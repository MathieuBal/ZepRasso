export type EventStatus = 'draft' | 'open' | 'closed';

export type RassoEvent = {
  id: string;
  name: string;
  status: EventStatus;
  createdAt: string;
};

export type Vehicle = {
  id: string;
  eventId: string;
  name: string;
  ownerName: string;
  category: string;
  plate?: string;
  imageUrl?: string;
  description?: string;
  isContestant: boolean;
  isDisqualified: boolean;
  createdAt: string;
};

export type Vote = {
  id: string;
  eventId: string;
  vehicleId: string;
  voterId?: string;
  voterPseudo: string;
  aesthetics: number;
  coherence: number;
  originality: number;
  details: number;
  rpPresentation: number;
  ip?: string;
  createdAt: string;
  updatedAt: string;
};

export type VoteInput = {
  eventId: string;
  vehicleId: string;
  voterId: string;
  voterPseudo: string;
  aesthetics: number;
  coherence: number;
  originality: number;
  details: number;
  rpPresentation: number;
};

export type AuditReport = {
  totalVotes: number;
  distinctVoters: number;
  distinctIps: number;
  sharedIps: { ip: string; voters: number; pseudos: string[] }[];
  reusedPseudos: { pseudo: string; devices: number }[];
};

export type VehicleScore = {
  vehicle: Vehicle;
  voteCount: number;
  /** Moyenne brute des votes reçus (affichage transparent). */
  average: number;
  /** Moyenne pondérée bayésienne utilisée pour le classement final.
   *  Compense le biais des véhicules peu notés. */
  weightedAverage: number;
  /** Vrai si le véhicule a reçu assez de votes pour être classé (quorum). */
  eligibleForRank: boolean;
  /** Seuil de votes en vigueur pour cet event (info UI). */
  quorum: number;
  averagesByCriterion: {
    aesthetics: number;
    coherence: number;
    originality: number;
    details: number;
    rpPresentation: number;
  };
};
