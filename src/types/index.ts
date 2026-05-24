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
  voterPseudo: string;
  aesthetics: number;
  coherence: number;
  originality: number;
  details: number;
  rpPresentation: number;
  createdAt: string;
  updatedAt: string;
};

export type VoteInput = Omit<Vote, 'id' | 'createdAt' | 'updatedAt'>;

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
