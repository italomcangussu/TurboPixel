import Phaser from 'phaser';
import { initEngineSound, playShiftSound, stopEngineSound, updateEngineSound } from '../core/audio';
import { RACE_DISTANCE_METERS } from '../core/constants';
import { DragRaceEngine } from '../core/race';
import { createEmptyUpgrades } from '../core/upgrades';
import { CAR_MAP } from '../data/cars';
import { TRACKS } from '../data/tracks';
import { setAdvanceHandler } from '../runtime/hooks';
import { setTextSnapshot } from '../runtime/textState';
import { gameStore } from '../state/gameStore';
import { createTextButton } from '../ui/button';
import { createCarVisual } from '../ui/carVisual';
import { AI_LANE_Y, createDragStrip, DRAG_MAX_X, DRAG_MIN_X, PLAYER_LANE_Y, type DragStripVisual } from '../ui/dragStrip';
import { createRaceHud, type RaceHud } from '../ui/raceHud';

export class RaceScene extends Phaser.Scene {
  private engine!: DragRaceEngine;

  private playerCarVisual!: Phaser.GameObjects.Container;

  private aiCarVisual!: Phaser.GameObjects.Container;

  private hud!: RaceHud;

  private strip!: DragStripVisual;

  private pausedByBackground = false;

  private resumeCountdownMs = 0;

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
    this.strip = createDragStrip(this, track);

    this.playerCarVisual = createCarVisual(this, {
      x: DRAG_MIN_X,
      y: PLAYER_LANE_Y,
      scale: 0.78,
      car: playerSpec,
      profile,
      variant: 'race',
    });

    this.aiCarVisual = createCarVisual(this, {
      x: DRAG_MIN_X,
      y: AI_LANE_Y,
      scale: 0.76,
      car: aiSpec,
      profile,
      variant: 'race',
    });

    this.hud = createRaceHud(this);

    const launchButton = createTextButton(this, {
      x: this.scale.width - 218,
      y: this.scale.height - 96,
      width: 172,
      height: 54,
      label: 'LAUNCH',
      onClick: () => this.handleLaunchOrShift(true),
      fillColor: 0x5f3a2b,
    });

