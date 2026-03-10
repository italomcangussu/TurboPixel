import Phaser from 'phaser';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { createTextButton } from '../ui/button';
import { createCarVisual } from '../ui/carVisual';
import { drawGarageBackdrop } from '../ui/garageBackdrop';

const PAGE_SIZE = 6;
const CARD_WIDTH = 350;
const CARD_HEIGHT = 172;
const CARD_X = [196, 544, 892];
const CARD_Y = [246, 452];

export class GarageScene extends Phaser.Scene {
  private page = 0;

  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super('GarageScene');
  }

  create(): void {
    gameStore.mode = 'garage';
    drawGarageBackdrop(this);

    const profile = gameStore.profile();
    const cars = gameStore.allCars();
    const totalPages = Math.ceil(cars.length / PAGE_SIZE);

    this.add
      .text(this.scale.width / 2, 72, 'SELECAO DE CARROS ESPORTIVOS', {
        fontFamily: 'Teko',
        fontSize: '56px',
        fontStyle: '600',
        color: '#f7fbff',
        stroke: '#10151d',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, 112, 'Grade curada de esportivos iconicos para a arrancada de 1/4 de milha', {
        fontFamily: 'Rajdhani',
        fontSize: '22px',
        fontStyle: '600',
        color: '#aabed5',
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width - 84, 164, `CREDITS ${profile.money}`, {
        fontFamily: 'Teko',
        fontSize: '34px',
        fontStyle: '600',
        color: '#fff1b9',
      })
      .setOrigin(1, 0.5);

    this.feedbackText = this.add
      .text(this.scale.width / 2, this.scale.height - 72, '', {
        fontFamily: 'Rajdhani',
        fontSize: '22px',
        fontStyle: '600',
        color: '#ffd8a6',
      })
      .setOrigin(0.5);

    createTextButton(this, {
      x: 128,
      y: this.scale.height - 54,
      width: 210,
      height: 48,
      label: 'Voltar ao Menu',
      onClick: () => this.scene.start('MenuScene'),
      fillColor: 0x263547,
    });

    const prevButton = createTextButton(this, {
      x: 58,
      y: this.scale.height / 2,
      width: 64,
      height: 110,
      label: '<',
      onClick: () => {
        this.page = Math.max(0, this.page - 1);
        this.scene.restart();
      },
      fillColor: 0x1f2a39,
    });

    const nextButton = createTextButton(this, {
      x: this.scale.width - 58,
      y: this.scale.height / 2,
      width: 64,
      height: 110,
      label: '>',
      onClick: () => {
        this.page = Math.min(totalPages - 1, this.page + 1);
        this.scene.restart();
      },
      fillColor: 0x1f2a39,
    });

    prevButton.setActive(this.page > 0);
    nextButton.setActive(this.page < totalPages - 1);

    this.renderCarPage();

    this.add
      .text(this.scale.width / 2, this.scale.height - 54, `Pagina ${this.page + 1}/${totalPages}`, {
        fontFamily: 'Rajdhani',
        fontSize: '22px',
        fontStyle: '600',
        color: '#d7e6f8',
      })
      .setOrigin(0.5);

    setTextSnapshot({
      mode: 'garage',
      trackId: null,
      phase: null,
      countdownLights: 0,
      money: profile.money,
      result: gameStore.latestRaceResult(),
    });
  }

  private renderCarPage(): void {
    const cars = gameStore.allCars();
    const profile = gameStore.profile();
    const start = this.page * PAGE_SIZE;
    const subset = cars.slice(start, start + PAGE_SIZE);

    subset.forEach((car, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const cardX = CARD_X[col];
      const cardY = CARD_Y[row];
      const owned = profile.ownedCars.includes(car.id);
      const isSelected = profile.selectedCarId === car.id;
      const unlockedByLeague = gameStore.canAccessLeague(car.unlockLeague);
      const canBuy = unlockedByLeague && profile.money >= car.price;

      const frame = this.add.graphics();
      frame.fillStyle(0x151b23, 0.96);
      frame.fillRoundedRect(cardX - CARD_WIDTH / 2, cardY - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 18);
      frame.lineStyle(3, 0x748ba8, 0.9);
      frame.strokeRoundedRect(cardX - CARD_WIDTH / 2, cardY - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 18);
      frame.fillStyle(0x273242, 0.95);
      frame.fillRoundedRect(cardX - CARD_WIDTH / 2 + 14, cardY - CARD_HEIGHT / 2 + 16, CARD_WIDTH - 28, 86, 12);
      frame.fillStyle(car.accentColor, 0.18);
      frame.fillRoundedRect(cardX - CARD_WIDTH / 2 + 14, cardY - CARD_HEIGHT / 2 + 16, CARD_WIDTH - 28, 86, 12);
      frame.fillStyle(0xffffff, 0.08);
      frame.fillRect(cardX - CARD_WIDTH / 2 + 28, cardY - CARD_HEIGHT / 2 + 24, CARD_WIDTH - 56, 8);
      frame.lineStyle(1, 0x51637b, 0.5);
      frame.strokeRect(cardX - CARD_WIDTH / 2 + 18, cardY - CARD_HEIGHT / 2 + 24, CARD_WIDTH - 36, 70);

      for (let i = 0; i < 7; i += 1) {
        const lineY = cardY - CARD_HEIGHT / 2 + 30 + i * 10;
        frame.lineStyle(1, 0x60758f, i === 0 ? 0.22 : 0.12);
        frame.lineBetween(cardX - CARD_WIDTH / 2 + 22, lineY, cardX + CARD_WIDTH / 2 - 22, lineY);
      }

      this.add.rectangle(cardX, cardY - 8, CARD_WIDTH - 90, 48, car.accentColor, 0.08);

      createCarVisual(this, {
        x: cardX,
        y: cardY - 8,
        scale: 1.08,
        car,
        profile,
      });

      this.add
        .text(cardX - CARD_WIDTH / 2 + 18, cardY + 32, car.name.toUpperCase(), {
          fontFamily: 'Teko',
          fontSize: '30px',
          fontStyle: '600',
          color: '#f7fbff',
        })
        .setOrigin(0, 0.5);

      this.add
        .text(cardX - CARD_WIDTH / 2 + 18, cardY + 58, `${car.yearLabel} | ${car.garageTag} | T${car.tier}`, {
          fontFamily: 'Rajdhani',
          fontSize: '18px',
          fontStyle: '600',
          color: '#b8cae1',
        })
        .setOrigin(0, 0.5);

      const status = isSelected
        ? 'Selecionado'
        : owned
          ? 'Disponivel'
          : unlockedByLeague
            ? `Preco ${car.price}`
            : `Liga ${car.unlockLeague}`;

      this.add
        .text(cardX - CARD_WIDTH / 2 + 18, cardY + 80, status, {
          fontFamily: 'Rajdhani',
          fontSize: '17px',
          fontStyle: '700',
          color: isSelected ? '#b8ffcf' : canBuy ? '#ffe3a3' : '#ffbfaa',
        })
        .setOrigin(0, 0.5);

      const actionLabel = isSelected ? 'Selecionado' : owned ? 'Selecionar' : 'Comprar';
      const button = createTextButton(this, {
        x: cardX + 106,
        y: cardY + 66,
        width: 108,
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
        fillColor: isSelected ? 0x2f6b49 : 0x253a4f,
      });

      if (isSelected || (!owned && (!unlockedByLeague || !canBuy))) {
        button.setActive(false);
      }
    });
  }
}
