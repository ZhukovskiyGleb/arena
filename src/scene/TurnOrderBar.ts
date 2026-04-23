import Phaser from 'phaser';
import type { BattleState, BattleChar } from '../state/BattleState';
import { TEAM_COLORS } from '../core/character';
import { getActiveChar } from '../state/BattleState';

const CARD_W = 110;
const CARD_H = 64;
const GAP    = 6;
const PAD_Y  = 6;

export class TurnOrderBar extends Phaser.GameObjects.Container {
  private cards: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, PAD_Y);
    scene.add.existing(this);
  }

  refresh(state: BattleState, betCharId: string | null = null): void {
    this.removeAll(true);
    this.cards.clear();

    const activeChar = getActiveChar(state);
    const playedIds  = new Set(state.turnQueue.slice(0, state.turnIndex));

    let offsetX = 8;
    for (const id of state.turnQueue) {
      const char = state.chars.find(c => c.id === id);
      if (!char) continue;

      const card = this.buildCard(char, {
        isActive: activeChar?.id === id,
        isPlayed: playedIds.has(id),
        isBet: id === betCharId,
      });
      card.setPosition(offsetX + CARD_W / 2, CARD_H / 2);
      this.add(card);
      this.cards.set(id, card);
      offsetX += CARD_W + GAP;
    }
  }

  private buildCard(
    char: BattleChar,
    flags: { isActive: boolean; isPlayed: boolean; isBet: boolean },
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const color = parseInt(TEAM_COLORS[char.setup.team].replace('#', ''), 16);

    const alpha = flags.isPlayed ? 0.4 : 1;
    const borderColor = flags.isActive ? 0xf1c40f : 0x444466;
    const borderWidth = flags.isActive ? 2 : 1;

    const bg = this.scene.add.rectangle(0, 0, CARD_W, CARD_H, 0x1a1a2e, 1)
      .setStrokeStyle(borderWidth, borderColor, 1);
    c.add(bg);

    // Team color strip on left
    c.add(this.scene.add.rectangle(-CARD_W / 2 + 5, 0, 8, CARD_H - 4, color, 1));

    // Char ID
    c.add(this.scene.add.text(-CARD_W / 2 + 14, -CARD_H / 2 + 6, char.id, {
      fontSize: '11px', color: '#ffffff', fontStyle: flags.isActive ? 'bold' : 'normal',
    }));

    // Bet star
    if (flags.isBet) {
      c.add(this.scene.add.text(CARD_W / 2 - 4, -CARD_H / 2 + 4, '★', {
        fontSize: '12px', color: '#f1c40f',
      }).setOrigin(1, 0));
    }

    // S/A/I
    const statsStr = `S:${char.stats.S} A:${char.stats.A} I:${char.stats.I}`;
    c.add(this.scene.add.text(-CARD_W / 2 + 14, -4, statsStr, {
      fontSize: '10px', color: '#aaaacc',
    }));

    // Weapon + Initiative
    const infoStr = `${char.setup.weapon.name}  Ini:${char.initiative}`;
    c.add(this.scene.add.text(-CARD_W / 2 + 14, 10, infoStr, {
      fontSize: '9px', color: '#778899',
    }));

    c.setAlpha(alpha);
    return c;
  }
}
