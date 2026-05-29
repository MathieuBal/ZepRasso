import express from 'express';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
const MAX_BACKUPS = 40;
const BACKUP_DEBOUNCE_MS = 15 * 1000;

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
    voterPseudo,
    aesthetics: clamp(raw.aesthetics),
    coherence: clamp(raw.coherence),
    originality: clamp(raw.originality),
    details: clamp(raw.details),
    rpPresentation: clamp(raw.rpPresentation),
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
  };
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

function saveDataUrlPhoto(imageUrl) {
  if (typeof imageUrl !== 'string' || imageUrl === '') return undefined;
  if (!imageUrl.startsWith('data:')) return imageUrl;
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(imageUrl);
  if (!match) return undefined;
  const ext = MIME_EXT[match[1]] || 'jpg';
  const name = `${randomUUID()}.${ext}`;
  writeFileSync(join(PHOTOS_DIR, name), Buffer.from(match[2], 'base64'));
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
app.use(express.json({ limit: '12mb' }));

function requireAdmin(req, res, next) {
  if ((req.get('x-admin-code') || '') !== ADMIN_CODE) {
    res.status(401).json({ error: 'Code organisateur invalide.' });
    return;
  }
  next();
}

app.get('/api/event', (_req, res) => res.json(db.event));
app.get('/api/vehicles', (_req, res) => res.json(db.vehicles));
app.get('/api/votes', (_req, res) => res.json(db.votes));

app.post('/api/admin/login', (req, res) => {
  if ((req.body?.code || '') !== ADMIN_CODE) {
    res.status(401).json({ error: 'Code organisateur incorrect.' });
    return;
  }
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
  const existing = db.votes.find(
    (vote) => vote.vehicleId === vehicleId && vote.voterPseudo.toLowerCase() === voterPseudo.toLowerCase(),
  );
  if (existing) {
    Object.assign(existing, scores, { updatedAt: now });
  } else {
    db.votes.push({
      id: randomUUID(),
      eventId: EVENT_ID,
      vehicleId,
      voterPseudo,
      ...scores,
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
  const vehicle = {
    id: randomUUID(),
    eventId: EVENT_ID,
    name,
    ownerName,
    category: String(body.category || '').trim(),
    plate: body.plate ? String(body.plate).trim() : undefined,
    imageUrl: saveDataUrlPhoto(body.imageUrl),
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
  console.log('  Ctrl+C pour arreter.');
  if (WANT_TUNNEL) startTunnel();
  else console.log('  Pour rendre l\'app accessible a distance : npm run share\n');
});
