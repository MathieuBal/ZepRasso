export type EventStatus = 'draft' | 'registrations' | 'voting' | 'closed';

export type RassoEvent = {
  id: string;
  name: string;
  status: EventStatus;
  entryFee: number;
  createdAt: string;
};

export type PaymentMethod = 'cash' | 'virement';

export type Participant = {
  id: string;
  eventId: string;
  pseudo: string;
  deviceToken: string;
  contactInfo?: string;
  hasPaid: boolean;
  paymentMethod?: PaymentMethod;
  note?: string;
  registeredAt: string;
};

export type PrizePool = {
  pool: number;
  orgaCut: number;
  net: number;
  podium: { first: number; second: number; third: number };
};

export type LotteryStatus = 'open' | 'closed' | 'drawn';

export type Lottery = {
  id: string;
  name: string;
  prizeDescription?: string;
  prizeImageUrl?: string;
  ticketPrice: number;
  prizeValue: number;
  maxTicketsPerBuyer: number;
  status: LotteryStatus;
  winnerEntryNumber?: number;
  winnerEntryId?: string;
  createdAt: string;
};

export type LotteryEntry = {
  id: string;
  lotteryId: string;
  entryNumber: number;
  firstName: string;
  lastName: string;
  phone?: string;
  ticketCount: number;
  hasPaid: boolean;
  paymentMethod?: PaymentMethod;
  note?: string;
  createdAt: string;
};

export type LotteryStats = {
  totalEntries: number;
  paidEntries: number;
  totalTickets: number;
  paidTickets: number;
  revenue: number;
};

export type RaceStatus = 'draft' | 'open' | 'running' | 'finished';
export type RaceSequenceMode = 'sequential' | 'alternating';
export type RaceBettingStatus = 'closed' | 'open' | 'locked';

export type Race = {
  id: string;
  name: string;
  description?: string;
  entryFee: number;
  rounds: number;
  sequenceMode: RaceSequenceMode;
  orgaCutPercent: number;
  betOrgaCutPercent: number;
  status: RaceStatus;
  bettingStatus: RaceBettingStatus;
  winnerPilotId?: string;
  createdAt: string;
};

export type RaceBet = {
  id: string;
  raceId: string;
  bettorPseudo: string;
  voterId?: string;
  pilotId: string;
  amount: number;
  hasPaid: boolean;
  paymentMethod?: PaymentMethod;
  note?: string;
  createdAt: string;
};

export type RaceBetPayout = {
  betId: string;
  bettorPseudo: string;
  pilotId: string;
  bet: number;
  payout: number;
  profit: number;
};

export type RaceBetPayouts = {
  pool: number;
  orgaCut: number;
  net: number;
  winners: RaceBetPayout[];
  orgaTakesAll: boolean;
};

export type RacePilot = {
  id: string;
  raceId: string;
  pseudo: string;
  vehicle?: string;
  hasPaid: boolean;
  paymentMethod?: PaymentMethod;
  note?: string;
  times: (number | null)[]; // millisecondes ou null pour un essai non passé
  createdAt: string;
};

// Pilote enrichi côté serveur dans la réponse /pilots (meilleur temps + rang
// + total parié sur lui parmi les paris payés).
export type RacePilotWithMeta = RacePilot & {
  bestTime: number | null;
  rank: number | null;
  paidStake: number;
  bettors: number;
};

export type RaceDetails = {
  race: Race;
  pilots: RacePilotWithMeta[];
  prize: PrizePool;
  paidCount: number;
  totalPilots: number;
  betPayouts: RaceBetPayouts;
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
  participantId?: string;
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

export type FinanceSummary = {
  contest: {
    paidParticipants: number;
    pool: number;
    orgaCut: number;
    toPayOut: number;
    categories: CategoryPool[];
  };
  lotteries: {
    detail: { id: string; name: string; revenue: number; cost: number; profit: number; paidTickets: number; status: string }[];
    revenue: number;
    cost: number;
    profit: number;
  };
  races: {
    id: string;
    name: string;
    status: string;
    winnerDeclared: boolean;
    pilotPool: number;
    pilotOrgaCut: number;
    pilotToPayOut: number;
    betPool: number;
    betOrgaCut: number;
    betToPayOut: number;
    orgaCut: number;
  }[];
  totals: {
    orgaTake: number;
    toPayOut: number;
    grossHandled: number;
    costs: number;
    netProfit: number;
  };
};

export type CategoryPool = PrizePool & { category: string; paidCount: number };

export type CategoriesInfo = {
  entryFee: number;
  categories: CategoryPool[];
};
