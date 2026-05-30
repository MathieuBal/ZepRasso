import express from 'express';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  readdirSync,
} from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_DIR = join(ROOT, 'dist');
const DATA_DIR = join(ROOT, 'data');
const PHOTOS_DIR = join(DATA_DIR, 'photos');
const BACKUPS_DIR = join(DATA_DIR, 'backups');
const DB_FILE = join(DATA_DIR, 'db.json');

const PORT = Number(process.env.PORT) || 4173;
const ADMIN_CODE = process.env.ADMIN_CODE || 'zepadmin';
const EVENT_ID = 'rasso';
const WANT_TUNNEL = process.argv.includes('--tunnel') || process.env.TUNNEL === '1';
// Quand on est derrière le tunnel cloudflared on doit croire les en-têtes
// X-Forwarded-For / CF-Connecting-IP pour identifier la vraie IP. En accès
// direct (LAN) on ne le fait surtout pas, sinon n'importe qui peut spoofer
// son IP et fausser l'audit anti-triche.
const TRUST_PROXY = WANT_TUNNEL || process.env.TRUST_PROXY === '1';
const MAX_BACKUPS = 40;
const BACKUP_DEBOUNCE_MS = 15 * 1000;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 Mo après décodage base64
const JSON_BODY_LIMIT = '5mb';
const ADMIN_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 min
const ADMIN_RATE_MAX_FAILURES = 10;

mkdirSync(PHOTOS_DIR, { recursive: true });
mkdirSync(BACKUPS_DIR, { recursive: true });

const clamp = (value) => Math.min(10, Math.max(0, Math.round(Number(value) || 0)));

function defaultDb() {
  return {
    event: {
      id: EVENT_ID,
      name: 'ZepRasso - Car Meet RP',
      status: 'open',
      createdAt: new Date().toISOString(),
    },
    vehicles: [],
    votes: [],
  };
}

