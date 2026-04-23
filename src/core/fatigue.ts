import type { CharacterState } from './character';

export interface FatigueResult {
  fatigue: number;
  knockedOut: boolean;
}

export function applyActionCost(
  fatigue: number,
  cost: number,
  eMax: number,
): FatigueResult {
  const newFatigue = fatigue + cost;
  return { fatigue: newFatigue, knockedOut: newFatigue >= eMax };
}

export function resetFatigue(state: CharacterState): CharacterState {
  return { ...state, fatigue: 0, knockedOut: false };
}
