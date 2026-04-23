import { describe, it, expect } from 'vitest';
import {
  createSetupState,
  activateSlot,
  deactivateSlot,
  updateCharacter,
  validate,
  getActiveCharacters,
} from '@/state/SetupState';

describe('createSetupState', () => {
  it('has exactly 8 slots', () => {
    expect(createSetupState().slots).toHaveLength(8);
  });

  it('all 8 slots are active', () => {
    const state = createSetupState();
    for (let i = 0; i < 8; i++) expect(state.slots[i]).not.toBeNull();
  });

  it('all chars are AI by default', () => {
    const state = createSetupState();
    for (let i = 0; i < 8; i++) expect(state.slots[i]!.controller).toBe('ai');
  });

  it('default chars have unique teams', () => {
    const state = createSetupState();
    expect(state.slots[0]!.team).not.toBe(state.slots[1]!.team);
  });

  it('default state is valid', () => {
    expect(validate(createSetupState()).valid).toBe(true);
  });
});

describe('activateSlot', () => {
  it('activates an empty slot', () => {
    const state = activateSlot(createSetupState(), 2);
    expect(state.slots[2]).not.toBeNull();
    expect(state.slots[2]!.id).toBe('Char 3');
  });

  it('no-op on already active slot', () => {
    const state = createSetupState();
    const next = activateSlot(state, 0);
    expect(next.slots[0]).toBe(state.slots[0]);
  });

  it('new char has valid stats (sum=100, each>=1)', () => {
    const state = activateSlot(createSetupState(), 3);
    const { S, A, I } = state.slots[3]!.stats;
    expect(S + A + I).toBe(100);
    expect(S).toBeGreaterThanOrEqual(1);
    expect(A).toBeGreaterThanOrEqual(1);
    expect(I).toBeGreaterThanOrEqual(1);
  });
});

describe('deactivateSlot', () => {
  it('removes slot when more than 2 active', () => {
    let state = activateSlot(createSetupState(), 2);
    state = deactivateSlot(state, 2);
    expect(state.slots[2]).toBeNull();
  });

  it('refuses when only 2 active', () => {
    let state = createSetupState();
    for (let i = 2; i < 8; i++) state = deactivateSlot(state, i);
    expect(deactivateSlot(state, 0).slots[0]).not.toBeNull();
    expect(deactivateSlot(state, 1).slots[1]).not.toBeNull();
  });

  it('allows deactivating down to exactly 2', () => {
    let state = createSetupState();
    for (let i = 2; i < 8; i++) state = deactivateSlot(state, i);
    expect(getActiveCharacters(state)).toHaveLength(2);
  });
});

describe('updateCharacter', () => {
  it('updates stats', () => {
    let state = createSetupState();
    state = updateCharacter(state, 0, { stats: { S: 10, A: 10, I: 10 } });
    expect(state.slots[0]!.stats).toEqual({ S: 10, A: 10, I: 10 });
  });

  it('no-op on null slot', () => {
    let state = createSetupState();
    state = deactivateSlot(state, 5);
    expect(updateCharacter(state, 5, { controller: 'player' })).toBe(state);
  });

  it('does not change id', () => {
    let state = createSetupState();
    state = updateCharacter(state, 0, { controller: 'ai' });
    expect(state.slots[0]!.id).toBe('Char 1');
  });
});

describe('validate', () => {
  it('invalid when stats do not sum to 100', () => {
    let state = createSetupState();
    state = updateCharacter(state, 0, { stats: { S: 10, A: 10, I: 5 } });
    const result = validate(state);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('invalid when a stat is 0', () => {
    let state = createSetupState();
    state = updateCharacter(state, 0, { stats: { S: 0, A: 15, I: 15 } });
    expect(validate(state).valid).toBe(false);
  });

  it('invalid when all chars on the same team', () => {
    let state = createSetupState();
    for (let i = 0; i < 8; i++) state = updateCharacter(state, i, { team: 1 });
    expect(validate(state).valid).toBe(false);
    expect(validate(state).errors).toContain('At least 2 different teams required');
  });

  it('valid when chars share a team but other teams exist', () => {
    let state = createSetupState();
    state = updateCharacter(state, 0, { team: 1 });
    state = updateCharacter(state, 1, { team: 1 });
    // slots 2–7 still have teams 3–8
    expect(validate(state).valid).toBe(true);
  });
});
