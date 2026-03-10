import Phaser from 'phaser';
import { initEngineSound, playLaunchSound, playShiftSound, stopEngineSound, updateEngineSound } from '../core/audio';
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
import type { CarSpec } from '../types';

export class RaceScene extends Phaser.Scene {
  private engine!: DragRaceEngine;

  private playerSpec!: CarSpec;

  private playerCarVisual!: Phaser.GameObjects.Container;

  private aiCarVisual!: Phaser.GameObjects.Container;

  private playerWheelHubs: Phaser.GameObjects.Container[] = [];

  private aiWheelHubs: Phaser.GameObjects.Container[] = [];

  private playerSmokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  private aiSmokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  private playerShiftBurstMs = 0;

  private aiShiftBurstMs = 0;

  private lastPlayerGear = 1;

  private lastAiGear = 1;

  private lastPlayerSpeedMps = 0;

  private lastAiSpeedMps = 0;

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
    this.playerSpec = playerSpec;

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
    this.playerWheelHubs = this.getWheelHubs(this.playerCarVisual);
    this.aiWheelHubs = this.getWheelHubs(this.aiCarVisual);
    this.createContinuousSmokeEmitters();

    this.lastPlayerGear = this.engine.getPlayerCar().getGear();
    this.lastAiGear = this.engine.getAiCar().getGear();
    this.lastPlayerSpeedMps = 0;
    this.lastAiSpeedMps = 0;
    this.playerShiftBurstMs = 0;
    this.aiShiftBurstMs = 0;

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
      this.playerSmokeEmitter?.destroy();
      this.aiSmokeEmitter?.destroy();
      this.playerSmokeEmitter = null;
      this.aiSmokeEmitter = null;
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

    initEngineSound(this.playerSpec);

    const playerState = this.engine.getPlayerState();
    if (preferLaunch && playerState.launchAtMs === null) {
      this.engine.inputLaunch();
      const state = this.engine.getPlayerState();
      if (state.falseStartPenaltyMs > 0) {
        this.hud.shiftText.setColor('#ff9f9f').setText('False start! +0.25s de penalidade');
        playLaunchSound(this.playerSpec, true);
      } else {
        this.hud.shiftText.setColor('#ffd28c').setText('Launch registrado. Prepare o shift!');
        playLaunchSound(this.playerSpec, false);
        this.triggerSmokeParticles();
      }
      return;
    }

    if (playerState.launchAtMs === null) {
      this.engine.inputLaunch();
      playLaunchSound(this.playerSpec, false);
      this.triggerSmokeParticles();
      return;
    }

    const shift = this.engine.inputShift();
    if (shift.quality === 'ignored') {
      return;
    }

    playShiftSound(shift.quality, this.playerSpec, shift.gearAfterShift);

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

  private getWheelHubs(carVisual: Phaser.GameObjects.Container): Phaser.GameObjects.Container[] {
    const hubs = carVisual.getData('wheelHubs');
    if (!Array.isArray(hubs)) {
      return [];
    }
    return hubs.filter((hub): hub is Phaser.GameObjects.Container => hub instanceof Phaser.GameObjects.Container);
  }

