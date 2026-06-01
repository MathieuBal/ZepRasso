import { describe, expect, it } from 'vitest';
import {
  clamp,
  computeAudit,
  computePrizePool,
  defaultDb,
  findExistingVote,
  isOwnVehicle,
  normalizeDb,
  normalizeParticipant,
  normalizeVote,
  ownsVehicleByDevice,
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
    expect(db.event.id).toBe('rasso');
    expect(db.event.status).toBe('draft');
    expect(db.event.entryFee).toBe(0);
    expect(db.vehicles).toEqual([]);
    expect(db.votes).toEqual([]);
    expect(db.participants).toEqual([]);
  });

  it('migrates the legacy "open" status to "voting"', () => {
    const db = normalizeDb({ event: { name: 'X', status: 'open' } }, NOW);
    expect(db.event.status).toBe('voting');
  });

  it('keeps an existing draft status as draft (no auto-promotion)', () => {
    const db = normalizeDb({ event: { name: 'X', status: 'draft' } }, NOW);
    expect(db.event.status).toBe('draft');
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
    expect(normalizeDb({ event: { entryFee: -5 } }, NOW).event.entryFee).toBe(0);
    expect(normalizeDb({ event: { entryFee: 'abc' } }, NOW).event.entryFee).toBe(0);
    expect(normalizeDb({ event: { entryFee: 12 } }, NOW).event.entryFee).toBe(12);
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
    expect(db.event.status).toBe('draft');
  });

  it('keeps a valid status and uses default name fallback', () => {
    const db = normalizeDb({ event: { name: '   ', status: 'closed' } }, NOW);
    expect(db.event.status).toBe('closed');
    expect(db.event.name).toBe(defaultDb(NOW).event.name);
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
