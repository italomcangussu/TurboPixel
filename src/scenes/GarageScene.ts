import Phaser from 'phaser';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { drawAtmosphere } from '../ui/background';
import { createCarVisual } from '../ui/carVisual';
import { createTextButton } from '../ui/button';

const PAGE_SIZE = 4;

export class GarageScene extends Phaser.Scene {
  private page = 0;

  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super('GarageScene');
  }

  create(): void {
    gameStore.mode = 'garage';
    drawAtmosphere(this, { top: 0x17263b, bottom: 0x0c1019, glow: 0x355d89 });

    this.add
      .text(this.scale.width / 2, 42, 'Garagem TurboPixel', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#f4f9ff',
      })
      .setOrigin(0.5);

    this.feedbackText = this.add
      .text(this.scale.width / 2, this.scale.height - 125, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffdca6',
      })
      .setOrigin(0.5);

    createTextButton(this, {
      x: 140,
      y: this.scale.height - 58,
      width: 210,
      height: 46,
      label: 'Voltar ao Menu',
      onClick: () => this.scene.start('MenuScene'),
    });

    createTextButton(this, {
      x: this.scale.width / 2,
      y: this.scale.height - 58,
      width: 150,
      height: 46,
      label: '< Pagina',
      onClick: () => {
        this.page = Math.max(0, this.page - 1);
        this.scene.restart();
      },
    });

    createTextButton(this, {
      x: this.scale.width / 2 + 170,
      y: this.scale.height - 58,
      width: 150,
      height: 46,
      label: 'Pagina >',
      onClick: () => {
        const maxPage = Math.floor((gameStore.allCars().length - 1) / PAGE_SIZE);
        this.page = Math.min(maxPage, this.page + 1);
        this.scene.restart();
      },
    });

    this.renderCarPage();

    setTextSnapshot({
      mode: 'garage',
      money: gameStore.profile().money,
      result: gameStore.latestRaceResult(),
    });
  }

  private renderCarPage(): void {
    const cars = gameStore.allCars();
    const profile = gameStore.profile();
    const start = this.page * PAGE_SIZE;
    const subset = cars.slice(start, start + PAGE_SIZE);

    subset.forEach((car, index) => {
      const cardY = 130 + index * 110;
      const card = this.add
        .rectangle(this.scale.width / 2, cardY, this.scale.width * 0.86, 92, 0x182943, 0.9)
        .setStrokeStyle(2, 0x7da8d8, 0.6);

      createCarVisual(this, {
        x: card.x - card.width * 0.35,
        y: cardY + 4,
        scale: 0.45,
        car,
        profile,
      });

      const owned = profile.ownedCars.includes(car.id);
      const isSelected = profile.selectedCarId === car.id;
      const unlockedByLeague = gameStore.canAccessLeague(car.unlockLeague);

      this.add
        .text(card.x - 90, cardY - 27, `${car.name} (${car.era})`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#edf5ff',
        })
        .setOrigin(0, 0);

      const statusParts = [
        owned ? 'Possuido' : `Preco ${car.price}`,
        unlockedByLeague ? 'Disponivel' : `Liga ${car.unlockLeague} bloqueada`,
      ];

      this.add
        .text(card.x - 90, cardY + 3, statusParts.join(' | '), {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#98b6dc',
        })
        .setOrigin(0, 0);

      const actionLabel = isSelected ? 'Selecionado' : owned ? 'Selecionar' : 'Comprar';

      createTextButton(this, {
        x: card.x + card.width * 0.33,
        y: cardY,
        width: 150,
        height: 42,
        label: actionLabel,
        onClick: () => {
          if (isSelected) {
            this.feedbackText.setText('Este carro ja esta ativo.');
            return;
          }

          if (owned) {
            const selected = gameStore.selectCar(car.id);
            this.feedbackText.setText(selected.ok ? `${car.name} selecionado.` : selected.reason ?? 'Falha ao selecionar.');
            this.scene.restart();
            return;
          }

          const purchase = gameStore.buyCar(car.id);
          this.feedbackText.setText(purchase.ok ? `${car.name} comprado com sucesso.` : purchase.reason ?? 'Falha na compra.');
          this.scene.restart();
        },
        fillColor: isSelected ? 0x316544 : 0x23304a,
      });
    });

    this.add
      .text(this.scale.width - 12, 8, `Dinheiro: ${profile.money}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#f5ffc8',
      })
      .setOrigin(1, 0);

    this.add
      .text(this.scale.width / 2, this.scale.height - 92, `Pagina ${this.page + 1}/${Math.ceil(cars.length / PAGE_SIZE)}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#95acd0',
      })
      .setOrigin(0.5);
  }
}
