import { describe, it, expect } from 'vitest';
import { findReference, calcSteps, reachableHexes, findPath } from '@/core/movement';
import { hexDistance } from '@/utils/hexMath';
import type { CharacterState } from '@/core/character';
import type { HexCoord } from '@/utils/hexMath';

function makeChar(id: string, a: number, initOrder = 0): CharacterState {
  return {
    id,
    stats: { S: 10, A: a, I: 10 },
    fatigue: 0,
    knockedOut: false,
    position: { q: 0, r: 0, s: 0 },
    initOrder,
  };
}

describe('findReference', () => {
  it('duel: returns character with lower A', () => {
    const chars = [makeChar('a', 12), makeChar('b', 8)];
    expect(findReference(chars).id).toBe('b');
  });

  it('duel: equal A → returns first encountered', () => {
    const chars = [makeChar('a', 10), makeChar('b', 10)];
    expect(findReference(chars).id).toBe('a');
  });

  it('group: returns char with A closest to avg from above', () => {
    // A values: 3, 5, 7 → avg = 5 → candidates >= 5: {5, 7} → min = 5
    const chars = [makeChar('a', 3), makeChar('b', 5), makeChar('c', 7)];
    expect(findReference(chars).id).toBe('b');
  });

  it('group: avg is non-integer, picks nearest above', () => {
    // A values: 3, 4, 7 → avg = 14/3 ≈ 4.67 → candidates >= 4.67: {7} → only 7
    const chars = [makeChar('a', 3), makeChar('b', 4), makeChar('c', 7)];
    expect(findReference(chars).id).toBe('c');
  });
});

describe('calcSteps', () => {
  // Table from DOC.md with Ref.A = 10
  const cases: [number, number][] = [
    [6, 1],
    [8, 1],
    [10, 2],
    [15, 3],
    [20, 4],
    [25, 5],
  ];
  for (const [a, expected] of cases) {
    it(`A=${a} → steps=${expected} (refA=10)`, () => {
      expect(calcSteps(a, 10)).toBe(expected);
    });
  }

  it('clamped to 1 minimum (very low ratio)', () => {
    expect(calcSteps(1, 100)).toBe(1);
  });

  it('clamped to 5 maximum (very high ratio)', () => {
    expect(calcSteps(100, 1)).toBe(5);
  });

  it('ratio exactly 0.7 → steps 1', () => {
    expect(calcSteps(7, 10)).toBe(1);
  });
});

describe('reachableHexes', () => {
  const origin: HexCoord = { q: 0, r: 0, s: 0 };

  it('returns hexes within step range', () => {
    const hexes = reachableHexes(origin, 1, []);
    expect(hexes).toHaveLength(6); // 6 neighbors
  });

  it('does not include origin', () => {
    const hexes = reachableHexes(origin, 2, []);
    expect(hexes.find(h => h.q === 0 && h.r === 0 && h.s === 0)).toBeUndefined();
  });

  it('BFS does not pass through occupied hexes', () => {
    // Block all 6 neighbors → nothing reachable in 1 step
    const occupied: HexCoord[] = [
      { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
      { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
    ];
    expect(reachableHexes(origin, 2, occupied)).toHaveLength(0);
  });

  it('BFS blocked hex is unreachable even from another path', () => {
    // Block q=1,r=0,s=-1. With 2 steps from origin, we cannot reach it.
    const blocked: HexCoord = { q: 1, r: 0, s: -1 };
    const hexes = reachableHexes(origin, 2, [blocked]);
    expect(hexes.find(h => h.q === blocked.q && h.r === blocked.r)).toBeUndefined();
  });

  it('2 steps reaches up to distance 2 hexes', () => {
    const hexes = reachableHexes(origin, 2, []);
    for (const h of hexes) {
      expect(hexDistance(origin, h)).toBeLessThanOrEqual(2);
    }
  });

  it('field radius limits reachable area', () => {
    const hexes = reachableHexes(origin, 5, [], 1);
    for (const h of hexes) {
      expect(hexDistance(origin, h)).toBeLessThanOrEqual(1);
    }
  });
});

describe('findPath', () => {
  const o: HexCoord = { q: 0, r: 0, s: 0 };

  it('returns empty array when from === to', () => {
    expect(findPath(o, o, [])).toEqual([]);
  });

  it('returns single step for adjacent hex', () => {
    const to: HexCoord = { q: 1, r: 0, s: -1 };
    const path = findPath(o, to, []);
    expect(path).toEqual([to]);
  });

  it('returns null when destination is occupied', () => {
    const to: HexCoord = { q: 1, r: 0, s: -1 };
    expect(findPath(o, to, [to])).toBeNull();
  });

  it('returns null when no path exists (all neighbors blocked)', () => {
    const blocked: HexCoord[] = [
      { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
      { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
    ];
    const to: HexCoord = { q: 2, r: 0, s: -2 };
    expect(findPath(o, to, blocked)).toBeNull();
  });

  it('returns null when destination is outside field radius', () => {
    const far: HexCoord = { q: 5, r: 0, s: -5 };
    expect(findPath(o, far, [], 3)).toBeNull();
  });

  it('path length equals hex distance for straight line', () => {
    const to: HexCoord = { q: 3, r: 0, s: -3 };
    const path = findPath(o, to, []);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);
    expect(path![path!.length - 1]).toEqual(to);
  });
});