    const shiftButton = createTextButton(this, {
      x: this.scale.width - 218,
      y: this.scale.height - 34,
      width: 172,
      height: 54,
      label: 'SHIFT',
      onClick: () => this.handleLaunchOrShift(false),
      fillColor: 0x244e78,
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

  private handleLaunchOrShift(preferLaunch: boolean): void {
    const phase = this.engine.getPhase();
    if (phase === 'finished' || this.resumeCountdownMs > 0) {
      return;
    }

    initEngineSound();

    const playerState = this.engine.getPlayerState();
    if (preferLaunch && playerState.launchAtMs === null) {
      this.engine.inputLaunch();
      const state = this.engine.getPlayerState();
      if (state.falseStartPenaltyMs > 0) {
        this.hud.shiftText.setColor('#ff9f9f').setText('False start! +0.25s de penalidade');
      } else {
        this.hud.shiftText.setColor('#ffd28c').setText('Launch registrado. Prepare o shift!');
        this.triggerSmokeParticles();
      }
      return;
    }

    if (playerState.launchAtMs === null) {
      this.engine.inputLaunch();
      this.triggerSmokeParticles();
      return;
    }

    const shift = this.engine.inputShift();
    if (shift.quality === 'ignored') {
      return;
    }

    playShiftSound(shift.quality);

    if (shift.quality === 'perfect') {
      this.hud.shiftText.setColor('#a6ff9f').setText(`Perfect! Δ ${shift.diffMs.toFixed(0)}ms`);
      this.cameras.main.shake(100, 0.008);
      this.triggerExhaustParticles(true);
      return;
    }

    if (shift.quality === 'good') {
      this.hud.shiftText.setColor('#ffe79f').setText(`Good. Δ ${shift.diffMs.toFixed(0)}ms`);
      this.triggerExhaustParticles(false);
      return;
    }

    this.hud.shiftText.setColor('#ff9f9f').setText(`Miss! Δ ${shift.diffMs.toFixed(0)}ms`);
    this.cameras.main.shake(150, 0.015);
  }

  private triggerExhaustParticles(isPerfect: boolean): void {
    const color = isPerfect ? 0x66ccff : 0xffb057;

    if (!this.textures.exists('flame')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(8, 8, 8);
      graphics.generateTexture('flame', 16, 16);
      graphics.destroy();
    }

    const emitter = this.add.particles(this.playerCarVisual.x - 72, this.playerCarVisual.y + 20, 'flame', {
      speedX: { min: -160, max: -320 },
      speedY: { min: -16, max: 16 },
      scale: { start: 0.5, end: 0 },
      lifespan: 260,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });

    emitter.explode(12);
    this.time.delayedCall(350, () => {
      emitter.destroy();
    });
  }

  private triggerSmokeParticles(): void {
    if (!this.textures.exists('smoke')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(16, 16, 16);
      graphics.generateTexture('smoke', 32, 32);
      graphics.destroy();
    }

    const emitter = this.add.particles(this.playerCarVisual.x - 68, this.playerCarVisual.y + 26, 'smoke', {
      speedX: { min: -120, max: -280 },
      speedY: { min: -44, max: 8 },
      scale: { start: 0.42, end: 1.7 },
      alpha: { start: 0.56, end: 0 },
      lifespan: 1000,
      tint: 0xdde5ee,
      blendMode: 'NORMAL',
      frequency: 44,
    });

    this.time.delayedCall(700, () => {
      emitter.stop();
      this.time.delayedCall(900, () => emitter.destroy());
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
      this.hud.resumeText.setText(seconds > 0 ? `Retomando em ${seconds}` : '');
      return;
    }

    this.hud.resumeText.setText('');
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
      this.hud.shiftText
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
    const playerProgress = Math.min(1, player.getDistanceM() / RACE_DISTANCE_METERS);
    const aiProgress = Math.min(1, ai.getDistanceM() / RACE_DISTANCE_METERS);

    this.playerCarVisual.x = DRAG_MIN_X + (DRAG_MAX_X - DRAG_MIN_X) * playerProgress;
    this.playerCarVisual.y = PLAYER_LANE_Y - playerProgress * 8;
    this.playerCarVisual.setScale(0.78 + playerProgress * 0.03);

    this.aiCarVisual.x = DRAG_MIN_X + (DRAG_MAX_X - DRAG_MIN_X) * aiProgress;
    this.aiCarVisual.y = AI_LANE_Y - aiProgress * 8;
    this.aiCarVisual.setScale(0.76 + aiProgress * 0.03);

    const phase = this.engine.getPhase();
    const lights = this.engine.getCountdownLights();
    this.strip.updateTree(lights, phase);

    if (phase === 'countdown') {
      this.hud.countdownText.setVisible(true);
      this.hud.countdownText.setText(String(Math.max(1, 3 - lights)));
      this.hud.countdownText.setColor('#fff0c8');
      this.countdownGoShown = false;
    } else if (!this.countdownGoShown) {
      this.countdownGoShown = true;
      this.hud.countdownText.setVisible(true);
      this.hud.countdownText.setText('GO');
      this.hud.countdownText.setColor('#8fffa9');
      this.time.delayedCall(280, () => {
        this.hud.countdownText.setVisible(false);
      });
    }

    const currentSpeed = player.getSpeedMps();
    updateEngineSound(player.getRpm(), phase === 'racing');

    this.strip.layers.forEach((layer) => {
      layer.xPos -= currentSpeed * layer.speedOffset;
      if (layer.xPos <= -this.scale.width) {
        layer.xPos = 0;
      }
      layer.graphics.setX(layer.xPos);
    });

    this.strip.streaks.children.iterate((child) => {
      const line = child as Phaser.GameObjects.Rectangle;
      line.x -= currentSpeed * 1.8;
      if (line.x < -line.width) {
        line.x = this.scale.width + line.width;
        line.y = Phaser.Math.Between(246, this.scale.height - 96);
      }
      return null;
    });

    this.hud.timerText.setText(`Tempo: ${(this.engine.getElapsedMs() / 1000).toFixed(2)}s`);
    this.hud.speedText.setText((player.getSpeedMps() * 3.6).toFixed(0));
    this.hud.gearText.setText(String(player.getGear()));
    this.hud.hintText.setAlpha(phase === 'countdown' ? 1 : 0.45);

    const maxRpm = Math.max(8000, player.getSpec().redlineRpm * 1.05);
    const rpmRotation = 180 + (Math.min(player.getRpm(), maxRpm) / maxRpm) * 180;
    this.hud.rpmNeedle.setRotation(Phaser.Math.DegToRad(rpmRotation));
  }

  private refreshTextState(): void {
    const player = this.engine.getPlayerCar();
    const ai = this.engine.getAiCar();
    const result = gameStore.latestRaceResult();

    setTextSnapshot({
      coordinateSystem:
        'origin top-left; x increases right; y increases downward; race distance in meters from the quarter-mile start line',
      mode: 'race',
      trackId: this.raceConfig?.trackId ?? null,
      phase: this.engine.getPhase(),
      countdownLights: this.engine.getCountdownLights(),
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
