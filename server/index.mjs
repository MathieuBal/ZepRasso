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
} from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_DIR = join(ROOT, 'dist');
const DATA_DIR = join(ROOT, 'data');
const PHOTOS_DIR = join(DATA_DIR, 'photos');
const DB_FILE = join(DATA_DIR, 'db.json');

const PORT = Number(process.env.PORT) || 4173;
const ADMIN_CODE = process.env.ADMIN_CODE || 'zepadmin';
const EVENT_ID = 'rasso';
const WANT_TUNNEL = process.argv.includes('--tunnel') || process.env.TUNNEL === '1';

mkdirSync(PHOTOS_DIR, { recursive: true });

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

let db;

function saveDb() {
  const tmp = `${DB_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_FILE);
}

function loadDb() {
  if (!existsSync(DB_FILE)) {
    db = defaultDb();
    saveDb();
    return;
  }
  try {
    const parsed = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    db = {
      event: parsed.event || defaultDb().event,
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      votes: Array.isArray(parsed.votes) ? parsed.votes : [],
    };
  } catch {
    db = defaultDb();
  }
}

loadDb();

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

const clamp = (value) => Math.min(10, Math.max(0, Math.round(Number(value) || 0)));

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
  removePhoto(db.vehicles[index].imageUrl);
  db.vehicles.splice(index, 1);
  db.votes = db.votes.filter((vote) => vote.vehicleId !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.delete('/api/votes', requireAdmin, (_req, res) => {
  db.votes = [];
  saveDb();
  res.json({ ok: true });
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
  console.log('\n  Donnees enregistrees dans data/db.json . Ctrl+C pour arreter.');
  if (WANT_TUNNEL) startTunnel();
  else console.log('  Pour rendre l\'app accessible a distance : npm run share\n');
});
