const PSEUDO_KEY = 'zeprasso_voter_pseudo';
const ADMIN_KEY = 'zeprasso_admin_unlocked';

export function getStoredPseudo(): string | null {
  return localStorage.getItem(PSEUDO_KEY);
}

export function setStoredPseudo(pseudo: string): void {
  localStorage.setItem(PSEUDO_KEY, pseudo.trim());
}

export function clearStoredPseudo(): void {
  localStorage.removeItem(PSEUDO_KEY);
}

export function isAdminUnlocked(): boolean {
  return localStorage.getItem(ADMIN_KEY) === 'true';
}

export function unlockAdmin(): void {
  localStorage.setItem(ADMIN_KEY, 'true');
}

export function lockAdmin(): void {
  localStorage.removeItem(ADMIN_KEY);
}
