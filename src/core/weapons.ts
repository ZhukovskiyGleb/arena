export type WeaponType = 'SS' | 'AA' | 'II' | 'SA' | 'AI' | 'IS';

export interface WeaponConfig {
  type: WeaponType;
  stat1: 'S' | 'A' | 'I';
  stat2: 'S' | 'A' | 'I';
  fatigueCost: number;
  name: string;
  mul: number;
}

export const WEAPONS: Record<WeaponType, WeaponConfig> = {
  SS: { type: 'SS', stat1: 'S', stat2: 'S', fatigueCost: 3, name: 'Greatsword', mul: 0.75 },
  AA: { type: 'AA', stat1: 'A', stat2: 'A', fatigueCost: 2, name: 'Daggers',    mul: 0.75 },
  II: { type: 'II', stat1: 'I', stat2: 'I', fatigueCost: 5, name: 'Staff',      mul: 0.75 },
  SA: { type: 'SA', stat1: 'S', stat2: 'A', fatigueCost: 2, name: 'Longsword',  mul: 1 },
  AI: { type: 'AI', stat1: 'A', stat2: 'I', fatigueCost: 3, name: 'Rapier',     mul: 1 },
  IS: { type: 'IS', stat1: 'I', stat2: 'S', fatigueCost: 4, name: 'War Hammer', mul: 1 },
};

export const WEAPON_LIST: WeaponType[] = ['SS', 'AA', 'II', 'SA', 'AI', 'IS'];
