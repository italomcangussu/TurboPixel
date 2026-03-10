import {
  FALSE_START_PENALTY_MS,
  GOOD_WINDOW_MS,
  GREEN_LIGHT_AT_MS,
  LAUNCH_BONUS_DURATION_MS,
  LAUNCH_BONUS_MULTIPLIER,
  LAUNCH_BONUS_WINDOW_MS,
  MISS_DEBUFF_DURATION_MS,
  MISS_DEBUFF_TORQUE_MULTIPLIER,
  OVERREV_DEBUFF_DURATION_MS,
  OVERREV_DEBUFF_TORQUE_MULTIPLIER,
  OVERREV_THRESHOLD_RATIO,
  OVERREV_TRIGGER_MS,
  PERFECT_BUFF_DURATION_MS,
  PERFECT_BUFF_TORQUE_MULTIPLIER,
  PERFECT_WINDOW_MS,
  RACE_DISTANCE_METERS,
  SHIFT_DEBOUNCE_MS,
} from './constants';
import { SeededRng } from './random';
import {
  getDragReduction,
  getFalseStartPenaltyReduction,
  getLaunchBonusMultiplier,
  getOverRevToleranceBonusMs,
  getRedlineMultiplier,
  getShiftDebounceReductionMs,
  getShiftLagReduction,
  getShiftWindowBonusMs,
  getTorqueMultiplier,
} from './upgrades';
import type { CarSpec, LeagueSpec, RaceConfig, UpgradeLevels } from '../types';

export type ShiftQuality = 'perfect' | 'good' | 'miss' | 'ignored';

export interface ShiftOutcome {
  quality: ShiftQuality;
  diffMs: number;
  gearAfterShift: number;
}

export function classifyShiftTiming(diffMs: number, perfectWindowMs: number): ShiftQuality {
  const absDiff = Math.abs(diffMs);
  if (absDiff <= perfectWindowMs) {
    return 'perfect';
  }
  if (absDiff <= GOOD_WINDOW_MS) {
    return 'good';
  }
  return 'miss';
}

export function advanceOverRevAccumulator(params: {
  accumMs: number;
  rpm: number;
  redlineRpm: number;
  deltaMs: number;
  triggerMs?: number;
}): { accumMs: number; triggered: boolean } {
  const triggerMs = params.triggerMs ?? OVERREV_TRIGGER_MS;
  if (params.rpm > params.redlineRpm * OVERREV_THRESHOLD_RATIO) {
    const next = params.accumMs + params.deltaMs;
    if (next >= triggerMs) {
      return { accumMs: 0, triggered: true };
    }
    return { accumMs: next, triggered: false };
  }

  return {
    accumMs: Math.max(0, params.accumMs - params.deltaMs * 0.6),
    triggered: false,
  };
}

interface RacerState {
  launched: boolean;
  launchAtMs: number | null;
  reactionMs: number;
  falseStartPenaltyMs: number;
  finishedTimeMs: number | null;
  perfectShifts: number;
}

interface AiShiftPlan {
  offsetByGear: Record<number, number>;
}

export interface RaceWinner {
  winner: 'player' | 'ai';
  playerTimeMs: number;
  aiTimeMs: number;
  playerPerfectShifts: number;
  falseStartPenaltyMs: number;
}

export class RaceCar {
  private elapsedMs = 0;

  private distanceM = 0;

  private speedMps = 0;

  private rpm = 1100;

  private lastRpm = 1100;

  private rpmRisePerMs = 2;

  private gear = 1;

  private idealPassedAtMs: number | null = null;

  private lastShiftAtMs = -1000;

  private shiftLagMs = 0;

  private perfectBuffMs = 0;

  private missDebuffMs = 0;

  private overRevDebuffMs = 0;

  private overRevAccumMs = 0;

  private launchBonusMs = 0;

  private launchBonusMultiplier = 1;

  constructor(
    private readonly car: CarSpec,
    private readonly upgrades: UpgradeLevels,
  ) {}

