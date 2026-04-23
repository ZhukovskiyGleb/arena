import Phaser from 'phaser';
import type { BattleChar } from '../state/BattleState';
import { TEAM_COLORS } from '../core/character';

const RADIUS = 18;
const BAR_W  = 36;
const BAR_H  = 4;

export class CharacterToken extends Phaser.GameObjects.Container {
  private gfx!:         Phaser.GameObjects.Graphics;
  private label!:       Phaser.GameObjects.Text;
  private hpFill!:      Phaser.GameObjects.Rectangle;
  private hpBg!:        Phaser.GameObjects.Rectangle;
  private fatigueFill!: Phaser.GameObjects.Rectangle;
  private fatigueBg!:   Phaser.GameObjects.Rectangle;
  private koText!:      Phaser.GameObjects.Text;
  private maxHp:        number;
  private maxFatigue:   number;

  constructor(scene: Phaser.Scene, char: BattleChar) {
    super(scene, 0, 0);
    this.maxHp      = char.stats.S + char.stats.A + char.stats.I;
    this.maxFatigue = char.stats.I;
    this.build(char);
    scene.add.existing(this);
  }

  private build(char: BattleChar): void {
    const color   = parseInt(TEAM_COLORS[char.setup.team].replace('#', ''), 16);
    const charNum = char.id.replace('Char ', '');

    this.gfx = this.scene.add.graphics();
    drawCharacter(this.gfx, color, char.setup.weapon.type);

    // Small number label centred on the torso
    this.label = this.scene.add.text(0, 3, charNum, {
      fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const hpY      = RADIUS + 6;
    const fatigueY = RADIUS + 12;

    this.hpBg = this.scene.add.rectangle(0, hpY, BAR_W, BAR_H, 0x333333);
    this.hpFill = this.scene.add.rectangle(-BAR_W / 2, hpY, BAR_W, BAR_H, 0x2ecc71)
      .setOrigin(0, 0.5);

    this.fatigueBg = this.scene.add.rectangle(0, fatigueY, BAR_W, BAR_H, 0x333333);
    this.fatigueFill = this.scene.add.rectangle(-BAR_W / 2, fatigueY, BAR_W, BAR_H, 0xf1c40f)
      .setOrigin(0, 0.5).setDisplaySize(BAR_W, BAR_H);

    this.koText = this.scene.add.text(0, -RADIUS - 10, 'KO', {
      fontSize: '10px', color: '#f1c40f', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setVisible(false);

    this.add([
      this.hpBg, this.hpFill,
      this.fatigueBg, this.fatigueFill,
      this.gfx, this.label, this.koText,
    ]);
    this.setSize(RADIUS * 2 + 4, RADIUS * 2 + 22);
  }

  refresh(char: BattleChar): void {
    const hp      = char.dead ? 0 : char.stats.S + char.stats.A + char.stats.I;
    const hpRatio = Math.max(0, hp / this.maxHp);
    this.hpFill.setDisplaySize(BAR_W * hpRatio, BAR_H);
    const hpColor = hpRatio > 0.5 ? 0x2ecc71 : hpRatio > 0.25 ? 0xf1c40f : 0xe74c3c;
    this.hpFill.setFillStyle(hpColor);

    const fatigueRatio = char.knockedOut ? 0 : 1 - Math.min(1, char.fatigue / this.maxFatigue);
    this.fatigueFill.setDisplaySize(BAR_W * fatigueRatio, BAR_H);

    this.koText.setVisible(char.knockedOut && !char.dead);
  }

  moveTween(wx: number, wy: number, speed = 1, onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this, x: wx, y: wy, duration: Math.round(200 / speed), ease: 'Linear',
      onComplete: () => onComplete?.(),
    });
  }

  playAttackAnimation(speed = 1, onComplete?: () => void): void {
    this.setAngle(0);
    this.scene.tweens.add({
      targets: this, angle: 360, duration: Math.round(280 / speed), ease: 'Cubic.easeOut',
      onComplete: () => { this.setAngle(0); onComplete?.(); },
    });
  }

  playHitAnimation(speed = 1, onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this, alpha: 0.1, duration: Math.round(55 / speed), ease: 'Linear',
      yoyo: true, repeat: 2,
      onComplete: () => { this.setAlpha(1); onComplete?.(); },
    });
  }

