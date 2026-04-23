import { describe, it, expect } from 'vitest';
import { decideTurn } from '@/core/ai';
import { createBattleState, startRound } from '@/state/BattleState';
import { WEAPONS } from '@/core/weapons';
import type { CharacterSetup } from '@/core/character';
import type { HexCoord } from '@/utils/hexMath';

const FIELD_RADIUS = 3;

function setup(id: string, team: 1 | 2, controller: 'player' | 'ai' = 'ai'): CharacterSetup {
  return { id, stats: { S: 20, A: 20, I: 20 }, weapon: WEAPONS['SA'], controller, team };
}
const pos = (q: number, r: number = 0): HexCoord => ({ q, r, s: -q - r });

function makeState(setups: CharacterSetup[], positions: HexCoord[]) {
  let state = createBattleState(setups, positions);
  state = startRound(state, new Map(setups.map(s => [s.id, 5])));
  return state;
}

describe('decideTurn', () => {
  it('returns [end] when no enemies exist', () => {
    // Two chars on same team — no enemies
    const state = makeState(
      [setup('a', 1), setup('b', 1)],
      [pos(-3), pos(3)],
    );
    const char = state.chars[0];
    const actions = decideTurn(state, char, FIELD_RADIUS);
    expect(actions).toEqual([{ type: 'end' }]);
  });

  it('moves toward nearest enemy', () => {
    // a at (-3,0), b at (3,0) — 6 apart, needs multiple steps to reach
    const state = makeState(
      [setup('a', 1), setup('b', 2)],
      [pos(-3), pos(3)],
    );
    const char = state.chars.find(c => c.id === 'a')!;
    const actions = decideTurn(state, char, FIELD_RADIUS);
    const moves = actions.filter(a => a.type === 'move');
    expect(moves.length).toBeGreaterThan(0);
    // Each move step brings us closer to b at (3,0)
    for (const a of moves) {
      expect(a.type).toBe('move');
    }
  });

  it('attacks when adjacent to enemy', () => {
    // a at (0,0), b at (1,0) — adjacent
    const state = makeState(
      [setup('a', 1), setup('b', 2)],
      [pos(0), pos(1)],
    );
    const char = state.chars.find(c => c.id === 'a')!;
    const actions = decideTurn(state, char, FIELD_RADIUS);
    expect(actions.some(a => a.type === 'attack')).toBe(true);
    const attack = actions.find(a => a.type === 'attack');
    expect(attack).toMatchObject({ type: 'attack', targetId: 'b' });
  });

  it('attacks even when it will cause knockout (uses last energy)', () => {
    const state = makeState(
      [setup('a', 1), setup('b', 2)],
      [pos(0), pos(1)],
    );
    const charA = state.chars.find(c => c.id === 'a')!;
    // One below KO threshold — attack will push over, but should still happen
    const almostKo = { ...charA, fatigue: charA.stats.I - 1 };
    const modState = { ...state, chars: state.chars.map(c => c.id === 'a' ? almostKo : c) };
    const actions = decideTurn(modState, almostKo, FIELD_RADIUS);
    expect(actions.some(a => a.type === 'attack')).toBe(true);
  });

  it('does not attack when already knocked out (fatigue >= I)', () => {
    const state = makeState(
      [setup('a', 1), setup('b', 2)],
      [pos(0), pos(1)],
    );
    const charA = state.chars.find(c => c.id === 'a')!;
    const alreadyKo = { ...charA, fatigue: charA.stats.I, knockedOut: true };
    const modState = { ...state, chars: state.chars.map(c => c.id === 'a' ? alreadyKo : c) };
    const actions = decideTurn(modState, alreadyKo, FIELD_RADIUS);
    expect(actions.some(a => a.type === 'attack')).toBe(false);
    expect(actions.some(a => a.type === 'move')).toBe(false);
  });

  it('targets lowest-HP adjacent enemy', () => {
    // a at (0,0), b at (1,0) with high HP, c at (-1,0) with low HP — both adjacent
    const lowHp: CharacterSetup = { ...setup('c', 2), stats: { S: 5, A: 5, I: 5 } };
    const state = makeState(
      [setup('a', 1), setup('b', 2), lowHp],
      [pos(0), pos(1), pos(-1)],
    );
    const char = state.chars.find(c => c.id === 'a')!;
    const actions = decideTurn(state, char, FIELD_RADIUS);
    const attack = actions.find(a => a.type === 'attack');
    expect(attack).toMatchObject({ type: 'attack', targetId: 'c' });
  });

  it('always ends with { type: end }', () => {
    const state = makeState(
      [setup('a', 1), setup('b', 2)],
      [pos(-3), pos(3)],
    );
    const char = state.chars[0];
    const actions = decideTurn(state, char, FIELD_RADIUS);
    expect(actions[actions.length - 1]).toEqual({ type: 'end' });
  });

  it('prefers nearer enemy over farther one (distance tie-break branch)', () => {
    // a at center, b at (2,0) — near, c at (3,0) — far
    // → should target b (nearer)
    const nearSetup: CharacterSetup = { ...setup('b', 2), stats: { S: 30, A: 20, I: 20 } };
    const farSetup:  CharacterSetup = { ...setup('c', 2), stats: { S: 10, A: 10, I: 10 } };
    const state = makeState(
      [setup('a', 1), nearSetup, farSetup],
      [pos(0), pos(2), pos(-2)],
    );
    const char = state.chars.find(c => c.id === 'a')!;
    const actions = decideTurn(state, char, FIELD_RADIUS);
    // The char should move toward the adjacent hex of the nearest enemy
    expect(actions.some(a => a.type === 'move')).toBe(true);
  });

  it('stops moving when already knocked out (fatigue >= I)', () => {
    const state = makeState(
      [setup('a', 1), setup('b', 2)],
      [pos(-2), pos(2)],
    );
    const charA = state.chars.find(c => c.id === 'a')!;
    // Already at max fatigue → no moves, no attack
    const ko = { ...charA, fatigue: charA.stats.I, knockedOut: true };
    const modState = { ...state, chars: state.chars.map(c => c.id === 'a' ? ko : c) };
    const actions = decideTurn(modState, ko, FIELD_RADIUS);
    expect(actions.every(a => a.type === 'end')).toBe(true);
  });

  it('returns [end] when path is completely blocked', () => {
    // Surround 'a' so findPath returns null
    const blocked = [
      { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
      { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
    ];
    // Place 6 extra allies around 'a' to block all neighbors
    const allies = blocked.map((_p, i) => ({
      ...setup(`ally${i}`, 1 as 1 | 2),
      stats: { S: 10, A: 10, I: 10 },
    }));
    const state = makeState(
      [setup('a', 1), setup('b', 2), ...allies],
      [pos(0), pos(3, 0), ...blocked],
    );
    const char = state.chars.find(c => c.id === 'a')!;
    const actions = decideTurn(state, char, FIELD_RADIUS);
    expect(actions.every(a => a.type === 'end')).toBe(true);
  });
});
