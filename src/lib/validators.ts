export function normalizePseudo(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function validatePseudo(value: string): string | null {
  const pseudo = normalizePseudo(value);
  if (pseudo.length < 3) return 'Le pseudo doit contenir au moins 3 caractères.';
  if (pseudo.length > 32) return 'Le pseudo doit contenir 32 caractères maximum.';
  if (!/^[\p{L}\p{N}_\- ]+$/u.test(pseudo)) return 'Utilise seulement lettres, chiffres, espaces, tirets ou underscores.';
  return null;
}

export function clampRating(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(10, Math.max(0, Math.round(value)));
}
