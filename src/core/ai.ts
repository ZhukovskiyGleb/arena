import type { BattleState, BattleChar } from '../state/BattleState';
import { getLiving } from '../state/BattleState';
import type { HexCoord } from '../utils/hexMath';
import { hexDistance, hexNeighbors } from '../utils/hexMath';
import { findPath, calcSteps, findReference, reachableHexes } from './movement';
import { applyActionCost } from './fatigue';
import { maxDamage } from './combat';

export type AiAction =
  | { type: 'move';   to: HexCoord }
  | { type: 'attack'; targetId: string }
  | { type: 'end' };

export function decideTurn(
  state: BattleState,
  char: BattleChar,
  fieldRadius: number,
): AiAction[] {
  const living = getLiving(state);
  const enemies = living.filter(c => c.setup.team !== char.setup.team);
  if (enemies.length === 0) return [{ type: 'end' }];
  if (char.fatigue >= char.stats.I) return [{ type: 'end' }];

  const ref = findReference(living.map(c => ({
    id: c.id, stats: c.stats, fatigue: c.fatigue,
    knockedOut: c.knockedOut, position: c.position, initOrder: c.initOrder,
  })));
  const refChar   = living.find(c => c.id === ref.id)!;
  const maxSteps  = calcSteps(char.stats.A, refChar.stats.A);

  // Nearest enemy; ties broken by lowest HP
  const target = enemies.reduce((best, e) => {
    const db = hexDistance(char.position, best.position);
    const de = hexDistance(char.position, e.position);
    if (de !== db) return de < db ? e : best;
    return hp(e) < hp(best) ? e : best;
  });

  const myHp        = hp(char);
  const enemyHp     = hp(target);
  const myMaxDmg    = maxDamage(char.setup.weapon, char.stats);
  const enemyMaxDmg = maxDamage(target.setup.weapon, target.stats);
  const canKillEnemy   = myMaxDmg    >= enemyHp - 2;
  const enemyCanKillUs = enemyMaxDmg >= myHp    - 2;
  const enemyHasntActed = state.turnQueue.indexOf(target.id) > state.turnIndex;

  const d           = hexDistance(char.position, target.position);
  const enemySteps  = calcSteps(target.stats.A, refChar.stats.A);
  // can we get adjacent and attack this very turn?
  const canReachAndAttack = maxSteps >= d - 1;
  // distance at which enemy cannot reach us next turn
  const safeDistance = enemySteps + 2;

  const allOccupied = living.filter(c => c.id !== char.id).map(c => c.position);

  const actions: AiAction[] = [];
  let fatigue = char.fatigue;
  let pos = char.position;

  // ── Movement ─────────────────────────────────────────────────────────────

  let movePath = planMovement({
    char, target, d, maxSteps, enemySteps, safeDistance,
    canReachAndAttack, canKillEnemy, enemyCanKillUs, enemyHasntActed,
    allOccupied, fieldRadius, myHp, enemyHp,
  });

  // ── Flee override ────────────────────────────────────────────────────────
  // Applies when advancing puts us in a bad spot we can't escape from:
  //  (a) movement itself causes KO — get KO'd far from enemies instead
  //  (b) movement lands us adjacent but attacking would cause KO while a
  //      dangerous enemy still has their turn — flee rather than stand idle
  const endPos      = movePath.length > 0 ? movePath[movePath.length - 1] : char.position;
  const fatalFatigue = char.fatigue + movePath.length;
  const koSteps      = Math.min(maxSteps, char.stats.I - char.fatigue);

  const moveWouldKO = movePath.length > 0 && fatalFatigue >= char.stats.I;
  const adjacentTrap =
    hexDistance(endPos, target.position) === 1 &&
    fatalFatigue + char.setup.weapon.fatigueCost >= char.stats.I &&
    !canKillEnemy && enemyCanKillUs && enemyHasntActed;

  if (moveWouldKO || adjacentTrap) {
    const fleeHex = farthestFromEnemies(
      char.position, koSteps, allOccupied, fieldRadius,
      enemies.map(e => e.position),
    );
    if (fleeHex) {
      movePath = findPath(char.position, fleeHex, allOccupied, fieldRadius) ?? movePath;
    }
  }

  let stepsUsed = 0;
  for (const step of movePath) {
    if (fatigue >= char.stats.I) break;
    actions.push({ type: 'move', to: step });
    fatigue = applyActionCost(fatigue, 1, char.stats.I).fatigue;
    pos = step;
    stepsUsed++;
  }

  // ── Attack ───────────────────────────────────────────────────────────────

  if (fatigue < char.stats.I) {
    const adjacent = hexNeighbors(pos).flatMap(nb => {
      const found = living.find(c =>
        c.id !== char.id &&
        c.setup.team !== char.setup.team &&
        hk(c.position) === hk(nb),
      );
      return found ? [found] : [];
    });

    if (adjacent.length > 0) {
      const attackTarget = adjacent.reduce((a, b) => hp(a) <= hp(b) ? a : b);
      const attackCausesKO = applyActionCost(
        fatigue, char.setup.weapon.fatigueCost, char.stats.I,
      ).knockedOut;
      // Always attack on a potential kill shot;
      // otherwise skip if it causes KO while a dangerous enemy still has their turn
      const shouldAttack = canKillEnemy
        || !(attackCausesKO && enemyHasntActed && enemyCanKillUs);
      if (shouldAttack) {
        actions.push({ type: 'attack', targetId: attackTarget.id });

        // ── Tactical retreat after attack ─────────────────────────────────
        // If we have more remaining steps than the enemy, they can't catch up
        // to retaliate — spend those steps retreating to safety
        const fatigueAfterAttack = applyActionCost(
          fatigue, char.setup.weapon.fatigueCost, char.stats.I,
        ).fatigue;
        const remainingSteps   = maxSteps - stepsUsed;
        const stepsForRetreat  = Math.min(remainingSteps, char.stats.I - fatigueAfterAttack);

        if (enemyHasntActed && stepsForRetreat > enemySteps) {
          const fleeHex = farthestFromEnemies(
            pos, stepsForRetreat, allOccupied, fieldRadius,
            enemies.map(e => e.position),
          );
          if (fleeHex) {
            const retreatPath = findPath(pos, fleeHex, allOccupied, fieldRadius) ?? [];
            let f = fatigueAfterAttack;
            for (const step of retreatPath) {
              if (f >= char.stats.I) break;
              actions.push({ type: 'move', to: step });
              f = applyActionCost(f, 1, char.stats.I).fatigue;
            }
          }
        }
      }
    }
  }

  return [...actions, { type: 'end' }];
}

