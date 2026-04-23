import { describe, it, expect } from 'vitest';
import {
  createBattleState,
  startRound,
  beginCharTurn,
  applyDamage,
  checkBattleEnd,
  nextTurn,
  getActiveChar,
  getLiving,
  isRoundOver,
  moveChar,
  updateFatigue,
} from '@/state/BattleState';
import { WEAPONS } from '@/core/weapons';
import type { CharacterSetup } from '@/core/character';
import type { HexCoord } from '@/utils/hexMath';

function makeSetup(id: string, team: 1 | 2, s = 10, a = 10, i = 10): CharacterSetup {
  return { id, stats: { S: s, A: a, I: i }, weapon: WEAPONS['SA'], controller: 'ai', team };
}
const pos = (q: number): HexCoord => ({ q, r: 0, s: -q });

describe('createBattleState', () => {
  it('creates correct number of chars', () => {
    const state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    expect(state.chars).toHaveLength(2);
    expect(state.round).toBe(0);
    expect(state.status).toBe('active');
    expect(state.turnQueue).toHaveLength(0);
  });

  it('all chars start alive with F=0 knockedOut=false', () => {
    const state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    for (const c of state.chars) {
      expect(c.dead).toBe(false);
      expect(c.fatigue).toBe(0);
      expect(c.knockedOut).toBe(false);
    }
  });

  it('stats copied from setup', () => {
    const state = createBattleState([makeSetup('c1', 1, 15, 8, 7)], [pos(0)]);
    expect(state.chars[0].stats).toEqual({ S: 15, A: 8, I: 7 });
  });
});

describe('startRound', () => {
  it('increments round', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = startRound(state, new Map([['c1', 8], ['c2', 5]]));
    expect(state.round).toBe(1);
    state = startRound(state, new Map([['c1', 3], ['c2', 9]]));
    expect(state.round).toBe(2);
  });

  it('sorts turnQueue by descending initiative', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = startRound(state, new Map([['c1', 5], ['c2', 8]]));
    expect(state.turnQueue).toEqual(['c2', 'c1']);
  });

  it('preserves fatigue and knockedOut across rounds', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = { ...state, chars: state.chars.map(c => ({ ...c, fatigue: 7, knockedOut: true })) };
    state = startRound(state, new Map([['c1', 5], ['c2', 8]]));
    for (const c of state.chars) {
      expect(c.fatigue).toBe(7);
      expect(c.knockedOut).toBe(true);
    }
  });

  it('beginCharTurn resets fatigue when knockedOut', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = { ...state, chars: state.chars.map(c => ({ ...c, fatigue: 9, knockedOut: true })) };
    state = beginCharTurn(state, 'c1');
    const c1 = state.chars.find(c => c.id === 'c1')!;
    expect(c1.fatigue).toBe(0);
    expect(c1.knockedOut).toBe(false);
    const c2 = state.chars.find(c => c.id === 'c2')!;
    expect(c2.fatigue).toBe(9);
    expect(c2.knockedOut).toBe(true);
  });

  it('beginCharTurn leaves fatigue untouched when not knockedOut', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = { ...state, chars: state.chars.map(c => ({ ...c, fatigue: 4, knockedOut: false })) };
    state = beginCharTurn(state, 'c1');
    expect(state.chars.find(c => c.id === 'c1')!.fatigue).toBe(4);
  });

  it('dead chars excluded from turnQueue', () => {
    let state = createBattleState(
      [makeSetup('c1', 1), makeSetup('c2', 2), makeSetup('c3', 1)],
      [pos(3), pos(-3), pos(0)],
    );
    state = applyDamage(state, 'c2', 28); // kill c2
    state = startRound(state, new Map([['c1', 5], ['c3', 3]]));
    expect(state.turnQueue).not.toContain('c2');
    expect(state.turnQueue).toHaveLength(2);
  });
});

