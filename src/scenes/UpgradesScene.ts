import Phaser from 'phaser';
import { UPGRADE_ORDER } from '../core/constants';
import { getUpgradeCost } from '../core/upgrades';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import type { UpgradeType } from '../types';
import { drawAtmosphere } from '../ui/background';
import { createCarVisual } from '../ui/carVisual';
import { createTextButton } from '../ui/button';

const UPGRADE_DESC: Record<UpgradeType, string> = {
  motor: '+3% torque/nivel',
  cambio: '+10ms perfect e troca rapida',
  turbo: '+3% aceleracao marchas 3-6',
  peso: '+2% aceleracao global',
  tracao: '+1% launch e reduz false start',
  aerodinamica: '-2% drag efetivo',
  embreagem: '-8ms debounce de troca',
  ecu: '+1.5% redline e tolerancia overrev',
};

const UPGRADE_LABEL: Record<UpgradeType, string> = {
  motor: 'Motor',
  cambio: 'Cambio',
  turbo: 'Turbo',
  peso: 'Reducao Peso',
  tracao: 'Tracao',
  aerodinamica: 'Aero',
  embreagem: 'Embreagem',
  ecu: 'ECU',
};

function frameExists(scene: Phaser.Scene, texture: string, frame: string): boolean {
  return scene.textures.exists(texture) && scene.textures.get(texture).has(frame);
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
    const levels = gameStore.selectedCarUpgradeLevels();
    const equipped = gameStore.selectedCarUpgradeEquipped();

    this.add
      .text(this.scale.width / 2, 40, 'Upgrades Equipaveis (8 Slots)', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#f4fff3',
      })
      .setOrigin(0.5);

    createCarVisual(this, {
      x: 160,
      y: 170,
      scale: 0.84,
      car,
      profile,
      variant: 'idle',
    });

    this.add
      .text(160, 236, `${car.name} | ${car.era}`, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#dcffe2',
      })
      .setOrigin(0.5);

    this.add
      .text(160, 262, `Dinheiro: ${profile.money}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#fff3b8',
      })
      .setOrigin(0.5);

    this.feedbackText = this.add
      .text(this.scale.width / 2, this.scale.height - 86, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffdca8',
      })
      .setOrigin(0.5);

    UPGRADE_ORDER.forEach((type, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const cardX = 420 + col * 410;
      const cardY = 125 + row * 130;
      const level = levels[type];
      const cost = getUpgradeCost(level, type);
      const isEquipped = equipped[type];

      const card = this.add
        .rectangle(cardX, cardY, 380, 112, 0x213a29, 0.9)
        .setStrokeStyle(2, isEquipped ? 0xb8ffbf : 0x8ac89b, 0.8);

      const iconFrame = `upg_${type}_icon`;
      if (frameExists(this, 'upgradesAtlas', iconFrame)) {
        this.add.sprite(card.x - 160, card.y - 26, 'upgradesAtlas', iconFrame).setScale(1.1);
      }

      const tierFrame = `upg_${type}_tier_${Math.max(1, Math.min(5, level || 1))}`;
      if (level > 0 && frameExists(this, 'upgradesAtlas', tierFrame)) {
        this.add.sprite(card.x - 122, card.y - 26, 'upgradesAtlas', tierFrame).setScale(1.05);
      }

      this.add
        .text(card.x - 98, card.y - 44, `${UPGRADE_LABEL[type]} | Nivel ${level}/5`, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#effff0',
        })
        .setOrigin(0, 0);

      this.add
        .text(card.x - 98, card.y - 22, UPGRADE_DESC[type], {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#bdddc7',
        })
        .setOrigin(0, 0);

      this.add
        .text(card.x - 98, card.y + 1, `Status: ${isEquipped ? 'Equipado' : 'Guardado'}`, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: isEquipped ? '#bbffbf' : '#d2dccf',
        })
        .setOrigin(0, 0);

      const upgradeBtn = createTextButton(this, {
        x: card.x + 95,
        y: card.y + 28,
        width: 116,
        height: 30,
        label: cost === null ? 'MAX' : `Upgrade ${cost}`,
        onClick: () => {
          const upgraded = gameStore.buyUpgrade(type);
          this.feedbackText.setText(
            upgraded.ok
              ? `${UPGRADE_LABEL[type]} nivel ${upgraded.nextLevel}.`
              : upgraded.reason ?? 'Falha no upgrade.',
          );
          this.scene.restart();
        },
        fillColor: cost === null ? 0x4d4d4d : 0x2f5f3d,
      });
      if (cost === null) {
        upgradeBtn.setActive(false);
      }

      const equipBtn = createTextButton(this, {
        x: card.x + 95,
        y: card.y - 10,
        width: 116,
        height: 30,
        label: isEquipped ? 'Desequipar' : 'Equipar',
        onClick: () => {
          const toggled = gameStore.toggleUpgradeEquip(type);
          this.feedbackText.setText(
            toggled.ok
              ? `${UPGRADE_LABEL[type]} ${toggled.equipped ? 'equipado' : 'guardado'}.`
              : toggled.reason ?? 'Falha ao equipar.',
          );
          this.scene.restart();
        },
        fillColor: isEquipped ? 0x40653c : 0x364a3b,
      });
      if (level <= 0) {
        equipBtn.setActive(false);
      }
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
      trackId: null,
      phase: null,
      countdownLights: 0,
      money: profile.money,
      result: gameStore.latestRaceResult(),
    });
  }
}
