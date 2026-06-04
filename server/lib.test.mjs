import { describe, expect, it } from 'vitest';
import {
  bestTime,
  clamp,
  computeAudit,
  computeBetPayouts,
  computeCategoryPools,
  computeFinanceSummary,
  computePrizePool,
  computeRaceStandings,
  defaultDb,
  findExistingVote,
  formatMs,
  isOwnVehicle,
  normalizeDb,
  normalizeParticipant,
  normalizeRace,
  normalizeRaceBet,
  normalizeRacePilot,
  normalizeVote,
  ownsVehicleByDevice,
  parseTimeStr,
  publicVote,
} from './lib.mjs';

const NOW = '2026-05-30T08:00:00.000Z';

describe('clamp', () => {
  it('clamps any number into [0, 10] integers', () => {
    expect(clamp(-3)).toBe(0);
    expect(clamp(0)).toBe(0);
    expect(clamp(5.4)).toBe(5);
    expect(clamp(5.6)).toBe(6);
    expect(clamp(10)).toBe(10);
    expect(clamp(15)).toBe(10);
  });

  it('treats junk values as 0', () => {
    expect(clamp('abc')).toBe(0);
    expect(clamp(undefined)).toBe(0);
    expect(clamp(null)).toBe(0);
    expect(clamp(NaN)).toBe(0);
  });
});

describe('publicVote', () => {
  it('strips voterId and ip', () => {
    const masked = publicVote({
      id: 'v1', vehicleId: 'c1', voterId: 'token', voterPseudo: 'A',
      ip: '1.2.3.4', aesthetics: 8,
    });
    expect(masked).not.toHaveProperty('voterId');
    expect(masked).not.toHaveProperty('ip');
    expect(masked.voterPseudo).toBe('A');
    expect(masked.aesthetics).toBe(8);
  });
});

describe('normalizeVote', () => {
  it('returns null when pseudo or vehicleId is missing', () => {
    expect(normalizeVote(null, NOW)).toBeNull();
    expect(normalizeVote({ vehicleId: 'c1' }, NOW)).toBeNull();
    expect(normalizeVote({ voterPseudo: 'A' }, NOW)).toBeNull();
  });

  it('clamps scores and preserves identifiers', () => {
    const v = normalizeVote(
      { vehicleId: 'c1', voterPseudo: '  Alice ', voterId: 'dev', aesthetics: 99, coherence: -3, originality: 5.5, details: 'foo', rpPresentation: 7, ip: '1.1.1.1', id: 'v1', createdAt: 'past', updatedAt: 'past' },
      NOW,
    );
    expect(v).toMatchObject({
      id: 'v1',
      eventId: 'rasso',
      vehicleId: 'c1',
      voterId: 'dev',
      voterPseudo: 'Alice',
      aesthetics: 10,
      coherence: 0,
      originality: 6,
      details: 0,
      rpPresentation: 7,
      ip: '1.1.1.1',
      createdAt: 'past',
      updatedAt: 'past',
    });
  });

  it('uses now as default timestamps when missing', () => {
    const v = normalizeVote({ vehicleId: 'c1', voterPseudo: 'A' }, NOW);
    expect(v.createdAt).toBe(NOW);
    expect(v.updatedAt).toBe(NOW);
  });
});

