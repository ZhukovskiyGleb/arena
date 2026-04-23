import { randomStats, type CharacterSetup, type TeamColor } from '../core/character';
import { WEAPONS, WEAPON_LIST } from '../core/weapons';
import { maxDamage } from '../core/combat';

function bestWeapon(stats: CharacterSetup['stats']) {
  return WEAPON_LIST.reduce((best, type) => {
    const w = WEAPONS[type];
    return maxDamage(w, stats) > maxDamage(WEAPONS[best], stats) ? type : best;
  }, WEAPON_LIST[0]);
}

function makeDefaultChar(slotIndex: number): CharacterSetup {
  const stats = randomStats();
  const weapon = WEAPONS[bestWeapon(stats)];
  return {
    stats,
    id: `Char ${slotIndex + 1}`,
    weapon,
    controller: 'ai',
    team: (slotIndex + 1) as TeamColor,
  };
}

export interface SetupState {
  slots: Array<CharacterSetup | null>; // always length 8
}

export function createSetupState(): SetupState {
  const slots: Array<CharacterSetup | null> = Array.from({ length: 8 }, (_, i) => makeDefaultChar(i));
  return { slots };
}

export function getActiveCharacters(state: SetupState): CharacterSetup[] {
  return state.slots.filter((s): s is CharacterSetup => s !== null);
}

export function activateSlot(state: SetupState, index: number): SetupState {
  if (state.slots[index] !== null) return state;
  const slots = [...state.slots];
  slots[index] = makeDefaultChar(index);
  return { slots };
}

export function deactivateSlot(state: SetupState, index: number): SetupState {
  if (state.slots[index] === null) return state;
  if (getActiveCharacters(state).length <= 2) return state;
  const slots = [...state.slots];
  slots[index] = null;
  return { slots };
}

export function updateCharacter(
  state: SetupState,
  index: number,
  updates: Partial<Omit<CharacterSetup, 'id'>>,
): SetupState {
  if (state.slots[index] === null) return state;
  const slots = [...state.slots];
  slots[index] = { ...slots[index]!, ...updates };
  return { slots };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validate(state: SetupState): ValidationResult {
  const errors: string[] = [];
  const active = getActiveCharacters(state);

  if (active.length < 2) errors.push('At least 2 characters required');
  if (active.length > 8) errors.push('Maximum 8 characters');

  for (const char of active) {
    const { S, A, I } = char.stats;
    if (S < 1 || A < 1 || I < 1) errors.push(`${char.id}: each stat must be >= 1`);
    if (S + A + I !== 100) errors.push(`${char.id}: S+A+I must equal 100`);
  }

  const teamCount = new Set(active.map(c => c.team)).size;
  if (teamCount < 2) {
    errors.push('At least 2 different teams required');
  }

  return { valid: errors.length === 0, errors };
}
