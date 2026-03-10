import type { RaceTextState } from '../types';

let snapshot: RaceTextState = {
  coordinateSystem: 'origin top-left; x increases right; y increases downward; distance in meters from start line',
  mode: 'boot',
  league: null,
  raceNumber: null,
  player: {
    carId: null,
    gear: 1,
    rpm: 0,
    distanceM: 0,
    speedMps: 0,
    launched: false,
  },
  ai: {
    carId: null,
    gear: 1,
    rpm: 0,
    distanceM: 0,
    speedMps: 0,
    launched: false,
  },
  timerMs: 0,
  money: 0,
  result: null,
};

export function setTextSnapshot(next: Partial<RaceTextState>): void {
  snapshot = {
    ...snapshot,
    ...next,
    player: {
      ...snapshot.player,
      ...(next.player ?? {}),
    },
    ai: {
      ...snapshot.ai,
      ...(next.ai ?? {}),
    },
  };
}

export function getTextSnapshot(): RaceTextState {
  return snapshot;
}
