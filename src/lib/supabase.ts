import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeStorage } from './storage';

const CONFIG_KEY = 'zeprasso_supabase_config';

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  eventId?: string;
};

function normalize(config: Partial<SupabaseConfig> | null | undefined): SupabaseConfig | null {
  if (!config) return null;
  const url = (config.url || '').trim().replace(/\/+$/, '');
  const anonKey = (config.anonKey || '').trim();
  if (!url || !anonKey) return null;
  return { url, anonKey, eventId: config.eventId?.trim() || undefined };
}

function readRuntimeConfig(): SupabaseConfig | null {
  const raw = safeStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  try {
    return normalize(JSON.parse(raw) as SupabaseConfig);
  } catch {
    return null;
  }
}

function readEnvConfig(): SupabaseConfig | null {
  return normalize({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    eventId: import.meta.env.VITE_EVENT_ID,
  });
}

export function getActiveConfig(): SupabaseConfig | null {
  return readRuntimeConfig() || readEnvConfig();
}

export function isSupabaseConfigured(): boolean {
  return getActiveConfig() !== null;
}

export function hasRuntimeConfig(): boolean {
  return readRuntimeConfig() !== null;
}

export function setSupabaseConfig(config: SupabaseConfig): void {
  const normalized = normalize(config);
  if (!normalized) throw new Error('URL et clé anon sont obligatoires.');
  safeStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
}

export function clearSupabaseConfig(): void {
  safeStorage.removeItem(CONFIG_KEY);
}

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';

export function getSupabase(): SupabaseClient | null {
  const config = getActiveConfig();
  if (!config) {
    cachedClient = null;
    cachedKey = '';
    return null;
  }
  const key = `${config.url}|${config.anonKey}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = createClient(config.url, config.anonKey);
  cachedKey = key;
  return cachedClient;
}
