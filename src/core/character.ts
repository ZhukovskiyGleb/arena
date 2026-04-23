import type { HexCoord } from '../utils/hexMath';
import type { WeaponConfig } from './weapons';

export interface CharacterStats {
  S: number;
  A: number;
  I: number;
}

export interface CharacterState {
  id: string;
  stats: CharacterStats;
  fatigue: number;
  knockedOut: boolean;
  position: HexCoord;
  initOrder: number;
}

export type Controller = 'player' | 'ai';

export const TEAM_COLORS = {
  1: '#e74c3c',
  2: '#3498db',
  3: '#2ecc71',
  4: '#f1c40f',
  5: '#9b59b6',
  6: '#e67e22',
  7: '#ff69b4',
  8: '#ecf0f1',
} as const;

export type TeamColor = keyof typeof TEAM_COLORS;

export interface CharacterSetup {
  id: string;
  stats: CharacterStats;
  weapon: WeaponConfig;
  controller: Controller;
  team: TeamColor;
}

export function randomStats(total = 100): CharacterStats {
  const positions = new Set<number>();
  while (positions.size < 2) {
    positions.add(1 + Math.floor(Math.random() * (total - 1)));
  }
  const [p1, p2] = [...positions].sort((a, b) => a - b);
  return { S: p1, A: p2 - p1, I: total - p2 };
}
