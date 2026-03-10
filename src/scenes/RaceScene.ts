import Phaser from 'phaser';
import { initEngineSound, playShiftSound, stopEngineSound, updateEngineSound } from '../core/audio';
import { DragRaceEngine } from '../core/race';
import { createEmptyUpgrades } from '../core/upgrades';
import { CAR_MAP } from '../data/cars';
import { TRACKS } from '../data/tracks';
import { setAdvanceHandler } from '../runtime/hooks';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { createTextButton } from '../ui/button';
import { createCarVisual } from '../ui/carVisual';

export class RaceScene extends Phaser.Scene {
  private engine!: DragRaceEngine;

  private playerCarVisual!: Phaser.GameObjects.Container;

  private aiCarVisual!: Phaser.GameObjects.Container;

  private timerText!: Phaser.GameObjects.Text;

  private hudText!: Phaser.GameObjects.Text;

  private shiftText!: Phaser.GameObjects.Text;

  private countdownText!: Phaser.GameObjects.Text;

  private speedLinesGroup!: Phaser.GameObjects.Group;

  private pausedByBackground = false;

  private resumeCountdownMs = 0;

  private resumeText!: Phaser.GameObjects.Text;

  private raceFinishedHandled = false;

  private countdownGoShown = false;

  private raceConfig = gameStore.pendingRace();

  private visibilityHandler: (() => void) | null = null;

  constructor() {
    super('RaceScene');
  }

  create(): void {
    gameStore.mode = 'race';
    this.raceConfig = gameStore.pendingRace();
    this.raceFinishedHandled = false;
    this.pausedByBackground = false;
    this.resumeCountdownMs = 0;
    this.countdownGoShown = false;

    if (!this.raceConfig) {
      const fallback = gameStore.createRaceConfig(1, 1);
      gameStore.setPendingRace(fallback);
      this.raceConfig = fallback;
    }

    const playerSpec = CAR_MAP.get(this.raceConfig.playerCarId);
    const aiSpec = CAR_MAP.get(this.raceConfig.aiCarId);
    if (!playerSpec || !aiSpec) {
      throw new Error('Race config has invalid car id');
    }

    const profile = gameStore.profile();
    const playerUpgrades = gameStore.selectedCarActiveUpgrades();
    const aiUpgrades = createEmptyUpgrades();
    const league = gameStore.getLeague(this.raceConfig.league);
    this.engine = new DragRaceEngine(this.raceConfig, playerSpec, aiSpec, playerUpgrades, aiUpgrades, league);

    const track = TRACKS.find((candidate) => candidate.id === this.raceConfig?.trackId) ?? TRACKS[0];

    this.drawTrack(track.horizonColor, track.roadColor, track.accentColor);

    this.playerCarVisual = createCarVisual(this, {
      x: 140,
      y: this.scale.height * 0.72,
      scale: 0.66,
      car: playerSpec,
      profile,
    });

    this.aiCarVisual = createCarVisual(this, {
      x: 140,
      y: this.scale.height * 0.48,
      scale: 0.58,
      car: aiSpec,
      profile,
    });

    this.timerText = this.add
      .text(this.scale.width / 2, 28, 'Tempo: 0.00s', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f6fbff',
      })
      .setOrigin(0.5);