describe('normalizeDb', () => {
  it('returns a clean default when parsed is empty', () => {
    const db = normalizeDb({}, NOW);
    expect(db.events).toHaveLength(1);
    expect(db.events[0].id).toBe('rasso');
    expect(db.events[0].status).toBe('draft');
    expect(db.events[0].entryFee).toBe(0);
    expect(db.activeEventId).toBe('rasso');
    expect(db.vehicles).toEqual([]);
    expect(db.votes).toEqual([]);
    expect(db.participants).toEqual([]);
  });

  it('migrates the legacy "open" status to "voting"', () => {
    const db = normalizeDb({ event: { name: 'X', status: 'open' } }, NOW);
    expect(db.events[0].status).toBe('voting');
  });

  it('keeps an existing draft status as draft (no auto-promotion)', () => {
    const db = normalizeDb({ event: { name: 'X', status: 'draft' } }, NOW);
    expect(db.events[0].status).toBe('draft');
  });

  it('preserves participants and vehicle.participantId, tolerating orphans', () => {
    const db = normalizeDb({
      vehicles: [
        { id: 'A', name: 'Sultan', ownerName: 'Sandro', participantId: 'p1' },
        { id: 'B', name: 'Comet', ownerName: 'Ghost', participantId: 'gone' },
      ],
      participants: [
        { id: 'p1', pseudo: 'Sandro', deviceToken: 'dev-1' },
        { pseudo: 'NoToken' }, // invalide → filtré
      ],
    }, NOW);
    expect(db.participants).toHaveLength(1);
    expect(db.participants[0].id).toBe('p1');
    expect(db.vehicles.find((v) => v.id === 'A').participantId).toBe('p1');
    // Lien orphelin conservé tel quel (le participant n'existe pas).
    expect(db.vehicles.find((v) => v.id === 'B').participantId).toBe('gone');
  });

  it('clamps a negative or junk entryFee to 0 and keeps a valid one', () => {
    expect(normalizeDb({ event: { entryFee: -5 } }, NOW).events[0].entryFee).toBe(0);
    expect(normalizeDb({ event: { entryFee: 'abc' } }, NOW).events[0].entryFee).toBe(0);
    expect(normalizeDb({ event: { entryFee: 12 } }, NOW).events[0].entryFee).toBe(12);
  });

  it('drops orphan votes whose vehicle was deleted', () => {
    const db = normalizeDb({
      vehicles: [{ id: 'A', name: 'Sultan', ownerName: 'N' }],
      votes: [
        { vehicleId: 'A', voterPseudo: 'X', voterId: 'd1' },
        { vehicleId: 'GHOST', voterPseudo: 'Y', voterId: 'd2' },
      ],
    }, NOW);
    expect(db.vehicles).toHaveLength(1);
    expect(db.votes).toHaveLength(1);
    expect(db.votes[0].vehicleId).toBe('A');
  });

  it('coerces an unknown event status to draft', () => {
    const db = normalizeDb({ event: { name: 'X', status: 'wat' } }, NOW);
    expect(db.events[0].status).toBe('draft');
  });

  it('keeps a valid status and uses default name fallback', () => {
    const db = normalizeDb({ event: { name: '   ', status: 'closed' } }, NOW);
    expect(db.events[0].status).toBe('closed');
    // normalizeEvent retombe sur 'Événement' quand le nom est vide/blanc.
    expect(db.events[0].name).toBe('Événement');
  });
});

describe('normalizeParticipant', () => {
  it('returns null when pseudo or deviceToken is missing', () => {
    expect(normalizeParticipant(null, NOW)).toBeNull();
    expect(normalizeParticipant({ pseudo: 'A' }, NOW)).toBeNull();
    expect(normalizeParticipant({ deviceToken: 'd1' }, NOW)).toBeNull();
  });

  it('trims, coerces fields and defaults registeredAt to now', () => {
    const p = normalizeParticipant(
      { pseudo: '  Sandro ', deviceToken: ' dev-1 ', contactInfo: ' Discord#1 ', hasPaid: 1, paymentMethod: 'cash', note: ' VIP ' },
      NOW,
    );
    expect(p).toMatchObject({
      eventId: 'rasso',
      pseudo: 'Sandro',
      deviceToken: 'dev-1',
      contactInfo: 'Discord#1',
      hasPaid: true,
      paymentMethod: 'cash',
      note: 'VIP',
      registeredAt: NOW,
    });
    expect(typeof p.id).toBe('string');
  });

  it('drops an unknown payment method', () => {
    const p = normalizeParticipant({ pseudo: 'A', deviceToken: 'd', paymentMethod: 'bitcoin' }, NOW);
    expect(p.paymentMethod).toBeUndefined();
  });
});

