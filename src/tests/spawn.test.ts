import { describe, it, expect } from 'vitest';
import { calcStartPositions, getFieldConfig } from '@/core/spawn';
import { hexDistance } from '@/utils/hexMath';
import type { HexCoord } from '@/utils/hexMath';

const CENTER: HexCoord = { q: 0, r: 0, s: 0 };

describe('calcStartPositions', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    it(`N=${n}: returns exactly N positions`, () => {
      expect(calcStartPositions(n)).toHaveLength(n);
    });

    it(`N=${n}: all positions are unique`, () => {
      const positions = calcStartPositions(n);
      const keys = positions.map(h => `${h.q},${h.r},${h.s}`);
      expect(new Set(keys).size).toBe(n);
    });

    it(`N=${n}: all positions at correct spawn radius`, () => {
      const { spawnRadius } = getFieldConfig(n);
      const positions = calcStartPositions(n);
      for (const pos of positions) {
        expect(hexDistance(CENTER, pos)).toBe(spawnRadius);
      }
    });

    it(`N=${n}: all positions within field radius`, () => {
      const { fieldRadius } = getFieldConfig(n);
      const positions = calcStartPositions(n);
      for (const pos of positions) {
        expect(hexDistance(CENTER, pos)).toBeLessThanOrEqual(fieldRadius);
      }
    });
  }
});

describe('getFieldConfig', () => {
  it('N=2: fieldRadius=3 spawnRadius=3', () => {
    expect(getFieldConfig(2)).toEqual({ fieldRadius: 3, spawnRadius: 3 });
  });

  it('N=8: fieldRadius=6 spawnRadius=6', () => {
    expect(getFieldConfig(8)).toEqual({ fieldRadius: 6, spawnRadius: 6 });
  });

  it('unknown N falls back to {fieldRadius:6, spawnRadius:6}', () => {
    expect(getFieldConfig(1)).toEqual({ fieldRadius: 6, spawnRadius: 6 });
    expect(getFieldConfig(9)).toEqual({ fieldRadius: 6, spawnRadius: 6 });
  });
});
