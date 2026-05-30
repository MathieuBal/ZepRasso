import { describe, expect, it } from 'vitest';
import { calculateVehicleScores, calculateVoteAverage, findUserVote } from './scoring';
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

  it('orders by average desc, then by vote count desc', () => {
    const scores = calculateVehicleScores(
      [vehicle({ id: 'A' }), vehicle({ id: 'B' }), vehicle({ id: 'C' })],
      [
        vote({ id: '1', vehicleId: 'A', aesthetics: 8, coherence: 8, originality: 8, details: 8, rpPresentation: 8 }),
        vote({ id: '2', vehicleId: 'B', aesthetics: 10, coherence: 10, originality: 10, details: 10, rpPresentation: 10 }),
        // Tie on average (8) but C has 2 votes vs A's 1.
        vote({ id: '3', vehicleId: 'C', aesthetics: 8, coherence: 8, originality: 8, details: 8, rpPresentation: 8, voterPseudo: 'p1' }),
        vote({ id: '4', vehicleId: 'C', aesthetics: 8, coherence: 8, originality: 8, details: 8, rpPresentation: 8, voterPseudo: 'p2' }),
      ],
    );
    expect(scores.map((s) => s.vehicle.id)).toEqual(['B', 'C', 'A']);
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
