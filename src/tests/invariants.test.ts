/**
 * DOC.md §8 — Ключові інваріанти
 * Кожен тест перевіряє один пункт з розділу 8.
 */
import { describe, it, expect } from 'vitest';
import { setSeed } from '@/utils/random';
import { random } from '@/utils/random';
import { distributeNetDamage, rollDefense } from '@/core/combat';
import { calcSteps } from '@/core/movement';
import { applyActionCost } from '@/core/fatigue';
import { randomStats } from '@/core/character';

// ── helpers ────────────────────────────────────────────────────────────────

function forMany(n: number, fn: (i: number) => void): void {
  for (let i = 0; i < n; i++) fn(i);
}

// ── Invariant 1 & 2 & 3 — distributeNetDamage ─────────────────────────────

describe('Invariant 1 — all NetD distributed when not dead', () => {
  it('ΔS + ΔA + ΔI === netD for wide range of inputs', () => {
    const cases: [number, number, number, number][] = [
      [1, 10, 10, 10], [5, 10, 10, 10], [10, 10, 10, 10],
      [3, 50, 30, 20], [1, 1, 1, 97], [20, 70, 20, 10],
      [120, 100, 50, 50], [1, 2, 2, 96], [14, 5, 5, 15],
    ];
    for (const [netD, s, a, i] of cases) {
      const r = distributeNetDamage(netD, s, a, i);
      if (!r.dead) {
        expect(r.S + r.A + r.I, `netD=${netD} s=${s} a=${a} i=${i}`).toBe(netD);
      }
    }
  });
});

describe('Invariant 2 — no stat drops below 1 when not dead', () => {
  it('remaining stats >= 1 after non-lethal hit', () => {
    const cases: [number, number, number, number][] = [
      [5, 10, 10, 10], [1, 50, 30, 20], [10, 12, 5, 5],
      [1, 2, 2, 96], [3, 3, 3, 94],
    ];
    for (const [netD, s, a, i] of cases) {
      const r = distributeNetDamage(netD, s, a, i);
      if (!r.dead) {
        expect(s - r.S, `S below 1: netD=${netD}`).toBeGreaterThanOrEqual(1);
        expect(a - r.A, `A below 1: netD=${netD}`).toBeGreaterThanOrEqual(1);
        expect(i - r.I, `I below 1: netD=${netD}`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('Invariant 3 — death only when netD >= HP - 2', () => {
  it('dead iff netD >= S+A+I-2', () => {
    const cases: [number, number, number, number][] = [
      [27, 10, 10, 10], [28, 10, 10, 10], [29, 10, 10, 10],
      [48, 20, 15, 15], [49, 20, 15, 15], [50, 20, 15, 15],
      [1, 1, 1, 1], [2, 2, 2, 2],
    ];
    for (const [netD, s, a, i] of cases) {
      const r = distributeNetDamage(netD, s, a, i);
      const threshold = s + a + i - 2;
      expect(r.dead, `netD=${netD} HP=${s+a+i}`).toBe(netD >= threshold);
    }
  });
});

// ── Invariant 4 — Random(X) range ─────────────────────────────────────────

describe('Invariant 4 — random(X) always in [max(1, floor(X/5)), X]', () => {
  it('holds for X = 1..100 over many rolls', () => {
    setSeed(1);
    for (let x = 1; x <= 100; x++) {
      const lo = Math.max(1, Math.floor(x / 5));
      forMany(20, () => {
        const v = random(x);
        expect(v, `x=${x}`).toBeGreaterThanOrEqual(lo);
        expect(v, `x=${x}`).toBeLessThanOrEqual(x);
      });
    }
  });
});

// ── Invariant 5 — calcSteps always in [1, 5] ──────────────────────────────

describe('Invariant 5 — calcSteps always in [1, 5]', () => {
  it('holds for wide range of A values and ref values', () => {
    const aValues = [1, 5, 10, 20, 30, 50, 70, 99];
    const refValues = [1, 10, 20, 50, 100];
    for (const a of aValues) {
      for (const ref of refValues) {
        const steps = calcSteps(a, ref);
        expect(steps, `a=${a} ref=${ref}`).toBeGreaterThanOrEqual(1);
        expect(steps, `a=${a} ref=${ref}`).toBeLessThanOrEqual(5);
      }
    }
  });
});

// ── Invariant 6 — KnockedOut → Def = 0 ────────────────────────────────────

describe('Invariant 6 — knockedOut always gives Def = 0', () => {
  it('rollDefense returns 0 regardless of S when knockedOut', () => {
    setSeed(1);
    const sValues = [1, 5, 10, 50, 99];
    for (const s of sValues) {
      forMany(10, () => {
        expect(rollDefense(s, true), `s=${s}`).toBe(0);
      });
    }
  });
});

// ── Invariant 7 — E_max = current I ───────────────────────────────────────

describe('Invariant 7 — fatigue knockout threshold equals current I', () => {
  it('applyActionCost knocks out exactly when newFatigue >= I', () => {
    const cases = [
      { f: 9, cost: 1, i: 10 },  // 10 >= 10 → KO
      { f: 8, cost: 1, i: 10 },  // 9 < 10  → not KO
      { f: 0, cost: 5, i: 5 },   // 5 >= 5  → KO
      { f: 3, cost: 2, i: 5 },   // 5 >= 5  → KO
      { f: 3, cost: 1, i: 5 },   // 4 < 5   → not KO
    ];
    for (const { f, cost, i } of cases) {
      const r = applyActionCost(f, cost, i);
      expect(r.knockedOut, `f=${f} cost=${cost} I=${i}`).toBe(f + cost >= i);
    }
  });
});

// ── Invariant 8 — randomStats ─────────────────────────────────────────────

describe('Invariant 8 — randomStats: S+A+I=100, each >= 1', () => {
  it('holds for 200 generated stat sets', () => {
    forMany(200, () => {
      const { S, A, I } = randomStats();
      expect(S + A + I).toBe(100);
      expect(S).toBeGreaterThanOrEqual(1);
      expect(A).toBeGreaterThanOrEqual(1);
      expect(I).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────

describe('Edge case — duel (2 characters)', () => {
  it('calcSteps works correctly in a duel scenario', () => {
    // In a duel, findReference returns the char with lower A
    // calcSteps with equal A → ratio=1 → steps=2
    expect(calcSteps(20, 20)).toBe(2);
    expect(calcSteps(10, 20)).toBe(1); // ratio=0.5 < 0.7 → 1
    expect(calcSteps(30, 20)).toBe(3); // ratio=1.5, 2+floor((1.5-1)/0.5)=2+1=3
  });
});

describe('Edge case — one-shot kill', () => {
  it('first hit kills when netD >= HP - 2', () => {
    // Fresh character: S=50, A=30, I=20, HP=100
    // Hit with netD=98 → 98 >= 100-2=98 → dead
    const r1 = distributeNetDamage(98, 50, 30, 20);
    expect(r1.dead).toBe(true);

    // Hit with netD=97 → 97 < 98 → not dead
    const r2 = distributeNetDamage(97, 50, 30, 20);
    expect(r2.dead).toBe(false);
  });
});