  step(deltaMs: number): void {
    this.elapsedMs += deltaMs;

    this.perfectBuffMs = Math.max(0, this.perfectBuffMs - deltaMs);
    this.missDebuffMs = Math.max(0, this.missDebuffMs - deltaMs);
    this.overRevDebuffMs = Math.max(0, this.overRevDebuffMs - deltaMs);
    this.shiftLagMs = Math.max(0, this.shiftLagMs - deltaMs);
    this.launchBonusMs = Math.max(0, this.launchBonusMs - deltaMs);

    const dt = deltaMs / 1000;
    const gearRatio = this.car.gearRatios[this.gear - 1];
    const effectiveRedline = this.getEffectiveRedline();

    let torqueMultiplier = getTorqueMultiplier(this.upgrades, this.gear);
    if (this.perfectBuffMs > 0) {
      torqueMultiplier *= PERFECT_BUFF_TORQUE_MULTIPLIER;
    }
    if (this.missDebuffMs > 0) {
      torqueMultiplier *= MISS_DEBUFF_TORQUE_MULTIPLIER;
    }
    if (this.overRevDebuffMs > 0) {
      torqueMultiplier *= OVERREV_DEBUFF_TORQUE_MULTIPLIER;
    }
    if (this.launchBonusMs > 0) {
      torqueMultiplier *= this.launchBonusMultiplier;
    }

    const shiftLagFactor = this.shiftLagMs > 0 ? 0.55 : 1;
    const traction = this.car.baseTorque * this.car.tractionBias * gearRatio * torqueMultiplier;
    const baseAcceleration = (traction / Math.max(820, this.car.weightKg * 0.68)) * shiftLagFactor;
    const aeroFactor = Math.max(0.1, 1 - getDragReduction(this.upgrades));
    const drag = (this.speedMps * this.speedMps) * this.car.dragCoef * 0.0009 * aeroFactor;
    const acceleration = Math.max(0, baseAcceleration - drag);

    this.speedMps += acceleration * dt;
    this.distanceM += this.speedMps * dt;

    this.lastRpm = this.rpm;
    this.rpm = Math.min(effectiveRedline * 1.08, Math.max(900, 900 + this.speedMps * gearRatio * 42));
    this.rpmRisePerMs = Math.max(0.2, (this.rpm - this.lastRpm) / Math.max(1, deltaMs));

    if (this.rpm >= this.getIdealRpm() && this.idealPassedAtMs === null) {
      this.idealPassedAtMs = this.elapsedMs;
    }

    const overRevState = advanceOverRevAccumulator({
      accumMs: this.overRevAccumMs,
      rpm: this.rpm,
      redlineRpm: effectiveRedline,
      deltaMs,
      triggerMs: OVERREV_TRIGGER_MS + getOverRevToleranceBonusMs(this.upgrades),
    });
    this.overRevAccumMs = overRevState.accumMs;
    if (overRevState.triggered) {
      this.overRevDebuffMs = OVERREV_DEBUFF_DURATION_MS;
    }
  }

  applyLaunchBonus(): void {
    this.launchBonusMs = LAUNCH_BONUS_DURATION_MS;
    this.launchBonusMultiplier = LAUNCH_BONUS_MULTIPLIER * getLaunchBonusMultiplier(this.upgrades);
  }

  shift(): ShiftOutcome {
    if (this.gear >= 6) {
      return { quality: 'ignored', diffMs: 0, gearAfterShift: this.gear };
    }

    const shiftDebounceMs = Math.max(60, SHIFT_DEBOUNCE_MS - getShiftDebounceReductionMs(this.upgrades));
    if (this.elapsedMs - this.lastShiftAtMs < shiftDebounceMs) {
      return { quality: 'ignored', diffMs: 0, gearAfterShift: this.gear };
    }

    const diffMs = this.getShiftTimingDiffMs();
    const perfectWindow = PERFECT_WINDOW_MS + getShiftWindowBonusMs(this.upgrades);
    const quality = classifyShiftTiming(diffMs, perfectWindow);
    if (quality === 'perfect') {
      this.perfectBuffMs = PERFECT_BUFF_DURATION_MS;
    } else if (quality === 'miss') {
      this.missDebuffMs = MISS_DEBUFF_DURATION_MS;
    }

    const currentRatio = this.car.gearRatios[this.gear - 1];
    this.gear += 1;
    const nextRatio = this.car.gearRatios[this.gear - 1];

    this.rpm = Math.max(1200, this.rpm * (nextRatio / currentRatio) * 0.97);
    this.lastShiftAtMs = this.elapsedMs;
    this.idealPassedAtMs = null;
    this.overRevAccumMs = 0;

    const lagReduction = getShiftLagReduction(this.upgrades);
    this.shiftLagMs = Math.max(130, 220 * (1 - lagReduction));

    return { quality, diffMs, gearAfterShift: this.gear };
  }

  private getShiftTimingDiffMs(): number {
    if (this.idealPassedAtMs !== null) {
      return this.elapsedMs - this.idealPassedAtMs;
    }

    const gap = this.getIdealRpm() - this.rpm;
    if (gap <= 0) {
      return 0;
    }

    return -Math.abs(gap / this.rpmRisePerMs);
  }

  getIdealRpm(): number {
    return this.getEffectiveRedline() * 0.92;
  }

  getElapsedMs(): number {
    return this.elapsedMs;
  }

  getDistanceM(): number {
    return this.distanceM;
  }

  getSpeedMps(): number {
    return this.speedMps;
  }

  getRpm(): number {
    return this.rpm;
  }

  getGear(): number {
    return this.gear;
  }

