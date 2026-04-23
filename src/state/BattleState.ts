import type { CharacterSetup, CharacterStats, TeamColor } from '../core/character';
import type { HexCoord } from '../utils/hexMath';
import { distributeNetDamage } from '../core/combat';

export interface BattleChar {
  id: string;
  setup: CharacterSetup;
  stats: CharacterStats;
  position: HexCoord;
  fatigue: number;
  knockedOut: boolean;
  initOrder: number;
  initiative: number;
  dead: boolean;
}

export interface BattleState {
  round: number;
  chars: BattleChar[];
  turnQueue: string[]; // IDs of living chars in this round's order
  turnIndex: number;
  status: 'active' | 'ended';
  winnerTeam: TeamColor | null;
}

export function createBattleState(
  setups: CharacterSetup[],
  positions: HexCoord[],
): BattleState {
  const chars: BattleChar[] = setups.map((setup, i) => ({
    id: setup.id,
    setup,
    stats: { ...setup.stats },
    position: positions[i],
    fatigue: 0,
    knockedOut: false,
    initOrder: i,
    initiative: 0,
    dead: false,
  }));
  return { round: 0, chars, turnQueue: [], turnIndex: 0, status: 'active', winnerTeam: null };
}

export function getLiving(state: BattleState): BattleChar[] {
  return state.chars.filter(c => !c.dead);
}

export function getActiveChar(state: BattleState): BattleChar | null {
  const id = state.turnQueue[state.turnIndex];
  if (id === undefined) return null;
  return state.chars.find(c => c.id === id) ?? null;
}

export function isRoundOver(state: BattleState): boolean {
  return state.turnIndex >= state.turnQueue.length;
}

export function startRound(
  state: BattleState,
  initiatives: Map<string, number>,
): BattleState {
  const chars = state.chars.map(c => ({
    ...c,
    initiative: c.dead ? 0 : (initiatives.get(c.id) ?? 0),
  }));

  const turnQueue = chars
    .filter(c => !c.dead)
    .sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      if (b.stats.A !== a.stats.A) return b.stats.A - a.stats.A;
      const sa = a.stats.S + a.stats.A + a.stats.I;
      const sb = b.stats.S + b.stats.A + b.stats.I;
      if (sb !== sa) return sb - sa;
      return a.initOrder - b.initOrder;
    })
    .map(c => c.id);

  return { ...state, round: state.round + 1, chars, turnQueue, turnIndex: 0 };
}

// Called at the start of each character's turn. Resets fatigue only if they
// were knocked out — otherwise fatigue carries over from the previous turn.
export function beginCharTurn(state: BattleState, charId: string): BattleState {
  const chars = state.chars.map(c => {
    if (c.id !== charId || !c.knockedOut) return c;
    return { ...c, fatigue: 0, knockedOut: false };
  });
  return { ...state, chars };
}

export function applyDamage(
  state: BattleState,
  targetId: string,
  netD: number,
): BattleState {
  const chars = state.chars.map(c => {
    if (c.id !== targetId || c.dead) return c;
    const result = distributeNetDamage(netD, c.stats.S, c.stats.A, c.stats.I);
    if (result.dead) return { ...c, dead: true };
    return {
      ...c,
      stats: { S: c.stats.S - result.S, A: c.stats.A - result.A, I: c.stats.I - result.I },
    };
  });
  return { ...state, chars };
}

export function checkBattleEnd(state: BattleState): BattleState {
  const living = getLiving(state);
  const teams = new Set(living.map(c => c.setup.team));
  if (teams.size > 1) return state;
  const winnerTeam = teams.size === 1 ? [...teams][0] : null;
  return { ...state, status: 'ended', winnerTeam };
}

export function nextTurn(state: BattleState): BattleState {
  if (state.status === 'ended') return state;
  let next = state.turnIndex + 1;
  while (next < state.turnQueue.length) {
    const id = state.turnQueue[next];
    if (!state.chars.find(c => c.id === id)?.dead) break;
    next++;
  }
  return { ...state, turnIndex: next };
}

export function moveChar(
  state: BattleState,
  charId: string,
  newPosition: HexCoord,
): BattleState {
  const chars = state.chars.map(c =>
    c.id === charId ? { ...c, position: newPosition } : c,
  );
  return { ...state, chars };
}

export function updateFatigue(
  state: BattleState,
  charId: string,
  fatigue: number,
  knockedOut: boolean,
): BattleState {
  const chars = state.chars.map(c =>
    c.id === charId ? { ...c, fatigue, knockedOut } : c,
  );
  return { ...state, chars };
}
