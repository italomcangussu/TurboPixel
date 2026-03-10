import Phaser from 'phaser';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { drawAtmosphere } from '../ui/background';
import { createTextButton } from '../ui/button';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  create(): void {
    gameStore.mode = 'result';
    drawAtmosphere(this, { top: 0x1f2736, bottom: 0x0f1219, glow: 0x4b658f });

    const result = gameStore.latestRaceResult();
    if (!result) {
      this.scene.start('MenuScene');
      return;
    }

    this.add
      .text(this.scale.width / 2, 72, result.winner === 'player' ? 'Vitoria!' : 'Derrota', {
        fontFamily: 'monospace',
        fontSize: '58px',
        color: result.winner === 'player' ? '#bcffbc' : '#ffbcbc',
      })
      .setOrigin(0.5);

    const card = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, 520, 260, 0x1a2a40, 0.92)
      .setStrokeStyle(2, 0x91b8e9, 0.75);

    const lines = [
      `Seu tempo: ${(result.playerTimeMs / 1000).toFixed(3)}s`,
      `IA tempo: ${(result.aiTimeMs / 1000).toFixed(3)}s`,
      `Perfect shifts: ${result.perfectShifts}`,
      `Penalidade false start: ${(result.falseStartPenaltyMs / 1000).toFixed(3)}s`,
      `Dinheiro ganho: ${result.moneyEarned}`,
      result.lootBoxGranted ? 'Caixa gratis recebida!' : 'Sem caixa nesta corrida.',
    ];

    lines.forEach((line, index) => {
      this.add
        .text(card.x, card.y - 90 + index * 32, line, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#eaf4ff',
        })
        .setOrigin(0.5);
    });

    const targetScene = result.lootBoxGranted ? 'RewardsScene' : 'MenuScene';
    createTextButton(this, {
      x: this.scale.width / 2,
      y: this.scale.height - 86,
      width: 280,
      height: 56,
      label: result.lootBoxGranted ? 'Continuar para Caixa' : 'Voltar ao Menu',
      onClick: () => this.scene.start(targetScene),
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.scene.start(targetScene);
    });

    setTextSnapshot({
      mode: 'result',
      trackId: null,
      phase: null,
      countdownLights: 0,
      money: gameStore.profile().money,
      result,
    });
  }
}
