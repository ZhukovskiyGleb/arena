import Phaser from 'phaser';
import type { CharacterSetup, TeamColor } from '../core/character';
import { TEAM_COLORS } from '../core/character';
import { WEAPON_LIST } from '../core/weapons';
import { maxDamage } from '../core/combat';

export interface CardCallbacks {
  onActivate: () => void;
  onDeactivate: () => void;
  onStatChange: (stat: 'S' | 'A' | 'I', delta: number) => void;
  onWeaponChange: (delta: 1 | -1) => void;
  onControllerToggle: () => void;
  onTeamChange: (team: TeamColor) => void;
  onBet: () => void;
}

const TEAM_HEX: Record<TeamColor, number> = {
  1: 0xe74c3c, 2: 0x3498db, 3: 0x2ecc71, 4: 0xf1c40f,
  5: 0x9b59b6, 6: 0xe67e22, 7: 0xff69b4, 8: 0xecf0f1,
};

function hexColor(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

export class CharacterCard extends Phaser.GameObjects.Container {
  static readonly W = 610;
  static readonly H = 145;

  private cb: CardCallbacks;

  constructor(scene: Phaser.Scene, x: number, y: number, cb: CardCallbacks) {
    super(scene, x, y);
    this.cb = cb;
    scene.add.existing(this);
  }

  refresh(setup: CharacterSetup | null, canDeactivate: boolean, isBet = false): void {
    this.removeAll(true);
    if (setup === null) {
      this.buildEmpty();
    } else {
      this.buildFull(setup, canDeactivate, isBet);
    }
  }

  private t(
    x: number, y: number, text: string,
    size = '13px', color = '#cccccc',
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, text, { fontSize: size, color });
  }

  private btn(
    x: number, y: number, label: string,
    color: string, cb: () => void,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, label, { fontSize: '13px', color })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', cb);
  }

  private buildEmpty(): void {
    const { W, H } = CharacterCard;
    const bg = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x111122)
      .setStrokeStyle(1, 0x2a2a44)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cb.onActivate())
      .on('pointerover', () => (bg as Phaser.GameObjects.Rectangle).setFillStyle(0x1a1a33))
      .on('pointerout', () => (bg as Phaser.GameObjects.Rectangle).setFillStyle(0x111122));
    const label = this.t(W / 2, H / 2, '+ Add Character', '15px', '#445566')
      .setOrigin(0.5);
    this.add([bg, label]);
  }

  private buildFull(setup: CharacterSetup, canDeactivate: boolean, isBet: boolean): void {
    const { W, H } = CharacterCard;

    // Background + border
    const bg = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x16213e)
      .setStrokeStyle(1, 0x2a2a4a);

    // Team color accent bar (left edge)
    const bar = this.scene.add.rectangle(3, H / 2, 6, H, TEAM_HEX[setup.team])
      .setOrigin(0.5);

    // Row 1 — name, controller, close
    const nameText = this.t(18, 12, setup.id, '14px', '#ffffff').setFontStyle('bold');

    const isPlayer = setup.controller === 'player';
    const ctrlLabel = isPlayer ? 'PLAYER' : 'AI';
    const ctrlColor = isPlayer ? '#2ecc71' : '#e67e22';
    const ctrlBtn = this.btn(W - 100, 10, ctrlLabel, ctrlColor, () => this.cb.onControllerToggle())
      .setFontStyle('bold');

    const items: Phaser.GameObjects.GameObject[] = [bg, bar, nameText, ctrlBtn];

    if (canDeactivate) {
      const closeBtn = this.btn(W - 18, 10, '✕', '#e74c3c', () => this.cb.onDeactivate());
      items.push(closeBtn);
    }

    // Row 2 — stats S / A / I
    const statKeys: Array<'S' | 'A' | 'I'> = ['S', 'A', 'I'];
    const statLabels = { S: 'STR', A: 'AGI', I: 'INT' };
    statKeys.forEach((stat, i) => {
      const sx = 18 + i * 197;
      items.push(this.t(sx, 48, statLabels[stat] + ':', '11px', '#777799'));
      items.push(this.btn(sx + 38, 46, '−', '#cc4444', () => this.cb.onStatChange(stat, -1)));
      items.push(
        this.t(sx + 60, 46, String(setup.stats[stat]).padStart(3, ' '), '14px', '#ffffff')
          .setFontStyle('bold'),
      );
      items.push(this.btn(sx + 95, 46, '+', '#44cc44', () => this.cb.onStatChange(stat, +1)));
    });

    // Row 3 — weapon
    const wIdx = WEAPON_LIST.indexOf(setup.weapon.type);
    const wTotal = WEAPON_LIST.length;
    const dmg = maxDamage(setup.weapon, setup.stats);
    items.push(this.btn(18, 82, '◄', '#888888', () => this.cb.onWeaponChange(-1)));
    items.push(
      this.t(45, 82, `${setup.weapon.name}  (${setup.weapon.stat1}+${setup.weapon.stat2})`, '13px', '#f1c40f'),
    );
    items.push(
      this.t(45 + 280, 84, `${wIdx + 1}/${wTotal}`, '11px', '#555577'),
    );
    items.push(
      this.t(45 + 330, 82, `DMG: ${dmg}`, '13px', '#e74c3c'),
    );
    items.push(
      this.t(45 + 430, 82, `Energy: ${setup.weapon.fatigueCost}`, '13px', '#9b59b6'),
    );
    items.push(this.btn(W - 30, 82, '►', '#888888', () => this.cb.onWeaponChange(+1)));

    // Row 4 — team color picker + BET button
    items.push(this.t(18, 116, 'Team:', '11px', '#777799'));
    const teamKeys: TeamColor[] = [1, 2, 3, 4, 5, 6, 7, 8];
    teamKeys.forEach((t, i) => {
      const cx = 110 + i * 28;
      const isSelected = t === setup.team;
      const dot = this.scene.add.circle(cx, 122, isSelected ? 9 : 7, TEAM_HEX[t])
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.cb.onTeamChange(t));
      if (isSelected) {
        dot.setStrokeStyle(2, hexColor(TEAM_COLORS[t]));
      }
      items.push(dot);
    });

    // BET button / indicator
    const betBg = this.scene.add.rectangle(500, 122, 96, 26,
      isBet ? 0x3d3000 : 0x111122,
    ).setStrokeStyle(1, isBet ? 0xf1c40f : 0x444466)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cb.onBet());
    const betLabel = isBet ? '★  YOUR BET' : 'BET';
    const betTxt = this.scene.add.text(500, 122, betLabel, {
      fontSize: '12px',
      color: isBet ? '#f1c40f' : '#667799',
      fontStyle: isBet ? 'bold' : 'normal',
    }).setOrigin(0.5);
    items.push(betBg, betTxt);

    this.add(items);
  }
}