  getIdealPassedAtMs(): number | null {
    return this.idealPassedAtMs;
  }

  getSpec(): CarSpec {
    return this.car;
  }

  getFalseStartPenaltyReduction(): number {
    return getFalseStartPenaltyReduction(this.upgrades);
  }

  private getEffectiveRedline(): number {
    return this.car.redlineRpm * getRedlineMultiplier(this.upgrades);
  }

  isFinished(): boolean {
    return this.distanceM >= RACE_DISTANCE_METERS;
  }
}

function randomInRange(rng: SeededRng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

function sampleAiShiftOffset(error: LeagueSpec['aiError'], rng: SeededRng): number {
  const roll = rng.next();

  if (error === 'high') {
    if (roll < 0.3) return randomInRange(rng, 10, 140);
    if (roll < 0.75) return randomInRange(rng, 140, 290);
    return randomInRange(rng, 320, 540);
  }

  if (error === 'medium') {
    if (roll < 0.45) return randomInRange(rng, 10, 130);
    if (roll < 0.85) return randomInRange(rng, 130, 260);
    return randomInRange(rng, 300, 430);
  }

  if (error === 'good') {
    if (roll < 0.6) return randomInRange(rng, 5, 110);
    if (roll < 0.93) return randomInRange(rng, 110, 220);
    return randomInRange(rng, 260, 340);
  }

  if (error === 'perfect') {
    if (roll < 0.75) return randomInRange(rng, 0, 90);
    if (roll < 0.98) return randomInRange(rng, 90, 180);
    return randomInRange(rng, 220, 280);
  }

  if (roll < 0.85) return randomInRange(rng, 0, 70);
  if (roll < 0.98) return randomInRange(rng, 70, 140);
  return randomInRange(rng, 180, 240);
}

function createAiShiftPlan(error: LeagueSpec['aiError'], rng: SeededRng): AiShiftPlan {
  const offsetByGear: Record<number, number> = {};
  for (let gear = 1; gear <= 5; gear += 1) {
    offsetByGear[gear] = sampleAiShiftOffset(error, rng);
  }
  return { offsetByGear };
}

export class DragRaceEngine {
  private readonly playerCar: RaceCar;

  private readonly aiCar: RaceCar;

  private readonly rng: SeededRng;

  private readonly aiShiftPlan: AiShiftPlan;

  private elapsedMs = 0;

  private phase: 'countdown' | 'racing' | 'finished' = 'countdown';

  private readonly playerState: RacerState = {
    launched: false,
    launchAtMs: null,
    reactionMs: 0,
    falseStartPenaltyMs: 0,
    finishedTimeMs: null,
    perfectShifts: 0,
  };

  private readonly aiState: RacerState = {
    launched: false,
    launchAtMs: null,
    reactionMs: 0,
    falseStartPenaltyMs: 0,
    finishedTimeMs: null,
    perfectShifts: 0,
  };

  private readonly aiLaunchAtMs: number;

  private latestShift: ShiftOutcome = { quality: 'ignored', diffMs: 0, gearAfterShift: 1 };

  constructor(
    private readonly raceConfig: RaceConfig,
    playerCarSpec: CarSpec,
    aiCarSpec: CarSpec,
    playerUpgrades: UpgradeLevels,
    aiUpgrades: UpgradeLevels,
    leagueSpec: LeagueSpec,
  ) {
    this.rng = new SeededRng(raceConfig.seed);
    this.playerCar = new RaceCar(playerCarSpec, playerUpgrades);
    this.aiCar = new RaceCar(aiCarSpec, aiUpgrades);

    this.aiShiftPlan = createAiShiftPlan(leagueSpec.aiError, this.rng);

    const reactionJitter = randomInRange(this.rng, -40, 40);
    this.aiState.reactionMs = Math.max(80, leagueSpec.aiReactionMs + reactionJitter);
    this.aiLaunchAtMs = GREEN_LIGHT_AT_MS + this.aiState.reactionMs;
    this.aiState.launchAtMs = this.aiLaunchAtMs;
  }

  update(deltaMs: number): void {
    if (this.phase === 'finished') {
      return;
    }

    this.elapsedMs += deltaMs;

    if (this.phase === 'countdown' && this.elapsedMs >= GREEN_LIGHT_AT_MS) {
      this.phase = 'racing';
    }

    this.handleLaunches();

    if (this.playerState.launched) {
      this.playerCar.step(deltaMs);
      this.checkFinish('player');
    }

    if (this.aiState.launched) {
      this.aiDrive();
      this.aiCar.step(deltaMs);
      this.checkFinish('ai');
    }

    if (this.playerState.finishedTimeMs !== null && this.aiState.finishedTimeMs !== null) {
      this.phase = 'finished';
    }
  }

  private handleLaunches(): void {
    if (!this.playerState.launched && this.playerState.launchAtMs !== null && this.elapsedMs >= this.playerState.launchAtMs) {
      this.playerState.launched = true;
      if (this.playerState.reactionMs <= LAUNCH_BONUS_WINDOW_MS && this.playerState.falseStartPenaltyMs === 0) {
        this.playerCar.applyLaunchBonus();
      }
    }

    if (!this.aiState.launched && this.elapsedMs >= this.aiLaunchAtMs) {
      this.aiState.launched = true;
      if (this.aiState.reactionMs <= LAUNCH_BONUS_WINDOW_MS) {
        this.aiCar.applyLaunchBonus();
      }
    }
  }

  private aiDrive(): void {
    if (this.aiCar.getGear() >= 6) {
      return;
    }

    const gear = this.aiCar.getGear();
    const idealPassedAt = this.aiCar.getIdealPassedAtMs();
    if (idealPassedAt === null) {
      if (this.aiCar.getRpm() > this.aiCar.getSpec().redlineRpm * 1.03) {
        this.aiCar.shift();
      }
      return;
    }

    const targetOffset = this.aiShiftPlan.offsetByGear[gear] ?? 120;
    if (this.aiCar.getElapsedMs() - idealPassedAt >= targetOffset) {
      const shift = this.aiCar.shift();
      if (shift.quality === 'perfect') {
        this.aiState.perfectShifts += 1;
      }
    }
  }

  inputLaunch(): void {
    if (this.playerState.launchAtMs !== null) {
      return;
    }

    if (this.elapsedMs < GREEN_LIGHT_AT_MS) {
      this.playerState.launchAtMs = GREEN_LIGHT_AT_MS;
      this.playerState.reactionMs = 0;
      const reduction = this.playerCar.getFalseStartPenaltyReduction();
      const scaledPenalty = FALSE_START_PENALTY_MS * Math.max(0.2, 1 - reduction);
      this.playerState.falseStartPenaltyMs = Math.round(scaledPenalty);
      return;
    }

    this.playerState.launchAtMs = this.elapsedMs;
    this.playerState.reactionMs = this.elapsedMs - GREEN_LIGHT_AT_MS;
  }

  inputShift(): ShiftOutcome {
    if (!this.playerState.launched || this.phase === 'finished') {
      return { quality: 'ignored', diffMs: 0, gearAfterShift: this.playerCar.getGear() };
    }

    const shift = this.playerCar.shift();
    this.latestShift = shift;
    if (shift.quality === 'perfect') {
      this.playerState.perfectShifts += 1;
    }
    return shift;
  }

  private checkFinish(who: 'player' | 'ai'): void {
    const state = who === 'player' ? this.playerState : this.aiState;
    const car = who === 'player' ? this.playerCar : this.aiCar;
    if (state.finishedTimeMs !== null || !car.isFinished()) {
      return;
    }

    const reactionComponent = Math.max(0, (state.launchAtMs ?? GREEN_LIGHT_AT_MS) - GREEN_LIGHT_AT_MS);
    state.finishedTimeMs = reactionComponent + car.getElapsedMs() + state.falseStartPenaltyMs;
  }

  getPhase(): 'countdown' | 'racing' | 'finished' {
    return this.phase;
  }

  getElapsedMs(): number {
    return this.elapsedMs;
  }

  getCountdownLights(): number {
    if (this.elapsedMs < 1000) return 0;
    if (this.elapsedMs < 2000) return 1;
    if (this.elapsedMs < 3000) return 2;
    return 3;
  }

  getPlayerCar(): RaceCar {
    return this.playerCar;
  }

  getAiCar(): RaceCar {
    return this.aiCar;
  }

  getLatestShift(): ShiftOutcome {
    return this.latestShift;
  }

  getWinner(): RaceWinner | null {
    if (this.playerState.finishedTimeMs === null || this.aiState.finishedTimeMs === null) {
      return null;
    }

    let winner: 'player' | 'ai';
    if (Math.abs(this.playerState.finishedTimeMs - this.aiState.finishedTimeMs) <= 1) {
      winner = this.playerState.reactionMs <= this.aiState.reactionMs ? 'player' : 'ai';
    } else {
      winner = this.playerState.finishedTimeMs < this.aiState.finishedTimeMs ? 'player' : 'ai';
    }

    return {
      winner,
      playerTimeMs: this.playerState.finishedTimeMs,
      aiTimeMs: this.aiState.finishedTimeMs,
      playerPerfectShifts: this.playerState.perfectShifts,
      falseStartPenaltyMs: this.playerState.falseStartPenaltyMs,
    };
  }

  getRaceConfig(): RaceConfig {
    return this.raceConfig;
  }

  getPlayerState(): RacerState {
    return { ...this.playerState };
  }

  getAiState(): RacerState {
    return { ...this.aiState };
  }
}