describe('applyDamage', () => {
  it('reduces stats proportionally on non-lethal hit', () => {
    let state = createBattleState([makeSetup('c1', 1, 10, 10, 10)], [pos(0)]);
    state = applyDamage(state, 'c1', 15);
    const c = state.chars[0];
    expect(c.dead).toBe(false);
    expect(c.stats.S + c.stats.A + c.stats.I).toBe(15);
  });

  it('marks dead on lethal hit (netD >= HP-2)', () => {
    let state = createBattleState([makeSetup('c1', 1, 10, 10, 10)], [pos(0)]);
    state = applyDamage(state, 'c1', 28); // HP=30, 28>=28
    expect(state.chars[0].dead).toBe(true);
  });

  it('does not affect other chars', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    const orig = { ...state.chars[1].stats };
    state = applyDamage(state, 'c1', 10);
    expect(state.chars[1].stats).toEqual(orig);
  });

  it('no-op on already dead char', () => {
    let state = createBattleState([makeSetup('c1', 1)], [pos(0)]);
    state = applyDamage(state, 'c1', 28);
    const statsBefore = { ...state.chars[0].stats };
    state = applyDamage(state, 'c1', 5);
    expect(state.chars[0].stats).toEqual(statsBefore);
  });
});

describe('checkBattleEnd', () => {
  it('ends when only one team remains', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = applyDamage(state, 'c2', 28);
    state = checkBattleEnd(state);
    expect(state.status).toBe('ended');
    expect(state.winnerTeam).toBe(1);
  });

  it('continues when two teams alive', () => {
    const state = checkBattleEnd(
      createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]),
    );
    expect(state.status).toBe('active');
    expect(state.winnerTeam).toBeNull();
  });

  it('winner is correct team', () => {
    let state = createBattleState(
      [makeSetup('c1', 1), makeSetup('c2', 2), makeSetup('c3', 2)],
      [pos(3), pos(-3), pos(0)],
    );
    state = applyDamage(state, 'c1', 28);
    state = checkBattleEnd(state);
    expect(state.winnerTeam).toBe(2);
  });
});

describe('nextTurn / getActiveChar / isRoundOver', () => {
  it('first active char is correct after startRound', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = startRound(state, new Map([['c1', 8], ['c2', 5]]));
    expect(getActiveChar(state)?.id).toBe('c1');
  });

  it('nextTurn advances to next char', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = startRound(state, new Map([['c1', 8], ['c2', 5]]));
    state = nextTurn(state);
    expect(getActiveChar(state)?.id).toBe('c2');
  });

  it('isRoundOver after all turns', () => {
    let state = createBattleState([makeSetup('c1', 1), makeSetup('c2', 2)], [pos(3), pos(-3)]);
    state = startRound(state, new Map([['c1', 8], ['c2', 5]]));
    state = nextTurn(state);
    state = nextTurn(state);
    expect(isRoundOver(state)).toBe(true);
    expect(getActiveChar(state)).toBeNull();
  });

  it('nextTurn skips chars killed mid-round', () => {
    let state = createBattleState(
      [makeSetup('c1', 1), makeSetup('c2', 2), makeSetup('c3', 1)],
      [pos(3), pos(-3), pos(0)],
    );
    state = startRound(state, new Map([['c1', 10], ['c2', 5], ['c3', 1]]));
    // c1 goes first; kill c2 mid-round
    state = applyDamage(state, 'c2', 28);
    state = nextTurn(state); // should skip c2, go to c3
    expect(getActiveChar(state)?.id).toBe('c3');
  });
});

describe('getLiving', () => {
  it('returns only non-dead chars', () => {
    let state = createBattleState(
      [makeSetup('c1', 1), makeSetup('c2', 2), makeSetup('c3', 1)],
      [pos(3), pos(-3), pos(0)],
    );
    state = applyDamage(state, 'c2', 28);
    expect(getLiving(state).map(c => c.id)).toEqual(['c1', 'c3']);
  });
});

describe('moveChar', () => {
  it('updates position', () => {
    let state = createBattleState([makeSetup('c1', 1)], [pos(3)]);
    state = moveChar(state, 'c1', pos(2));
    expect(state.chars[0].position).toEqual(pos(2));
  });
});

describe('updateFatigue', () => {
  it('updates fatigue and knockedOut', () => {
    let state = createBattleState([makeSetup('c1', 1)], [pos(0)]);
    state = updateFatigue(state, 'c1', 5, true);
    expect(state.chars[0].fatigue).toBe(5);
    expect(state.chars[0].knockedOut).toBe(true);
  });
});
