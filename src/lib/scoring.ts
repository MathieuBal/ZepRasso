import type { Vehicle, VehicleScore, Vote } from '../types';

const round = (value: number) => Math.round(value * 10) / 10;

// Poids de lissage bayésien : nombre de "votes virtuels" à la moyenne globale
// ajoutés à chaque véhicule. Tasse l'écart entre véhicules très notés et peu
// notés ; ne suffit pas seul à neutraliser un coup de chance isolé (cf quorum).
const PRIOR_WEIGHT = 3;

// Quorum : un véhicule doit avoir reçu des votes d'au moins la moitié des
// participants actifs (et au moins 2) pour entrer dans le classement. Un seul
// 10/10 d'un copain ne peut donc pas faire monter un véhicule sur le podium.
const QUORUM_RATIO = 0.5;
const MIN_QUORUM = 2;

export function calculateVoteAverage(vote: Pick<Vote, 'aesthetics' | 'coherence' | 'originality' | 'details' | 'rpPresentation'>): number {
  return round((vote.aesthetics + vote.coherence + vote.originality + vote.details + vote.rpPresentation) / 5);
}

export function isOwnVehicle(vehicle: Pick<Vehicle, 'ownerName'>, voterPseudo: string | null | undefined): boolean {
  if (!voterPseudo) return false;
  return (vehicle.ownerName || '').trim().toLowerCase() === voterPseudo.trim().toLowerCase();
}

function voterKey(vote: Vote): string {
  return vote.voterId ? `id:${vote.voterId}` : `pseudo:${vote.voterPseudo.toLowerCase()}`;
}

export function calculateVehicleScores(vehicles: Vehicle[], votes: Vote[]): VehicleScore[] {
  const contestants = vehicles.filter((vehicle) => vehicle.isContestant && !vehicle.isDisqualified);
  const contestantIds = new Set(contestants.map((v) => v.id));
  const relevantVotes = votes.filter((vote) => contestantIds.has(vote.vehicleId));

  const distinctVoters = new Set(relevantVotes.map(voterKey)).size;
  const quorum = Math.max(MIN_QUORUM, Math.ceil(distinctVoters * QUORUM_RATIO));

  // Moyenne globale (C) sur l'ensemble des votes : prior du lissage bayésien.
  // Si aucun vote, fallback à 5 (milieu de l'échelle 0-10).
  const globalMean = relevantVotes.length > 0
    ? relevantVotes.reduce((sum, vote) => sum + calculateVoteAverage(vote), 0) / relevantVotes.length
    : 5;

  const scored = contestants.map((vehicle) => {
    const vehicleVotes = relevantVotes.filter((vote) => vote.vehicleId === vehicle.id);
    const voteCount = vehicleVotes.length;
    const eligibleForRank = voteCount >= quorum;

    if (voteCount === 0) {
      return {
        vehicle,
        voteCount,
        average: 0,
        weightedAverage: round(globalMean),
        eligibleForRank,
        quorum,
        averagesByCriterion: {
          aesthetics: 0, coherence: 0, originality: 0, details: 0, rpPresentation: 0,
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

    const rawAverage = calculateVoteAverage(averagesByCriterion);
    const weightedAverage = round(
      (rawAverage * voteCount + globalMean * PRIOR_WEIGHT) / (voteCount + PRIOR_WEIGHT),
    );

    return { vehicle, voteCount, average: rawAverage, weightedAverage, eligibleForRank, quorum, averagesByCriterion };
  });

  // Tri : éligibles d'abord (par note pondérée puis nb votes), non éligibles
  // à la fin (par note brute pour info), de sorte qu'aucun véhicule sous
  // quorum ne puisse occuper le podium.
  return scored.sort((a, b) => {
    if (a.eligibleForRank !== b.eligibleForRank) return a.eligibleForRank ? -1 : 1;
    if (a.eligibleForRank) {
      return b.weightedAverage - a.weightedAverage || b.voteCount - a.voteCount;
    }
    return b.average - a.average || b.voteCount - a.voteCount;
  });
}

export function findUserVote(votes: Vote[], vehicleId: string, voterPseudo: string | null): Vote | undefined {
  if (!voterPseudo) return undefined;
  return votes.find((vote) => vote.vehicleId === vehicleId && vote.voterPseudo.toLowerCase() === voterPseudo.toLowerCase());
}

// Regroupe des scores déjà calculés par catégorie de véhicule (catégorie vide
// = bucket ''). L'ordre des catégories suit le meilleur score de chacune.
// Le classement à l'intérieur reste celui de calculateVehicleScores (quorum +
// pondération calculés globalement, on ne fait que filtrer/regrouper ici).
export function groupScoresByCategory(scores: VehicleScore[]): { category: string; scores: VehicleScore[] }[] {
  const byCat = new Map<string, VehicleScore[]>();
  for (const s of scores) {
    const cat = (s.vehicle.category || '').trim();
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(s);
  }
  return [...byCat.entries()]
    .map(([category, list]) => ({ category, scores: list }))
    .sort((a, b) => {
      const bestA = a.scores[0]?.weightedAverage ?? 0;
      const bestB = b.scores[0]?.weightedAverage ?? 0;
      return bestB - bestA;
    });
}
