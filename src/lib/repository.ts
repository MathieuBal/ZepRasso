import { demoEvent, demoVehicles, demoVotes } from './mockData';
import { safeStorage, safeUuid } from './storage';
import { isSupabaseConfigured, supabase } from './supabase';
import type { RassoEvent, Vehicle, Vote, VoteInput } from '../types';

const LOCAL_VEHICLES_KEY = 'zeprasso_demo_vehicles';
const LOCAL_VOTES_KEY = 'zeprasso_demo_votes';
const DEFAULT_SUPABASE_EVENT_ID = '00000000-0000-0000-0000-000000000001';
const PHOTO_BUCKET = 'vehicle-photos';
const EVENT_ID = import.meta.env.VITE_EVENT_ID || (isSupabaseConfigured ? DEFAULT_SUPABASE_EVENT_ID : demoEvent.id);

async function uploadPhotoIfNeeded(imageUrl?: string): Promise<string | undefined> {
  if (!imageUrl || !imageUrl.startsWith('data:') || !supabase) return imageUrl;
  const blob = await (await fetch(imageUrl)).blob();
  const path = `${EVENT_ID}/${safeUuid()}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`Upload photo: ${error.message}`);
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readLocal<T>(key: string, fallback: T): T {
  const raw = safeStorage.getItem(key);
  if (!raw) return clone(fallback);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return clone(fallback);
  }
}

function writeLocal<T>(key: string, value: T): void {
  safeStorage.setItem(key, JSON.stringify(value));
}

function mapVehicleFromDb(row: Record<string, unknown>): Vehicle {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    name: String(row.name),
    ownerName: String(row.owner_name),
    category: String(row.category || ''),
    plate: row.plate ? String(row.plate) : undefined,
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    description: row.description ? String(row.description) : undefined,
    isContestant: Boolean(row.is_contestant),
    isDisqualified: Boolean(row.is_disqualified),
    createdAt: String(row.created_at),
  };
}

function mapVoteFromDb(row: Record<string, unknown>): Vote {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    vehicleId: String(row.vehicle_id),
    voterPseudo: String(row.voter_pseudo),
    aesthetics: Number(row.aesthetics),
    coherence: Number(row.coherence),
    originality: Number(row.originality),
    details: Number(row.details),
    rpPresentation: Number(row.rp_presentation),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getEvent(): Promise<RassoEvent> {
  if (!isSupabaseConfigured || !supabase) return demoEvent;
  const { data, error } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
  if (error || !data) throw new Error(error?.message || 'Événement introuvable');
  return {
    id: String(data.id),
    name: String(data.name),
    status: data.status as RassoEvent['status'],
    createdAt: String(data.created_at),
  };
}

export async function getVehicles(): Promise<Vehicle[]> {
  if (!isSupabaseConfigured || !supabase) {
    return readLocal<Vehicle[]>(LOCAL_VEHICLES_KEY, demoVehicles);
  }
  const { data, error } = await supabase.from('vehicles').select('*').eq('event_id', EVENT_ID).order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapVehicleFromDb);
}

export async function getVotes(): Promise<Vote[]> {
  if (!isSupabaseConfigured || !supabase) {
    return readLocal<Vote[]>(LOCAL_VOTES_KEY, demoVotes);
  }
  const { data, error } = await supabase.from('votes').select('*').eq('event_id', EVENT_ID);
  if (error) throw new Error(error.message);
  return (data || []).map(mapVoteFromDb);
}

export async function upsertVote(input: VoteInput): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const votes = readLocal<Vote[]>(LOCAL_VOTES_KEY, demoVotes);
    const existingIndex = votes.findIndex(
      (vote) => vote.eventId === input.eventId && vote.vehicleId === input.vehicleId && vote.voterPseudo.toLowerCase() === input.voterPseudo.toLowerCase(),
    );
    const now = new Date().toISOString();
    const vote: Vote = {
      ...input,
      id: existingIndex >= 0 ? votes[existingIndex].id : safeUuid(),
      createdAt: existingIndex >= 0 ? votes[existingIndex].createdAt : now,
      updatedAt: now,
    };
    if (existingIndex >= 0) votes[existingIndex] = vote;
    else votes.push(vote);
    writeLocal(LOCAL_VOTES_KEY, votes);
    return;
  }

  const { error } = await supabase.from('votes').upsert(
    {
      event_id: input.eventId,
      vehicle_id: input.vehicleId,
      voter_pseudo: input.voterPseudo,
      aesthetics: input.aesthetics,
      coherence: input.coherence,
      originality: input.originality,
      details: input.details,
      rp_presentation: input.rpPresentation,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,vehicle_id,voter_pseudo' },
  );
  if (error) throw new Error(error.message);
}

export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'eventId' | 'createdAt'>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const vehicles = readLocal<Vehicle[]>(LOCAL_VEHICLES_KEY, demoVehicles);
    vehicles.push({ ...vehicle, id: safeUuid(), eventId: EVENT_ID, createdAt: new Date().toISOString() });
    writeLocal(LOCAL_VEHICLES_KEY, vehicles);
    return;
  }

  const imageUrl = await uploadPhotoIfNeeded(vehicle.imageUrl);

  const { error } = await supabase.from('vehicles').insert({
    event_id: EVENT_ID,
    name: vehicle.name,
    owner_name: vehicle.ownerName,
    category: vehicle.category,
    plate: vehicle.plate,
    image_url: imageUrl,
    description: vehicle.description,
    is_contestant: vehicle.isContestant,
    is_disqualified: vehicle.isDisqualified,
  });
  if (error) throw new Error(error.message);
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    writeLocal(LOCAL_VEHICLES_KEY, readLocal<Vehicle[]>(LOCAL_VEHICLES_KEY, demoVehicles).filter((vehicle) => vehicle.id !== vehicleId));
    writeLocal(LOCAL_VOTES_KEY, readLocal<Vote[]>(LOCAL_VOTES_KEY, demoVotes).filter((vote) => vote.vehicleId !== vehicleId));
    return;
  }
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
  if (error) throw new Error(error.message);
}

export async function toggleVehicleDisqualification(vehicle: Vehicle): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    const vehicles = readLocal<Vehicle[]>(LOCAL_VEHICLES_KEY, demoVehicles).map((item) =>
      item.id === vehicle.id ? { ...item, isDisqualified: !item.isDisqualified } : item,
    );
    writeLocal(LOCAL_VEHICLES_KEY, vehicles);
    return;
  }
  const { error } = await supabase.from('vehicles').update({ is_disqualified: !vehicle.isDisqualified }).eq('id', vehicle.id);
  if (error) throw new Error(error.message);
}

export async function resetVotes(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    writeLocal(LOCAL_VOTES_KEY, []);
    return;
  }
  const { error } = await supabase.from('votes').delete().eq('event_id', EVENT_ID);
  if (error) throw new Error(error.message);
}

export async function resetDemoData(): Promise<void> {
  localStorage.removeItem(LOCAL_VEHICLES_KEY);
  localStorage.removeItem(LOCAL_VOTES_KEY);
}

export function getConfiguredEventId(): string {
  return EVENT_ID;
}
