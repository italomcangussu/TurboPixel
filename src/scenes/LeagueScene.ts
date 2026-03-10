import Phaser from 'phaser';
import { LEAGUES, RACES_PER_LEAGUE } from '../data/leagues';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { drawAtmosphere } from '../ui/background';
import { createTextButton } from '../ui/button';

interface SceneData {
  league?: number;
  race?: number;
}

export class LeagueScene extends Phaser.Scene {
  private selectedLeague = 1;

  private selectedRace = 1;

  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super('LeagueScene');
  }

  init(data: SceneData): void {
    this.selectedLeague = data.league ?? 1;
    this.selectedRace = data.race ?? 1;
  }

  create(): void {
    gameStore.mode = 'league';
    drawAtmosphere(this, { top: 0x3a2319, bottom: 0x1a120d, glow: 0x9b5638 });

    this.add
      .text(this.scale.width / 2, 44, 'Selecao de Liga e Corrida', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#fff4ea',
      })
      .setOrigin(0.5);

    const profile = gameStore.profile();

    LEAGUES.forEach((league, index) => {
      const y = 120 + index * 72;
      const isUnlocked = gameStore.canAccessLeague(league.id);
      const progress = profile.leagueProgress[String(league.id)];

      const button = createTextButton(this, {
        x: 260,
        y,
        width: 360,
        height: 56,
        label: `${league.name} | IA ${league.aiReactionMs.toFixed(0)}ms`,
        onClick: () => {
          if (!isUnlocked) {
            this.feedbackText.setText(`Liga ${league.id} bloqueada: complete a liga ${league.id - 1}`);
            return;
          }
          this.scene.restart({ league: league.id, race: 1 });
        },
        fillColor: this.selectedLeague === league.id ? 0x7f4b32 : isUnlocked ? 0x4a3023 : 0x444444,
      });

      if (!isUnlocked) {
        button.setActive(false);
      }

      this.add
        .text(470, y, `Progresso ${progress?.racesCompleted ?? 0}/${RACES_PER_LEAGUE}`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#f7d2bd',
        })
        .setOrigin(0, 0.5);
    });

    const racePanel = this.add
      .rectangle(this.scale.width - 250, 236, 380, 310, 0x2d1f19, 0.9)
      .setStrokeStyle(2, 0xa37253, 0.75);

    this.add
      .text(racePanel.x, racePanel.y - 132, `Liga ${this.selectedLeague} - Corridas`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffe8d7',
      })
      .setOrigin(0.5);

    for (let race = 1; race <= RACES_PER_LEAGUE; race += 1) {
      const col = (race - 1) % 3;
      const row = Math.floor((race - 1) / 3);
      createTextButton(this, {
        x: racePanel.x - 120 + col * 120,
        y: racePanel.y - 46 + row * 72,
        width: 95,
        height: 54,
        label: `R${race}`,
        onClick: () => {
          this.scene.restart({ league: this.selectedLeague, race });
        },
        fillColor: this.selectedRace === race ? 0x8d5a3b : 0x4a3527,
      });
    }

    this.feedbackText = this.add
      .text(this.scale.width / 2, this.scale.height - 98, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffd2a6',
      })
      .setOrigin(0.5);

    createTextButton(this, {
      x: this.scale.width - 250,
      y: this.scale.height - 84,
      width: 230,
      height: 50,
      label: 'Iniciar Corrida',
      onClick: () => this.startSelectedRace(),
      fillColor: 0x70513c,
    });

    createTextButton(this, {
      x: 130,
      y: this.scale.height - 50,
      width: 200,
      height: 44,
      label: 'Voltar Menu',
      onClick: () => this.scene.start('MenuScene'),
    });

    this.add
      .text(this.scale.width - 250, this.scale.height - 41, `Carro ativo: ${gameStore.selectedCar().name}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffdeca',
      })
      .setOrigin(0.5);

    setTextSnapshot({
      mode: 'league',
      league: this.selectedLeague,
      raceNumber: this.selectedRace,
      money: gameStore.profile().money,
      result: gameStore.latestRaceResult(),
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.startSelectedRace());
  }

  private startSelectedRace(): void {
    if (!gameStore.canAccessLeague(this.selectedLeague)) {
      this.feedbackText.setText('Liga bloqueada.');
      return;
    }

    const config = gameStore.createRaceConfig(this.selectedLeague, this.selectedRace);
    gameStore.setPendingRace(config);
    this.scene.start('RaceScene');
  }
}
