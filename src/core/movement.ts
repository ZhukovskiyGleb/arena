import type { CharacterState } from './character';
import type { HexCoord } from '../utils/hexMath';
import { hexDistance, hexNeighbors } from '../utils/hexMath';

export function findPath(
  from: HexCoord,
  to: HexCoord,
  occupied: HexCoord[],
  fieldRadius = 100,
): HexCoord[] | null {
  const center: HexCoord = { q: 0, r: 0, s: 0 };
  const occupiedSet = new Set(occupied.map(h => `${h.q},${h.r},${h.s}`));
  const toKey = `${to.q},${to.r},${to.s}`;
  const fromKey = `${from.q},${from.r},${from.s}`;

  if (fromKey === toKey) return [];
  if (hexDistance(center, to) > fieldRadius) return null;

  const prev = new Map<string, string | null>([[fromKey, null]]);
  const queue: HexCoord[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const nb of hexNeighbors(current)) {
      const key = `${nb.q},${nb.r},${nb.s}`;
      if (prev.has(key) || occupiedSet.has(key)) continue;
      if (hexDistance(center, nb) > fieldRadius) continue;
      prev.set(key, `${current.q},${current.r},${current.s}`);
      if (key === toKey) {
        const path: HexCoord[] = [];
        let k: string | null | undefined = toKey;
        while (k && k !== fromKey) {
          const [q, r, s] = k.split(',').map(Number);
          path.unshift({ q, r, s });
          k = prev.get(k);
        }
        return path;
      }
      queue.push(nb);
    }
  }
  return null;
}

export function findReference(chars: CharacterState[]): CharacterState {
  if (chars.length <= 2) {
    return chars.reduce((ref, c) => (c.stats.A < ref.stats.A ? c : ref));
  }
  const aAvg = chars.reduce((sum, c) => sum + c.stats.A, 0) / chars.length;
  const candidates = chars.filter(c => c.stats.A >= aAvg);
  const pool = candidates.length > 0 ? candidates : chars;
  return pool.reduce((ref, c) => (c.stats.A < ref.stats.A ? c : ref));
}

export function calcSteps(charA: number, refA: number): number {
  const ratio = charA / refA;
  let steps: number;
  if (ratio < 0.7) {
    steps = 1;
  } else {
    steps = 2 + Math.floor((ratio - 1) / 0.5);
  }
  return Math.max(1, Math.min(5, steps));
}

export function reachableHexes(
  origin: HexCoord,
  steps: number,
  occupied: HexCoord[],
  fieldRadius = 100,
): HexCoord[] {
  const center: HexCoord = { q: 0, r: 0, s: 0 };
  const occupiedSet = new Set(occupied.map(h => `${h.q},${h.r},${h.s}`));
  const visited = new Set<string>([`${origin.q},${origin.r},${origin.s}`]);
  const queue: Array<{ hex: HexCoord; rem: number }> = [{ hex: origin, rem: steps }];
  const reachable: HexCoord[] = [];

  while (queue.length > 0) {
    const { hex, rem } = queue.shift()!;
    if (rem === 0) continue;
    for (const nb of hexNeighbors(hex)) {
      const key = `${nb.q},${nb.r},${nb.s}`;
      if (visited.has(key)) continue;
      if (occupiedSet.has(key)) continue;
      if (hexDistance(center, nb) > fieldRadius) continue;
      visited.add(key);
      reachable.push(nb);
      if (rem > 1) queue.push({ hex: nb, rem: rem - 1 });
    }
  }
  return reachable;
}
