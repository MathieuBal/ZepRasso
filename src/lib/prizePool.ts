import type { PrizePool } from '../types';

// Miroir TS de computePrizePool de server/lib.mjs : MÊME règle d'arrondi.
// L'orga prend 10 % (arrondi), le net (90 %) est partagé 60/25/15 sur le
// podium, le gagnant absorbe l'arrondi pour que first+second+third === net.
// Gardé en double (serveur en .mjs, front en .ts) avec des tests des deux
// côtés pour garantir qu'ils ne divergent pas.
export function computePrizePool(paidCount: number, entryFee: number): PrizePool {
  const count = Math.max(0, Math.floor(Number(paidCount) || 0));
  const fee = Math.max(0, Number(entryFee) || 0);
  const pool = count * fee;
  const orgaCut = Math.round(pool * 0.1);
  const net = pool - orgaCut;
  const second = Math.round(net * 0.25);
  const third = Math.round(net * 0.15);
  const first = net - second - third;
  return { pool, orgaCut, net, podium: { first, second, third } };
}
