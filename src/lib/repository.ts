import { getAdminCode } from './localSession';
import type { RassoEvent, Vehicle, Vote, VoteInput } from '../types';

export const EVENT_ID = 'rasso';

export function getConfiguredEventId(): string {
  return EVENT_ID;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
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

export function updateEvent(patch: { name?: string; status?: RassoEvent['status'] }): Promise<RassoEvent> {
  return api<RassoEvent>('/event', { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(patch) });
}

export function getVehicles(): Promise<Vehicle[]> {
  return api<Vehicle[]>('/vehicles');
}

export function getVotes(): Promise<Vote[]> {
  return api<Vote[]>('/votes');
}

export async function upsertVote(input: VoteInput): Promise<void> {
  await api('/votes', { method: 'POST', body: JSON.stringify(input) });
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
