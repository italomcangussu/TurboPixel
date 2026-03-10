import Phaser from 'phaser';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { drawAtmosphere } from '../ui/background';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.atlas('vehiclesAtlas', 'assets/vehicles/vehicles_atlas.png', 'assets/vehicles/vehicles_atlas.json');
    this.load.atlas('upgradesAtlas', 'assets/upgrades/upgrades_ui_atlas.png', 'assets/upgrades/upgrades_ui_atlas.json');
  }

  create(): void {
    gameStore.mode = 'boot';
    drawAtmosphere(this);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 20, 'TurboPixel', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#f4fbff',
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 28, 'Carregando garagem...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#a6bbd9',
      })
      .setOrigin(0.5);

    setTextSnapshot({
      mode: 'boot',
      trackId: null,
      phase: null,
      countdownLights: 0,
      league: null,
      raceNumber: null,
      money: gameStore.profile().money,
      result: null,
    });

    void document.fonts.ready.finally(() => {
      this.time.delayedCall(120, () => {
        this.scene.start('MenuScene');
      });
    });
  }
}