  playDeathAnimation(speed = 1, onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this, alpha: 0.1, duration: Math.round(60 / speed), ease: 'Linear',
      yoyo: true, repeat: 2,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this, alpha: 0, scaleX: 0.1, scaleY: 0.1,
          duration: Math.round(500 / speed), ease: 'Power2',
          onComplete: () => { this.setVisible(false); onComplete?.(); },
        });
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function pt(x: number, y: number): { x: number; y: number } {
  return { x, y };
}

function drawCharacter(
  g: Phaser.GameObjects.Graphics,
  teamColor: number,
  weaponType: string,
): void {
  // ── Ground shadow ──────────────────────────────────────────────────────────
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(1, 15, 30, 8);

  // ── Weapon drawn first so body layers on top ───────────────────────────────
  drawWeapon(g, weaponType);

  // ── Left shoulder ──────────────────────────────────────────────────────────
  g.fillStyle(teamColor, 1);
  g.lineStyle(1.5, 0x000000, 0.45);
  g.fillCircle(-10, 1, 5);
  g.strokeCircle(-10, 1, 5);

  // ── Right shoulder ─────────────────────────────────────────────────────────
  g.fillCircle(10, 1, 5);
  g.strokeCircle(10, 1, 5);

  // ── Torso ──────────────────────────────────────────────────────────────────
  g.fillRoundedRect(-7, -3, 14, 14, 3);
  g.strokeRoundedRect(-7, -3, 14, 14, 3);

  // ── Head ───────────────────────────────────────────────────────────────────
  g.fillStyle(0xf0c898, 1);
  g.lineStyle(1.5, 0x000000, 0.3);
  g.fillCircle(0, -10, 7);
  g.strokeCircle(0, -10, 7);

  // Eyes
  g.fillStyle(0x222233, 1);
  g.fillCircle(-2.5, -11, 1.2);
  g.fillCircle(2.5, -11, 1.2);
}

