import { safeStorage } from './storage';

const PSEUDO_KEY = 'zeprasso_voter_pseudo';
const ADMIN_KEY = 'zeprasso_admin_unlocked';

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

export function unlockAdmin(): void {
  safeStorage.setItem(ADMIN_KEY, 'true');
}

export function lockAdmin(): void {
  safeStorage.removeItem(ADMIN_KEY);
}
