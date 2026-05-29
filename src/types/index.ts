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
  average: number;
  averagesByCriterion: {
    aesthetics: number;
    coherence: number;
    originality: number;
    details: number;
    rpPresentation: number;
  };
};
