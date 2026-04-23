import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '@/utils/random';
import { rollInitiative, sortTurnOrder } from '@/core/initiative';
import type { CharacterState } from '@/core/character';

beforeEach(() => setSeed(42));

function makeChar(id: string, s: number, a: number, i: number, initOrder: number): CharacterState {
  return {
    id,
    stats: { S: s, A: a, I: i },
    fatigue: 0,
    knockedOut: false,
    position: { q: 0, r: 0, s: 0 },
    initOrder,
  };
}

describe('rollInitiative', () => {
  it('result in [max(1, floor(A/5)), A]', () => {
    setSeed(42);
    for (const a of [1, 5, 10, 15, 20, 30]) {
      for (let i = 0; i < 50; i++) {
        const init = rollInitiative(a);
        expect(init).toBeGreaterThanOrEqual(Math.max(1, Math.floor(a / 5)));
        expect(init).toBeLessThanOrEqual(a);
      }
    }
  });
});

describe('sortTurnOrder', () => {
  it('sorts by descending initiative', () => {
    const chars = [makeChar('a', 10, 10, 10, 0), makeChar('b', 10, 10, 10, 1)];
    const inits = new Map([['a', 5], ['b', 10]]);
    const sorted = sortTurnOrder(chars, inits);
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('a');
  });

  it('tie-break 1: higher A goes first', () => {
    const chars = [makeChar('a', 10, 8, 12, 0), makeChar('b', 10, 15, 5, 1)];
    const inits = new Map([['a', 10], ['b', 10]]);
    const sorted = sortTurnOrder(chars, inits);
    expect(sorted[0].id).toBe('b'); // A=15 > A=8
  });

  it('tie-break 2: higher S+A+I goes first when A equal', () => {
    // a: S+A+I=25, b: S+A+I=30 → b wins
    const chars = [makeChar('a', 10, 10, 5, 0), makeChar('b', 15, 10, 5, 1)];
    const inits = new Map([['a', 7], ['b', 7]]);
    const sorted = sortTurnOrder(chars, inits);
    expect(sorted[0].id).toBe('b');
  });

  it('tie-break 3: lower initOrder goes first when everything equal', () => {
    const chars = [makeChar('b', 10, 10, 10, 1), makeChar('a', 10, 10, 10, 0)];
    const inits = new Map([['a', 5], ['b', 5]]);
    const sorted = sortTurnOrder(chars, inits);
    expect(sorted[0].id).toBe('a'); // initOrder 0 < 1
  });

  it('tie-break 2 distinct case', () => {
    const chars = [makeChar('a', 10, 10, 5, 0), makeChar('b', 15, 10, 5, 1)];
    const inits = new Map([['a', 8], ['b', 8]]);
    const sorted = sortTurnOrder(chars, inits);
    // a: S+A+I=25, b: S+A+I=30 → b wins
    expect(sorted[0].id).toBe('b');
  });

  it('missing initiative defaults to 0', () => {
    // 'a' not in the map → treated as 0; 'b' has 5 → b goes first
    const chars = [makeChar('a', 10, 10, 10, 0), makeChar('b', 10, 10, 10, 1)];
    const inits = new Map([['b', 5]]);
    const sorted = sortTurnOrder(chars, inits);
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('a');
  });
});
