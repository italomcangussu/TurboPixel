import Phaser from 'phaser';
import { RACES_PER_LEAGUE } from '../data/leagues';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { drawAtmosphere } from '../ui/background';
import { createCarVisual } from '../ui/carVisual';
import { createTextButton } from '../ui/button';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    gameStore.mode = 'menu';
    drawAtmosphere(this, { top: 0x151f36, bottom: 0x0c1019, glow: 0x2f4974 });

    const profile = gameStore.profile();
    const selectedCar = gameStore.selectedCar();

    this.add
      .text(this.scale.width / 2, 58, 'TurboPixel', {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#f8fcff',
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, 98, 'Arrancada | Pixel 2.5D | Mobile First', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9bb7dc',
      })
      .setOrigin(0.5);

    const card = this.add
      .rectangle(this.scale.width / 2, this.scale.height * 0.33, 510, 132, 0x1a2c45, 0.88)
      .setStrokeStyle(2, 0x7fb0e4, 0.7);

    createCarVisual(this, {
      x: card.x - 150,
      y: card.y + 6,
      scale: 0.95,
      car: selectedCar,
      profile,
    });

    const moneyText = this.add
      .text(card.x + 40, card.y - 34, `Dinheiro: ${profile.money}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f5ffc6',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(card.x + 40, card.y + 2, `Carro atual: ${selectedCar.name}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#d6e6ff',
      })
      .setOrigin(0, 0.5);

    const racesDone = Object.values(profile.leagueProgress).reduce((sum, entry) => sum + entry.racesCompleted, 0);
    this.add
      .text(card.x + 40, card.y + 30, `Corridas concluidas: ${racesDone}/${RACES_PER_LEAGUE * 5}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#97b2d2',
      })
      .setOrigin(0, 0.5);

    if (gameStore.wasRecoveredFromBackup()) {
      this.add
        .text(this.scale.width / 2, card.y + 76, 'Save recuperado de backup local.', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffcc8a',
        })
        .setOrigin(0.5);
    }

    const buttons = [
      {
        label: 'Corridas',
        scene: 'LeagueScene',
      },
      {
        label: 'Garagem',
        scene: 'GarageScene',
      },
      {
        label: 'Customizacao',
        scene: 'CustomizationScene',
      },
      {
        label: 'Upgrades',
        scene: 'UpgradesScene',
      },
      {
        label: 'Inventario e Caixas',
        scene: 'RewardsScene',
      },
    ];

    buttons.forEach((entry, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      createTextButton(this, {
        x: this.scale.width / 2 - 145 + col * 290,
        y: this.scale.height * 0.58 + row * 78,
        width: 260,
        height: 58,
        label: entry.label,
        onClick: () => this.scene.start(entry.scene),
      });
    });

    createTextButton(this, {
      x: this.scale.width / 2,
      y: this.scale.height - 60,
      width: 340,
      height: 46,
      label: 'Resetar Progresso Local',
      onClick: () => {
        gameStore.resetProfile();
        this.scene.restart();
      },
      fillColor: 0x51303a,
    });

    setTextSnapshot({
      mode: 'menu',
      money: profile.money,
      league: null,
      raceNumber: null,
      result: gameStore.latestRaceResult(),
      player: {
        carId: selectedCar.id,
        gear: 1,
        rpm: 0,
        distanceM: 0,
        speedMps: 0,
        launched: false,
      },
      ai: {
        carId: null,
        gear: 1,
        rpm: 0,
        distanceM: 0,
        speedMps: 0,
        launched: false,
      },
      timerMs: 0,
    });

    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        moneyText.setText(`Dinheiro: ${gameStore.profile().money}`);
      },
    });

    this.input.keyboard?.on('keydown-A', () => {
      this.scene.start('LeagueScene');
    });
  }
}
