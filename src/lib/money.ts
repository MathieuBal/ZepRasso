// Montants en dollars GTA RP (argent du jeu) : symbole $ et séparateurs de
// milliers à la GTA, ex. 100000 -> "$100,000". Arrondi à l'entier.
export function formatMoney(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `$${n.toLocaleString('en-US')}`;
}