describe('computePrizePool', () => {
  it('computes pool, orga cut and podium with invariants holding', () => {
    const r = computePrizePool(7, 10);
    expect(r.pool).toBe(70);
    expect(r.orgaCut).toBe(7);
    expect(r.net).toBe(63);
    expect(r.podium.second).toBe(16); // round(63*0.25)=16
    expect(r.podium.third).toBe(9);   // round(63*0.15)=9
    expect(r.podium.first).toBe(38);  // 63-16-9
    expect(r.podium.first + r.podium.second + r.podium.third).toBe(r.net);
    expect(r.orgaCut + r.podium.first + r.podium.second + r.podium.third).toBe(r.pool);
  });

  it('returns all zeros when no one paid', () => {
    expect(computePrizePool(0, 10)).toEqual({ pool: 0, orgaCut: 0, net: 0, podium: { first: 0, second: 0, third: 0 } });
  });

  it('treats junk inputs as zero', () => {
    expect(computePrizePool('x', null).pool).toBe(0);
    expect(computePrizePool(-3, -5).pool).toBe(0);
  });
});

describe('ownsVehicleByDevice (device-bound self-vote guard)', () => {
  const participants = [{ id: 'p1', pseudo: 'Sandro', deviceToken: 'dev-1' }];

  it('is true when the voter device matches the owning participant', () => {
    expect(ownsVehicleByDevice({ participantId: 'p1' }, participants, 'dev-1')).toBe(true);
  });

  it('is false on token mismatch, missing link, missing token or unresolved participant', () => {
    expect(ownsVehicleByDevice({ participantId: 'p1' }, participants, 'dev-2')).toBe(false);
    expect(ownsVehicleByDevice({}, participants, 'dev-1')).toBe(false);
    expect(ownsVehicleByDevice({ participantId: 'p1' }, participants, '')).toBe(false);
    expect(ownsVehicleByDevice({ participantId: 'gone' }, participants, 'dev-1')).toBe(false);
  });
});

describe('findExistingVote (anti-cheat dedup rule)', () => {
  const votes = [
    { id: 'v1', vehicleId: 'A', voterId: 'd1', voterPseudo: 'Alice' },
    { id: 'v2', vehicleId: 'B', voterId: 'd1', voterPseudo: 'Alice' },
    { id: 'v3', vehicleId: 'A', voterId: 'd2', voterPseudo: 'Bob' },
    { id: 'v4', vehicleId: 'A', voterPseudo: 'Legacy' },
  ];

  it('matches by voterId+vehicleId when voterId is provided (pseudo change is irrelevant)', () => {
    const hit = findExistingVote(votes, 'A', 'd1', 'completely-different-pseudo');
    expect(hit?.id).toBe('v1');
  });

  it('falls back to pseudo (case-insensitive) when no voterId is provided', () => {
    const hit = findExistingVote(votes, 'A', '', 'LEGACY');
    expect(hit?.id).toBe('v4');
  });

  it('returns undefined when nothing matches', () => {
    expect(findExistingVote(votes, 'C', 'd1', 'Alice')).toBeUndefined();
    expect(findExistingVote(votes, 'A', 'unknown', '')).toBeUndefined();
  });
});

describe('isOwnVehicle', () => {
  it('matches owner pseudo case- and whitespace-insensitively', () => {
    expect(isOwnVehicle({ ownerName: 'Sandro_Vega' }, 'sandro_vega')).toBe(true);
    expect(isOwnVehicle({ ownerName: '  Sandro ' }, ' SANDRO ')).toBe(true);
  });

  it('returns false on empty inputs or different pseudo', () => {
    expect(isOwnVehicle(null, 'X')).toBe(false);
    expect(isOwnVehicle({ ownerName: 'X' }, '')).toBe(false);
    expect(isOwnVehicle({ ownerName: 'X' }, 'Y')).toBe(false);
  });
});

