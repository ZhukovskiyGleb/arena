import { random } from '../utils/random';
import type { CharacterState } from './character';

export function rollInitiative(a: number): number {
  return random(a);
}

export function sortTurnOrder(
  chars: CharacterState[],
  initiatives: Map<string, number>,
): CharacterState[] {
  return [...chars].sort((a, b) => {
    const ia = initiatives.get(a.id) ?? 0;
    const ib = initiatives.get(b.id) ?? 0;
    if (ib !== ia) return ib - ia;
    if (b.stats.A !== a.stats.A) return b.stats.A - a.stats.A;
    const sumA = a.stats.S + a.stats.A + a.stats.I;
    const sumB = b.stats.S + b.stats.A + b.stats.I;
    if (sumB !== sumA) return sumB - sumA;
    return a.initOrder - b.initOrder;
  });
}
