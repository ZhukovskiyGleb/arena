import { describe, it, expect } from 'vitest';
import { applyActionCost, resetFatigue } from '@/core/fatigue';
import type { CharacterState } from '@/core/character';

function makeState(fatigue: number, i: number, knockedOut = false): CharacterState {
  return {
    id: 'test',
    stats: { S: 10, A: 10, I: i },
    fatigue,
    knockedOut,
    position: { q: 0, r: 0, s: 0 },
    initOrder: 0,
  };
}

describe('applyActionCost', () => {
  it('F < E_max → not knocked out', () => {
    const result = applyActionCost(0, 2, 10);
    expect(result.fatigue).toBe(2);
    expect(result.knockedOut).toBe(false);
  });

  it('F exactly equals E_max → knocked out', () => {
    const result = applyActionCost(8, 2, 10);
    expect(result.fatigue).toBe(10);
    expect(result.knockedOut).toBe(true);
  });

  it('F exceeds E_max → knocked out', () => {
    const result = applyActionCost(9, 5, 10);
    expect(result.fatigue).toBe(14);
    expect(result.knockedOut).toBe(true);
  });

  it('E_max = current I', () => {
    // I=3: F=2 → not knocked out; F=3 (>=3) → knocked out
    expect(applyActionCost(0, 2, 3).knockedOut).toBe(false); // 0+2=2 < 3
    expect(applyActionCost(2, 1, 3).fatigue).toBe(3);
    expect(applyActionCost(2, 1, 3).knockedOut).toBe(true);  // 2+1=3 >= 3
  });

  it('single step cost +1', () => {
    const r1 = applyActionCost(0, 1, 10);
    const r2 = applyActionCost(r1.fatigue, 1, 10);
    expect(r2.fatigue).toBe(2);
  });
});

describe('resetFatigue', () => {
  it('sets F=0 and knockedOut=false', () => {
    const state = makeState(8, 10, true);
    const reset = resetFatigue(state);
    expect(reset.fatigue).toBe(0);
    expect(reset.knockedOut).toBe(false);
  });

  it('does not mutate original state', () => {
    const state = makeState(8, 10, true);
    resetFatigue(state);
    expect(state.fatigue).toBe(8);
    expect(state.knockedOut).toBe(true);
  });
});
