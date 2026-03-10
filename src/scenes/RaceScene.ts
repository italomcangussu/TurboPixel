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

  private rpmNeedle!: Phaser.GameObjects.Rectangle;

  private speedText!: Phaser.GameObjects.Text;

  private gearText!: Phaser.GameObjects.Text;

  private shiftText!: Phaser.GameObjects.Text;

  private countdownText!: Phaser.GameObjects.Text;

  private speedLinesGroup!: Phaser.GameObjects.Group;

  private cityLayers!: { graphics: Phaser.GameObjects.Graphics; speedOffset: number; xPos: number }[];

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
      y: this.scale.height * 0.77,
      scale: 0.60,
      car: playerSpec,
      profile,
      variant: 'race',
    });

    this.aiCarVisual = createCarVisual(this, {
      x: 140,
      y: this.scale.height * 0.54,
      scale: 0.52,
      car: aiSpec,
      profile,
      variant: 'race',
    });

    this.timerText = this.add
      .text(this.scale.width / 2, 28, 'Tempo: 0.00s', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f6fbff',
      })
      .setOrigin(0.5);

    this.createTachometer();

    this.shiftText = this.add
      .text(this.scale.width / 2, this.scale.height - 180, 'Aguardando launch...', {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold italic',
        fontSize: '28px',
        color: '#ffaa00',
        stroke: '#000000',
        strokeThickness: 4,
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

  private createTachometer(): void {
    const x = 120;
    const y = this.scale.height - 100;
    const radius = 80;

    // Draw background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1c29, 0.85);
    bg.lineStyle(4, 0x3a3f5c, 1);
    bg.fillCircle(x, y, radius);
    bg.strokeCircle(x, y, radius);

    // Draw increments (0 to 8 x1000 RPM)
    for (let i = 0; i <= 8; i++) {
        const angle = Phaser.Math.DegToRad(180 + i * 22.5); // Semi-circle from 180 to 360 degrees
        const isRedline = i >= 7;
        
        bg.lineStyle(isRedline ? 4 : 2, isRedline ? 0xff4444 : 0x8892b0, 1);
        const startX = x + Math.cos(angle) * (radius - 15);
        const startY = y + Math.sin(angle) * (radius - 15);
        const endX = x + Math.cos(angle) * radius;
        const endY = y + Math.sin(angle) * radius;

        bg.lineBetween(startX, startY, endX, endY);
        
        // Add number labels
        const textX = x + Math.cos(angle) * (radius - 32);
        const textY = y + Math.sin(angle) * (radius - 32);
        this.add.text(textX, textY, i.toString(), {
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            fontSize: '18px',
            color: isRedline ? '#ff4444' : '#ffffff',
        }).setOrigin(0.5);
    }

    // Digital Speed Display Center
    this.speedText = this.add.text(x, y + 10, '0', {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold italic',
        fontSize: '36px',
        color: '#ffffff',
    }).setOrigin(0.5, 1);

    this.add.text(x, y + 25, 'km/h', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#8892b0',
    }).setOrigin(0.5, 1);

    // Gear indicator
    this.gearText = this.add.text(x, y + 50, 'N', {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: '24px',
        color: '#66ccff',
    }).setOrigin(0.5, 1);

    // Needle
    this.rpmNeedle = this.add.rectangle(x, y, radius - 15, 4, 0xff3333);
    this.rpmNeedle.setOrigin(0, 0.5);
    this.rpmNeedle.setRotation(Phaser.Math.DegToRad(180));
    
    // Add central pin for needle
    const pin = this.add.graphics();
    pin.fillStyle(0x3a3f5c, 1);
    pin.fillCircle(x, y, 6);
  }

  private drawTrack(horizonColor: number, roadColor: number, accentColor: number): void {
    const width = this.scale.width;
    const height = this.scale.height;

    // Sky Background
    this.add.rectangle(width / 2, height * 0.26, width, height * 0.52, horizonColor);
    
    // Sun/Cloud setup (instead of Moon/Stars)
    const skyDeco = this.add.graphics();
    skyDeco.fillStyle(0xfffdf0, 0.9);
    skyDeco.fillCircle(width - 120, 80, 45); // Sun
    skyDeco.fillStyle(0xffffff, 0.6);
    skyDeco.fillEllipse(200, 100, 180, 40); // Clouds
    skyDeco.fillEllipse(500, 150, 220, 30);
    skyDeco.fillEllipse(width - 300, 120, 250, 50);

    // Parallax Mountain & Forest Layers
    this.cityLayers = [
       { graphics: this.add.graphics(), speedOffset: 0.05, xPos: 0 }, // Distant mountains
       { graphics: this.add.graphics(), speedOffset: 0.15, xPos: 0 }, // Mid hills
       { graphics: this.add.graphics(), speedOffset: 0.4, xPos: 0 }   // Foreground trees
    ];

    this.cityLayers.forEach((layer, index) => {
        // Adjust color based on depth
        const mtnColor = [0x507d6a, 0x3d6b47, 0x24542d][index];
        const layerHeightBase = [height * 0.35, height * 0.25, height * 0.15][index];
        
        layer.graphics.fillStyle(mtnColor, 1);
        
        // Draw Mountains/Hills/Trees that will repeat
        for(let bx = 0; bx < width * 2; bx += Phaser.Math.Between(50, 150)) {
            const elWidth = Phaser.Math.Between(80, 200);
            const elHeight = layerHeightBase + Phaser.Math.Between(-40, 50);
            
            if (index < 2) {
                // Draw Mountain Peaks (Triangles)
                layer.graphics.fillTriangle(
                    bx, height * 0.54, 
                    bx + elWidth / 2, height * 0.54 - elHeight, 
                    bx + elWidth, height * 0.54
                );
            } else {
                // Draw Foreground Trees (Ellipses on trunks)
                const trunkHeight = 20;
                layer.graphics.fillStyle(0x362312, 1); // Trunk
                layer.graphics.fillRect(bx + elWidth/2 - 5, height * 0.54 - trunkHeight, 10, trunkHeight);
                layer.graphics.fillStyle(mtnColor, 1); // Leaves
                layer.graphics.fillEllipse(bx + elWidth/2, height * 0.54 - elHeight/2, elWidth * 0.6, elHeight);
            }
        }
    });

    // Darker Asphalt Road with gradient illusion
    this.add.rectangle(width / 2, height * 0.77, width, height * 0.46, roadColor);
    this.add.rectangle(width / 2, height * 0.53, width, height * 0.05, 0x0a0a0a); // Horizon fade

    // Guard rails
    const gfx = this.add.graphics();
    gfx.fillStyle(0xcccccc, 1);
    gfx.fillRect(0, height * 0.54, width, 6);
    gfx.fillStyle(0xff1111, 1); // Red stripes
    for(let r = 0; r < width; r+= 40) {
        gfx.fillRect(r, height * 0.54, 20, 6);
    }
    
    // Bottom rail
    gfx.fillStyle(0x555555, 1);
    gfx.fillRect(0, height * 0.69, width, 4);

    // Track Markers
    for (let i = 0; i < 18; i += 1) {
      const x = 70 + i * 60;
      this.add.rectangle(x, height * 0.62, 40, 6, 0xdddddd, 0.6);
    }

    this.speedLinesGroup = this.add.group();
    for (let i = 0; i < 40; i += 1) {
      const lineColor = Phaser.Utils.Array.GetRandom([0xffffff, accentColor, 0xaaaaaa]);
      const line = this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(height * 0.55, height),
        Phaser.Math.Between(40, 150),
        Phaser.Math.Between(2, 5),
        lineColor,
      );
      line.setAlpha(Phaser.Math.FloatBetween(0.1, 0.5));
      this.speedLinesGroup.add(line);
    }

    this.add
      .text(16, 12, 'Space: launch | Enter: shift', {
        fontFamily: 'Arial, sans-serif',
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

  private triggerSmokeParticles(): void {
    if (!this.textures.exists('smoke')) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(16, 16, 16);
      graphics.generateTexture('smoke', 32, 32);
      graphics.destroy();
    }

    const emitter = this.add.particles(this.playerCarVisual.x - 80, this.playerCarVisual.y + 20, 'smoke', {
      speedX: { min: -100, max: -300 },
      speedY: { min: -50, max: 10 },
      scale: { start: 0.5, end: 2 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 1200,
      tint: 0xddeeff,
      blendMode: 'NORMAL',
      frequency: 50,
    });

    this.time.delayedCall(800, () => {
        emitter.stop();
        this.time.delayedCall(1200, () => emitter.destroy());
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
    this.playerCarVisual.y = this.scale.height * 0.77 - playerProgress * 18;
    this.playerCarVisual.setScale(0.6 + playerProgress * 0.15);

    this.aiCarVisual.x = minX + (maxX - minX) * aiProgress;
    this.aiCarVisual.y = this.scale.height * 0.54 - aiProgress * 14;
    this.aiCarVisual.setScale(0.52 + aiProgress * 0.12);

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

    // Update Parallax Cityscape
    this.cityLayers.forEach(layer => {
        layer.xPos -= currentSpeed * layer.speedOffset;
        if (layer.xPos <= -this.scale.width) {
            layer.xPos = 0;
        }
        layer.graphics.setX(layer.xPos);
    });

    this.speedLinesGroup.children.iterate((child) => {
      const line = child as Phaser.GameObjects.Rectangle;
      line.x -= currentSpeed * 2.5; // multiplier for visual speed
      if (line.x < -line.width) {
        line.x = this.scale.width + line.width;
        line.y = Phaser.Math.Between(this.scale.height * 0.55, this.scale.height);
      }
      return null;
    });

    this.timerText.setText(`Tempo: ${(this.engine.getElapsedMs() / 1000).toFixed(2)}s`);

    // Speed update
    const speedKmh = player.getSpeedMps() * 3.6;
    this.speedText.setText(speedKmh.toFixed(0));
    
    // Gear update
    this.gearText.setText(player.getGear() === 0 ? 'N' : String(player.getGear()));
    
    // Needle update (Assuming 0 RPM = 180 deg, 8000 RPM = 360 deg)
    const maxRpm = 8000;
    const rpmRotation = 180 + (Math.min(player.getRpm(), maxRpm) / maxRpm) * 180;
    this.rpmNeedle.setRotation(Phaser.Math.DegToRad(rpmRotation));
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
