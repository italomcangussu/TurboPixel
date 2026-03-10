import { RACE_DISTANCE_METERS } from '../core/constants';
import { DragRaceEngine, advanceOverRevAccumulator, classifyShiftTiming } from '../core/race';
import { createEmptyUpgrades } from '../core/upgrades';
import { CAR_MAP } from '../data/cars';
import { LEAGUES } from '../data/leagues';
import type { RaceConfig } from '../types';

const FIXED_STEP_MS = 1000 / 60;

function simulateQuarterMile(carId: string, leagueId = 1): { timeMs: number; distanceM: number } {
  const car = CAR_MAP.get(carId);
  const league = LEAGUES.find((entry) => entry.id === leagueId);

  if (!car || !league) {
    throw new Error(`Missing car or league for simulation: ${carId} / ${leagueId}`);
  }

  const config: RaceConfig = {
    league: leagueId,
    raceNumber: 1,
    trackId: 'evergreen-dragway',
    playerCarId: car.id,
    aiCarId: car.id,
    seed: 42,
  };

  const engine = new DragRaceEngine(
    config,
    car,
    car,
    createEmptyUpgrades(),
    createEmptyUpgrades(),
    league,
  );

  let launchRegistered = false;

  for (let frame = 0; frame < 2400; frame += 1) {
    engine.update(FIXED_STEP_MS);

    if (!launchRegistered && engine.getElapsedMs() >= 3000) {
      engine.inputLaunch();
      launchRegistered = true;
    }

    const player = engine.getPlayerCar();
    const playerState = engine.getPlayerState();
    if (playerState.launched && player.getGear() < 6 && player.getIdealPassedAtMs() !== null) {
      engine.inputShift();
    }

    const winner = engine.getWinner();
    if (winner) {
      return {
        timeMs: winner.playerTimeMs,
        distanceM: engine.getPlayerCar().getDistanceM(),
      };
    }
  }

  throw new Error(`Race did not finish for ${carId}`);
}

describe('race timing', () => {
  it('classifies perfect, good and miss boundaries', () => {
    expect(classifyShiftTiming(0, 120)).toBe('perfect');
    expect(classifyShiftTiming(120, 120)).toBe('perfect');
    expect(classifyShiftTiming(121, 120)).toBe('good');
    expect(classifyShiftTiming(-300, 120)).toBe('good');
    expect(classifyShiftTiming(301, 120)).toBe('miss');
  });

  it('triggers over-rev debuff after threshold and decays when below redline', () => {
    const stepA = advanceOverRevAccumulator({
      accumMs: 0,
      rpm: 7000,
      redlineRpm: 7000,
      deltaMs: 250,
    });
    expect(stepA.triggered).toBe(false);
    expect(stepA.accumMs).toBe(250);

    const stepB = advanceOverRevAccumulator({
      accumMs: stepA.accumMs,
      rpm: 7000,
      redlineRpm: 7000,
      deltaMs: 260,
    });
    expect(stepB.triggered).toBe(true);
    expect(stepB.accumMs).toBe(0);

    const decay = advanceOverRevAccumulator({
      accumMs: 300,
      rpm: 2000,
      redlineRpm: 7000,
      deltaMs: 100,
    });
    expect(decay.triggered).toBe(false);
    expect(decay.accumMs).toBeCloseTo(240);
  });

  it('finishes the quarter mile using the official 402.336m distance', () => {
    const result = simulateQuarterMile('supra-a80');

    expect(result.timeMs).toBeLessThan(20000);
    expect(result.distanceM).toBeGreaterThanOrEqual(RACE_DISTANCE_METERS);
  });

  it('keeps representative cars ordered by tier and inside target drag windows', () => {
    const expectations = [
      { id: 'supra-a80', minSeconds: 12.8, maxSeconds: 13.5 },
      { id: 'nsx-na1', minSeconds: 12.0, maxSeconds: 12.7 },
      { id: 'challenger-hellcat', minSeconds: 11.2, maxSeconds: 11.9 },
      { id: 'shelby-gt500', minSeconds: 10.6, maxSeconds: 11.1 },
      { id: 'gtr-r35-nismo', minSeconds: 9.9, maxSeconds: 10.5 },
    ];

    const results = expectations.map((entry) => ({
      ...entry,
      seconds: Number((simulateQuarterMile(entry.id).timeMs / 1000).toFixed(3)),
    }));

    for (const result of results) {
      expect(result.seconds).toBeGreaterThanOrEqual(result.minSeconds);
      expect(result.seconds).toBeLessThanOrEqual(result.maxSeconds);
    }

    for (let index = 1; index < results.length; index += 1) {
      expect(results[index].seconds).toBeLessThan(results[index - 1].seconds);
    }
  });
});
