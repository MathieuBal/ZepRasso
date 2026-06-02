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
    races: [],
    racePilots: [],
    raceBets: [],
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
  const races = Array.isArray(parsed?.races)
    ? parsed.races.map((raw) => normalizeRace(raw, now)).filter(Boolean)
    : [];
  const raceIds = new Set(races.map((r) => r.id));
  // Pilotes orphelins (course supprimée) écartés à la lecture.
  const racePilots = Array.isArray(parsed?.racePilots)
    ? parsed.racePilots
        .map((raw) => normalizeRacePilot(raw, now)).filter((p) => p && raceIds.has(p.raceId))
    : [];
  const pilotIds = new Set(racePilots.map((p) => p.id));
  // Paris orphelins (course OU pilote supprimé) écartés.
  const raceBets = Array.isArray(parsed?.raceBets)
    ? parsed.raceBets
        .map((raw) => normalizeRaceBet(raw, now))
        .filter((b) => b && raceIds.has(b.raceId) && pilotIds.has(b.pilotId))
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
    races,
    racePilots,
    raceBets,
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

// Calcule la répartition de la cagnotte. L'orga prend orgaPercent (défaut 10,
// arrondi), le reste (net) est partagé sur le podium 60/25/15. Le gagnant
// absorbe l'arrondi pour que first+second+third === net exactement (et
// orgaCut+podium === pool).
export function computePrizePool(paidCount, entryFee, orgaPercent = 10) {
  const count = Math.max(0, Math.floor(Number(paidCount) || 0));
  const fee = Math.max(0, Number(entryFee) || 0);
  const pct = Math.min(100, Math.max(0, Number(orgaPercent) || 0));
  const pool = count * fee;
  const orgaCut = Math.round(pool * (pct / 100));
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

// ─── Courses chronométrées ──────────────────────────────────────────────────

// Parse "1:23.450" / "83.450" / "83.45" / "83" → millisecondes (entier).
// Renvoie null si la chaîne est vide ou non parsable.
export function parseTimeStr(s) {
  if (s === null || s === undefined) return null;
  const str = String(s).trim();
  if (!str) return null;
  // mm:ss(.ms)
  const m = /^(\d+):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(str);
  if (m) {
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    if (sec >= 60) return null;
    const msStr = m[3] || '0';
    const ms = parseInt(msStr.padEnd(3, '0'), 10);
    return min * 60_000 + sec * 1000 + ms;
  }
  // ss(.ms) seul
  const m2 = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(str);
  if (m2) {
    const sec = parseInt(m2[1], 10);
    const msStr = m2[2] || '0';
    const ms = parseInt(msStr.padEnd(3, '0'), 10);
    return sec * 1000 + ms;
  }
  return null;
}

export function formatMs(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '';
  const total = Math.max(0, Math.floor(Number(ms)));
  const min = Math.floor(total / 60_000);
  const sec = Math.floor((total % 60_000) / 1000);
  const milli = total % 1000;
  return `${min}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

// Une course chrono. sequenceMode est purement indicatif côté UI (mode A =
// chaque pilote enchaîne ses runs ; mode B = tour par tour pour tout le monde).
// La donnée est identique dans les deux cas : un tableau de N temps par pilote.
export function normalizeRace(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const entryFee = Math.max(0, Math.floor(Number(raw.entryFee) || 0));
  const rounds = Math.min(10, Math.max(1, Math.floor(Number(raw.rounds) || 3)));
  // Number(undefined) === NaN et NaN ?? 10 === NaN, donc on bascule sur le
  // défaut explicitement quand la valeur n'est pas un nombre fini.
  const rawOrga = Number(raw.orgaCutPercent);
  const orgaCutPercent = Math.min(50, Math.max(0, Number.isFinite(rawOrga) ? rawOrga : 10));
  const rawBetOrga = Number(raw.betOrgaCutPercent);
  const betOrgaCutPercent = Math.min(50, Math.max(0, Number.isFinite(rawBetOrga) ? rawBetOrga : 20));
  const sequenceMode = raw.sequenceMode === 'alternating' ? 'alternating' : 'sequential';
  const status = ['draft', 'open', 'running', 'finished'].includes(raw.status) ? raw.status : 'open';
  const bettingStatus = ['closed', 'open', 'locked'].includes(raw.bettingStatus) ? raw.bettingStatus : 'closed';
  return {
    id: String(raw.id || randomUUID()),
    name,
    description: raw.description ? String(raw.description).trim() : undefined,
    entryFee,
    rounds,
    sequenceMode,
    orgaCutPercent,
    betOrgaCutPercent,
    status,
    bettingStatus,
    winnerPilotId: raw.winnerPilotId ? String(raw.winnerPilotId) : undefined,
    createdAt: String(raw.createdAt || now),
  };
}

export function normalizeRacePilot(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const raceId = String(raw.raceId || '');
  const pseudo = String(raw.pseudo || '').trim();
  if (!raceId || !pseudo) return null;
  // times[] : longueur libre, valeurs ms entières positives ou null pour "vide".
  // Important : ne pas confondre null/undefined avec 0 (Number(null) === 0).
  const times = Array.isArray(raw.times)
    ? raw.times.map((t) => {
        if (t === null || t === undefined || t === '') return null;
        const n = Number(t);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
      })
    : [];
  const method = raw.paymentMethod;
  return {
    id: String(raw.id || randomUUID()),
    raceId,
    pseudo,
    vehicle: raw.vehicle ? String(raw.vehicle).trim() : undefined,
    hasPaid: Boolean(raw.hasPaid),
    paymentMethod: (method === 'cash' || method === 'virement') ? method : undefined,
    note: raw.note ? String(raw.note).trim() : undefined,
    times,
    createdAt: String(raw.createdAt || now),
  };
}

// Meilleur temps du pilote (min des entrées non nulles) ou null.
export function bestTime(pilot) {
  const valid = (pilot.times || []).filter((t) => t !== null && t !== undefined);
  return valid.length > 0 ? Math.min(...valid) : null;
}

// Classement : trié par meilleur temps croissant. Les pilotes sans aucun temps
// terminent en bas de tableau (ordre stable entre eux).
export function computeRaceStandings(pilots) {
  return [...pilots].sort((a, b) => {
    const ta = bestTime(a);
    const tb = bestTime(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

// ─── Paris mutuels sur les courses ──────────────────────────────────────────
// Style PMU : seuls les paris PAYÉS rentrent dans le pot. À la déclaration du
// vainqueur, l'orga prend betOrgaCutPercent (défaut 20). Le net est redistribué
// entre les parieurs gagnants au prorata de leur mise. Si aucun pari payé sur
// le vainqueur, tout le pot va à l'orga.

export function normalizeRaceBet(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') return null;
  const raceId = String(raw.raceId || '');
  const bettorPseudo = String(raw.bettorPseudo || '').trim();
  const pilotId = String(raw.pilotId || '');
  const amount = Math.floor(Number(raw.amount) || 0);
  if (!raceId || !bettorPseudo || !pilotId || amount <= 0) return null;
  const method = raw.paymentMethod;
  return {
    id: String(raw.id || randomUUID()),
    raceId,
    bettorPseudo,
    voterId: raw.voterId ? String(raw.voterId) : undefined,
    pilotId,
    amount,
    hasPaid: Boolean(raw.hasPaid),
    paymentMethod: (method === 'cash' || method === 'virement') ? method : undefined,
    note: raw.note ? String(raw.note).trim() : undefined,
    createdAt: String(raw.createdAt || now),
  };
}

// Pour chaque pilote : total parié (toutes mises payées confondues) et nombre
// de parieurs distincts. Utile à l'affichage admin avant tirage du vainqueur.
export function computeBetTotalsByPilot(bets) {
  const map = new Map();
  for (const b of bets) {
    if (!b.hasPaid) continue;
    if (!map.has(b.pilotId)) map.set(b.pilotId, { totalAmount: 0, bettors: 0 });
    const entry = map.get(b.pilotId);
    entry.totalAmount += b.amount;
    entry.bettors += 1;
  }
  return map;
}

// Calcule la répartition des paris d'une course. winnerPilotId peut être null
// (course pas encore tranchée) : on renvoie alors juste le pool.
// L'arrondi est absorbé par le dernier gagnant pour que la somme tombe juste.
export function computeBetPayouts(bets, winnerPilotId, orgaPercent = 20) {
  const paid = bets.filter((b) => b.hasPaid);
  const pool = paid.reduce((s, b) => s + b.amount, 0);
  const pct = Math.min(100, Math.max(0, Number(orgaPercent) || 0));
  const orgaCut = Math.round(pool * (pct / 100));
  const net = pool - orgaCut;
  if (!winnerPilotId) {
    return { pool, orgaCut, net, winners: [], orgaTakesAll: false };
  }
  const winningBets = paid.filter((b) => b.pilotId === winnerPilotId);
  const winningStake = winningBets.reduce((s, b) => s + b.amount, 0);
  // Cas particulier : personne n'a misé sur le vainqueur → tout va à l'orga.
  if (winningStake === 0) {
    return { pool, orgaCut: pool, net: 0, winners: [], orgaTakesAll: true };
  }
  // Distribution proportionnelle, dernier gagnant absorbe le reste.
  const winners = winningBets.map((b) => ({
    betId: b.id,
    bettorPseudo: b.bettorPseudo,
    pilotId: b.pilotId,
    bet: b.amount,
    payout: 0,
    profit: 0,
  }));
  let distributed = 0;
  for (let i = 0; i < winners.length - 1; i++) {
    const share = Math.round(net * (winningBets[i].amount / winningStake));
    winners[i].payout = share;
    distributed += share;
  }
  if (winners.length > 0) {
    winners[winners.length - 1].payout = net - distributed;
  }
  for (let i = 0; i < winners.length; i++) {
    winners[i].profit = winners[i].payout - winningBets[i].amount;
  }
  return { pool, orgaCut, net, winners, orgaTakesAll: false };
}

// ─── Récap financier de la soirée (toutes sources agrégées) ─────────────────
// Pur : prend les collections de la DB et renvoie ce que l'orga garde, ce qu'il
// doit redistribuer, et le détail par source. Réutilise les helpers de cagnotte
// existants pour rester cohérent au centime près.
export function computeFinanceSummary(data) {
  const {
    event,
    participants = [],
    lotteries = [],
    lotteryEntries = [],
    races = [],
    racePilots = [],
    raceBets = [],
  } = data || {};

  // Concours : part orga = 10 % du pot des inscriptions payées.
  const paidParticipants = participants.filter((p) => p.hasPaid).length;
  const contestPrize = computePrizePool(paidParticipants, event?.entryFee || 0, 10);
  const contest = {
    paidParticipants,
    pool: contestPrize.pool,
    orgaCut: contestPrize.orgaCut,
    toPayOut: contestPrize.net,
  };

  // Loteries : revenu intégralement à l'orga (la voiture est offerte par l'orga).
  const lotteriesDetail = lotteries.map((l) => {
    const entries = lotteryEntries.filter((e) => e.lotteryId === l.id);
    const stats = computeLotteryStats(entries, l.ticketPrice);
    return { id: l.id, name: l.name, revenue: stats.revenue, paidTickets: stats.paidTickets, status: l.status };
  });
  const lotteriesRevenue = lotteriesDetail.reduce((s, l) => s + l.revenue, 0);

  // Courses : part orga = cut sur les inscriptions pilotes + cut sur les paris.
  const racesDetail = races.map((r) => {
    const paidPilots = racePilots.filter((p) => p.raceId === r.id && p.hasPaid).length;
    const pilotPrize = computePrizePool(paidPilots, r.entryFee, r.orgaCutPercent);
    const bets = raceBets.filter((b) => b.raceId === r.id);
    const betPayouts = computeBetPayouts(bets, r.winnerPilotId, r.betOrgaCutPercent);
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      winnerDeclared: Boolean(r.winnerPilotId),
      pilotPool: pilotPrize.pool,
      pilotOrgaCut: pilotPrize.orgaCut,
      pilotToPayOut: pilotPrize.net,
      betPool: betPayouts.pool,
      betOrgaCut: betPayouts.orgaCut,
      betToPayOut: betPayouts.net,
      orgaCut: pilotPrize.orgaCut + betPayouts.orgaCut,
    };
  });

  const racesOrgaCut = racesDetail.reduce((s, r) => s + r.orgaCut, 0);
  const racesToPayOut = racesDetail.reduce((s, r) => s + r.pilotToPayOut + r.betToPayOut, 0);

  const orgaTake = contest.orgaCut + lotteriesRevenue + racesOrgaCut;
  const toPayOut = contest.toPayOut + racesToPayOut;
  const grossHandled = contest.pool + lotteriesRevenue
    + racesDetail.reduce((s, r) => s + r.pilotPool + r.betPool, 0);

  return {
    contest,
    lotteries: { detail: lotteriesDetail, revenue: lotteriesRevenue },
    races: racesDetail,
    totals: { orgaTake, toPayOut, grossHandled },
  };
}

// ─── Cagnottes par catégorie de concours ────────────────────────────────────
// Chaque participant payé alimente le pot de SA catégorie (celle de son
// véhicule). Un participant payé sans véhicule (donc sans catégorie) n'est
// rattaché à aucun pot. Catégorie vide → bucket '' (affiché « Général »).
export function computeCategoryPools(vehicles, participants, entryFee) {
  const catByParticipant = new Map();
  for (const v of vehicles) {
    if (v.participantId) catByParticipant.set(v.participantId, v.category || '');
  }
  const paidByCat = new Map();
  for (const p of participants) {
    if (!p.hasPaid) continue;
    const cat = catByParticipant.get(p.id);
    if (cat === undefined) continue; // payé mais sans véhicule rattaché
    paidByCat.set(cat, (paidByCat.get(cat) || 0) + 1);
  }
  return [...paidByCat.entries()]
    .map(([category, paidCount]) => ({ category, paidCount, ...computePrizePool(paidCount, entryFee, 10) }))
    .sort((a, b) => b.pool - a.pool);
}
