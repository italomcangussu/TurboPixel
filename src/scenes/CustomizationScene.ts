import Phaser from 'phaser';
import { COSMETIC_MAP } from '../data/cosmetics';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import type { CosmeticCategory } from '../types';
import { drawAtmosphere } from '../ui/background';
import { createCarVisual } from '../ui/carVisual';
import { createTextButton } from '../ui/button';

const CATEGORIES: CosmeticCategory[] = ['spoiler', 'rodas', 'bodykit', 'pintura'];
const ITEMS_PER_PAGE = 5;

interface SceneData {
  category?: CosmeticCategory;
  page?: number;
}

function rarityLabel(rarity: string): string {
  if (rarity === 'comum') return 'Comum';
  if (rarity === 'rara') return 'Rara';
  if (rarity === 'epica') return 'Epica';
  return 'Lendaria';
}

export class CustomizationScene extends Phaser.Scene {
  private selectedCategory: CosmeticCategory = 'spoiler';

  private page = 0;

  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super('CustomizationScene');
  }

  init(data: SceneData): void {
    if (data.category) {
      this.selectedCategory = data.category;
    }
    this.page = data.page ?? 0;
  }

  create(): void {
    gameStore.mode = 'customization';
    drawAtmosphere(this, { top: 0x2d1f38, bottom: 0x120f19, glow: 0x713a87 });

    this.add
      .text(this.scale.width / 2, 40, 'Customizacao Visual', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#f9f1ff',
      })
      .setOrigin(0.5);

    const profile = gameStore.profile();
    const selectedCar = gameStore.selectedCar();

    createCarVisual(this, {
      x: 180,
      y: 170,
      scale: 0.8,
      car: selectedCar,
      profile,
    });

    this.add
      .text(180, 228, `${selectedCar.name}`, {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#f2dcff',
      })
      .setOrigin(0.5);

    CATEGORIES.forEach((category, index) => {
      createTextButton(this, {
        x: 180,
        y: 280 + index * 52,
        width: 180,
        height: 42,
        label: category.toUpperCase(),
        onClick: () => {
          this.scene.restart({ category, page: 0 });
        },
        fillColor: category === this.selectedCategory ? 0x5f3a79 : 0x2f2540,
      });
    });

    this.feedbackText = this.add
      .text(this.scale.width / 2 + 130, this.scale.height - 98, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffd9a8',
      })
      .setOrigin(0.5);

    createTextButton(this, {
      x: 130,
      y: this.scale.height - 44,
      width: 190,
      height: 42,
      label: 'Voltar Menu',
      onClick: () => this.scene.start('MenuScene'),
    });

    createTextButton(this, {
      x: this.scale.width - 320,
      y: this.scale.height - 44,
      width: 120,
      height: 42,
      label: '<',
      onClick: () => {
        this.page = Math.max(0, this.page - 1);
        this.scene.restart({ category: this.selectedCategory, page: this.page });
      },
    });

    createTextButton(this, {
      x: this.scale.width - 180,
      y: this.scale.height - 44,
      width: 120,
      height: 42,
      label: '>',
      onClick: () => {
        const items = gameStore.listCosmeticsForCategory(this.selectedCategory);
        const maxPage = Math.floor((items.length - 1) / ITEMS_PER_PAGE);
        this.page = Math.min(maxPage, this.page + 1);
        this.scene.restart({ category: this.selectedCategory, page: this.page });
      },
    });

    this.renderItems();

    setTextSnapshot({
      mode: 'customization',
      money: profile.money,
      result: gameStore.latestRaceResult(),
    });
  }

  private renderItems(): void {
    const profile = gameStore.profile();
    const selectedCarId = profile.selectedCarId;
    const items = gameStore.listCosmeticsForCategory(this.selectedCategory);
    const start = this.page * ITEMS_PER_PAGE;
    const subset = items.slice(start, start + ITEMS_PER_PAGE);

    this.add
      .text(this.scale.width / 2 + 170, 95, `${this.selectedCategory.toUpperCase()} - itens`, {
        fontFamily: 'monospace',
        fontSize: '21px',
        color: '#ecdfff',
      })
      .setOrigin(0.5);

    subset.forEach((item, index) => {
      const y = 150 + index * 78;
      const card = this.add
        .rectangle(this.scale.width / 2 + 170, y, 420, 64, 0x2b233f, 0.88)
        .setStrokeStyle(2, item.color, 0.8);

      const owned = gameStore.isCosmeticOwned(item.id);
      const equipped = gameStore.equippedItem(selectedCarId, item.category) === item.id;

      this.add
        .text(card.x - 190, y - 20, `${item.name} (${rarityLabel(item.rarity)})`, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#f8f0ff',
        })
        .setOrigin(0, 0);

      const buttonLabel = equipped ? 'Equipado' : owned ? 'Equipar' : 'Bloqueado';

      createTextButton(this, {
        x: card.x + 150,
        y,
        width: 120,
        height: 36,
        label: buttonLabel,
        onClick: () => {
          if (!owned) {
            this.feedbackText.setText('Item ainda nao desbloqueado.');
            return;
          }
          const equippedResult = gameStore.equipCosmetic(item.id);
          this.feedbackText.setText(equippedResult.ok ? `Equipado: ${item.name}` : equippedResult.reason ?? 'Falha ao equipar');
          this.scene.restart({ category: this.selectedCategory, page: this.page });
        },
        fillColor: equipped ? 0x496444 : 0x3f315d,
      });
    });

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    this.add
      .text(this.scale.width - 250, this.scale.height - 95, `Pagina ${this.page + 1}/${totalPages}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#b7a4d3',
      })
      .setOrigin(0.5);

    const rarityCounts = ['comum', 'rara', 'epica', 'lendaria']
      .map((rarity) => {
        const unlocked = profile.ownedCosmetics
          .map((id) => COSMETIC_MAP.get(id))
          .filter((item) => item?.rarity === rarity).length;
        return `${rarity.substring(0, 2).toUpperCase()}:${unlocked}`;
      })
      .join(' | ');

    this.add
      .text(this.scale.width / 2 + 170, this.scale.height - 130, `Colecao: ${profile.ownedCosmetics.length}/60 | ${rarityCounts}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#dbc8ff',
      })
      .setOrigin(0.5);
  }
}