function drawWeapon(g: Phaser.GameObjects.Graphics, type: string): void {
  switch (type) {

    // ── SS — Two-handed great sword ──────────────────────────────────────────
    case 'SS': {
      // Blade
      g.fillStyle(0xd4e8f8, 1);
      g.fillRect(-2, -25, 4, 22);
      // Fuller (central groove)
      g.fillStyle(0xb8cedd, 1);
      g.fillRect(-0.5, -23, 1, 18);
      // Tip
      g.fillStyle(0xe8f6ff, 1);
      g.fillTriangle(-2, -25, 2, -25, 0, -31);
      // Crossguard
      g.fillStyle(0x8899aa, 1);
      g.fillRect(-10, -5, 20, 3.5);
      g.lineStyle(1, 0x667788, 0.8);
      g.strokeRect(-10, -5, 20, 3.5);
      // Grip
      g.fillStyle(0x7a5030, 1);
      g.fillRect(-1.5, -2, 3, 8);
      // Pommel
      g.fillStyle(0x8899aa, 1);
      g.fillCircle(0, 6, 2.5);
      break;
    }

    // ── AA — Daggers ─────────────────────────────────────────────────────────
    case 'AA': {
      g.fillStyle(0xccd4dc, 1);
      // Left dagger — angled out-up
      g.fillPoints([
        pt(-7, 3), pt(-5.5, 3),
        pt(-17, -13), pt(-18.5, -13),
      ], true);
      // Right dagger
      g.fillPoints([
        pt(5.5, 3), pt(7, 3),
        pt(18.5, -13), pt(17, -13),
      ], true);
      // Left guard
      g.fillStyle(0x8899aa, 1);
      g.fillRect(-11, -2, 5, 2);
      // Right guard
      g.fillRect(6, -2, 5, 2);
      break;
    }

    // ── II — Magic staff ─────────────────────────────────────────────────────
    case 'II': {
      // Pole
      g.fillStyle(0x7a4f2c, 1);
      g.fillRect(-1.5, -26, 3, 30);
      // Glow halo
      g.fillStyle(0xcc44ff, 0.2);
      g.fillCircle(0, -27, 10);
      // Orb
      g.fillStyle(0xb833ff, 0.95);
      g.fillCircle(0, -27, 6);
      g.lineStyle(1.5, 0xee99ff, 0.8);
      g.strokeCircle(0, -27, 6);
      // Shine
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(-2, -29, 2);
      break;
    }

    // ── SA — Sword + Shield ───────────────────────────────────────────────────
    case 'SA': {
      // Sword blade (right, slight angle)
      g.fillStyle(0xd4e8f8, 1);
      g.fillPoints([
        pt(6, 2), pt(9, 0),
        pt(4, -21), pt(1, -19),
      ], true);
      g.fillStyle(0xeef8ff, 1);
      g.fillTriangle(1, -19, 4, -21, 2.5, -25);
      // Crossguard
      g.fillStyle(0x8899aa, 1);
      g.fillRect(3, -2, 10, 3);
      // Shield (left) — kite/heater shape
      g.fillStyle(0x8b4010, 1);
      g.fillPoints([
        pt(-21, -8), pt(-12, -8),
        pt(-12, 4), pt(-16.5, 9), pt(-21, 4),
      ], true);
      g.lineStyle(1.5, 0xaa5522, 0.75);
      g.strokePoints([
        pt(-21, -8), pt(-12, -8),
        pt(-12, 4), pt(-16.5, 9), pt(-21, 4),
      ], true);
      // Shield boss
      g.fillStyle(0xc8a830, 1);
      g.fillCircle(-16.5, 0, 2.5);
      break;
    }

    // ── AI — Rogue blade + arcane orb ────────────────────────────────────────
    case 'AI': {
      // Short curved blade (right)
      g.fillStyle(0xccd4dc, 1);
      g.fillPoints([
        pt(7, 2), pt(9.5, 0),
        pt(6, -14), pt(3.5, -12),
      ], true);
      g.fillStyle(0xe8f0f8, 1);
      g.fillTriangle(3.5, -12, 6, -14, 4.5, -17);
      // Guard
      g.fillStyle(0x8899aa, 1);
      g.fillRect(5, -1, 7, 2);
      // Arcane orb (left hand)
      g.fillStyle(0x1c6ea4, 0.25);
      g.fillCircle(-14, -1, 8);
      g.fillStyle(0x2980b9, 0.9);
      g.fillCircle(-14, -1, 5);
      g.lineStyle(1.5, 0x5dade2, 0.85);
      g.strokeCircle(-14, -1, 5);
      // Inner shine
      g.fillStyle(0xaaddff, 0.5);
      g.fillCircle(-15.5, -2.5, 2);
      break;
    }

    // ── IS — Warhammer ───────────────────────────────────────────────────────
    case 'IS': {
      // Handle
      g.fillStyle(0x7a4f2c, 1);
      g.fillRect(-1.5, -17, 3, 22);
      // Head
      g.fillStyle(0x888898, 1);
      g.fillRoundedRect(-1.5, -19, 17, 9, 2);
      g.lineStyle(1.5, 0x666677, 0.75);
      g.strokeRoundedRect(-1.5, -19, 17, 9, 2);
      // Striking face detail
      g.lineStyle(1, 0x555566, 0.6);
      g.lineBetween(2.5, -17, 2.5, -12);
      // Pommel
      g.fillStyle(0xaaaabc, 1);
      g.fillCircle(0, 5, 2.5);
      break;
    }
  }
}
