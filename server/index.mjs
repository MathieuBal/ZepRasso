import express from 'express';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  EVENT_ID,
  clamp,
  computeAudit,
  defaultDb,
  bestTime,
  computeBetPayouts,
  computeBetTotalsByPilot,
  computeCategoryPools,
  computeFinanceSummary,
  computeLotteryStats,
  computePrizePool,
  computeRaceStandings,
  findExistingVote,
  isOwnVehicle,
  normalizeDb,
  normalizeLottery,
  normalizeLotteryEntry,
  normalizeParticipant,
  normalizeRace,
  normalizeRaceBet,
  normalizeRacePilot,
  normalizeVote,
  ownsVehicleByDevice,
  publicVote,
} from './lib.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
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
const LOG_FILE = join(DATA_DIR, 'server.log');
const LOG_MAX_BYTES = 2 * 1024 * 1024; // 2 Mo : on tronque par moitié au-delà

const PORT = Number(process.env.PORT) || 4173;
const ADMIN_CODE = process.env.ADMIN_CODE || 'zepadmin';
// URL publique stable (Tailscale Funnel, tunnel nommé Cloudflare, ngrok perso, etc.).
// Si elle est fournie, la page QR l'utilise au lieu de localhost / IP LAN.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '') || null;
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

// Append simple à data/server.log avec rotation par moitié quand on dépasse
// LOG_MAX_BYTES, pour qu'un event qui dure ne fasse pas exploser le fichier.
function logToFile(level, message) {
  try {
    const line = `${new Date().toISOString()} [${level}] ${message}\n`;
    if (existsSync(LOG_FILE)) {
      const size = statSync(LOG_FILE).size;
      if (size + line.length > LOG_MAX_BYTES) {
        const kept = readFileSync(LOG_FILE).slice(Math.floor(LOG_MAX_BYTES / 2));
        writeFileSync(LOG_FILE, kept);
      }
    }
    appendFileSync(LOG_FILE, line);
  } catch {
    // Si on n'arrive même pas à écrire le log, on ne fait rien : pas de boucle.
  }
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

// Aide la page QR à fabriquer un lien que les téléphones du même WiFi peuvent
// vraiment ouvrir (impossible si on encode "localhost"). On expose l'IP LAN
// vue par le serveur ; la page QR l'utilise quand l'admin est sur localhost.
app.get('/api/network', (_req, res) => {
  const ip = lanIp();
  res.json({
    lanIp: ip,
    port: PORT,
    lanUrl: ip && ip !== 'localhost' ? `http://${ip}:${PORT}` : null,
    publicUrl: PUBLIC_URL,
    behindTunnel: WANT_TUNNEL,
  });
});
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
  if (db.event.status !== 'voting') {
    res.status(403).json({ error: 'Les votes ne sont pas ouverts.' });
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
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) {
    res.status(404).json({ error: 'Véhicule introuvable.' });
    return;
  }
  // Anti-auto-vote : d'abord lié à l'appareil (robuste), puis fallback pseudo.
  if (ownsVehicleByDevice(vehicle, db.participants, voterId) || isOwnVehicle(vehicle, voterPseudo)) {
    res.status(403).json({ error: 'Tu ne peux pas voter pour ton propre véhicule.' });
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
  const existing = findExistingVote(db.votes, vehicleId, voterId, voterPseudo);
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

// Inscription au concours (public, uniquement en phase "registrations").
// Idempotent : un appareil déjà inscrit met juste à jour son pseudo/contact,
// son statut de paiement est préservé. On ne renvoie jamais le deviceToken ni
// les infos de contact dans la réponse.
app.post('/api/register', (req, res) => {
  if (db.event.status !== 'registrations') {
    res.status(403).json({ error: 'Les inscriptions ne sont pas ouvertes.' });
    return;
  }
  const body = req.body || {};
  const pseudo = String(body.pseudo || '').trim();
  const deviceToken = String(body.deviceToken || '').trim();
  if (!pseudo || !deviceToken) {
    res.status(400).json({ error: 'Pseudo requis.' });
    return;
  }
  const now = new Date().toISOString();
  const existing = db.participants.find((p) => p.deviceToken === deviceToken);
  if (existing) {
    existing.pseudo = pseudo;
    if (typeof body.contactInfo === 'string') {
      existing.contactInfo = body.contactInfo.trim() || undefined;
    }
    saveDb();
    res.json({ id: existing.id, pseudo: existing.pseudo, registered: true });
    return;
  }
  const participant = normalizeParticipant(
    { pseudo, deviceToken, contactInfo: body.contactInfo, registeredAt: now },
    now,
  );
  db.participants.push(participant);
  saveDb();
  res.json({ id: participant.id, pseudo: participant.pseudo, registered: true });
});

// Statut d'inscription de l'appareil appelant uniquement (le jeton est passé
// en query) : ne révèle aucune info sur les autres participants.
app.get('/api/register/status', (req, res) => {
  const token = String(req.query.deviceToken || '').trim();
  const me = token ? db.participants.find((p) => p.deviceToken === token) : null;
  res.json(me ? { registered: true, pseudo: me.pseudo, id: me.id } : { registered: false });
});

// Résumé de la cagnotte (public) : montants seulement, aucune donnée perso.
// Permet d'afficher l'enjeu sur le podium pour motiver les votes.
app.get('/api/prize', (_req, res) => {
  const paidCount = db.participants.filter((p) => p.hasPaid).length;
  const fee = db.event.entryFee || 0;
  res.json({ entryFee: fee, paidCount, ...computePrizePool(paidCount, fee) });
});

// Cagnottes par catégorie (public, montants + comptes seulement, aucune donnée
// perso). Permet d'afficher un podium et un pot par catégorie.
app.get('/api/categories', (_req, res) => {
  const fee = db.event.entryFee || 0;
  res.json({ entryFee: fee, categories: computeCategoryPools(db.vehicles, db.participants, fee) });
});

app.patch('/api/event', requireAdmin, (req, res) => {
  const body = req.body || {};
  if (typeof body.name === 'string' && body.name.trim()) {
    db.event.name = body.name.trim();
  }
  if (typeof body.status === 'string' && ['draft', 'registrations', 'voting', 'closed'].includes(body.status)) {
    db.event.status = body.status;
  }
  if (typeof body.entryFee === 'number' && Number.isFinite(body.entryFee) && body.entryFee >= 0) {
    db.event.entryFee = body.entryFee;
  }
  saveDb();
  res.json(db.event);
});

app.post('/api/vehicles', requireAdmin, (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  // Si un participant inscrit est fourni, le propriétaire est forcé à son
  // pseudo (lien cohérent). Sinon on garde le nom libre (cas manuel/legacy).
  const participantId = body.participantId ? String(body.participantId) : undefined;
  let linked = null;
  if (participantId) {
    linked = db.participants.find((p) => p.id === participantId);
    if (!linked) {
      res.status(400).json({ error: 'Participant introuvable.' });
      return;
    }
  }
  const ownerName = linked ? linked.pseudo : String(body.ownerName || '').trim();
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
    participantId: linked ? linked.id : undefined,
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

// Liste complète des inscrits (admin uniquement : contient contact + paiement).
app.get('/api/participants', requireAdmin, (_req, res) => {
  res.json(db.participants);
});

app.patch('/api/participants/:id', requireAdmin, (req, res) => {
  const participant = db.participants.find((p) => p.id === req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant introuvable.' });
    return;
  }
  const body = req.body || {};
  if (typeof body.hasPaid === 'boolean') participant.hasPaid = body.hasPaid;
  if (body.paymentMethod === 'cash' || body.paymentMethod === 'virement') {
    participant.paymentMethod = body.paymentMethod;
  } else if (body.paymentMethod === null || body.paymentMethod === '') {
    participant.paymentMethod = undefined;
  }
  if (typeof body.note === 'string') participant.note = body.note.trim() || undefined;
  if (typeof body.pseudo === 'string' && body.pseudo.trim()) {
    participant.pseudo = body.pseudo.trim();
    // Garder l'affichage du véhicule lié cohérent avec le pseudo.
    db.vehicles.forEach((v) => {
      if (v.participantId === participant.id) v.ownerName = participant.pseudo;
    });
  }
  if (typeof body.contactInfo === 'string') {
    participant.contactInfo = body.contactInfo.trim() || undefined;
  }
  saveDb();
  res.json(participant);
});

app.delete('/api/participants/:id', requireAdmin, (req, res) => {
  const index = db.participants.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Participant introuvable.' });
    return;
  }
  backupDb('avant-suppression-participant');
  // On ne supprime PAS les véhicules liés : le lien devient orphelin (toléré),
  // l'orga peut le réattribuer ou supprimer le véhicule séparément.
  db.participants.splice(index, 1);
  saveDb();
  res.json({ ok: true });
});

// ─── Loteries (toutes admin) ────────────────────────────────────────────────
// Chaque loterie a sa numérotation propre, qui ne se réutilise jamais (même
// après suppression d'une entry) pour éviter qu'un numéro recyclé crée de la
// confusion au moment du tirage / de l'export billes.

function nextEntryNumber(lotteryId) {
  let max = 0;
  for (const e of db.lotteryEntries) {
    if (e.lotteryId === lotteryId && e.entryNumber > max) max = e.entryNumber;
  }
  return max + 1;
}

app.get('/api/lotteries', requireAdmin, (_req, res) => {
  res.json(db.lotteries);
});

app.post('/api/lotteries', requireAdmin, (req, res) => {
  const body = req.body || {};
  let prizeImageUrl;
  try {
    prizeImageUrl = saveDataUrlPhoto(body.prizeImageUrl);
  } catch (err) {
    if (err instanceof PhotoRejected) { res.status(400).json({ error: err.message }); return; }
    throw err;
  }
  const lottery = normalizeLottery({
    name: body.name,
    prizeDescription: body.prizeDescription,
    prizeImageUrl,
    ticketPrice: body.ticketPrice,
    maxTicketsPerBuyer: body.maxTicketsPerBuyer,
    status: 'open',
  });
  if (!lottery) { res.status(400).json({ error: 'Nom de la loterie obligatoire.' }); return; }
  db.lotteries.push(lottery);
  saveDb();
  res.json(lottery);
});

app.patch('/api/lotteries/:id', requireAdmin, (req, res) => {
  const lottery = db.lotteries.find((l) => l.id === req.params.id);
  if (!lottery) { res.status(404).json({ error: 'Loterie introuvable.' }); return; }
  const body = req.body || {};
  if (typeof body.name === 'string' && body.name.trim()) lottery.name = body.name.trim();
  if (typeof body.prizeDescription === 'string') lottery.prizeDescription = body.prizeDescription.trim() || undefined;
  if (typeof body.ticketPrice === 'number' && body.ticketPrice >= 0) lottery.ticketPrice = Math.floor(body.ticketPrice);
  if (typeof body.maxTicketsPerBuyer === 'number' && body.maxTicketsPerBuyer >= 1) lottery.maxTicketsPerBuyer = Math.floor(body.maxTicketsPerBuyer);
  if (['open', 'closed', 'drawn'].includes(body.status)) lottery.status = body.status;
  if (typeof body.prizeImageUrl === 'string' && body.prizeImageUrl.startsWith('data:')) {
    try {
      const photo = saveDataUrlPhoto(body.prizeImageUrl);
      if (photo) {
        removePhoto(lottery.prizeImageUrl);
        lottery.prizeImageUrl = photo;
      }
    } catch (err) {
      if (err instanceof PhotoRejected) { res.status(400).json({ error: err.message }); return; }
      throw err;
    }
  }
  saveDb();
  res.json(lottery);
});

app.delete('/api/lotteries/:id', requireAdmin, (req, res) => {
  const index = db.lotteries.findIndex((l) => l.id === req.params.id);
  if (index === -1) { res.status(404).json({ error: 'Loterie introuvable.' }); return; }
  backupDb('avant-suppression-loterie');
  removePhoto(db.lotteries[index].prizeImageUrl);
  db.lotteries.splice(index, 1);
  // Cascade : les tickets de cette loterie n'ont plus de sens.
  db.lotteryEntries = db.lotteryEntries.filter((e) => e.lotteryId !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.get('/api/lotteries/:id/entries', requireAdmin, (req, res) => {
  const lottery = db.lotteries.find((l) => l.id === req.params.id);
  if (!lottery) { res.status(404).json({ error: 'Loterie introuvable.' }); return; }
  const entries = db.lotteryEntries.filter((e) => e.lotteryId === lottery.id)
    .sort((a, b) => a.entryNumber - b.entryNumber);
  res.json({ lottery, entries, stats: computeLotteryStats(entries, lottery.ticketPrice) });
});

app.post('/api/lotteries/:id/entries', requireAdmin, (req, res) => {
  const lottery = db.lotteries.find((l) => l.id === req.params.id);
  if (!lottery) { res.status(404).json({ error: 'Loterie introuvable.' }); return; }
  if (lottery.status !== 'open') { res.status(403).json({ error: 'Cette loterie n\'accepte plus de nouvelles inscriptions.' }); return; }
  const body = req.body || {};
  const ticketCount = Math.max(1, Math.floor(Number(body.ticketCount) || 1));
  if (ticketCount > lottery.maxTicketsPerBuyer) {
    res.status(400).json({ error: `Maximum ${lottery.maxTicketsPerBuyer} tickets par personne pour cette loterie.` });
    return;
  }
  const entry = normalizeLotteryEntry({
    lotteryId: lottery.id,
    entryNumber: nextEntryNumber(lottery.id),
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    ticketCount,
    hasPaid: body.hasPaid,
    paymentMethod: body.paymentMethod,
    note: body.note,
  });
  if (!entry) { res.status(400).json({ error: 'Nom et prénom obligatoires.' }); return; }
  db.lotteryEntries.push(entry);
  saveDb();
  res.json(entry);
});

app.patch('/api/lottery-entries/:id', requireAdmin, (req, res) => {
  const entry = db.lotteryEntries.find((e) => e.id === req.params.id);
  if (!entry) { res.status(404).json({ error: 'Ticket introuvable.' }); return; }
  const lottery = db.lotteries.find((l) => l.id === entry.lotteryId);
  const body = req.body || {};
  if (typeof body.firstName === 'string' && body.firstName.trim()) entry.firstName = body.firstName.trim();
  if (typeof body.lastName === 'string' && body.lastName.trim()) entry.lastName = body.lastName.trim();
  if (typeof body.phone === 'string') entry.phone = body.phone.trim() || undefined;
  if (typeof body.ticketCount === 'number' && body.ticketCount >= 1) {
    const max = lottery?.maxTicketsPerBuyer ?? 5;
    if (body.ticketCount > max) { res.status(400).json({ error: `Maximum ${max} tickets par personne.` }); return; }
    entry.ticketCount = Math.floor(body.ticketCount);
  }
  if (typeof body.hasPaid === 'boolean') entry.hasPaid = body.hasPaid;
  if (body.paymentMethod === 'cash' || body.paymentMethod === 'virement') entry.paymentMethod = body.paymentMethod;
  else if (body.paymentMethod === null || body.paymentMethod === '') entry.paymentMethod = undefined;
  if (typeof body.note === 'string') entry.note = body.note.trim() || undefined;
  saveDb();
  res.json(entry);
});

app.delete('/api/lottery-entries/:id', requireAdmin, (req, res) => {
  const idx = db.lotteryEntries.findIndex((e) => e.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Ticket introuvable.' }); return; }
  db.lotteryEntries.splice(idx, 1);
  saveDb();
  res.json({ ok: true });
});

// Fichier « une ligne par bille » pour le jeu de course de billes : une seule
// colonne « Participant NN » (numéro à 2 chiffres min, plus si besoin),
// répété autant de fois que la personne a de tickets payés. Aucun en-tête,
// le jeu lit chaque ligne comme un libellé de bille.
app.get('/api/lotteries/:id/marbles.csv', requireAdmin, (req, res) => {
  const lottery = db.lotteries.find((l) => l.id === req.params.id);
  if (!lottery) { res.status(404).json({ error: 'Loterie introuvable.' }); return; }
  const entries = db.lotteryEntries
    .filter((e) => e.lotteryId === lottery.id && e.hasPaid)
    .sort((a, b) => a.entryNumber - b.entryNumber);
  const maxNum = entries.reduce((m, e) => Math.max(m, e.entryNumber), 0);
  const width = Math.max(2, String(maxNum).length);
  const lines = [];
  for (const e of entries) {
    const label = `Participant ${String(e.entryNumber).padStart(width, '0')}`;
    for (let i = 0; i < e.ticketCount; i++) lines.push(label);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="loterie-${lottery.id}-billes.csv"`);
  res.send(lines.join('\n'));
});

// Tirage au sort serveur : pioche aléatoirement parmi les tickets PAYÉS.
// Sauvegarde le numéro gagnant sur la loterie et passe son statut à 'drawn'.
app.post('/api/lotteries/:id/draw', requireAdmin, (req, res) => {
  const lottery = db.lotteries.find((l) => l.id === req.params.id);
  if (!lottery) { res.status(404).json({ error: 'Loterie introuvable.' }); return; }
  if (lottery.status === 'drawn') { res.status(403).json({ error: 'Le tirage a déjà eu lieu.' }); return; }
  const pool = [];
  for (const e of db.lotteryEntries) {
    if (e.lotteryId !== lottery.id || !e.hasPaid) continue;
    for (let i = 0; i < e.ticketCount; i++) pool.push(e);
  }
  if (pool.length === 0) { res.status(400).json({ error: 'Aucun ticket payé : impossible de tirer.' }); return; }
  backupDb('avant-tirage-loterie');
  const winner = pool[Math.floor(Math.random() * pool.length)];
  lottery.winnerEntryNumber = winner.entryNumber;
  lottery.winnerEntryId = winner.id;
  lottery.status = 'drawn';
  saveDb();
  res.json({ winner });
});

// ─── Courses chronométrées (toutes admin) ───────────────────────────────────
// Modèle : 1 course → N pilotes → chaque pilote a un tableau de temps (1 par
// run, longueur = race.rounds). Le meilleur temps détermine le classement.

app.get('/api/races', requireAdmin, (_req, res) => {
  res.json(db.races);
});

app.post('/api/races', requireAdmin, (req, res) => {
  const race = normalizeRace({ ...(req.body || {}), status: 'open' });
  if (!race) { res.status(400).json({ error: 'Nom de la course obligatoire.' }); return; }
  db.races.push(race);
  saveDb();
  res.json(race);
});

app.patch('/api/races/:id', requireAdmin, (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  const body = req.body || {};
  if (typeof body.name === 'string' && body.name.trim()) race.name = body.name.trim();
  if (typeof body.description === 'string') race.description = body.description.trim() || undefined;
  if (typeof body.entryFee === 'number' && body.entryFee >= 0) race.entryFee = Math.floor(body.entryFee);
  if (typeof body.rounds === 'number' && body.rounds >= 1) race.rounds = Math.min(10, Math.floor(body.rounds));
  if (typeof body.orgaCutPercent === 'number' && body.orgaCutPercent >= 0 && body.orgaCutPercent <= 50) race.orgaCutPercent = body.orgaCutPercent;
  if (typeof body.betOrgaCutPercent === 'number' && body.betOrgaCutPercent >= 0 && body.betOrgaCutPercent <= 50) race.betOrgaCutPercent = body.betOrgaCutPercent;
  if (body.sequenceMode === 'sequential' || body.sequenceMode === 'alternating') race.sequenceMode = body.sequenceMode;
  if (['draft', 'open', 'running', 'finished'].includes(body.status)) race.status = body.status;
  if (['closed', 'open', 'locked'].includes(body.bettingStatus)) race.bettingStatus = body.bettingStatus;
  saveDb();
  res.json(race);
});

app.delete('/api/races/:id', requireAdmin, (req, res) => {
  const idx = db.races.findIndex((r) => r.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  backupDb('avant-suppression-course');
  db.races.splice(idx, 1);
  // Cascade : pilotes de cette course supprimés.
  db.racePilots = db.racePilots.filter((p) => p.raceId !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.get('/api/races/:id/pilots', requireAdmin, (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  const pilots = db.racePilots.filter((p) => p.raceId === race.id);
  const standings = computeRaceStandings(pilots);
  const paidCount = pilots.filter((p) => p.hasPaid).length;
  const prize = computePrizePool(paidCount, race.entryFee, race.orgaCutPercent);
  // Pour chaque pilote : meilleur temps, rang, total parié (mises payées).
  const bets = db.raceBets.filter((b) => b.raceId === race.id);
  const totalsByPilot = computeBetTotalsByPilot(bets);
  const withMeta = standings.map((p, i) => {
    const t = totalsByPilot.get(p.id) || { totalAmount: 0, bettors: 0 };
    return { ...p, bestTime: bestTime(p), rank: bestTime(p) === null ? null : i + 1, paidStake: t.totalAmount, bettors: t.bettors };
  });
  const betPayouts = computeBetPayouts(bets, race.winnerPilotId, race.betOrgaCutPercent);
  res.json({ race, pilots: withMeta, prize, paidCount, totalPilots: pilots.length, betPayouts });
});

app.post('/api/races/:id/pilots', requireAdmin, (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  const body = req.body || {};
  const pilot = normalizeRacePilot({
    raceId: race.id,
    pseudo: body.pseudo,
    vehicle: body.vehicle,
    hasPaid: body.hasPaid,
    paymentMethod: body.paymentMethod,
    note: body.note,
    // On initialise un tableau de la bonne longueur (rounds), rempli de null.
    times: Array.from({ length: race.rounds }, () => null),
  });
  if (!pilot) { res.status(400).json({ error: 'Pseudo du pilote obligatoire.' }); return; }
  db.racePilots.push(pilot);
  saveDb();
  res.json(pilot);
});

app.patch('/api/race-pilots/:id', requireAdmin, (req, res) => {
  const pilot = db.racePilots.find((p) => p.id === req.params.id);
  if (!pilot) { res.status(404).json({ error: 'Pilote introuvable.' }); return; }
  const race = db.races.find((r) => r.id === pilot.raceId);
  const body = req.body || {};
  if (typeof body.pseudo === 'string' && body.pseudo.trim()) pilot.pseudo = body.pseudo.trim();
  if (typeof body.vehicle === 'string') pilot.vehicle = body.vehicle.trim() || undefined;
  if (typeof body.hasPaid === 'boolean') pilot.hasPaid = body.hasPaid;
  if (body.paymentMethod === 'cash' || body.paymentMethod === 'virement') pilot.paymentMethod = body.paymentMethod;
  else if (body.paymentMethod === null || body.paymentMethod === '') pilot.paymentMethod = undefined;
  if (typeof body.note === 'string') pilot.note = body.note.trim() || undefined;
  // Maj d'un temps précis : { roundIndex: 0..n-1, timeMs: number|null }
  if (typeof body.roundIndex === 'number' && body.roundIndex >= 0) {
    const idx = Math.floor(body.roundIndex);
    const max = race?.rounds ?? pilot.times.length;
    if (idx >= max) { res.status(400).json({ error: `Cette course n'a que ${max} tours.` }); return; }
    // S'assurer que le tableau a la bonne taille (au cas où race.rounds a été augmenté).
    while (pilot.times.length < max) pilot.times.push(null);
    const v = body.timeMs;
    if (v === null) pilot.times[idx] = null;
    else if (Number.isFinite(Number(v)) && Number(v) >= 0) pilot.times[idx] = Math.floor(Number(v));
    else { res.status(400).json({ error: 'Temps invalide.' }); return; }
  }
  // Remplacement complet de times (utile pour reset)
  if (Array.isArray(body.times)) {
    pilot.times = body.times.map((t) => (Number.isFinite(Number(t)) && Number(t) >= 0 ? Math.floor(Number(t)) : null));
  }
  saveDb();
  res.json(pilot);
});

app.delete('/api/race-pilots/:id', requireAdmin, (req, res) => {
  const idx = db.racePilots.findIndex((p) => p.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Pilote introuvable.' }); return; }
  db.racePilots.splice(idx, 1);
  saveDb();
  res.json({ ok: true });
});

// ─── Paris sur les courses ──────────────────────────────────────────────────
// Seuls les paris PAYÉS rentrent dans le pot. Le vainqueur d'un pari est
// défini par la déclaration du vainqueur de la course (POST .../winner).

// Endpoint PUBLIC pour la page de paris : ne renvoie que les infos utiles aux
// parieurs (jamais le détail des paris ni de données admin).
app.get('/api/races/:id/public', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  const pilots = db.racePilots
    .filter((p) => p.raceId === race.id)
    .map((p) => ({ id: p.id, pseudo: p.pseudo, vehicle: p.vehicle }));
  const bets = db.raceBets.filter((b) => b.raceId === race.id);
  const totalsByPilot = {};
  for (const b of bets) {
    if (!b.hasPaid) continue;
    if (!totalsByPilot[b.pilotId]) totalsByPilot[b.pilotId] = 0;
    totalsByPilot[b.pilotId] += b.amount;
  }
  res.json({
    race: {
      id: race.id,
      name: race.name,
      description: race.description,
      status: race.status,
      bettingStatus: race.bettingStatus,
      betOrgaCutPercent: race.betOrgaCutPercent,
      winnerPilotId: race.winnerPilotId,
    },
    pilots,
    totalsByPilot,
  });
});

// Soumission publique de pari : créé en hasPaid=false (l'orga valide ensuite).
// Gated par bettingStatus === 'open'.
app.post('/api/races/:id/bets-public', (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  if (race.bettingStatus !== 'open') { res.status(403).json({ error: 'Les paris ne sont pas ouverts pour cette course.' }); return; }
  const body = req.body || {};
  const pilot = db.racePilots.find((p) => p.id === String(body.pilotId || '') && p.raceId === race.id);
  if (!pilot) { res.status(400).json({ error: 'Pilote introuvable.' }); return; }
  const bet = normalizeRaceBet({
    raceId: race.id,
    bettorPseudo: body.bettorPseudo,
    voterId: body.voterId,
    pilotId: pilot.id,
    amount: body.amount,
    hasPaid: false, // toujours en attente côté public
  });
  if (!bet) { res.status(400).json({ error: 'Pseudo et mise > 0 obligatoires.' }); return; }
  db.raceBets.push(bet);
  saveDb();
  // Réponse minimale, sans IP ni metadata interne.
  res.json({ id: bet.id, pilotId: bet.pilotId, amount: bet.amount, bettorPseudo: bet.bettorPseudo, hasPaid: false });
});

app.get('/api/races/:id/bets', requireAdmin, (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  const bets = db.raceBets.filter((b) => b.raceId === race.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(bets);
});

app.post('/api/races/:id/bets', requireAdmin, (req, res) => {
  // Admin-side bet entry (V1) : l'orga rentre les paris à mesure que les gens
  // viennent miser. Plus tard on pourra ajouter une route publique gated par
  // race.bettingStatus === 'open'.
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  if (race.status === 'finished') { res.status(403).json({ error: 'La course est terminée, plus de paris possibles.' }); return; }
  const body = req.body || {};
  const pilot = db.racePilots.find((p) => p.id === String(body.pilotId || '') && p.raceId === race.id);
  if (!pilot) { res.status(400).json({ error: 'Pilote introuvable pour cette course.' }); return; }
  const bet = normalizeRaceBet({
    raceId: race.id,
    bettorPseudo: body.bettorPseudo,
    pilotId: pilot.id,
    amount: body.amount,
    hasPaid: body.hasPaid,
    paymentMethod: body.paymentMethod,
    note: body.note,
  });
  if (!bet) { res.status(400).json({ error: 'Pseudo du parieur, pilote et mise > 0 obligatoires.' }); return; }
  db.raceBets.push(bet);
  saveDb();
  res.json(bet);
});

app.patch('/api/race-bets/:id', requireAdmin, (req, res) => {
  const bet = db.raceBets.find((b) => b.id === req.params.id);
  if (!bet) { res.status(404).json({ error: 'Pari introuvable.' }); return; }
  const body = req.body || {};
  if (typeof body.bettorPseudo === 'string' && body.bettorPseudo.trim()) bet.bettorPseudo = body.bettorPseudo.trim();
  if (typeof body.amount === 'number' && body.amount > 0) bet.amount = Math.floor(body.amount);
  if (typeof body.pilotId === 'string') {
    const p = db.racePilots.find((rp) => rp.id === body.pilotId && rp.raceId === bet.raceId);
    if (p) bet.pilotId = p.id;
  }
  if (typeof body.hasPaid === 'boolean') bet.hasPaid = body.hasPaid;
  if (body.paymentMethod === 'cash' || body.paymentMethod === 'virement') bet.paymentMethod = body.paymentMethod;
  else if (body.paymentMethod === null || body.paymentMethod === '') bet.paymentMethod = undefined;
  if (typeof body.note === 'string') bet.note = body.note.trim() || undefined;
  saveDb();
  res.json(bet);
});

app.delete('/api/race-bets/:id', requireAdmin, (req, res) => {
  const idx = db.raceBets.findIndex((b) => b.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Pari introuvable.' }); return; }
  db.raceBets.splice(idx, 1);
  saveDb();
  res.json({ ok: true });
});

// Déclaration du vainqueur : verrouille les paris (bettingStatus='locked'),
// passe la course à 'finished' et permet le calcul définitif des gains.
app.post('/api/races/:id/winner', requireAdmin, (req, res) => {
  const race = db.races.find((r) => r.id === req.params.id);
  if (!race) { res.status(404).json({ error: 'Course introuvable.' }); return; }
  const winnerPilotId = String((req.body || {}).pilotId || '').trim() || undefined;
  if (winnerPilotId) {
    const pilot = db.racePilots.find((p) => p.id === winnerPilotId && p.raceId === race.id);
    if (!pilot) { res.status(400).json({ error: 'Pilote introuvable.' }); return; }
  }
  backupDb('avant-declaration-vainqueur-course');
  race.winnerPilotId = winnerPilotId;
  race.status = 'finished';
  race.bettingStatus = 'locked';
  saveDb();
  const bets = db.raceBets.filter((b) => b.raceId === race.id);
  res.json({ race, betPayouts: computeBetPayouts(bets, winnerPilotId, race.betOrgaCutPercent) });
});

app.get('/api/admin/audit', requireAdmin, (_req, res) => {
  res.json(computeAudit(db.votes));
});

// Récap financier de toute la soirée (concours + loteries + courses + paris).
app.get('/api/admin/finance', requireAdmin, (_req, res) => {
  res.json(computeFinanceSummary(db));
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: Math.floor(process.uptime()) });
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
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 400 && status < 500) {
    if (!res.headersSent) res.status(status).json({ error: 'Requête invalide.' });
    return;
  }
  console.error('  Erreur serveur :', err.message);
  logToFile('ERROR', `${req.method} ${req.originalUrl || req.url} — ${err.stack || err.message}`);
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

function resolveCloudflared() {
  // 1) chemin explicite, 2) binaire telecharge dans ./bin (script npm
  // "tunnel:install"), 3) cloudflared installe globalement (PATH).
  if (process.env.CLOUDFLARED_PATH) return process.env.CLOUDFLARED_PATH;
  const localName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const localBin = join(ROOT, 'bin', localName);
  if (existsSync(localBin)) return localBin;
  return 'cloudflared';
}

function startTunnel() {
  if (ADMIN_CODE === 'zepadmin') {
    console.warn('\n  /!\\ Le code admin est encore "zepadmin" alors que l\'app va etre publique.');
    console.warn('      Mets ton code dans le fichier .env avant de partager.\n');
  }
  console.log('  Ouverture du tunnel public (cloudflared)...');
  const child = spawn(resolveCloudflared(), ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
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
  console.log(`  Journal    : data/server.log (erreurs + demarrages)`);
  console.log(`  IP source  : ${TRUST_PROXY ? 'en-tetes proxy (CF-Connecting-IP / X-Forwarded-For)' : 'socket TCP direct'}`);
  console.log('  Ctrl+C pour arreter.');
  logToFile('INFO', `start port=${PORT} tunnel=${WANT_TUNNEL ? 'on' : 'off'} trustProxy=${TRUST_PROXY ? 'on' : 'off'}`);
  if (WANT_TUNNEL) startTunnel();
  else console.log('  Pour rendre l\'app accessible a distance : npm run share\n');
});
