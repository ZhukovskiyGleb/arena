import Phaser from 'phaser';
import type { CharacterSetup, TeamColor } from '../core/character';
import { TEAM_COLORS } from '../core/character';
import { calcStartPositions } from '../core/spawn';
import { createBattleState } from '../state/BattleState';

export interface ResultSceneData {
  winnerTeam: TeamColor | null;
  setups: CharacterSetup[];
  rounds: number;
  betCharId: string | null;
}

const TEAM_NAMES: Record<TeamColor, string> = {
  1: 'Red',
  2: 'Blue',
  3: 'Green',
  4: 'Yellow',
  5: 'Purple',
  6: 'Orange',
  7: 'Pink',
  8: 'White',
};

export class ResultScene extends Phaser.Scene {
  private result!: ResultSceneData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultSceneData): void {
    this.result = data;
  }

  create(): void {
    const { width, height } = this.scale;
    const { winnerTeam, rounds, betCharId, setups } = this.result;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d1a);

    // Subtle radial glow behind the result card
    const glowColor = winnerTeam !== null
      ? parseInt(TEAM_COLORS[winnerTeam].replace('#', ''), 16)
      : 0x888888;
    this.add.circle(width / 2, height / 2 - 30, 240, glowColor, 0.07);

    // Card
    this.add.rectangle(width / 2, height / 2 - 20, 520, 320, 0x10101e)
      .setStrokeStyle(2, glowColor, 0.8);

    // Team color circle
    this.add.circle(width / 2, height / 2 - 130, 36, glowColor);
    this.add.circle(width / 2, height / 2 - 130, 38, glowColor, 0)
      .setStrokeStyle(3, 0xffffff, 0.15);

    // VICTORY / DRAW label
    this.add.text(width / 2, height / 2 - 70, winnerTeam !== null ? 'VICTORY' : 'DRAW', {
      fontSize: '42px',
      color: winnerTeam !== null ? TEAM_COLORS[winnerTeam] : '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Team name
    if (winnerTeam !== null) {
      this.add.text(width / 2, height / 2 - 18, `Team ${TEAM_NAMES[winnerTeam]}`, {
        fontSize: '22px',
        color: '#cccccc',
      }).setOrigin(0.5);
    }

    // Rounds played
    this.add.text(width / 2, height / 2 + 24, `Rounds: ${rounds}`, {
      fontSize: '15px',
      color: '#555577',
    }).setOrigin(0.5);

    // Bet result
    const betSetup = betCharId ? setups.find(s => s.id === betCharId) : null;
    if (betSetup) {
      const betWon = winnerTeam !== null && betSetup.team === winnerTeam;
      this.add.text(width / 2, height / 2 + 58,
        betWon ? `★  BET WON  —  ${betSetup.id}` : `✗  Bet lost  —  ${betSetup.id}`, {
          fontSize: '16px',
          color: betWon ? '#f1c40f' : '#884444',
          fontStyle: betWon ? 'bold' : 'normal',
        }).setOrigin(0.5);
    }

    // Buttons
    this.makeButton('Play Again', width / 2 - 90, height / 2 + 100, glowColor, () => this.playAgain());
    this.makeButton('New Setup',  width / 2 + 90, height / 2 + 100, 0x3498db,  () => {
      this.scene.start('SetupScene');
    });
  }

  private playAgain(): void {
    const { setups, betCharId } = this.result;
    const positions = calcStartPositions(setups.length);
    const battleState = createBattleState(setups, positions);
    this.scene.start('BattleScene', { battleState, setups, betCharId });
  }

  private makeButton(
    label: string, x: number, y: number, accentColor: number, cb: () => void,
  ): void {
    const bg = this.add.rectangle(x, y, 160, 40, 0x14142a)
      .setStrokeStyle(1, accentColor, 0.8)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x1e1e3a))
      .on('pointerout',  () => bg.setFillStyle(0x14142a))
      .on('pointerdown', cb);

    this.add.text(x, y, label, {
      fontSize: '15px',
      color: '#' + accentColor.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);
  }
}
