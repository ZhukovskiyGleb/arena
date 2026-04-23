import { hexRing } from '../utils/hexMath';
import type { HexCoord } from '../utils/hexMath';

const FIELD_CONFIG: Record<number, { fieldRadius: number; spawnRadius: number }> = {
  2: { fieldRadius: 3, spawnRadius: 3 },
  3: { fieldRadius: 4, spawnRadius: 4 },
  4: { fieldRadius: 4, spawnRadius: 4 },
  5: { fieldRadius: 5, spawnRadius: 5 },
  6: { fieldRadius: 5, spawnRadius: 5 },
  7: { fieldRadius: 6, spawnRadius: 6 },
  8: { fieldRadius: 6, spawnRadius: 6 },
};

export function getFieldConfig(n: number): { fieldRadius: number; spawnRadius: number } {
  return FIELD_CONFIG[n] ?? { fieldRadius: 6, spawnRadius: 6 };
}

const CENTER: HexCoord = { q: 0, r: 0, s: 0 };

export function calcStartPositions(n: number): HexCoord[] {
  const { spawnRadius } = getFieldConfig(n);
  const ring = hexRing(CENTER, spawnRadius);
  return Array.from({ length: n }, (_, i) => ({
    ...ring[Math.floor((i * ring.length) / n)],
  }));
}
