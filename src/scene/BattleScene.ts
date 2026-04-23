import Phaser from 'phaser';
import type { BattleState, BattleChar } from '../state/BattleState';
import type { CharacterSetup } from '../core/character';
import {
  getActiveChar, getLiving, isRoundOver,
  startRound, beginCharTurn, applyDamage, checkBattleEnd, nextTurn,
  moveChar, updateFatigue,
} from '../state/BattleState';
import { rollInitiative } from '../core/initiative';
import { reachableHexes, calcSteps, findReference, findPath } from '../core/movement';
import { rollDamage, rollDefense, calcNetDamage, maxDamage } from '../core/combat';
import { applyActionCost } from '../core/fatigue';
import { hexNeighbors, hexDistance } from '../utils/hexMath';
import type { HexCoord } from '../utils/hexMath';
import { getFieldConfig } from '../core/spawn';
import { decideTurn } from '../core/ai';
import type { AiAction } from '../core/ai';
import { HexGrid } from './HexGrid';
import { CharacterToken } from './CharacterToken';
import { TurnOrderBar } from './TurnOrderBar';

interface BattleSceneData {
  battleState: BattleState;
  setups: CharacterSetup[];
  betCharId: string | null;
}

type Phase = 'idle' | 'player' | 'ai';

interface PlayerTurnState {
  stepsRemaining: number;
  hasAttacked: boolean;
  maxSteps: number;
}

export class BattleScene extends Phaser.Scene {
  private bs!: BattleState;
  private setups!: CharacterSetup[];
  private betCharId: string | null = null;
  private grid!: HexGrid;
  private tokens: Map<string, CharacterToken> = new Map();
  private turnBar!: TurnOrderBar;
  private phase: Phase = 'idle';
  private playerTurn: PlayerTurnState | null = null;