function normalizeVehicle(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  const ownerName = String(raw.ownerName || '').trim();
  if (!name || !ownerName) return null;
  return {
    id: String(raw.id || randomUUID()),
    eventId: EVENT_ID,
    name,
    ownerName,
    category: String(raw.category || '').trim(),
    plate: raw.plate ? String(raw.plate).trim() : undefined,
    imageUrl: typeof raw.imageUrl === 'string' && raw.imageUrl ? raw.imageUrl : undefined,
    description: raw.description ? String(raw.description).trim() : undefined,
    isContestant: raw.isContestant !== false,
    isDisqualified: Boolean(raw.isDisqualified),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

function normalizeVote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const voterPseudo = String(raw.voterPseudo || '').trim();
  const vehicleId = String(raw.vehicleId || '');
  if (!voterPseudo || !vehicleId) return null;
  const now = new Date().toISOString();
  return {
    id: String(raw.id || randomUUID()),
    eventId: EVENT_ID,
    vehicleId,
    voterId: raw.voterId ? String(raw.voterId) : undefined,
    voterPseudo,
    aesthetics: clamp(raw.aesthetics),
    coherence: clamp(raw.coherence),
    originality: clamp(raw.originality),
    details: clamp(raw.details),
    rpPresentation: clamp(raw.rpPresentation),
    ip: raw.ip ? String(raw.ip) : undefined,
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
  };
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const cf = req.get('cf-connecting-ip');
    if (cf) return cf.trim();
    const xff = req.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || '';
}

function safeCodeMatch(provided) {
  const want = Buffer.from(ADMIN_CODE, 'utf8');
  const got = Buffer.from(String(provided ?? ''), 'utf8');
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}

// Limiteur d'essais d'authentification admin par IP. Fenêtre glissante simple
// (Map IP -> [{ts}]); après ADMIN_RATE_MAX_FAILURES dans ADMIN_RATE_WINDOW_MS,
// on renvoie 429 jusqu'à ce que la fenêtre se vide.
const adminFailures = new Map();
function checkAdminRate(ip) {
  if (!ip) return { ok: true, retryAfterMs: 0 };
  const now = Date.now();
  const recent = (adminFailures.get(ip) || []).filter((ts) => now - ts < ADMIN_RATE_WINDOW_MS);
  adminFailures.set(ip, recent);
  if (recent.length >= ADMIN_RATE_MAX_FAILURES) {
    const retryAfterMs = ADMIN_RATE_WINDOW_MS - (now - recent[0]);
    return { ok: false, retryAfterMs };
  }
  return { ok: true, retryAfterMs: 0 };
}
function noteAdminFailure(ip) {
  if (!ip) return;
  const arr = adminFailures.get(ip) || [];
  arr.push(Date.now());
  adminFailures.set(ip, arr);
}
function clearAdminFailures(ip) {
  if (ip) adminFailures.delete(ip);
}

function publicVote(vote) {
  const { voterId, ip, ...rest } = vote;
  return rest;
}

function normalizeDb(parsed) {
  const base = defaultDb();
  const event = parsed && typeof parsed.event === 'object' && parsed.event ? parsed.event : base.event;
  const vehicles = Array.isArray(parsed?.vehicles)
    ? parsed.vehicles.map(normalizeVehicle).filter(Boolean)
    : [];
  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  const votes = Array.isArray(parsed?.votes)
    ? parsed.votes.map(normalizeVote).filter((vote) => vote && vehicleIds.has(vote.vehicleId))
    : [];
  return {
    event: {
      id: EVENT_ID,
      name: String(event.name || base.event.name).trim() || base.event.name,
      status: ['open', 'closed', 'draft'].includes(event.status) ? event.status : 'open',
      createdAt: String(event.createdAt || base.event.createdAt),
    },
    vehicles,
    votes,
  };
}

let db;
let revision = 0;
let lastBackupRevision = -1;
let backupTimer = null;

function serialize() {
  return JSON.stringify(db, null, 2);
}

function scheduleBackup() {
  if (backupTimer) return;
  backupTimer = setTimeout(() => {
    backupTimer = null;
    if (revision !== lastBackupRevision) backupDb('auto');
  }, BACKUP_DEBOUNCE_MS);
  backupTimer.unref?.();
}

function saveDb() {
  const tmp = `${DB_FILE}.tmp`;
  writeFileSync(tmp, serialize());
  renameSync(tmp, DB_FILE);
  revision += 1;
  scheduleBackup();
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function listBackups() {
  try {
    return readdirSync(BACKUPS_DIR)
      .filter((file) => file.startsWith('db-') && file.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
}

function pruneBackups() {
  const files = listBackups();
  for (let i = 0; i < files.length - MAX_BACKUPS; i += 1) {
    try {
      unlinkSync(join(BACKUPS_DIR, files[i]));
    } catch {
      // fichier déjà retiré, on ignore
    }
  }
}

function backupDb(reason) {
  try {
    writeFileSync(join(BACKUPS_DIR, `db-${stamp()}.json`), serialize());
    lastBackupRevision = revision;
    pruneBackups();
  } catch (err) {
    console.warn(`  Sauvegarde auto impossible (${reason}) : ${err.message}`);
  }
}

function recoverFromLatestBackup() {
  const files = listBackups();
  if (files.length === 0) return null;
  try {
    const newest = files[files.length - 1];
    return normalizeDb(JSON.parse(readFileSync(join(BACKUPS_DIR, newest), 'utf8')));
  } catch {
    return null;
  }
}

function loadDb() {
  if (!existsSync(DB_FILE)) {
    db = defaultDb();
    saveDb();
    return;
  }
  try {
    db = normalizeDb(JSON.parse(readFileSync(DB_FILE, 'utf8')));
  } catch (err) {
    const corruptPath = join(DATA_DIR, `db.corrupt-${stamp()}.json`);
    try {
      renameSync(DB_FILE, corruptPath);
    } catch {
      // on n'a pas pu deplacer le fichier, on continue quand meme
    }
    const recovered = recoverFromLatestBackup();
    if (recovered) {
      db = recovered;
      console.warn(`\n  /!\\ db.json illisible (${err.message}).`);
      console.warn(`      Fichier corrompu mis de cote : ${corruptPath}`);
      console.warn('      Donnees restaurees depuis la derniere sauvegarde automatique.\n');
    } else {
      db = defaultDb();
      console.warn(`\n  /!\\ db.json illisible (${err.message}) et aucune sauvegarde disponible.`);
      console.warn(`      Fichier corrompu mis de cote : ${corruptPath}`);
      console.warn('      Redemarrage avec une base vide.\n');
    }
    saveDb();
  }
}

loadDb();
backupDb('demarrage');

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

class PhotoRejected extends Error {
  constructor(message) { super(message); this.name = 'PhotoRejected'; this.status = 400; }
}

function saveDataUrlPhoto(imageUrl) {
  if (typeof imageUrl !== 'string' || imageUrl === '') return undefined;
  if (!imageUrl.startsWith('data:')) return imageUrl;
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(imageUrl);
  if (!match) throw new PhotoRejected('Image illisible.');
  const ext = MIME_EXT[match[1]];
  // Whitelist stricte : pas de fallback silencieux, refus explicite des SVG
  // (qui peuvent embarquer du JS) et de tout type inconnu.
  if (!ext) throw new PhotoRejected('Format d\'image non supporté (JPEG, PNG, WEBP ou GIF uniquement).');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new PhotoRejected('Image vide.');
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new PhotoRejected(`Image trop lourde (max ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} Mo).`);
  }
  const name = `${randomUUID()}.${ext}`;
  writeFileSync(join(PHOTOS_DIR, name), buffer);
  return `/photos/${name}`;
}

function removePhoto(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('/photos/')) return;
  const name = imageUrl.slice('/photos/'.length);
  if (name.includes('/') || name.includes('..')) return;
  try {
    unlinkSync(join(PHOTOS_DIR, name));
  } catch {
    // photo déjà absente, on ignore
  }
}

const app = express();
app.use(express.json({ limit: JSON_BODY_LIMIT }));

function rejectAdmin(req, res, message) {
  const ip = clientIp(req);
  noteAdminFailure(ip);
  const { retryAfterMs } = checkAdminRate(ip);
  if (retryAfterMs > 0) {
    res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
    res.status(429).json({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' });
    return;
  }
  res.status(401).json({ error: message });
}

function requireAdmin(req, res, next) {
  const ip = clientIp(req);
  const gate = checkAdminRate(ip);
  if (!gate.ok) {
    res.setHeader('Retry-After', Math.ceil(gate.retryAfterMs / 1000));
    res.status(429).json({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' });
    return;
  }
  if (!safeCodeMatch(req.get('x-admin-code') || '')) {
    rejectAdmin(req, res, 'Code organisateur invalide.');
    return;
  }
  clearAdminFailures(ip);
  next();
}

app.get('/api/event', (_req, res) => res.json(db.event));
app.get('/api/vehicles', (_req, res) => res.json(db.vehicles));
app.get('/api/votes', (_req, res) => res.json(db.votes.map(publicVote)));

app.post('/api/admin/login', (req, res) => {
  const ip = clientIp(req);
  const gate = checkAdminRate(ip);
  if (!gate.ok) {
    res.setHeader('Retry-After', Math.ceil(gate.retryAfterMs / 1000));
    res.status(429).json({ error: 'Trop de tentatives. Réessaie dans quelques minutes.' });
    return;
  }
  if (!safeCodeMatch(req.body?.code || '')) {
    rejectAdmin(req, res, 'Code organisateur incorrect.');
    return;
  }
  clearAdminFailures(ip);
  res.json({ ok: true });
});

app.post('/api/votes', (req, res) => {
  if (db.event.status === 'closed') {
    res.status(403).json({ error: 'Les votes sont fermés.' });
    return;
  }
  const body = req.body || {};
  const voterPseudo = String(body.voterPseudo || '').trim();
  const vehicleId = String(body.vehicleId || '');
  const voterId = String(body.voterId || '').trim();
  if (!voterPseudo || !vehicleId) {
    res.status(400).json({ error: 'Pseudo et véhicule requis.' });
    return;
  }
  if (!db.vehicles.some((vehicle) => vehicle.id === vehicleId)) {
    res.status(404).json({ error: 'Véhicule introuvable.' });
    return;
  }
  const scores = {
    aesthetics: clamp(body.aesthetics),
    coherence: clamp(body.coherence),
    originality: clamp(body.originality),
    details: clamp(body.details),
    rpPresentation: clamp(body.rpPresentation),
  };
  const now = new Date().toISOString();
  const ip = clientIp(req);
  // Une voix par appareil (voterId) et par véhicule : changer de pseudo ne permet pas de revoter.
  const existing = db.votes.find((vote) =>
    vote.vehicleId === vehicleId &&
    (voterId ? vote.voterId === voterId : vote.voterPseudo.toLowerCase() === voterPseudo.toLowerCase()),
  );
  if (existing) {
    Object.assign(existing, scores, { updatedAt: now, voterPseudo, ip });
    if (voterId) existing.voterId = voterId;
  } else {
    db.votes.push({
      id: randomUUID(),
      eventId: EVENT_ID,
      vehicleId,
      voterId: voterId || undefined,
      voterPseudo,
      ...scores,
      ip,
      createdAt: now,
      updatedAt: now,
    });
  }
  saveDb();
  res.json({ ok: true });
});

app.patch('/api/event', requireAdmin, (req, res) => {
  const body = req.body || {};
  if (typeof body.name === 'string' && body.name.trim()) {
    db.event.name = body.name.trim();
  }
  if (typeof body.status === 'string' && ['open', 'closed'].includes(body.status)) {
    db.event.status = body.status;
  }
  saveDb();
  res.json(db.event);
});

app.post('/api/vehicles', requireAdmin, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const ownerName = String(body.ownerName || '').trim();
  if (!name || !ownerName) {
    res.status(400).json({ error: 'Nom du véhicule et propriétaire sont obligatoires.' });
    return;
  }
  let storedPhoto;
  try {
    storedPhoto = saveDataUrlPhoto(body.imageUrl);
  } catch (err) {
    if (err instanceof PhotoRejected) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  const vehicle = {
    id: randomUUID(),
    eventId: EVENT_ID,
    name,
    ownerName,
    category: String(body.category || '').trim(),
    plate: body.plate ? String(body.plate).trim() : undefined,
    imageUrl: storedPhoto,
    description: body.description ? String(body.description).trim() : undefined,
    isContestant: body.isContestant !== false,
    isDisqualified: Boolean(body.isDisqualified),
    createdAt: new Date().toISOString(),
  };
  db.vehicles.push(vehicle);
  saveDb();
  res.json(vehicle);
});

app.patch('/api/vehicles/:id', requireAdmin, (req, res) => {
  const vehicle = db.vehicles.find((item) => item.id === req.params.id);
  if (!vehicle) {
    res.status(404).json({ error: 'Véhicule introuvable.' });
    return;
  }
  if (typeof req.body?.isDisqualified === 'boolean') {
    vehicle.isDisqualified = req.body.isDisqualified;
  }
  saveDb();
  res.json(vehicle);
});

app.delete('/api/vehicles/:id', requireAdmin, (req, res) => {
  const index = db.vehicles.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Véhicule introuvable.' });
    return;
  }
  backupDb('avant-suppression-vehicule');
  removePhoto(db.vehicles[index].imageUrl);
  db.vehicles.splice(index, 1);
  db.votes = db.votes.filter((vote) => vote.vehicleId !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.delete('/api/votes', requireAdmin, (_req, res) => {
  backupDb('avant-reset-votes');
  db.votes = [];
  saveDb();
  res.json({ ok: true });
});

app.get('/api/admin/audit', requireAdmin, (_req, res) => {
  const votersByIp = new Map();
  const pseudosByIp = new Map();
  const votersByPseudo = new Map();
  const voters = new Set();
  const ips = new Set();
  for (const vote of db.votes) {
    const voterId = vote.voterId || `vote-${vote.id}`;
    voters.add(voterId);
    if (vote.ip) {
      ips.add(vote.ip);
      if (!votersByIp.has(vote.ip)) {
        votersByIp.set(vote.ip, new Set());
        pseudosByIp.set(vote.ip, new Set());
      }
      votersByIp.get(vote.ip).add(voterId);
      pseudosByIp.get(vote.ip).add(vote.voterPseudo);
    }
    const key = vote.voterPseudo.toLowerCase();
    if (!votersByPseudo.has(key)) votersByPseudo.set(key, { pseudo: vote.voterPseudo, voters: new Set() });
    votersByPseudo.get(key).voters.add(voterId);
  }
  const sharedIps = [...votersByIp.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([ip, set]) => ({ ip, voters: set.size, pseudos: [...pseudosByIp.get(ip)] }))
    .sort((a, b) => b.voters - a.voters);
  const reusedPseudos = [...votersByPseudo.values()]
    .filter((entry) => entry.voters.size > 1)
    .map((entry) => ({ pseudo: entry.pseudo, devices: entry.voters.size }))
    .sort((a, b) => b.devices - a.devices);
  res.json({
    totalVotes: db.votes.length,
    distinctVoters: voters.size,
    distinctIps: ips.size,
    sharedIps,
    reusedPseudos,
  });
});

app.get('/api/admin/backup', requireAdmin, (_req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="zeprasso-sauvegarde-${stamp()}.json"`);
  res.send(serialize());
});

app.post('/api/admin/restore', requireAdmin, (req, res) => {
  const body = req.body;
  const looksValid =
    body && typeof body === 'object' && (Array.isArray(body.vehicles) || Array.isArray(body.votes) || body.event);
  if (!looksValid) {
    res.status(400).json({ error: 'Fichier de sauvegarde invalide.' });
    return;
  }
  backupDb('avant-restauration');
  db = normalizeDb(body);
  saveDb();
  res.json({ ok: true, vehicles: db.vehicles.length, votes: db.votes.length });
});

app.use('/photos', express.static(PHOTOS_DIR));
app.use(express.static(DIST_DIR));

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(join(DIST_DIR, 'index.html'));
    return;
  }
  res.status(404).json({ error: 'Introuvable.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 400 && status < 500) {
    if (!res.headersSent) res.status(status).json({ error: 'Requête invalide.' });
    return;
  }
  console.error('  Erreur serveur :', err.message);
  if (!res.headersSent) res.status(500).json({ error: 'Erreur interne du serveur.' });
});

function lanIp() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

function startTunnel() {
  if (ADMIN_CODE === 'zepadmin') {
    console.warn('\n  /!\\ Le code admin est encore "zepadmin" alors que l\'app va etre publique.');
    console.warn('      Relance avec : ADMIN_CODE="ton-code" npm run share\n');
  }
  console.log('  Ouverture du tunnel public (cloudflared)...');
  const child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let announced = false;
  const scan = (chunk) => {
    const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk));
    if (match && !announced) {
      announced = true;
      console.log('\n  ====================================================');
      console.log('   Lien public a partager (Discord, etc.) :');
      console.log(`   ${match[0]}`);
      console.log('  ====================================================');
      console.log('   Tant que cette fenetre reste ouverte, le lien marche.\n');
    }
  };
  child.stdout.on('data', scan);
  child.stderr.on('data', scan);
  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('\n  cloudflared introuvable. Installe-le une fois, puis relance "npm run share".');
      console.error('    macOS    : brew install cloudflared');
      console.error('    Windows  : winget install --id Cloudflare.cloudflared');
      console.error('    Linux    : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
      console.error('\n  En attendant, l\'app reste accessible en local sur ce PC.\n');
    } else {
      console.error(`  Tunnel: ${err.message}`);
    }
  });
  const stop = () => {
    child.kill();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (!existsSync(join(DIST_DIR, 'index.html'))) {
  console.warn('\n  Attention : le dossier dist/ est vide. Lance "npm run build" avant, ou utilise "npm start".\n');
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = lanIp();
  console.log('\n  ZepRasso tourne en local');
  console.log(`  Sur ce PC    : http://localhost:${PORT}`);
  console.log(`  Meme WiFi    : http://${ip}:${PORT}`);
  console.log(`  Code admin   : ${ADMIN_CODE}`);
  console.log('\n  Donnees    : data/db.json');
  console.log(`  Sauvegardes: data/backups/ (auto apres chaque changement, ${MAX_BACKUPS} max)`);
  console.log(`  IP source  : ${TRUST_PROXY ? 'en-tetes proxy (CF-Connecting-IP / X-Forwarded-For)' : 'socket TCP direct'}`);
  console.log('  Ctrl+C pour arreter.');
  if (WANT_TUNNEL) startTunnel();
  else console.log('  Pour rendre l\'app accessible a distance : npm run share\n');
});
