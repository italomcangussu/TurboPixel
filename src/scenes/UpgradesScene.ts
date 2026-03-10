import Phaser from 'phaser';
import { getUpgradeCost } from '../core/upgrades';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import type { UpgradeType } from '../types';
import { drawAtmosphere } from '../ui/background';
import { createCarVisual } from '../ui/carVisual';
import { createTextButton } from '../ui/button';

const UPGRADE_ORDER: UpgradeType[] = ['motor', 'cambio', 'turbo', 'peso'];

const UPGRADE_DESC: Record<UpgradeType, string> = {
  motor: '+3% torque por nivel',
  cambio: '+10ms janela perfect e troca mais rapida',
  turbo: '+3% aceleracao nas marchas 3-6',
  peso: '+2% aceleracao global',
};

function labelFor(type: UpgradeType): string {
  if (type === 'motor') return 'Motor';
  if (type === 'cambio') return 'Cambio';
  if (type === 'turbo') return 'Turbo';
  return 'Reducao de Peso';
}

export class UpgradesScene extends Phaser.Scene {
  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super('UpgradesScene');
  }

  create(): void {
    gameStore.mode = 'upgrades';
    drawAtmosphere(this, { top: 0x203426, bottom: 0x101911, glow: 0x49895b });

    const profile = gameStore.profile();
    const car = gameStore.selectedCar();
    const levels = profile.upgradesByCar[car.id];

    this.add
      .text(this.scale.width / 2, 42, 'Upgrades de Performance', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#f4fff3',
      })
      .setOrigin(0.5);

    createCarVisual(this, {
      x: 190,
      y: 175,
      scale: 0.82,
      car,
      profile,
    });

    this.add
      .text(190, 235, car.name, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#dcffe2',
      })
      .setOrigin(0.5);

    this.add
      .text(190, 266, `Dinheiro: ${profile.money}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#fff3b8',
      })
      .setOrigin(0.5);

    this.feedbackText = this.add
      .text(this.scale.width / 2 + 150, this.scale.height - 86, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffdca8',
      })
      .setOrigin(0.5);

    UPGRADE_ORDER.forEach((type, index) => {
      const y = 128 + index * 92;
      const level = levels[type];
      const cost = getUpgradeCost(level);

      const card = this.add
        .rectangle(this.scale.width / 2 + 180, y, 430, 78, 0x213a29, 0.9)
        .setStrokeStyle(2, 0x8ac89b, 0.75);

      this.add
        .text(card.x - 198, y - 26, `${labelFor(type)} | Nivel ${level}/5`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#effff0',
        })
        .setOrigin(0, 0);

      this.add
        .text(card.x - 198, y + 1, UPGRADE_DESC[type], {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#bdddc7',
        })
        .setOrigin(0, 0);

      const buttonLabel = cost === null ? 'MAX' : `Upgrade (${cost})`;
      createTextButton(this, {
        x: card.x + 145,
        y,
        width: 140,
        height: 38,
        label: buttonLabel,
        onClick: () => {
          const upgraded = gameStore.buyUpgrade(type);
          this.feedbackText.setText(
            upgraded.ok ? `${labelFor(type)} agora no nivel ${upgraded.nextLevel}` : upgraded.reason ?? 'Falha',
          );
          this.scene.restart();
        },
        fillColor: cost === null ? 0x4d4d4d : 0x2f5f3d,
      });
    });

    createTextButton(this, {
      x: 140,
      y: this.scale.height - 50,
      width: 200,
      height: 44,
      label: 'Voltar Menu',
      onClick: () => this.scene.start('MenuScene'),
    });

    setTextSnapshot({
      mode: 'upgrades',
      money: profile.money,
      result: gameStore.latestRaceResult(),
    });
  }
}