  private statsText!: Phaser.GameObjects.Text;
  private stepsText!: Phaser.GameObjects.Text;
  private endTurnBtn!: Phaser.GameObjects.Container;
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private gameSpeed = 1;
  private speedBtns: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: BattleSceneData): void {
    this.bs = data.battleState;
    this.setups = data.setups;
    this.betCharId = data.betCharId ?? null;
    this.tokens.clear();
    this.logLines = [];
    this.phase = 'idle';
    this.playerTurn = null;
    this.gameSpeed = 1;
    this.speedBtns = [];
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d1a);

    const n = this.bs.chars.length;
    const { fieldRadius } = getFieldConfig(n);
    const hexSize = this.calcHexSize(fieldRadius);
    const gridCX = width / 2 - 140;
    const gridCY = height / 2 + 20;

    this.grid = new HexGrid(this, gridCX, gridCY, fieldRadius, hexSize);
    this.grid.onHexClick = (hex) => this.onHexClick(hex);

    for (const char of this.bs.chars) {
      const token = new CharacterToken(this, char);
      const { x, y } = this.grid.hexToWorld(char.position);
      token.setPosition(x, y);
      this.tokens.set(char.id, token);
    }

    this.turnBar = new TurnOrderBar(this);

    // Bottom panel
    this.add.rectangle(width / 2, height - 28, width, 56, 0x0a0a1a, 0.95);

    this.statsText = this.add.text(10, height - 50, '', {
      fontSize: '12px', color: '#aaaacc',
    });
    this.stepsText = this.add.text(10, height - 34, '', {
      fontSize: '12px', color: '#f1c40f',
    });

    // Right panel: event log
    this.add.rectangle(width - 160, height / 2 + 36, 300, height - 140, 0x0a0a1a, 0.85);
    this.add.text(width - 306, 80, 'Battle Log', { fontSize: '12px', color: '#555577' });
    this.logText = this.add.text(width - 306, 96, '', {
      fontSize: '11px', color: '#778899', wordWrap: { width: 296 },
    });

    this.endTurnBtn = this.makeButton('End Turn', width - 160, height - 28, () => this.onEndTurn());
    this.endTurnBtn.setVisible(false);

    this.makeButton('← Setup', width - 160, 20, () => this.scene.start('SetupScene'));
    this.buildSpeedButtons(width);

    this.beginRound();
  }

  private calcHexSize(fieldRadius: number): number {
    const { height } = this.scale;
    const availH = height * 0.82;
    return Math.floor(Math.min(46, availH / ((fieldRadius * 2 + 1) * 1.75)));
  }

  private beginRound(): void {
    const initiatives = new Map<string, number>();
    for (const c of getLiving(this.bs)) {
      initiatives.set(c.id, rollInitiative(c.stats.A));
    }
    this.bs = startRound(this.bs, initiatives);
    this.log(`--- Round ${this.bs.round} ---`);
    this.turnBar.refresh(this.bs, this.betCharId);
    this.beginTurn();
  }

  private beginTurn(): void {
    if (this.bs.status === 'ended') { this.showResult(); return; }
    if (isRoundOver(this.bs)) { this.beginRound(); return; }

    let active = getActiveChar(this.bs);
    if (!active) return;

    // Recover from knockout at the start of this character's turn
    this.bs = beginCharTurn(this.bs, active.id);
    active = getActiveChar(this.bs)!;
    this.tokens.get(active.id)?.refresh(active);

    this.updateBottomPanel(active, null);
    this.turnBar.refresh(this.bs, this.betCharId);

    if (active.setup.controller === 'player') {
      this.startPlayerTurn(active);
    } else {
      this.phase = 'ai';
      this.time.delayedCall(400, () => this.runAiTurn(active));
    }
  }

  // ── Player turn ──────────────────────────────────────────────────────────

  private startPlayerTurn(char: BattleChar): void {
    this.phase = 'player';
    const living = getLiving(this.bs);
    const ref = findReference(toCharStates(living));
    const refChar = living.find(c => c.id === ref.id)!;
    const maxSteps = calcSteps(char.stats.A, refChar.stats.A);
    this.playerTurn = { stepsRemaining: maxSteps, hasAttacked: false, maxSteps };
    this.endTurnBtn.setVisible(true);
    this.showPlayerHighlights(char);
    this.updateBottomPanel(char, this.playerTurn);
  }

  private showPlayerHighlights(char: BattleChar): void {
    if (!this.playerTurn) return;
    const living = getLiving(this.bs);
    const occupied = living.filter(c => c.id !== char.id).map(c => c.position);
    const eMax = char.stats.I;

    const canMove = this.playerTurn.stepsRemaining > 0 && !char.knockedOut
      && applyActionCost(char.fatigue, 1, eMax).fatigue < eMax;

    const moveHexes = canMove
      ? reachableHexes(char.position, this.playerTurn.stepsRemaining, occupied, this.grid.fieldRadius)
      : [];

    const canAttack = !this.playerTurn.hasAttacked && !char.knockedOut
      && !applyActionCost(char.fatigue, char.setup.weapon.fatigueCost, eMax).knockedOut;

    const attackHexes: HexCoord[] = canAttack
      ? hexNeighbors(char.position).filter(nb => {
          const key = hk(nb);
          return living.some(c =>
            c.id !== char.id &&
            c.setup.team !== char.setup.team &&
            hk(c.position) === key,
          );
        })
      : [];

    this.grid.setMoveHighlights(moveHexes);
    this.grid.setAttackHighlights(attackHexes);
  }

  private onHexClick(hex: HexCoord): void {
    if (this.phase !== 'player' || !this.playerTurn) return;
    const active = getActiveChar(this.bs);
    if (!active) return;

    const key = hk(hex);
    const living = getLiving(this.bs);

    // Adjacent enemy → attack
    const target = living.find(c =>
      c.id !== active.id &&
      c.setup.team !== active.setup.team &&
      hk(c.position) === key &&
      hexDistance(active.position, hex) === 1,
    );
    if (target && !this.playerTurn.hasAttacked && !active.knockedOut) {
      this.resolveAttack(active, target);
      return;
    }

    // Reachable empty hex → move
    if (this.playerTurn.stepsRemaining > 0 && !active.knockedOut) {
      const occupied = living.filter(c => c.id !== active.id).map(c => c.position);
      const reachable = reachableHexes(
        active.position, this.playerTurn.stepsRemaining, occupied, this.grid.fieldRadius,
      );
      if (reachable.some(h => hk(h) === key)) {
        this.movePlayer(active, hex);
      }
    }
  }

  private movePlayer(char: BattleChar, to: HexCoord): void {
    if (!this.playerTurn) return;
    const living = getLiving(this.bs);
    const occupied = living.filter(c => c.id !== char.id).map(c => c.position);
    const path = findPath(char.position, to, occupied, this.grid.fieldRadius);
    if (!path || path.length === 0) return;

    const usedSteps = Math.min(path.length, this.playerTurn.stepsRemaining);
    const dest = path[usedSteps - 1];
    const fatigueResult = applyActionCost(char.fatigue, usedSteps, char.stats.I);

    this.bs = moveChar(this.bs, char.id, dest);
    this.bs = updateFatigue(this.bs, char.id, fatigueResult.fatigue, fatigueResult.knockedOut);
    if (fatigueResult.knockedOut) this.log(`${char.id} knocked out!`);

    this.playerTurn.stepsRemaining -= usedSteps;
    this.phase = 'idle';
    this.grid.clearHighlights();

    const token = this.tokens.get(char.id)!;
    const { x, y } = this.grid.hexToWorld(dest);
    token.moveTween(x, y, this.gameSpeed, () => {
      this.phase = 'player';
      const updated = this.bs.chars.find(c => c.id === char.id)!;
      token.refresh(updated);
      this.showPlayerHighlights(updated);
      this.updateBottomPanel(updated, this.playerTurn);
    });
  }

  private resolveAttack(attacker: BattleChar, defender: BattleChar): void {
    if (!this.playerTurn) return;

    const dmg = rollDamage(attacker.setup.weapon, attacker.stats);
    const def = rollDefense(defender.stats.S, defender.knockedOut);
    const netD = calcNetDamage(dmg, def);
    this.log(`${attacker.id} → ${defender.id}  D:${dmg} Def:${def} Net:${netD}`);

    const fatigueResult = applyActionCost(
      attacker.fatigue, attacker.setup.weapon.fatigueCost, attacker.stats.I,
    );
    this.bs = updateFatigue(this.bs, attacker.id, fatigueResult.fatigue, fatigueResult.knockedOut);
    if (fatigueResult.knockedOut) this.log(`${attacker.id} knocked out!`);

    this.bs = applyDamage(this.bs, defender.id, netD);
    this.bs = checkBattleEnd(this.bs);

    const updatedDef = this.bs.chars.find(c => c.id === defender.id)!;
    const defToken = this.tokens.get(defender.id)!;
    defToken.refresh(updatedDef);

    this.playerTurn.hasAttacked = true;
    this.tokens.get(attacker.id)!.refresh(this.bs.chars.find(c => c.id === attacker.id)!);
    this.turnBar.refresh(this.bs, this.betCharId);

    const attToken = this.tokens.get(attacker.id)!;
    const afterAnimations = () => {
      if (this.bs.status === 'ended') {
        this.time.delayedCall(Math.round(300 / this.gameSpeed), () => this.showResult());
        return;
      }
      const updatedAtt = this.bs.chars.find(c => c.id === attacker.id)!;
      this.showPlayerHighlights(updatedAtt);
      this.updateBottomPanel(updatedAtt, this.playerTurn);
      if (this.playerTurn!.stepsRemaining === 0 || fatigueResult.knockedOut) {
        this.time.delayedCall(Math.round(300 / this.gameSpeed), () => this.onEndTurn());
      }
    };

    const afterHit = () => {
      if (updatedDef.dead) {
        this.log(`${defender.id} defeated!`);
        defToken.playDeathAnimation(this.gameSpeed, afterAnimations);
      } else {
        afterAnimations();
      }
    };

    attToken.playAttackAnimation(this.gameSpeed, () => {
      if (netD > 0) {
        defToken.playHitAnimation(this.gameSpeed, afterHit);
      } else {
        afterHit();
      }
    });
  }

  private onEndTurn(): void {
    if (this.phase !== 'player') return;
    this.phase = 'idle';
    this.endTurnBtn.setVisible(false);
    this.grid.clearHighlights();
    this.playerTurn = null;
    this.bs = nextTurn(this.bs);
    this.beginTurn();
  }

  // ── AI turn ───────────────────────────────────────────────────────────────

  private runAiTurn(char: BattleChar): void {
    const actions = decideTurn(this.bs, char, this.grid.fieldRadius);
    this.executeAiActions(char.id, actions, 0);
  }

  private executeAiActions(charId: string, actions: AiAction[], idx: number): void {
    if (idx >= actions.length) { this.endAiTurn(); return; }
    const action = actions[idx];
    const next = () => this.executeAiActions(charId, actions, idx + 1);

    if (action.type === 'end') {
      this.endAiTurn();
      return;
    }

    if (action.type === 'move') {
      const char = this.bs.chars.find(c => c.id === charId)!;
      const fr = applyActionCost(char.fatigue, 1, char.stats.I);
      this.bs = moveChar(this.bs, charId, action.to);
      this.bs = updateFatigue(this.bs, charId, fr.fatigue, fr.knockedOut);
      const token = this.tokens.get(charId)!;
      const { x, y } = this.grid.hexToWorld(action.to);
      token.moveTween(x, y, this.gameSpeed, () => {
        token.refresh(this.bs.chars.find(c => c.id === charId)!);
        next();
      });
      return;
    }

    if (action.type === 'attack') {
      const attacker = this.bs.chars.find(c => c.id === charId)!;
      const defender = this.bs.chars.find(c => c.id === action.targetId);
      if (!defender || defender.dead) { next(); return; }

      const dmg = rollDamage(attacker.setup.weapon, attacker.stats);
      const def = rollDefense(defender.stats.S, defender.knockedOut);
      const netD = calcNetDamage(dmg, def);
      this.log(`${attacker.id} → ${defender.id}  D:${dmg} Def:${def} Net:${netD}`);

      const fr = applyActionCost(attacker.fatigue, attacker.setup.weapon.fatigueCost, attacker.stats.I);
      this.bs = updateFatigue(this.bs, charId, fr.fatigue, fr.knockedOut);
      this.bs = applyDamage(this.bs, action.targetId, netD);
      this.bs = checkBattleEnd(this.bs);

      const updatedDef = this.bs.chars.find(c => c.id === action.targetId)!;
      const defToken = this.tokens.get(action.targetId)!;
      defToken.refresh(updatedDef);
      this.tokens.get(charId)!.refresh(this.bs.chars.find(c => c.id === charId)!);
      this.turnBar.refresh(this.bs, this.betCharId);

      const attToken = this.tokens.get(charId)!;
      const afterHit = () => {
        if (updatedDef.dead) {
          this.log(`${defender.id} defeated!`);
          defToken.playDeathAnimation(this.gameSpeed, () => {
            if (this.bs.status === 'ended') { this.showResult(); return; }
            next();
          });
          return;
        }
        if (this.bs.status === 'ended') { this.showResult(); return; }
        next();
      };

      attToken.playAttackAnimation(this.gameSpeed, () => {
        if (netD > 0) {
          defToken.playHitAnimation(this.gameSpeed, afterHit);
        } else {
          afterHit();
        }
      });
    }
  }

  private endAiTurn(): void {
    this.bs = nextTurn(this.bs);
    this.time.delayedCall(Math.round(200 / this.gameSpeed), () => this.beginTurn());
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  private updateBottomPanel(char: BattleChar, turn: PlayerTurnState | null): void {
    const hp = char.stats.S + char.stats.A + char.stats.I;
    const dmg = maxDamage(char.setup.weapon, char.stats);
    this.statsText.setText(
      `${char.id}  [${char.setup.weapon.name}]  S:${char.stats.S}  A:${char.stats.A}  I:${char.stats.I}  HP:${hp}  F:${char.fatigue}/${char.stats.I}  DMG:${dmg}`,
    );
    this.stepsText.setText(
      turn ? `Steps: ${turn.stepsRemaining}/${turn.maxSteps}  Attack: ${turn.hasAttacked ? 'used' : 'ready'}` : '',
    );
  }

  private log(msg: string): void {
    this.logLines.push(msg);
    if (this.logLines.length > 14) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }

  private showResult(): void {
    this.phase = 'idle';
    this.endTurnBtn.setVisible(false);
    this.grid.clearHighlights();
    this.scene.start('ResultScene', {
      winnerTeam: this.bs.winnerTeam,
      setups: this.setups,
      rounds: this.bs.round,
      betCharId: this.betCharId,
    });
  }

  private buildSpeedButtons(width: number): void {
    const speeds = [1, 2, 3];
    const btnW = 38; const btnH = 22; const gap = 6;
    const totalW = speeds.length * btnW + (speeds.length - 1) * gap;
    const startX = width - 160 - totalW / 2 + btnW / 2;

    this.add.text(startX - btnW / 2 - 6, 48, 'Speed', {
      fontSize: '10px', color: '#555577',
    }).setOrigin(1, 0.5);

    speeds.forEach((s, i) => {
      const x = startX + i * (btnW + gap);
      const c = this.add.container(x, 48);
      const isActive = s === this.gameSpeed;
      const bg = this.add.rectangle(0, 0, btnW, btnH,
        isActive ? 0x1a3d24 : 0x111122,
      ).setStrokeStyle(1, isActive ? 0x2ecc71 : 0x444466);
      const txt = this.add.text(0, 0, `×${s}`, {
        fontSize: '11px', color: isActive ? '#2ecc71' : '#555577',
      }).setOrigin(0.5);
      c.add([bg, txt]);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.gameSpeed = s;
        this.speedBtns.forEach((btn, j) => {
          const active = speeds[j] === s;
          (btn.list[0] as Phaser.GameObjects.Rectangle)
            .setFillStyle(active ? 0x1a3d24 : 0x111122)
            .setStrokeStyle(1, active ? 0x2ecc71 : 0x444466);
          (btn.list[1] as Phaser.GameObjects.Text)
            .setColor(active ? '#2ecc71' : '#555577');
        });
      });
      this.speedBtns.push(c);
    });
  }

  private makeButton(
    label: string, x: number, y: number, cb: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 120, 28, 0x1e3a5f).setStrokeStyle(1, 0x3498db);
    const txt = this.add.text(0, 0, label, { fontSize: '13px', color: '#3498db' }).setOrigin(0.5);
    c.add([bg, txt]);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x2a4f7a))
      .on('pointerout',  () => bg.setFillStyle(0x1e3a5f))
      .on('pointerdown', cb);
    return c;
  }
}

function hk(h: HexCoord): string {
  return `${h.q},${h.r},${h.s}`;
}

function toCharStates(chars: BattleChar[]) {
  return chars.map(c => ({
    id: c.id,
    stats: c.stats,
    fatigue: c.fatigue,
    knockedOut: c.knockedOut,
    position: c.position,
    initOrder: c.initOrder,
  }));
}