describe('computeAudit', () => {
  it('flags an IP behind which multiple devices voted', () => {
    const votes = [
      { id: '1', vehicleId: 'A', voterId: 'd1', voterPseudo: 'A1', ip: '10.0.0.1' },
      { id: '2', vehicleId: 'A', voterId: 'd2', voterPseudo: 'A2', ip: '10.0.0.1' },
      { id: '3', vehicleId: 'A', voterId: 'd3', voterPseudo: 'B',  ip: '10.0.0.2' },
    ];
    const report = computeAudit(votes);
    expect(report.totalVotes).toBe(3);
    expect(report.distinctVoters).toBe(3);
    expect(report.distinctIps).toBe(2);
    expect(report.sharedIps).toEqual([
      { ip: '10.0.0.1', voters: 2, pseudos: expect.arrayContaining(['A1', 'A2']) },
    ]);
    expect(report.reusedPseudos).toEqual([]);
  });

  it('flags pseudos reused across multiple devices', () => {
    const votes = [
      { id: '1', vehicleId: 'A', voterId: 'd1', voterPseudo: 'Pirate', ip: '1.1.1.1' },
      { id: '2', vehicleId: 'B', voterId: 'd2', voterPseudo: 'pirate', ip: '2.2.2.2' },
    ];
    const report = computeAudit(votes);
    expect(report.reusedPseudos).toEqual([{ pseudo: 'Pirate', devices: 2 }]);
    expect(report.sharedIps).toEqual([]);
  });

  it('handles votes without voterId by using a fallback identity', () => {
    const votes = [
      { id: '1', vehicleId: 'A', voterPseudo: 'X', ip: '1.1.1.1' },
      { id: '2', vehicleId: 'A', voterPseudo: 'X', ip: '1.1.1.1' },
    ];
    const report = computeAudit(votes);
    // Same pseudo, no voterId, on the same IP: counted as two distinct voters
    // because we cannot prove they are the same device.
    expect(report.distinctVoters).toBe(2);
    expect(report.sharedIps[0].voters).toBe(2);
  });

  it('returns zeros for an empty list', () => {
    const report = computeAudit([]);
    expect(report).toEqual({
      totalVotes: 0,
      distinctVoters: 0,
      distinctIps: 0,
      sharedIps: [],
      reusedPseudos: [],
    });
  });
});

describe('parseTimeStr / formatMs', () => {
  it('parses mm:ss.ms and round-trips', () => {
    expect(parseTimeStr('1:23.450')).toBe(83_450);
    expect(formatMs(83_450)).toBe('1:23.450');
  });
  it('accepts seconds-only and comma decimals', () => {
    expect(parseTimeStr('83.4')).toBe(83_400);
    expect(parseTimeStr('83,45')).toBe(83_450);
  });
  it('rejects garbage and 60+ seconds in mm:ss', () => {
    expect(parseTimeStr('abc')).toBeNull();
    expect(parseTimeStr('1:60.000')).toBeNull();
    expect(parseTimeStr('')).toBeNull();
  });
});

describe('normalizeRace', () => {
  it('returns null without a name', () => {
    expect(normalizeRace({}, NOW)).toBeNull();
  });
  it('clamps rounds to [1, 10] and orga % to [0, 50] and defaults sequenceMode/status', () => {
    const r = normalizeRace({ name: 'X', rounds: 99, orgaCutPercent: 80 }, NOW);
    expect(r.rounds).toBe(10);
    expect(r.orgaCutPercent).toBe(50);
    expect(r.sequenceMode).toBe('sequential');
    expect(r.status).toBe('open');
  });
});

describe('normalizeRacePilot', () => {
  it('returns null without raceId or pseudo', () => {
    expect(normalizeRacePilot({ raceId: 'r1' }, NOW)).toBeNull();
    expect(normalizeRacePilot({ pseudo: 'X' }, NOW)).toBeNull();
  });
  it('preserves valid times and converts garbage to null', () => {
    const p = normalizeRacePilot({ raceId: 'r1', pseudo: 'X', times: [1000, 'bad', null, 2500.7] }, NOW);
    expect(p.times).toEqual([1000, null, null, 2500]);
  });
});

describe('bestTime + computeRaceStandings', () => {
  const r = (pseudo, times) => ({ id: pseudo, raceId: 'r', pseudo, times, hasPaid: true });
  it('returns the smallest non-null time', () => {
    expect(bestTime(r('A', [3000, 1500, 2000]))).toBe(1500);
    expect(bestTime(r('B', [null, null]))).toBeNull();
  });
  it('orders by best time, pushing pilots without times to the end', () => {
    const standings = computeRaceStandings([
      r('A', [2000, 2500]),
      r('B', [null]),
      r('C', [1800, null]),
    ]);
    expect(standings.map((p) => p.pseudo)).toEqual(['C', 'A', 'B']);
  });
});

