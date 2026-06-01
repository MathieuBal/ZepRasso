import { describe, expect, it } from 'vitest';
import { calculateVehicleScores, calculateVoteAverage, findUserVote, isOwnVehicle } from './scoring';
import type { Vehicle, Vote } from '../types';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    eventId: 'rasso',
    name: 'Test',
    ownerName: 'Owner',
    category: '',
    isContestant: true,
    isDisqualified: false,
    createdAt: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

function vote(overrides: Partial<Vote> = {}): Vote {
  return {
    id: 'vote-1',
    eventId: 'rasso',
    vehicleId: 'v1',
    voterPseudo: 'Alice',
    aesthetics: 5,
    coherence: 5,
    originality: 5,
    details: 5,
    rpPresentation: 5,
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateVoteAverage', () => {
  it('returns the rounded mean of the five criteria', () => {
    expect(calculateVoteAverage({ aesthetics: 8, coherence: 7, originality: 9, details: 6, rpPresentation: 10 })).toBe(8);
  });

  it('keeps one decimal precision', () => {
    expect(calculateVoteAverage({ aesthetics: 7, coherence: 7, originality: 8, details: 7, rpPresentation: 7 })).toBe(7.2);
  });
});

describe('calculateVehicleScores', () => {
  it('returns 0 averages for vehicles with no vote', () => {
    const scores = calculateVehicleScores([vehicle({ id: 'A' })], []);
    expect(scores).toHaveLength(1);
    expect(scores[0].voteCount).toBe(0);
    expect(scores[0].average).toBe(0);
  });

  it('excludes non-contestants and disqualified vehicles', () => {
    const scores = calculateVehicleScores(
      [
        vehicle({ id: 'A' }),
        vehicle({ id: 'B', isContestant: false }),
        vehicle({ id: 'C', isDisqualified: true }),
      ],
      [vote({ vehicleId: 'A' }), vote({ id: 'v2', vehicleId: 'B' }), vote({ id: 'v3', vehicleId: 'C' })],
    );
    expect(scores.map((s) => s.vehicle.id)).toEqual(['A']);
  });

  it('disqualifies lone-vote outliers from the ranking via quorum', () => {
    // A : 1 vote à 10/10 (sous quorum) — ne peut pas occuper le podium.
    // B : 5 votes à 8/10 — quorum atteint, prend la tête malgré sa note plus basse.
    const scores = calculateVehicleScores(
      [vehicle({ id: 'A' }), vehicle({ id: 'B' })],
      [
        vote({ id: 'a1', vehicleId: 'A', voterPseudo: 'lone', aesthetics: 10, coherence: 10, originality: 10, details: 10, rpPresentation: 10 }),
        ...Array.from({ length: 5 }, (_, i) =>
          vote({ id: `b${i}`, vehicleId: 'B', voterPseudo: `p${i}`, aesthetics: 8, coherence: 8, originality: 8, details: 8, rpPresentation: 8 }),
        ),
      ],
    );
    expect(scores.map((s) => s.vehicle.id)).toEqual(['B', 'A']);
    expect(scores[0].eligibleForRank).toBe(true);
    expect(scores[1].eligibleForRank).toBe(false);
    expect(scores[1].average).toBe(10); // la note brute est conservée pour info
  });

  it('smooths the weighted average toward the global mean for low-vote eligible cars', () => {
    // 2 véhicules tous deux au quorum (3 votes chacun, distinctVoters=6, quorum=3),
    // A à 10/10, B à 6/10 → la pondération rapproche les notes sans les inverser.
    const scores = calculateVehicleScores(
      [vehicle({ id: 'A' }), vehicle({ id: 'B' })],
      [
        ...Array.from({ length: 3 }, (_, i) =>
          vote({ id: `a${i}`, vehicleId: 'A', voterPseudo: `pa${i}`, aesthetics: 10, coherence: 10, originality: 10, details: 10, rpPresentation: 10 }),
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          vote({ id: `b${i}`, vehicleId: 'B', voterPseudo: `pb${i}`, aesthetics: 6, coherence: 6, originality: 6, details: 6, rpPresentation: 6 }),
        ),
      ],
    );
    expect(scores[0].average).toBe(10);
    expect(scores[0].weightedAverage).toBeLessThan(10);
    expect(scores[1].weightedAverage).toBeGreaterThan(6);
  });

  it('tiebreaks on vote count when weighted scores match', () => {
    // 3 votes par véhicule pour atteindre le quorum à 6 votants distincts.
    const scores = calculateVehicleScores(
      [vehicle({ id: 'A' }), vehicle({ id: 'B' })],
      [
        ...Array.from({ length: 3 }, (_, i) =>
          vote({ id: `a${i}`, vehicleId: 'A', voterPseudo: `pa${i}`, aesthetics: 8, coherence: 8, originality: 8, details: 8, rpPresentation: 8 }),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          vote({ id: `b${i}`, vehicleId: 'B', voterPseudo: `pb${i}`, aesthetics: 8, coherence: 8, originality: 8, details: 8, rpPresentation: 8 }),
        ),
      ],
    );
    expect(scores.map((s) => s.vehicle.id)).toEqual(['B', 'A']);
  });

  it('averages each criterion independently and rounds to one decimal', () => {
    const scores = calculateVehicleScores(
      [vehicle({ id: 'A' })],
      [
        vote({ id: '1', vehicleId: 'A', voterPseudo: 'p1', aesthetics: 9, coherence: 5, originality: 7, details: 6, rpPresentation: 8 }),
        vote({ id: '2', vehicleId: 'A', voterPseudo: 'p2', aesthetics: 8, coherence: 6, originality: 8, details: 7, rpPresentation: 7 }),
      ],
    );
    expect(scores[0].averagesByCriterion).toEqual({
      aesthetics: 8.5,
      coherence: 5.5,
      originality: 7.5,
      details: 6.5,
      rpPresentation: 7.5,
    });
    expect(scores[0].voteCount).toBe(2);
    expect(scores[0].average).toBe(7.1);
  });
});

describe('isOwnVehicle', () => {
  it('matches case-insensitively with trimming', () => {
    expect(isOwnVehicle({ ownerName: 'Sandro_Vega' }, 'sandro_vega')).toBe(true);
    expect(isOwnVehicle({ ownerName: '  Sandro ' }, 'sandro')).toBe(true);
  });

  it('returns false when pseudo is empty or different', () => {
    expect(isOwnVehicle({ ownerName: 'Sandro' }, null)).toBe(false);
    expect(isOwnVehicle({ ownerName: 'Sandro' }, '')).toBe(false);
    expect(isOwnVehicle({ ownerName: 'Sandro' }, 'Mario')).toBe(false);
  });
});

describe('findUserVote', () => {
  const votes = [vote({ vehicleId: 'A', voterPseudo: 'Alice' })];

  it('matches a pseudo case-insensitively', () => {
    expect(findUserVote(votes, 'A', 'alice')?.voterPseudo).toBe('Alice');
    expect(findUserVote(votes, 'A', 'ALICE')?.voterPseudo).toBe('Alice');
  });

  it('returns undefined when pseudo is null', () => {
    expect(findUserVote(votes, 'A', null)).toBeUndefined();
  });

  it('does not match a different vehicle', () => {
    expect(findUserVote(votes, 'B', 'Alice')).toBeUndefined();
  });
});