interface MoveCtx {
  char: BattleChar;
  target: BattleChar;
  d: number;
  maxSteps: number;
  enemySteps: number;
  safeDistance: number;
  canReachAndAttack: boolean;
  canKillEnemy: boolean;
  enemyCanKillUs: boolean;
  enemyHasntActed: boolean;
  allOccupied: HexCoord[];
  fieldRadius: number;
  myHp: number;
  enemyHp: number;
}

function planMovement(ctx: MoveCtx): HexCoord[] {
  const {
    char, target, d, maxSteps, enemySteps, safeDistance,
    canReachAndAttack, canKillEnemy, enemyCanKillUs, enemyHasntActed,
    allOccupied, fieldRadius, myHp, enemyHp,
  } = ctx;

  // ── Can attack this turn: full advance ──────────────────────────────────
  if (canReachAndAttack) {
    return advancePath(char, target, maxSteps, allOccupied, fieldRadius);
  }

  // ── No threat from enemy this round: full advance ───────────────────────
  if (!enemyHasntActed || !enemyCanKillUs || canKillEnemy) {
    return advancePath(char, target, maxSteps, allOccupied, fieldRadius);
  }

  // ── Enemy can kill us and will act this round ────────────────────────────
  // Enemy reach after our move: enemy can attack if distance ≤ enemySteps + 1
  const inDangerNow        = d <= enemySteps + 1;
  const dAfterFullAdvance  = Math.max(0, d - maxSteps);
  const inDangerAfterMove  = dAfterFullAdvance <= enemySteps + 1;

  if (inDangerNow || (inDangerAfterMove && myHp < enemyHp * 0.5)) {
    // Already in danger or critically outmatched: retreat to safe distance
    return safeRetreat(char, target, maxSteps, safeDistance, allOccupied, fieldRadius);
  }

  if (inDangerAfterMove) {
    // Full advance puts us in range but HP is ok: cautious approach instead
    // advance only as far as safeDistance allows
    const safeAdvance = Math.min(maxSteps, Math.max(0, d - safeDistance));
    if (safeAdvance === 0) return []; // already at safe distance — hold position
    const occupied = withoutTarget(allOccupied, target);
    const path = findPath(char.position, target.position, occupied, fieldRadius) ?? [];
    return path.slice(0, safeAdvance);
  }

  // Full advance keeps us outside enemy reach — go for it
  return advancePath(char, target, maxSteps, allOccupied, fieldRadius);
}

function advancePath(
  char: BattleChar,
  target: BattleChar,
  maxSteps: number,
  allOccupied: HexCoord[],
  fieldRadius: number,
): HexCoord[] {
  const occupied = withoutTarget(allOccupied, target);
  const path = findPath(char.position, target.position, occupied, fieldRadius) ?? [];
  // Stop 1 hex short — attack from adjacent
  return path.length > 1 ? path.slice(0, Math.min(maxSteps, path.length - 1)) : [];
}

function safeRetreat(
  char: BattleChar,
  target: BattleChar,
  maxSteps: number,
  safeDistance: number,
  allOccupied: HexCoord[],
  fieldRadius: number,
): HexCoord[] {
  const reachable = reachableHexes(char.position, maxSteps, allOccupied, fieldRadius);
  if (reachable.length === 0) return [];

  // Prefer: safe hex closest to target (retreat just enough, not further)
  // Fallback: hex farthest from target (can't fully escape)
  const safeHexes = reachable.filter(h => hexDistance(h, target.position) >= safeDistance);
  const bestHex = safeHexes.length > 0
    ? safeHexes.reduce((best, h) =>
        hexDistance(h, target.position) < hexDistance(best, target.position) ? h : best)
    : reachable.reduce((best, h) =>
        hexDistance(h, target.position) > hexDistance(best, target.position) ? h : best);

  return findPath(char.position, bestHex, allOccupied, fieldRadius) ?? [];
}

function withoutTarget(allOccupied: HexCoord[], target: BattleChar): HexCoord[] {
  return allOccupied.filter(p => hk(p) !== hk(target.position));
}

function farthestFromEnemies(
  origin: HexCoord,
  steps: number,
  allOccupied: HexCoord[],
  fieldRadius: number,
  enemyPositions: HexCoord[],
): HexCoord | null {
  const reachable = reachableHexes(origin, steps, allOccupied, fieldRadius);
  if (reachable.length === 0) return null;
  const minDistTo = (h: HexCoord) =>
    Math.min(...enemyPositions.map(ep => hexDistance(h, ep)));
  return reachable.reduce((best, h) => minDistTo(h) > minDistTo(best) ? h : best);
}

function hp(c: BattleChar): number {
  return c.stats.S + c.stats.A + c.stats.I;
}

function hk(h: HexCoord): string {
  return `${h.q},${h.r},${h.s}`;
}
