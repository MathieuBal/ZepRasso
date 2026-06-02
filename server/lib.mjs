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
      status: 'draft',
      entryFee: 0,
      createdAt: now,
    },
    vehicles: [],
    votes: [],
    participants: [],
    lotteries: [],
    lotteryEntries: [],
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
    // Lien vers un compte participant inscrit (optionnel). Conservé tel quel
    // même si le participant a été supprimé (orphelin toléré) : le lien ne
    // résoudra simplement plus, et l'anti-auto-vote retombe sur le pseudo.
    participantId: raw.participantId ? String(raw.participantId) : undefined,
    createdAt: String(raw.createdAt || now),
  };
}

// Un participant = un concurrent inscrit au concours (avec un compte lié à son
// appareil via deviceToken). Style strict comme normalizeVote : on rejette une
// entrée sans pseudo ni deviceToken.
export function normalizeParticipant(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const pseudo = String(raw.pseudo || '').trim();
  const deviceToken = String(raw.deviceToken || '').trim();
  if (!pseudo || !deviceToken) return null;
  const method = raw.paymentMethod;
  return {
    id: String(raw.id || randomUUID()),
    eventId: EVENT_ID,
    pseudo,
    deviceToken,
    contactInfo: raw.contactInfo ? String(raw.contactInfo).trim() : undefined,
    hasPaid: Boolean(raw.hasPaid),
    paymentMethod: (method === 'cash' || method === 'virement') ? method : undefined,
    note: raw.note ? String(raw.note).trim() : undefined,
    registeredAt: String(raw.registeredAt || now),
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

// Une loterie : 1 prix (typiquement une voiture RP) tiré au sort parmi les
// tickets PAYÉS. Le revenu est purement orga (les tickets ne forment pas une
// cagnotte redistribuée).
export function normalizeLottery(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const ticketPrice = Math.max(0, Math.floor(Number(raw.ticketPrice) || 0));
  const maxTicketsPerBuyer = Math.max(1, Math.floor(Number(raw.maxTicketsPerBuyer) || 5));
  const status = ['open', 'closed', 'drawn'].includes(raw.status) ? raw.status : 'open';
  return {
    id: String(raw.id || randomUUID()),
    name,
    prizeDescription: raw.prizeDescription ? String(raw.prizeDescription).trim() : undefined,
    prizeImageUrl: typeof raw.prizeImageUrl === 'string' && raw.prizeImageUrl ? raw.prizeImageUrl : undefined,
    ticketPrice,
    maxTicketsPerBuyer,
    status,
    // numéro du ticket gagnant (1..nbTotalTickets) une fois le tirage fait
    winnerEntryNumber: Number.isFinite(Number(raw.winnerEntryNumber)) && raw.winnerEntryNumber > 0
      ? Math.floor(Number(raw.winnerEntryNumber))
      : undefined,
    winnerEntryId: raw.winnerEntryId ? String(raw.winnerEntryId) : undefined,
    createdAt: String(raw.createdAt || now),
  };
}

// Une participation à la loterie (1 acheteur, N tickets). Un numéro de
// participant unique par loterie, attribué côté serveur et jamais réutilisé
// (max(entryNumber) + 1) pour éviter qu'un numéro recyclé crée de la confusion.
export function normalizeLotteryEntry(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const lotteryId = String(raw.lotteryId || '');
  const firstName = String(raw.firstName || '').trim();
  const lastName = String(raw.lastName || '').trim();
  if (!lotteryId || !firstName || !lastName) return null;
  const ticketCount = Math.max(1, Math.floor(Number(raw.ticketCount) || 1));
  const entryNumber = Number.isFinite(Number(raw.entryNumber)) && raw.entryNumber > 0
    ? Math.floor(Number(raw.entryNumber))
    : 1;
  const method = raw.paymentMethod;
  return {
    id: String(raw.id || randomUUID()),
    lotteryId,
    entryNumber,
    firstName,
    lastName,
    phone: raw.phone ? String(raw.phone).trim() : undefined,
    ticketCount,
    hasPaid: Boolean(raw.hasPaid),
    paymentMethod: (method === 'cash' || method === 'virement') ? method : undefined,
    note: raw.note ? String(raw.note).trim() : undefined,
    createdAt: String(raw.createdAt || now),
  };
}

// Stats d'une loterie : nb tickets émis (payés ou non), nb tickets payés
// (seuls éligibles au tirage = « billes »), revenu brut orga.
export function computeLotteryStats(entries, ticketPrice) {
  let totalTickets = 0;
  let paidTickets = 0;
  let paidEntries = 0;
  for (const e of entries) {
    totalTickets += e.ticketCount;
    if (e.hasPaid) {
      paidTickets += e.ticketCount;
      paidEntries += 1;
    }
  }
  return {
    totalEntries: entries.length,
    paidEntries,
    totalTickets,
    paidTickets,
    revenue: paidTickets * (Number(ticketPrice) || 0),
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
  const participants = Array.isArray(parsed?.participants)
    ? parsed.participants.map((raw) => normalizeParticipant(raw, now)).filter(Boolean)
    : [];
  const lotteries = Array.isArray(parsed?.lotteries)
    ? parsed.lotteries.map((raw) => normalizeLottery(raw, now)).filter(Boolean)
    : [];
  const lotteryIds = new Set(lotteries.map((l) => l.id));
  // Les tickets orphelins (loterie supprimée) sont écartés à la lecture.
  const lotteryEntries = Array.isArray(parsed?.lotteryEntries)
    ? parsed.lotteryEntries
        .map((raw) => normalizeLotteryEntry(raw, now))
        .filter((e) => e && lotteryIds.has(e.lotteryId))
    : [];
  // Migration de statut : l'ancien 'open' (votes ouverts) devient 'voting'.
  // Tout statut inconnu retombe sur 'draft' (état le plus sûr : ni vote ni
  // inscription).
  let status = event.status === 'open' ? 'voting' : event.status;
  if (!['draft', 'registrations', 'voting', 'closed'].includes(status)) status = 'draft';
  const entryFee = Number.isFinite(Number(event.entryFee)) && Number(event.entryFee) >= 0
    ? Number(event.entryFee)
    : 0;
  return {
    event: {
      id: EVENT_ID,
      name: String(event.name || base.event.name).trim() || base.event.name,
      status,
      entryFee,
      createdAt: String(event.createdAt || base.event.createdAt),
    },
    vehicles,
    votes,
    participants,
    lotteries,
    lotteryEntries,
  };
}

export function publicVote(vote) {
  // Ne JAMAIS exposer voterId (jeton d'appareil) ni IP dans le flux public,
  // sinon un visiteur curieux pourrait usurper le vote d'un autre.
  const { voterId, ip, ...rest } = vote;
  return rest;
}

// Vrai si le pseudo correspond au propriétaire du véhicule. Comparaison
// normalisée (trim + lowercase) pour attraper "Sandro_Vega" vs "sandro_vega".
// Empêche l'auto-vote (cas honnête : un participant qui clique par erreur
// sur son propre véhicule). Ça ne couvre pas la triche volontaire avec un
// pseudo différent, mais ça suffit pour la majorité des cas et l'audit
// signale déjà les pseudos réutilisés sur plusieurs appareils.
export function isOwnVehicle(vehicle, voterPseudo) {
  if (!vehicle || !voterPseudo) return false;
  return String(vehicle.ownerName || '').trim().toLowerCase() ===
    String(voterPseudo).trim().toLowerCase();
}

// Anti-auto-vote lié à l'appareil : si le véhicule est rattaché à un compte
// participant, on refuse le vote venant du même jeton d'appareil que celui qui
// s'est inscrit. Plus robuste que isOwnVehicle (impossible à contourner en
// changeant de pseudo). Retombe à false si pas de lien ou pas de jeton.
export function ownsVehicleByDevice(vehicle, participants, voterId) {
  if (!vehicle || !vehicle.participantId || !voterId) return false;
  const owner = (participants || []).find((p) => p.id === vehicle.participantId);
  return Boolean(owner && owner.deviceToken && owner.deviceToken === voterId);
}

// Ne JAMAIS exposer deviceToken/contact/paiement d'un participant côté public.
export function publicParticipant(participant) {
  return { id: participant.id, pseudo: participant.pseudo };
}

// Calcule la répartition de la cagnotte. L'orga prend 10 % (arrondi), le reste
// (net) est partagé sur le podium 60/25/15. Le gagnant absorbe l'arrondi pour
// que first+second+third === net exactement (et orgaCut+podium === pool).
export function computePrizePool(paidCount, entryFee) {
  const count = Math.max(0, Math.floor(Number(paidCount) || 0));
  const fee = Math.max(0, Number(entryFee) || 0);
  const pool = count * fee;
  const orgaCut = Math.round(pool * 0.10);
  const net = pool - orgaCut;
  const second = Math.round(net * 0.25);
  const third = Math.round(net * 0.15);
  const first = net - second - third;
  return { pool, orgaCut, net, podium: { first, second, third } };
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
