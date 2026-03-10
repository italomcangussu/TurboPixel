import Phaser from 'phaser';
import { COSMETIC_MAP } from '../data/cosmetics';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { drawAtmosphere } from '../ui/background';
import { createTextButton } from '../ui/button';

export class RewardsScene extends Phaser.Scene {
  private lootText!: Phaser.GameObjects.Text;

  constructor() {
    super('RewardsScene');
  }

  create(): void {
    gameStore.mode = 'rewards';
    drawAtmosphere(this, { top: 0x2e2138, bottom: 0x130f19, glow: 0x764a8e });

    this.add
      .text(this.scale.width / 2, 52, 'Caixas e Inventario', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#fff1ff',
      })
      .setOrigin(0.5);

    const profile = gameStore.profile();

    const card = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2 - 22, 560, 280, 0x281f34, 0.92)
      .setStrokeStyle(2, 0xb69ad0, 0.7);

    this.lootText = this.add
      .text(card.x, card.y - 70, gameStore.hasPendingLootBox() ? 'Voce ganhou uma caixa gratis!' : 'Sem caixa pendente.', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f5e5ff',
        align: 'center',
      })
      .setOrigin(0.5);

    const ownedCount = profile.ownedCosmetics.length;
    const raritySummary = ['comum', 'rara', 'epica', 'lendaria']
      .map((rarity) => {
        const count = profile.ownedCosmetics
          .map((id) => COSMETIC_MAP.get(id))
          .filter((item) => item?.rarity === rarity).length;
        return `${rarity.toUpperCase()}:${count}`;
      })
      .join(' | ');

    this.add
      .text(card.x, card.y - 24, `Colecao: ${ownedCount}/60`, {
        fontFamily: 'monospace',
        fontSize: '19px',
        color: '#d8c6f1',
      })
      .setOrigin(0.5);

    this.add
      .text(card.x, card.y + 4, raritySummary, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#bfa8dd',
      })
      .setOrigin(0.5);

    const latest = gameStore.latestLootBox();
    const latestItemName = latest?.itemId === 'fallback_money'
      ? `Colecao completa: +${latest.fallbackMoney}`
      : latest
        ? COSMETIC_MAP.get(latest.itemId)?.name ?? latest.itemId
        : 'Nenhuma abertura recente';

    this.add
      .text(card.x, card.y + 40, `Ultimo drop: ${latestItemName}`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#fbe8ff',
      })
      .setOrigin(0.5);

    createTextButton(this, {
      x: this.scale.width / 2,
      y: this.scale.height - 120,
      width: 250,
      height: 56,
      label: 'Abrir Caixa',
      onClick: () => {
        const opened = gameStore.openPendingLootBox();
        if (!opened) {
          this.lootText.setText('Nenhuma caixa disponivel agora.');
          return;
        }

        if (opened.itemId === 'fallback_money') {
          this.lootText.setColor('#ffe1a6').setText(`Colecao completa! +${opened.fallbackMoney} moedas`);
        } else {
          const item = COSMETIC_MAP.get(opened.itemId);
          this.lootText
            .setColor('#bfffc0')
            .setText(`Drop ${opened.rarity.toUpperCase()}: ${item?.name ?? opened.itemId}`);
        }

        this.scene.restart();
      },
      fillColor: gameStore.hasPendingLootBox() ? 0x5f3b74 : 0x454545,
    });

    createTextButton(this, {
      x: this.scale.width / 2,
      y: this.scale.height - 52,
      width: 300,
      height: 50,
      label: 'Voltar ao Menu',
      onClick: () => this.scene.start('MenuScene'),
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (gameStore.hasPendingLootBox()) {
        const opened = gameStore.openPendingLootBox();
        if (!opened) {
          this.lootText.setText('Nenhuma caixa disponivel agora.');
        } else if (opened.itemId === 'fallback_money') {
          this.lootText.setColor('#ffe1a6').setText(`Colecao completa! +${opened.fallbackMoney} moedas`);
        } else {
          const item = COSMETIC_MAP.get(opened.itemId);
          this.lootText
            .setColor('#bfffc0')
            .setText(`Drop ${opened.rarity.toUpperCase()}: ${item?.name ?? opened.itemId}`);
        }
        this.scene.restart();
      } else {
        this.scene.start('MenuScene');
      }
    });

    setTextSnapshot({
      mode: 'rewards',
      money: gameStore.profile().money,
      result: gameStore.latestRaceResult(),
    });
  }
}
