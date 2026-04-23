import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '@/utils/random';
import { rollDamage, rollDefense, calcNetDamage, distributeNetDamage, maxDamage } from '@/core/combat';
import { WEAPONS } from '@/core/weapons';

beforeEach(() => setSeed(null));

describe('calcNetDamage', () => {
  it('max(0, D - Def)', () => {
    expect(calcNetDamage(10, 3)).toBe(7);
    expect(calcNetDamage(3, 10)).toBe(0);
    expect(calcNetDamage(5, 5)).toBe(0);
  });
});

describe('rollDefense', () => {
  it('returns 0 when knockedOut', () => {
    setSeed(42);
    for (let i = 0; i < 20; i++) {
      expect(rollDefense(20, true)).toBe(0);
    }
  });

  it('returns value in [max(1,floor(S/5)), S] when not knockedOut', () => {
    setSeed(42);
    for (let i = 0; i < 100; i++) {
      const s = 10;
      const def = rollDefense(s, false);
      expect(def).toBeGreaterThanOrEqual(Math.max(1, Math.floor(s / 5)));
      expect(def).toBeLessThanOrEqual(s);
    }
  });
});

describe('rollDamage', () => {
  it('returns value in correct range (mul=1)', () => {
    setSeed(42);
    const stats = { S: 15, A: 10, I: 5 };
    const weapon = WEAPONS['SA']; // mul=1
    for (let i = 0; i < 100; i++) {
      const x = stats.S + stats.A;
      const d = rollDamage(weapon, stats);
      expect(d).toBeGreaterThanOrEqual(Math.max(1, Math.floor(x / 5)));
      expect(d).toBeLessThanOrEqual(x);
    }
  });

  it('mul scales damage and maxDamage correctly', () => {
    setSeed(42);
    const stats = { S: 20, A: 10, I: 10 };
    const weapon = { ...WEAPONS['SA'], mul: 2 };
    expect(maxDamage(weapon, stats)).toBe(60); // round((20+10)*2)
    for (let i = 0; i < 100; i++) {
      const d = rollDamage(weapon, stats);
      expect(d).toBeGreaterThanOrEqual(Math.round(Math.max(1, Math.floor(30 / 5)) * 2));
      expect(d).toBeLessThanOrEqual(60);
    }
  });
});

describe('distributeNetDamage', () => {
  it('no damage when netD <= 0', () => {
    expect(distributeNetDamage(0, 10, 10, 10)).toEqual({ S: 0, A: 0, I: 0, dead: false });
    expect(distributeNetDamage(-5, 10, 10, 10)).toEqual({ S: 0, A: 0, I: 0, dead: false });
  });

  it('dead when netD >= HP - 2', () => {
    // HP=30, threshold=28
    expect(distributeNetDamage(28, 10, 10, 10).dead).toBe(true);
    expect(distributeNetDamage(29, 10, 10, 10).dead).toBe(true);
    expect(distributeNetDamage(100, 10, 10, 10).dead).toBe(true);
    expect(distributeNetDamage(27, 10, 10, 10).dead).toBe(false);
  });

  it('dead returns full current stats', () => {
    const r = distributeNetDamage(28, 10, 10, 10);
    expect(r).toEqual({ S: 10, A: 10, I: 10, dead: true });
  });

  it('proportional distribution — doc example S=100 A=50 I=50 netD=120', () => {
    const r = distributeNetDamage(120, 100, 50, 50);
    expect(r.dead).toBe(false);
    expect(r.S).toBe(60);
    expect(r.A).toBe(30);
    expect(r.I).toBe(30);
  });

  it('invariant: all damage distributed when not dead', () => {
    const cases: [number, number, number, number][] = [
      [15, 10, 10, 10],
      [120, 100, 50, 50],
      [1, 1, 1, 28],
      [12, 5, 5, 5],
      [1, 10, 10, 10],
      [5, 3, 4, 23],
    ];
    for (const [netD, s, a, i] of cases) {
      const r = distributeNetDamage(netD, s, a, i);
      if (!r.dead) {
        expect(r.S + r.A + r.I, `netD=${netD} s=${s} a=${a} i=${i}`).toBe(netD);
        expect(s - r.S, `S not below 1: netD=${netD}`).toBeGreaterThanOrEqual(1);
        expect(a - r.A, `A not below 1: netD=${netD}`).toBeGreaterThanOrEqual(1);
        expect(i - r.I, `I not below 1: netD=${netD}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('damage only goes to I when S=1 A=1 (caps are 0)', () => {
    const r = distributeNetDamage(1, 1, 1, 28);
    expect(r.dead).toBe(false);
    expect(r.S).toBe(0);
    expect(r.A).toBe(0);
    expect(r.I).toBe(1);
  });

  it('death boundary: HP=3, netD=1 → dead (1 >= 3-2=1)', () => {
    expect(distributeNetDamage(1, 1, 1, 1).dead).toBe(true);
  });
});