    this.hudText = this.add
      .text(18, this.scale.height - 130, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#ebf5ff',
      })
      .setOrigin(0, 0);

    this.shiftText = this.add
      .text(this.scale.width / 2, this.scale.height - 125, 'Aguardando launch...', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffd28c',
      })
      .setOrigin(0.5);

    this.countdownText = this.add
      .text(this.scale.width / 2, this.scale.height * 0.36, '3', {
        fontFamily: 'monospace',
        fontSize: '94px',
        color: '#ffdb9f',
      })
      .setOrigin(0.5);

    this.resumeText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: 'monospace',
        fontSize: '34px',
        color: '#fff4e0',
      })
      .setOrigin(0.5)
      .setDepth(10);

    const launchButton = createTextButton(this, {
      x: this.scale.width - 220,
      y: this.scale.height - 92,
      width: 170,
      height: 56,
      label: 'LAUNCH',
      onClick: () => this.handleLaunchOrShift(true),
      fillColor: 0x5f3a2b,
    });

    const shiftButton = createTextButton(this, {
      x: this.scale.width - 220,
      y: this.scale.height - 30,
      width: 170,
      height: 56,
      label: 'SHIFT',
      onClick: () => this.handleLaunchOrShift(false),
      fillColor: 0x2f4f81,
    });

    this.input.keyboard?.on('keydown-SPACE', () => this.handleLaunchOrShift(true));
    this.input.keyboard?.on('keydown-ENTER', () => this.handleLaunchOrShift(false));

    setAdvanceHandler((ms) => this.advanceDeterministic(ms));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      launchButton.container.destroy();
      shiftButton.container.destroy();
      stopEngineSound();
      setAdvanceHandler(() => {
        // no-op outside race scene
      });
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      }
    });

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pausedByBackground = true;
      } else if (this.pausedByBackground) {
        this.resumeCountdownMs = 3000;
        this.pausedByBackground = false;
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.refreshTextState();
  }

  private drawTrack(horizonColor: number, roadColor: number, accentColor: number): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height * 0.26, width, height * 0.52, horizonColor);
    this.add.rectangle(width / 2, height * 0.76, width, height * 0.48, roadColor);

    const gfx = this.add.graphics();
    gfx.fillStyle(accentColor, 0.22);
    gfx.fillRect(0, height * 0.44, width, 5);
    gfx.fillRect(0, height * 0.69, width, 4);

    for (let i = 0; i < 18; i += 1) {
      const x = 70 + i * 60;
      const alpha = i % 2 === 0 ? 0.3 : 0.18;
      this.add.rectangle(x, height * 0.61, 30, 4, 0xffffff, alpha);
    }

    this.speedLinesGroup = this.add.group();
    for (let i = 0; i < 30; i += 1) {
      const lineColor = Phaser.Utils.Array.GetRandom([0xffffff, accentColor]);
      const line = this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(height * 0.76, height),
        Phaser.Math.Between(20, 100),
        Phaser.Math.Between(2, 6),
        lineColor,
      );
      line.setAlpha(Phaser.Math.FloatBetween(0.1, 0.4));
      this.speedLinesGroup.add(line);
    }

    this.add
      .text(16, 12, 'Space: launch | Enter: shift', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#d8e8ff',
      })
      .setOrigin(0, 0);
  }

  private handleLaunchOrShift(preferLaunch: boolean): void {
    const phase = this.engine.getPhase();
    if (phase === 'finished' || this.resumeCountdownMs > 0) {
      return;
    }

    // Browser autoplay policy: WebAudio must start from a user gesture.
    initEngineSound();

    const playerState = this.engine.getPlayerState();
    if (preferLaunch && playerState.launchAtMs === null) {
      this.engine.inputLaunch();
      const state = this.engine.getPlayerState();
      if (state.falseStartPenaltyMs > 0) {
        this.shiftText.setColor('#ff9f9f').setText('False start! +0.25s de penalidade');
      } else {
        this.shiftText.setColor('#ffd28c').setText('Launch registrado. Prepare o shift!');
      }
      return;
    }

    if (playerState.launchAtMs === null) {
      this.engine.inputLaunch();
      return;
    }

    const shift = this.engine.inputShift();
    if (shift.quality === 'ignored') {
      return;
    }

    playShiftSound(shift.quality);

    if (shift.quality === 'perfect') {
      this.shiftText.setColor('#a6ff9f').setText(`Perfect! Δ ${shift.diffMs.toFixed(0)}ms`);
      this.cameras.main.shake(100, 0.008);
      this.triggerExhaustParticles(true);
      return;
    }

    if (shift.quality === 'good') {
      this.shiftText.setColor('#ffe79f').setText(`Good. Δ ${shift.diffMs.toFixed(0)}ms`);
      this.triggerExhaustParticles(false);
      return;
    }

    this.shiftText.setColor('#ff9f9f').setText(`Miss! Δ ${shift.diffMs.toFixed(0)}ms`);
    this.cameras.main.shake(150, 0.015);
  }

  private triggerExhaustParticles(isPerfect: boolean): void {
    const color = isPerfect ? 0x66ccff : 0xff9900;

    // Create a simple primitive texture for the flame if it doesn't exist
    if (!this.textures.exists('flame')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(8, 8, 8);
      graphics.generateTexture('flame', 16, 16);
      graphics.destroy();
    }

    const emitter = this.add.particles(this.playerCarVisual.x - 70, this.playerCarVisual.y + 10, 'flame', {
      speedX: { min: -200, max: -400 },
      speedY: { min: -20, max: 20 },
      scale: { start: 0.6, end: 0 },
      lifespan: 300,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });

    emitter.explode(15);

    this.time.delayedCall(400, () => {
      emitter.destroy();
    });
  }

  private advanceDeterministic(ms: number): void {
    const step = 1000 / 60;
    let remaining = ms;
    while (remaining > 0) {
      const delta = Math.min(step, remaining);
      this.tickRace(delta);
      remaining -= delta;
    }

    this.refreshVisuals();
    this.refreshTextState();
  }

  update(_: number, delta: number): void {
    const clamped = Math.min(40, Math.max(0, delta));

    if (this.resumeCountdownMs > 0) {
      this.resumeCountdownMs = Math.max(0, this.resumeCountdownMs - clamped);
      const seconds = Math.ceil(this.resumeCountdownMs / 1000);
      this.resumeText.setText(seconds > 0 ? `Retomando em ${seconds}` : '');
      return;
    }

    this.resumeText.setText('');

    this.tickRace(clamped);
    this.refreshVisuals();
    this.refreshTextState();
  }

  private tickRace(delta: number): void {
    if (this.raceFinishedHandled) {
      return;
    }

    this.engine.update(delta);
    if (this.engine.getPhase() === 'finished') {
      const winner = this.engine.getWinner();
      if (!winner || !this.raceConfig) {
        return;
      }

      this.raceFinishedHandled = true;
      const result = gameStore.applyRaceOutcome({
        league: this.raceConfig.league,
        winner: winner.winner,
        playerTimeMs: winner.playerTimeMs,
        aiTimeMs: winner.aiTimeMs,
        perfectShifts: winner.playerPerfectShifts,
        falseStartPenaltyMs: winner.falseStartPenaltyMs,
        raceSeed: this.raceConfig.seed,
      });

      gameStore.clearPendingRace();
      this.shiftText
        .setColor(result.winner === 'player' ? '#a6ff9f' : '#ff9999')
        .setText(result.winner === 'player' ? 'Vitoria!' : 'Derrota!');

      this.time.delayedCall(1200, () => {
        this.scene.start('ResultScene');
      });
    }
  }

  private refreshVisuals(): void {
    const player = this.engine.getPlayerCar();
    const ai = this.engine.getAiCar();

    const playerProgress = Math.min(1, player.getDistanceM() / 400);
    const aiProgress = Math.min(1, ai.getDistanceM() / 400);

    const minX = 120;
    const maxX = this.scale.width - 110;

    this.playerCarVisual.x = minX + (maxX - minX) * playerProgress;
    this.playerCarVisual.y = this.scale.height * 0.72 - playerProgress * 18;
    this.playerCarVisual.setScale(0.58 + playerProgress * 0.15);

    this.aiCarVisual.x = minX + (maxX - minX) * aiProgress;
    this.aiCarVisual.y = this.scale.height * 0.48 - aiProgress * 14;
    this.aiCarVisual.setScale(0.5 + aiProgress * 0.12);

    const lights = this.engine.getCountdownLights();
    if (lights < 3) {
      this.countdownText.setText(String(3 - lights));
      this.countdownText.setVisible(true);
      this.countdownText.setColor('#ffdb9f');
    } else if (!this.countdownGoShown) {
      this.countdownGoShown = true;
      this.countdownText.setText('GO');
      this.countdownText.setColor('#9fffad');
      this.time.delayedCall(300, () => {
        this.countdownText.setVisible(false);
      });
    }

    // Update speed lines based on player speed
    const currentSpeed = player.getSpeedMps();

    // Update audio
    updateEngineSound(player.getRpm(), this.engine.getPhase() === 'racing');

    this.speedLinesGroup.children.iterate((child) => {
      const line = child as Phaser.GameObjects.Rectangle;
      line.x -= currentSpeed * 2.5; // multiplier for visual speed
      if (line.x < -line.width) {
        line.x = this.scale.width + line.width;
        line.y = Phaser.Math.Between(this.scale.height * 0.76, this.scale.height);
      }
      return null;
    });

    this.timerText.setText(`Tempo: ${(this.engine.getElapsedMs() / 1000).toFixed(2)}s`);

    const playerState = this.engine.getPlayerState();
    this.hudText.setText(
      `Marcha: ${player.getGear()} | RPM: ${player.getRpm().toFixed(0)}\n` +
        `Distancia: ${player.getDistanceM().toFixed(1)}m / 400m\n` +
        `Velocidade: ${(player.getSpeedMps() * 3.6).toFixed(1)} km/h\n` +
        `Launch: ${playerState.launchAtMs === null ? 'pendente' : playerState.launched ? 'ativo' : 'agendado'}`,
    );
  }

  private refreshTextState(): void {
    const player = this.engine.getPlayerCar();
    const ai = this.engine.getAiCar();
    const result = gameStore.latestRaceResult();

    setTextSnapshot({
      coordinateSystem:
        'origin top-left; x increases right; y increases downward; race distance in meters from the start line',
      mode: 'race',
      league: this.raceConfig?.league ?? null,
      raceNumber: this.raceConfig?.raceNumber ?? null,
      timerMs: this.engine.getElapsedMs(),
      money: gameStore.profile().money,
      result,
      player: {
        carId: player.getSpec().id,
        gear: player.getGear(),
        rpm: player.getRpm(),
        distanceM: player.getDistanceM(),
        speedMps: player.getSpeedMps(),
        launched: this.engine.getPlayerState().launched,
      },
      ai: {
        carId: ai.getSpec().id,
        gear: ai.getGear(),
        rpm: ai.getRpm(),
        distanceM: ai.getDistanceM(),
        speedMps: ai.getSpeedMps(),
        launched: this.engine.getAiState().launched,
      },
    });
  }
}