describe('computePrizePool with custom orga %', () => {
  it('honours an orga percent different from the default 10', () => {
    const r = computePrizePool(4, 100_000, 20);
    expect(r.pool).toBe(400_000);
    expect(r.orgaCut).toBe(80_000);
    expect(r.net).toBe(320_000);
    expect(r.podium.first + r.podium.second + r.podium.third).toBe(r.net);
  });
});

describe('normalizeRaceBet', () => {
  it('rejects bets without raceId/pseudo/pilotId/amount > 0', () => {
    expect(normalizeRaceBet({}, NOW)).toBeNull();
    expect(normalizeRaceBet({ raceId: 'r', bettorPseudo: 'X', pilotId: 'p', amount: 0 }, NOW)).toBeNull();
  });
  it('trims, coerces and ignores unknown payment method', () => {
    const b = normalizeRaceBet({ raceId: 'r', bettorPseudo: '  Alice  ', pilotId: 'p1', amount: '12000', hasPaid: true, paymentMethod: 'crypto' }, NOW);
    expect(b).toMatchObject({ raceId: 'r', bettorPseudo: 'Alice', pilotId: 'p1', amount: 12000, hasPaid: true });
    expect(b.paymentMethod).toBeUndefined();
  });
});

describe('computeBetPayouts (pari mutuel)', () => {
  // Référence : 3 mises payées (30k sur A, 50k sur A, 20k sur B). Pool = 100k.
  // 20 % orga = 20k. Net = 80k partagé entre A1 et A2 au prorata 30/80 et 50/80.
  const bets = () => ([
    { id: 'b1', raceId: 'r', bettorPseudo: 'P1', pilotId: 'A', amount: 30000, hasPaid: true },
    { id: 'b2', raceId: 'r', bettorPseudo: 'P2', pilotId: 'A', amount: 50000, hasPaid: true },
    { id: 'b3', raceId: 'r', bettorPseudo: 'P3', pilotId: 'B', amount: 20000, hasPaid: true },
    { id: 'b4', raceId: 'r', bettorPseudo: 'P4', pilotId: 'A', amount: 99999999, hasPaid: false }, // non payé : ignoré
  ]);

  it('computes the pool from paid bets only and applies the orga cut', () => {
    const r = computeBetPayouts(bets(), 'A', 20);
    expect(r.pool).toBe(100000);
    expect(r.orgaCut).toBe(20000);
    expect(r.net).toBe(80000);
  });

  it('distributes the net proportionally to winning bets and the last winner absorbs rounding', () => {
    const r = computeBetPayouts(bets(), 'A', 20);
    expect(r.winners).toHaveLength(2);
    // Somme exacte = net (invariant).
    const totalPayout = r.winners.reduce((s, w) => s + w.payout, 0);
    expect(totalPayout).toBe(r.net);
    // Profit = payout - mise.
    for (const w of r.winners) {
      expect(w.profit).toBe(w.payout - w.bet);
    }
    // P1 récupère ~30/80 = 37.5% du net (30k), P2 ~62.5% (50k).
    const p1 = r.winners.find((w) => w.bettorPseudo === 'P1');
    const p2 = r.winners.find((w) => w.bettorPseudo === 'P2');
    expect(p1.payout).toBe(30000);
    expect(p2.payout).toBe(50000);
  });

  it('gives everything to the orga when nobody bet on the winner', () => {
    const r = computeBetPayouts(bets(), 'C', 20); // C n'a aucune mise payée
    expect(r.orgaCut).toBe(r.pool);
    expect(r.net).toBe(0);
    expect(r.winners).toHaveLength(0);
    expect(r.orgaTakesAll).toBe(true);
  });

  it('returns the pool only when no winner is set yet', () => {
    const r = computeBetPayouts(bets(), undefined, 20);
    expect(r.pool).toBe(100000);
    expect(r.winners).toEqual([]);
    expect(r.orgaTakesAll).toBe(false);
  });
});

