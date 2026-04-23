import { describe, it, expect } from 'vitest';
import { randomStats } from '@/core/character';

describe('randomStats', () => {
  it('S + A + I = 100', () => {
    for (let i = 0; i < 100; i++) {
      const { S, A, I } = randomStats();
      expect(S + A + I).toBe(100);
    }
  });

  it('each stat >= 1', () => {
    for (let i = 0; i < 100; i++) {
      const { S, A, I } = randomStats();
      expect(S).toBeGreaterThanOrEqual(1);
      expect(A).toBeGreaterThanOrEqual(1);
      expect(I).toBeGreaterThanOrEqual(1);
    }
  });

  it('respects custom total', () => {
    for (let i = 0; i < 50; i++) {
      const { S, A, I } = randomStats(60);
      expect(S + A + I).toBe(60);
      expect(S).toBeGreaterThanOrEqual(1);
      expect(A).toBeGreaterThanOrEqual(1);
      expect(I).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces varied results (not always the same)', () => {
    const results = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { S, A, I } = randomStats();
      results.add(`${S},${A},${I}`);
    }
    expect(results.size).toBeGreaterThan(5);
  });
});
