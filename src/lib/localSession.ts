import { safeStorage, safeUuid } from './storage';

const PSEUDO_KEY = 'zeprasso_voter_pseudo';
const ADMIN_KEY = 'zeprasso_admin_unlocked';
const ADMIN_CODE_KEY = 'zeprasso_admin_code';
const VOTER_ID_KEY = 'zeprasso_voter_id';

export function getVoterId(): string {
  let id = safeStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = safeUuid();
    safeStorage.setItem(VOTER_ID_KEY, id);
  }
  return id;
}

export function getStoredPseudo(): string | null {
  return safeStorage.getItem(PSEUDO_KEY);
}

export function setStoredPseudo(pseudo: string): void {
  safeStorage.setItem(PSEUDO_KEY, pseudo.trim());
}

export function clearStoredPseudo(): void {
  safeStorage.removeItem(PSEUDO_KEY);
}

export function isAdminUnlocked(): boolean {
  return safeStorage.getItem(ADMIN_KEY) === 'true';
}

export function getAdminCode(): string | null {
  return safeStorage.getItem(ADMIN_CODE_KEY);
}

export function unlockAdmin(code: string): void {
  safeStorage.setItem(ADMIN_KEY, 'true');
  safeStorage.setItem(ADMIN_CODE_KEY, code);
}

export function lockAdmin(): void {
  safeStorage.removeItem(ADMIN_KEY);
  safeStorage.removeItem(ADMIN_CODE_KEY);
}