describe('computeFinanceSummary', () => {
  it('aggregates orga take across contest, lotteries and races', () => {
    const data = {
      event: { entryFee: 100000 },
      participants: [
        { id: 'p1', hasPaid: true }, { id: 'p2', hasPaid: true },
        { id: 'p3', hasPaid: false }, { id: 'p4', hasPaid: true },
      ], // 3 payés -> pool 300k, orga 10% = 30k, net 270k
      lotteries: [{ id: 'l1', name: 'Sultan', ticketPrice: 50000, status: 'open' }],
      lotteryEntries: [
        { lotteryId: 'l1', ticketCount: 3, hasPaid: true },
        { lotteryId: 'l1', ticketCount: 2, hasPaid: false },
      ], // 3 billes payées * 50k = 150k revenu orga
      races: [{ id: 'r1', name: 'Sprint', entryFee: 100000, orgaCutPercent: 10, betOrgaCutPercent: 20, winnerPilotId: undefined }],
      racePilots: [
        { id: 'rp1', raceId: 'r1', hasPaid: true }, { id: 'rp2', raceId: 'r1', hasPaid: true },
      ], // pool pilotes 200k, orga 10% = 20k
      raceBets: [
        { id: 'b1', raceId: 'r1', pilotId: 'rp1', amount: 50000, hasPaid: true },
        { id: 'b2', raceId: 'r1', pilotId: 'rp2', amount: 30000, hasPaid: false },
      ], // pot paris payés 50k, orga 20% = 10k (estimation, pas de vainqueur)
    };
    const r = computeFinanceSummary(data);
    expect(r.contest.pool).toBe(300000);
    expect(r.contest.orgaCut).toBe(30000);
    expect(r.lotteries.revenue).toBe(150000);
    expect(r.races[0].pilotOrgaCut).toBe(20000);
    expect(r.races[0].betOrgaCut).toBe(10000);
    // Ta part = 30k (concours) + 150k (loterie) + 20k + 10k (course) = 210k
    expect(r.totals.orgaTake).toBe(210000);
    // À redistribuer = net concours 270k + net pilotes 180k + net paris 40k = 490k
    expect(r.totals.toPayOut).toBe(270000 + 180000 + 40000);
  });

  it('handles an empty db gracefully', () => {
    const r = computeFinanceSummary({ event: { entryFee: 0 } });
    expect(r.totals).toEqual({ orgaTake: 0, toPayOut: 0, grossHandled: 0, costs: 0, netProfit: 0 });
  });
});

describe('computeCategoryPools', () => {
  it('routes each paid participant fee to its vehicle category pool', () => {
    const vehicles = [
      { id: 'v1', participantId: 'p1', category: 'JDM' },
      { id: 'v2', participantId: 'p2', category: 'JDM' },
      { id: 'v3', participantId: 'p3', category: 'Muscle' },
      { id: 'v4', participantId: 'p4', category: '' }, // → bucket Général
    ];
    const participants = [
      { id: 'p1', hasPaid: true },
      { id: 'p2', hasPaid: true },
      { id: 'p3', hasPaid: true },
      { id: 'p4', hasPaid: false }, // pas payé → ignoré
      { id: 'p5', hasPaid: true },  // payé mais sans véhicule → aucun pot
    ];
    const pools = computeCategoryPools(vehicles, participants, 100000);
    const jdm = pools.find((p) => p.category === 'JDM');
    const muscle = pools.find((p) => p.category === 'Muscle');
    expect(jdm.paidCount).toBe(2);
    expect(jdm.pool).toBe(200000);
    expect(jdm.orgaCut).toBe(20000);
    expect(muscle.paidCount).toBe(1);
    expect(muscle.pool).toBe(100000);
    // p4 pas payé, p5 sans véhicule → pas de pot 'Général'
    expect(pools.find((p) => p.category === '')).toBeUndefined();
    // Tri par pool décroissant.
    expect(pools[0].category).toBe('JDM');
  });
});
