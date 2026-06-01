import { describe, expect, it } from 'vitest';
import { computePrizePool } from './prizePool';

describe('computePrizePool (frontend mirror)', () => {
  it('matches the server rounding rule and keeps the sum invariant', () => {
    const r = computePrizePool(7, 10);
    expect(r.pool).toBe(70);
    expect(r.orgaCut).toBe(7);
    expect(r.net).toBe(63);
    expect(r.podium).toEqual({ first: 38, second: 16, third: 9 });
    expect(r.podium.first + r.podium.second + r.podium.third).toBe(r.net);
    expect(r.orgaCut + r.podium.first + r.podium.second + r.podium.third).toBe(r.pool);
  });

  it('returns zeros when nobody paid', () => {
    expect(computePrizePool(0, 10)).toEqual({ pool: 0, orgaCut: 0, net: 0, podium: { first: 0, second: 0, third: 0 } });
  });

  it('keeps the invariant across a range of values', () => {
    for (let count = 0; count <= 20; count += 1) {
      for (const fee of [5, 10, 15, 20]) {
        const r = computePrizePool(count, fee);
        expect(r.pool).toBe(count * fee);
        expect(r.podium.first + r.podium.second + r.podium.third).toBe(r.net);
        expect(r.orgaCut + r.net).toBe(r.pool);
      }
    }
  });
});
