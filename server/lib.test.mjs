import { describe, expect, it } from 'vitest';
import {
  clamp,
  computeAudit,
  defaultDb,
  findExistingVote,
  normalizeDb,
  normalizeVote,
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
    expect(db.event.status).toBe('open');
    expect(db.vehicles).toEqual([]);
    expect(db.votes).toEqual([]);
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

  it('coerces an unknown event status to open', () => {
    const db = normalizeDb({ event: { name: 'X', status: 'wat' } }, NOW);
    expect(db.event.status).toBe('open');
  });

  it('keeps a valid status and uses default name fallback', () => {
    const db = normalizeDb({ event: { name: '   ', status: 'closed' } }, NOW);
    expect(db.event.status).toBe('closed');
    expect(db.event.name).toBe(defaultDb(NOW).event.name);
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
