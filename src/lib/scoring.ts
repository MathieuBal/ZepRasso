import type { Vehicle, VehicleScore, Vote } from '../types';

const round = (value: number) => Math.round(value * 10) / 10;

export function calculateVoteAverage(vote: Pick<Vote, 'aesthetics' | 'coherence' | 'originality' | 'details' | 'rpPresentation'>): number {
  return round((vote.aesthetics + vote.coherence + vote.originality + vote.details + vote.rpPresentation) / 5);
}

export function calculateVehicleScores(vehicles: Vehicle[], votes: Vote[]): VehicleScore[] {
  return vehicles
    .filter((vehicle) => vehicle.isContestant && !vehicle.isDisqualified)
    .map((vehicle) => {
      const vehicleVotes = votes.filter((vote) => vote.vehicleId === vehicle.id);
      const voteCount = vehicleVotes.length;

      if (voteCount === 0) {
        return {
          vehicle,
          voteCount,
          average: 0,
          averagesByCriterion: {
            aesthetics: 0,
            coherence: 0,
            originality: 0,
            details: 0,
            rpPresentation: 0,
          },
        };
      }

      const totals = vehicleVotes.reduce(
        (acc, vote) => ({
          aesthetics: acc.aesthetics + vote.aesthetics,
          coherence: acc.coherence + vote.coherence,
          originality: acc.originality + vote.originality,
          details: acc.details + vote.details,
          rpPresentation: acc.rpPresentation + vote.rpPresentation,
        }),
        { aesthetics: 0, coherence: 0, originality: 0, details: 0, rpPresentation: 0 },
      );

      const averagesByCriterion = {
        aesthetics: round(totals.aesthetics / voteCount),
        coherence: round(totals.coherence / voteCount),
        originality: round(totals.originality / voteCount),
        details: round(totals.details / voteCount),
        rpPresentation: round(totals.rpPresentation / voteCount),
      };

      return {
        vehicle,
        voteCount,
        average: calculateVoteAverage(averagesByCriterion),
        averagesByCriterion,
      };
    })
    .sort((a, b) => b.average - a.average || b.voteCount - a.voteCount);
}

export function findUserVote(votes: Vote[], vehicleId: string, voterPseudo: string | null): Vote | undefined {
  if (!voterPseudo) return undefined;
  return votes.find((vote) => vote.vehicleId === vehicleId && vote.voterPseudo.toLowerCase() === voterPseudo.toLowerCase());
}