  private ensureSmokeTexture(): string {
    const textureKey = 'smoke_soft';
    if (this.textures.exists(textureKey)) {
      return textureKey;
    }

    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 0.24);
    graphics.fillCircle(20, 20, 18);
    graphics.fillStyle(0xffffff, 0.34);
    graphics.fillCircle(20, 20, 12);
    graphics.fillStyle(0xffffff, 0.54);
    graphics.fillCircle(20, 20, 7);
    graphics.generateTexture(textureKey, 40, 40);
    graphics.destroy();
    return textureKey;
  }

  private createContinuousSmokeEmitters(): void {
    const smokeTexture = this.ensureSmokeTexture();
    this.playerSmokeEmitter = this.add.particles(this.playerCarVisual.x - 66, this.playerCarVisual.y + 24, smokeTexture, {
      speedX: { min: -160, max: -280 },
      speedY: { min: -30, max: 6 },
      alpha: { start: 0.36, end: 0 },
      scale: { start: 0.18, end: 1.2 },
      lifespan: 900,
      frequency: 52,
      quantity: 1,
      blendMode: 'NORMAL',
      tint: 0xe2e8ef,
      emitting: false,
    });
    this.playerSmokeEmitter.setDepth(-1);

    this.aiSmokeEmitter = this.add.particles(this.aiCarVisual.x - 66, this.aiCarVisual.y + 24, smokeTexture, {
      speedX: { min: -130, max: -230 },
      speedY: { min: -22, max: 4 },
      alpha: { start: 0.28, end: 0 },
      scale: { start: 0.16, end: 1 },
      lifespan: 850,
      frequency: 60,
      quantity: 1,
      blendMode: 'NORMAL',
      tint: 0xdde3eb,
      emitting: false,
    });
    this.aiSmokeEmitter.setDepth(-1);
  }

  private spinWheelHubs(hubs: Phaser.GameObjects.Container[], speedMps: number, deltaMs: number): void {
    if (hubs.length === 0 || deltaMs <= 0) {
      return;
    }

    const spinStep = speedMps * (deltaMs / 1000) * 2.9;
    const blurAlpha = Phaser.Math.Clamp(0.24 + speedMps * 0.0065, 0.24, 0.56);
    hubs.forEach((hub) => {
      hub.rotation += spinStep;
      hub.setAlpha(blurAlpha);
    });
  }

  private updateSmokeEmitter(
    emitter: Phaser.GameObjects.Particles.ParticleEmitter | null,
    x: number,
    y: number,
    power: number,
  ): void {
    if (!emitter) {
      return;
    }

    emitter.setPosition(x, y);
    const clampedPower = Phaser.Math.Clamp(power, 0, 1.4);
    if (clampedPower <= 0.04) {
      if (emitter.emitting) {
        emitter.stop();
      }
      return;
    }

    emitter.setFrequency(Math.max(18, 62 - clampedPower * 36), clampedPower > 0.78 ? 3 : clampedPower > 0.42 ? 2 : 1);
    emitter.setParticleLifespan(760 + clampedPower * 460);
    emitter.setParticleAlpha(Phaser.Math.Clamp(0.2 + clampedPower * 0.22, 0.2, 0.68));
    emitter.setScale(1 + clampedPower * 0.36);

    if (!emitter.emitting) {
      emitter.start();
    }
  }

  private updateDynamicRaceFx(deltaMs: number): void {
    const deltaSec = Math.max(0.001, deltaMs / 1000);
    const phase = this.engine.getPhase();
    const player = this.engine.getPlayerCar();
    const ai = this.engine.getAiCar();
    const playerState = this.engine.getPlayerState();
    const aiState = this.engine.getAiState();

    const playerSpeed = player.getSpeedMps();
    const aiSpeed = ai.getSpeedMps();

    const playerAccel = Math.max(0, (playerSpeed - this.lastPlayerSpeedMps) / deltaSec);
    const aiAccel = Math.max(0, (aiSpeed - this.lastAiSpeedMps) / deltaSec);
    this.lastPlayerSpeedMps = playerSpeed;
    this.lastAiSpeedMps = aiSpeed;

    const playerGear = player.getGear();
    const aiGear = ai.getGear();
    if (playerGear !== this.lastPlayerGear) {
      this.playerShiftBurstMs = 260;
      this.lastPlayerGear = playerGear;
    }
    if (aiGear !== this.lastAiGear) {
      this.aiShiftBurstMs = 220;
      this.lastAiGear = aiGear;
    }

    this.playerShiftBurstMs = Math.max(0, this.playerShiftBurstMs - deltaMs);
    this.aiShiftBurstMs = Math.max(0, this.aiShiftBurstMs - deltaMs);

    const isRacing = phase === 'racing';
    const playerPower = isRacing && playerState.launched
      ? Phaser.Math.Clamp(playerAccel / 12, 0, 1) * 0.58
        + Phaser.Math.Clamp(playerSpeed / 88, 0, 1) * 0.26
        + (this.playerShiftBurstMs > 0 ? 0.72 : 0)
      : 0;
    const aiPower = isRacing && aiState.launched
      ? Phaser.Math.Clamp(aiAccel / 12, 0, 1) * 0.5
        + Phaser.Math.Clamp(aiSpeed / 92, 0, 1) * 0.2
        + (this.aiShiftBurstMs > 0 ? 0.54 : 0)
      : 0;

    this.updateSmokeEmitter(this.playerSmokeEmitter, this.playerCarVisual.x - 66, this.playerCarVisual.y + 24, playerPower);
    this.updateSmokeEmitter(this.aiSmokeEmitter, this.aiCarVisual.x - 66, this.aiCarVisual.y + 24, aiPower);

    this.spinWheelHubs(this.playerWheelHubs, playerSpeed, deltaMs);
    this.spinWheelHubs(this.aiWheelHubs, aiSpeed, deltaMs);
  }

  private triggerExhaustParticles(isPerfect: boolean): void {
    this.playerShiftBurstMs = Math.max(this.playerShiftBurstMs, isPerfect ? 260 : 180);
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
    this.playerShiftBurstMs = Math.max(this.playerShiftBurstMs, 220);
    const smokeTexture = this.ensureSmokeTexture();
    const emitter = this.add.particles(this.playerCarVisual.x - 68, this.playerCarVisual.y + 26, smokeTexture, {
      speedX: { min: -160, max: -330 },
      speedY: { min: -58, max: 12 },
      scale: { start: 0.34, end: 2.06 },
      alpha: { start: 0.62, end: 0 },
      lifespan: 1160,
      tint: 0xdde5ee,
      blendMode: 'NORMAL',
      frequency: 34,
      quantity: 2,
    });

    this.time.delayedCall(840, () => {
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

    this.refreshVisuals(ms);
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
    this.refreshVisuals(clamped);
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

  private refreshVisuals(deltaMs: number): void {
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
    updateEngineSound(player.getRpm(), phase === 'racing', player.getGear(), currentSpeed);
    this.updateDynamicRaceFx(deltaMs);

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
