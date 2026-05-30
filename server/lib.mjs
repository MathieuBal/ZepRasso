// Helpers purs partagés entre le serveur (server/index.mjs) et les tests.
// Tout ce qui est ici doit rester sans effet de bord et sans état global :
// pas d'accès au système de fichiers, pas d'horloge implicite cachée, etc.

import { randomUUID } from 'node:crypto';

export const EVENT_ID = 'rasso';

export function clamp(value) {
  return Math.min(10, Math.max(0, Math.round(Number(value) || 0)));
}

export function defaultDb(now = new Date().toISOString()) {
  return {
    event: {
      id: EVENT_ID,
      name: 'ZepRasso - Car Meet RP',
      status: 'open',
      createdAt: now,
    },
    vehicles: [],
    votes: [],
  };
}

export function normalizeVehicle(raw, now = new Date().toISOString()) {
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
    createdAt: String(raw.createdAt || now),
  };
}

export function normalizeVote(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const voterPseudo = String(raw.voterPseudo || '').trim();
  const vehicleId = String(raw.vehicleId || '');
  if (!voterPseudo || !vehicleId) return null;
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

export function normalizeDb(parsed, now = new Date().toISOString()) {
  const base = defaultDb(now);
  const event = parsed && typeof parsed.event === 'object' && parsed.event ? parsed.event : base.event;
  const vehicles = Array.isArray(parsed?.vehicles)
    ? parsed.vehicles.map((raw) => normalizeVehicle(raw, now)).filter(Boolean)
    : [];
  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  // Les votes orphelins (pour un véhicule supprimé) sont écartés.
  const votes = Array.isArray(parsed?.votes)
    ? parsed.votes
        .map((raw) => normalizeVote(raw, now))
        .filter((vote) => vote && vehicleIds.has(vote.vehicleId))
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

export function publicVote(vote) {
  // Ne JAMAIS exposer voterId (jeton d'appareil) ni IP dans le flux public,
  // sinon un visiteur curieux pourrait usurper le vote d'un autre.
  const { voterId, ip, ...rest } = vote;
  return rest;
}

// Trouve un vote existant pour ce véhicule par voterId si fourni, sinon par
// pseudo (case-insensitive). C'est la règle anti-triche cœur : un appareil =
// une voix par véhicule, mais on conserve un fallback pseudo pour les votes
// anciens qui n'avaient pas de voterId.
export function findExistingVote(votes, vehicleId, voterId, voterPseudo) {
  return votes.find((vote) =>
    vote.vehicleId === vehicleId &&
    (voterId ? vote.voterId === voterId : vote.voterPseudo.toLowerCase() === voterPseudo.toLowerCase()),
  );
}

export function computeAudit(votes) {
  const votersByIp = new Map();
  const pseudosByIp = new Map();
  const votersByPseudo = new Map();
  const voters = new Set();
  const ips = new Set();
  for (const vote of votes) {
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
    if (!votersByPseudo.has(key)) {
      votersByPseudo.set(key, { pseudo: vote.voterPseudo, voters: new Set() });
    }
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
  return {
    totalVotes: votes.length,
    distinctVoters: voters.size,
    distinctIps: ips.size,
    sharedIps,
    reusedPseudos,
  };
}
