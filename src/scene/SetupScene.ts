import Phaser from 'phaser';
import {
  createSetupState,
  activateSlot,
  deactivateSlot,
  updateCharacter,
  validate,
  getActiveCharacters,
  type SetupState,
} from '../state/SetupState';
import { WEAPONS, WEAPON_LIST } from '../core/weapons';
import { CharacterCard, type CardCallbacks } from '../ui/CharacterCard';
import type { TeamColor } from '../core/character';
import { calcStartPositions } from '../core/spawn';
import { rollInitiative } from '../core/initiative';
import { createBattleState, startRound } from '../state/BattleState';

const CARD_W = CharacterCard.W;
const CARD_H = CharacterCard.H;
const LEFT = 20;
const TOP = 55;
const COL_GAP = 20;
const ROW_GAP = 10;

export class SetupScene extends Phaser.Scene {
  private setupState!: SetupState;
  private cards!: CharacterCard[];
  private readyBg!: Phaser.GameObjects.Rectangle;
  private readyText!: Phaser.GameObjects.Text;
  private readyReason!: Phaser.GameObjects.Text;
  private betIndex: number | null = null;

  constructor() {
    super({ key: 'SetupScene' });
  }

  create(): void {
    this.setupState = createSetupState();
    this.betIndex = null;
    this.buildStatic();
    this.buildCards();
    this.refresh();
  }

  private buildStatic(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d1a);

    // Title
    this.add.text(width / 2, 26, 'ARENA — Setup', {
      fontSize: '20px', color: '#e74c3c', fontStyle: 'bold',
    }).setOrigin(0.5);

    // READY button
    this.readyBg = this.add.rectangle(width / 2, height - 30, 220, 46, 0x2ecc71)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleReady())
      .on('pointerover', () => { if (this.isValid()) this.readyBg.setFillStyle(0x27ae60); })
      .on('pointerout', () => { if (this.isValid()) this.readyBg.setFillStyle(0x2ecc71); });

    this.readyText = this.add.text(width / 2, height - 30, 'READY', {
      fontSize: '18px', color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    this.readyReason = this.add.text(width / 2 + 130, height - 30, '', {
      fontSize: '13px', color: '#e74c3c', wordWrap: { width: 360 },
    }).setOrigin(0, 0.5);
  }

  private buildCards(): void {
    this.cards = Array.from({ length: 8 }, (_, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = LEFT + col * (CARD_W + COL_GAP);
      const y = TOP + row * (CARD_H + ROW_GAP);
      const idx = i;
      const cb: CardCallbacks = {
        onActivate: () => this.onActivate(idx),
        onDeactivate: () => this.onDeactivate(idx),
        onStatChange: (stat, delta) => this.onStatChange(idx, stat, delta),
        onWeaponChange: delta => this.onWeaponChange(idx, delta),
        onControllerToggle: () => this.onControllerToggle(idx),
        onTeamChange: team => this.onTeamChange(idx, team),
        onBet: () => this.onBet(idx),
      };
      return new CharacterCard(this, x, y, cb);
    });
  }

  private isValid(): boolean {
    return validate(this.setupState).valid && this.betIndex !== null;
  }

  private getBlockReasons(): string[] {
    const reasons = validate(this.setupState).errors.slice();
    if (this.betIndex === null) reasons.push('Place a bet to start');
    return reasons;
  }

  private refresh(): void {
    const active = getActiveCharacters(this.setupState);
    const canDeactivate = active.length > 2;
    const valid = this.isValid();

    for (let i = 0; i < 8; i++) {
      const slot = this.setupState.slots[i];
      const isBet = this.betIndex === i && slot !== null;
      this.cards[i].refresh(slot, canDeactivate && slot !== null, isBet);
    }

    if (valid) {
      this.readyBg.setFillStyle(0x2ecc71).setInteractive({ useHandCursor: true });
      this.readyText.setColor('#000000');
      this.readyReason.setText('');
    } else {
      this.readyBg.setFillStyle(0x1a3d24).disableInteractive();
      this.readyText.setColor('#4a4a4a');
      this.readyReason.setText(this.getBlockReasons().join('\n'));
    }
  }

  private onActivate(index: number): void {
    this.setupState = activateSlot(this.setupState, index);
    this.refresh();
  }

  private onDeactivate(index: number): void {
    this.setupState = deactivateSlot(this.setupState, index);
    if (this.betIndex === index) this.betIndex = null;
    this.refresh();
  }

  private onBet(index: number): void {
    this.betIndex = this.betIndex === index ? null : index;
    this.refresh();
  }

  private onStatChange(index: number, stat: 'S' | 'A' | 'I', delta: number): void {
    const char = this.setupState.slots[index];
    if (!char) return;

    const stats = { ...char.stats };
    const newVal = stats[stat] + delta;
    if (newVal < 1) return;

    // Transfer the point to/from another stat to keep sum = 100
    const others = (['S', 'A', 'I'] as const).filter(s => s !== stat);
    const donor = others.find(s => delta > 0 ? stats[s] > 1 : true);
    if (!donor) return;

    stats[stat] = newVal;
    stats[donor] -= delta;

    this.setupState = updateCharacter(this.setupState, index, { stats });
    this.refresh();
  }

  private onWeaponChange(index: number, delta: 1 | -1): void {
    const char = this.setupState.slots[index];
    if (!char) return;
    const cur = WEAPON_LIST.indexOf(char.weapon.type);
    const next = (cur + delta + WEAPON_LIST.length) % WEAPON_LIST.length;
    this.setupState = updateCharacter(this.setupState, index, { weapon: WEAPONS[WEAPON_LIST[next]] });
    this.refresh();
  }

  private onControllerToggle(index: number): void {
    const char = this.setupState.slots[index];
    if (!char) return;
    this.setupState = updateCharacter(this.setupState, index, {
      controller: char.controller === 'player' ? 'ai' : 'player',
    });
    this.refresh();
  }

  private onTeamChange(index: number, team: TeamColor): void {
    this.setupState = updateCharacter(this.setupState, index, { team });
    this.refresh();
  }

  private handleReady(): void {
    if (!this.isValid()) return;

    const setups = getActiveCharacters(this.setupState);
    const betCharId = this.betIndex !== null ? this.setupState.slots[this.betIndex]?.id ?? null : null;
    const positions = calcStartPositions(setups.length);
    const battleState = createBattleState(setups, positions);

    const initiatives = new Map(
      battleState.chars.map(c => [c.id, rollInitiative(c.stats.A)]),
    );
    const initialBattle = startRound(battleState, initiatives);

    this.scene.start('BattleScene', { battleState: initialBattle, setups, betCharId });
  }
}
