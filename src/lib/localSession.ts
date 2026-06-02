import { safeStorage, safeUuid } from './storage';

const PSEUDO_KEY = 'zeprasso_voter_pseudo';
const ADMIN_KEY = 'zeprasso_admin_unlocked';
const ADMIN_CODE_KEY = 'zeprasso_admin_code';
const VOTER_ID_KEY = 'zeprasso_voter_id';
const PARTICIPANT_ID_KEY = 'zeprasso_participant_id';

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

// Mémorise que cet appareil s'est inscrit au concours (le deviceToken d'inscription
// est getVoterId()). Sert à afficher « tu es inscrit » et son propre véhicule.
export function getParticipantId(): string | null {
  return safeStorage.getItem(PARTICIPANT_ID_KEY);
}

export function setParticipantId(id: string): void {
  safeStorage.setItem(PARTICIPANT_ID_KEY, id);
}

export function clearParticipantId(): void {
  safeStorage.removeItem(PARTICIPANT_ID_KEY);
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
