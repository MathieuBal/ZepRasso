import { getAdminCode, getVoterId } from './localSession';
import type { AuditReport, Lottery, LotteryEntry, LotteryStats, Participant, PaymentMethod, PrizePool, Race, RaceDetails, RacePilot, RassoEvent, Vehicle, Vote, VoteInput } from '../types';

export const EVENT_ID = 'rasso';

export function getConfiguredEventId(): string {
  return EVENT_ID;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers: extraHeaders, ...rest } = options;
  const response = await fetch(`/api${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
  if (!response.ok) {
    let message = `Erreur réseau (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // réponse sans corps JSON, on garde le message générique
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function adminHeaders(): Record<string, string> {
  return { 'x-admin-code': getAdminCode() || '' };
}

export function getEvent(): Promise<RassoEvent> {
  return api<RassoEvent>('/event');
}

export type NetworkInfo = {
  lanIp: string;
  port: number;
  lanUrl: string | null;
  publicUrl: string | null;
  behindTunnel: boolean;
};

export function getNetwork(): Promise<NetworkInfo> {
  return api<NetworkInfo>('/network');
}

export type PrizeSummary = PrizePool & { entryFee: number; paidCount: number };

export function getPrize(): Promise<PrizeSummary> {
  return api<PrizeSummary>('/prize');
}

export function updateEvent(patch: { name?: string; status?: RassoEvent['status']; entryFee?: number }): Promise<RassoEvent> {
  return api<RassoEvent>('/event', { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(patch) });
}

export type RegistrationStatus = { registered: boolean; pseudo?: string; id?: string };

export function registerParticipant(input: { pseudo: string; contactInfo?: string }): Promise<{ id: string; pseudo: string; registered: boolean }> {
  return api('/register', {
    method: 'POST',
    body: JSON.stringify({ ...input, deviceToken: getVoterId() }),
  });
}

export function getRegistrationStatus(): Promise<RegistrationStatus> {
  return api<RegistrationStatus>(`/register/status?deviceToken=${encodeURIComponent(getVoterId())}`);
}

export function getParticipants(): Promise<Participant[]> {
  return api<Participant[]>('/participants', { headers: adminHeaders() });
}

export type ParticipantPatch = {
  hasPaid?: boolean;
  paymentMethod?: PaymentMethod | null;
  note?: string;
  pseudo?: string;
  contactInfo?: string;
};

export function updateParticipant(id: string, patch: ParticipantPatch): Promise<Participant> {
  return api<Participant>(`/participants/${id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(patch) });
}

export async function deleteParticipant(id: string): Promise<void> {
  await api(`/participants/${id}`, { method: 'DELETE', headers: adminHeaders() });
}

export function getVehicles(): Promise<Vehicle[]> {
  return api<Vehicle[]>('/vehicles');
}

export function getVotes(): Promise<Vote[]> {
  return api<Vote[]>('/votes');
}

export async function upsertVote(input: Omit<VoteInput, 'voterId'>): Promise<void> {
  await api('/votes', { method: 'POST', body: JSON.stringify({ ...input, voterId: getVoterId() }) });
}

export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'eventId' | 'createdAt'>): Promise<void> {
  await api('/vehicles', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(vehicle) });
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  await api(`/vehicles/${vehicleId}`, { method: 'DELETE', headers: adminHeaders() });
}

export async function toggleVehicleDisqualification(vehicle: Vehicle): Promise<void> {
  await api(`/vehicles/${vehicle.id}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ isDisqualified: !vehicle.isDisqualified }),
  });
}

export async function resetVotes(): Promise<void> {
  await api('/votes', { method: 'DELETE', headers: adminHeaders() });
}

export async function verifyAdminCode(code: string): Promise<boolean> {
  try {
    await api('/admin/login', { method: 'POST', body: JSON.stringify({ code }) });
    return true;
  } catch {
    return false;
  }
}

export async function downloadBackup(): Promise<Blob> {
  const response = await fetch('/api/admin/backup', { headers: adminHeaders() });
  if (!response.ok) {
    let message = `Erreur réseau (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // pas de corps JSON, on garde le message générique
    }
    throw new Error(message);
  }
  return response.blob();
}

export async function restoreBackup(data: unknown): Promise<{ vehicles: number; votes: number }> {
  return api('/admin/restore', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(data) });
}

export function getAudit(): Promise<AuditReport> {
  return api<AuditReport>('/admin/audit', { headers: adminHeaders() });
}

// ─── Loteries (admin) ────────────────────────────────────────────────────────

export function getLotteries(): Promise<Lottery[]> {
  return api<Lottery[]>('/lotteries', { headers: adminHeaders() });
}

export type LotteryCreate = {
  name: string;
  prizeDescription?: string;
  prizeImageUrl?: string;
  ticketPrice: number;
  maxTicketsPerBuyer: number;
};

export function createLottery(input: LotteryCreate): Promise<Lottery> {
  return api<Lottery>('/lotteries', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(input) });
}

export function updateLottery(id: string, patch: Partial<LotteryCreate> & { status?: Lottery['status'] }): Promise<Lottery> {
  return api<Lottery>(`/lotteries/${id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(patch) });
}

