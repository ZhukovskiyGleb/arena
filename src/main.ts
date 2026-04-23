import Phaser from 'phaser';
import { SetupScene } from './scene/SetupScene';
import { BattleScene } from './scene/BattleScene';
import { ResultScene } from './scene/ResultScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#0d0d1a',
  scene: [SetupScene, BattleScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
