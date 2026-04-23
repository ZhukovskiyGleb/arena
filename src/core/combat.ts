import { random } from '../utils/random';
import type { CharacterStats } from './character';
import type { WeaponConfig } from './weapons';

export function maxDamage(weapon: WeaponConfig, stats: CharacterStats): number {
  return Math.round((stats[weapon.stat1] + stats[weapon.stat2]) * weapon.mul);
}

export function rollDamage(weapon: WeaponConfig, stats: CharacterStats): number {
  return Math.round(random(stats[weapon.stat1] + stats[weapon.stat2]) * weapon.mul);
}

export function rollDefense(s: number, knockedOut: boolean): number {
  if (knockedOut) return 0;
  return random(s);
}

export function calcNetDamage(d: number, def: number): number {
  return Math.max(0, d - def);
}

export function distributeNetDamage(
  netD: number,
  s: number,
  a: number,
  i: number,
): { S: number; A: number; I: number; dead: boolean } {
  if (netD <= 0) return { S: 0, A: 0, I: 0, dead: false };

  const hp = s + a + i;
  if (netD >= hp - 2) return { S: s, A: a, I: i, dead: true };

  const cap = { S: s - 1, A: a - 1, I: i - 1 };
  const ideal = { S: (netD * s) / hp, A: (netD * a) / hp, I: (netD * i) / hp };
  const d = {
    S: Math.min(cap.S, Math.floor(ideal.S)),
    A: Math.min(cap.A, Math.floor(ideal.A)),
    I: Math.min(cap.I, Math.floor(ideal.I)),
  };
  let rem = netD - d.S - d.A - d.I;

  // Pass 1: distribute remainder by descending fractional part
  for (const k of (['S', 'A', 'I'] as Array<'S' | 'A' | 'I'>).sort(
    (x, y) => (ideal[y] % 1) - (ideal[x] % 1),
  )) {
    if (rem <= 0) break;
    if (d[k] < cap[k]) {
      d[k]++;
      rem--;
    }
  }

  // Pass 2: greedy fill for any remaining (capped stat edge cases)
  for (const k of ['S', 'A', 'I'] as const) {
    if (rem <= 0) break;
    const add = Math.min(rem, cap[k] - d[k]);
    d[k] += add;
    rem -= add;
  }

  return { ...d, dead: false };
}