export async function deleteLottery(id: string): Promise<void> {
  await api(`/lotteries/${id}`, { method: 'DELETE', headers: adminHeaders() });
}

export function getLotteryEntries(id: string): Promise<{ lottery: Lottery; entries: LotteryEntry[]; stats: LotteryStats }> {
  return api(`/lotteries/${id}/entries`, { headers: adminHeaders() });
}

export type LotteryEntryInput = {
  firstName: string;
  lastName: string;
  phone?: string;
  ticketCount: number;
  hasPaid?: boolean;
  paymentMethod?: PaymentMethod;
  note?: string;
};

export function addLotteryEntry(lotteryId: string, input: LotteryEntryInput): Promise<LotteryEntry> {
  return api<LotteryEntry>(`/lotteries/${lotteryId}/entries`, { method: 'POST', headers: adminHeaders(), body: JSON.stringify(input) });
}

export type LotteryEntryPatch = Partial<Omit<LotteryEntryInput, 'paymentMethod'>> & { paymentMethod?: PaymentMethod | null };

export function updateLotteryEntry(entryId: string, patch: LotteryEntryPatch): Promise<LotteryEntry> {
  return api<LotteryEntry>(`/lottery-entries/${entryId}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(patch) });
}

export async function deleteLotteryEntry(entryId: string): Promise<void> {
  await api(`/lottery-entries/${entryId}`, { method: 'DELETE', headers: adminHeaders() });
}

export function drawLottery(id: string): Promise<{ winner: LotteryEntry }> {
  return api<{ winner: LotteryEntry }>(`/lotteries/${id}/draw`, { method: 'POST', headers: adminHeaders() });
}

// ─── Courses chronométrées (admin) ──────────────────────────────────────────

export function getRaces(): Promise<Race[]> {
  return api<Race[]>('/races', { headers: adminHeaders() });
}

export type RaceCreate = {
  name: string;
  description?: string;
  entryFee: number;
  rounds: number;
  sequenceMode: Race['sequenceMode'];
  orgaCutPercent: number;
};

export function createRace(input: RaceCreate): Promise<Race> {
  return api<Race>('/races', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(input) });
}

export function updateRace(id: string, patch: Partial<RaceCreate> & { status?: Race['status'] }): Promise<Race> {
  return api<Race>(`/races/${id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(patch) });
}

export async function deleteRace(id: string): Promise<void> {
  await api(`/races/${id}`, { method: 'DELETE', headers: adminHeaders() });
}

export function getRaceDetails(id: string): Promise<RaceDetails> {
  return api<RaceDetails>(`/races/${id}/pilots`, { headers: adminHeaders() });
}

export type RacePilotInput = {
  pseudo: string;
  vehicle?: string;
  hasPaid?: boolean;
  paymentMethod?: PaymentMethod;
  note?: string;
};

export function addRacePilot(raceId: string, input: RacePilotInput): Promise<RacePilot> {
  return api<RacePilot>(`/races/${raceId}/pilots`, { method: 'POST', headers: adminHeaders(), body: JSON.stringify(input) });
}

export type RacePilotPatch = Partial<Omit<RacePilotInput, 'paymentMethod'>> & {
  paymentMethod?: PaymentMethod | null;
  // Mise à jour ciblée d'un temps : { roundIndex, timeMs }
  roundIndex?: number;
  timeMs?: number | null;
  times?: (number | null)[];
};

export function updateRacePilot(id: string, patch: RacePilotPatch): Promise<RacePilot> {
  return api<RacePilot>(`/race-pilots/${id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(patch) });
}

export async function deleteRacePilot(id: string): Promise<void> {
  await api(`/race-pilots/${id}`, { method: 'DELETE', headers: adminHeaders() });
}

// Téléchargement direct (admin-headers) du CSV billes.
export async function downloadMarblesCsv(lotteryId: string): Promise<Blob> {
  const response = await fetch(`/api/lotteries/${lotteryId}/marbles.csv`, { headers: adminHeaders() });
  if (!response.ok) {
    let message = `Erreur réseau (${response.status})`;
    try { const body = await response.json(); if (body?.error) message = body.error; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.blob();
}
