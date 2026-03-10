import { CARS, CAR_MAP } from '../data/cars';
import { LEAGUES } from '../data/leagues';
import { SCHEMA_VERSION } from './constants';
import { createDefaultUpgradeEquipped, createEmptyUpgrades } from './upgrades';
import type { PlayerProfile } from '../types';

function normalizeOwnedCars(rawOwnedCars: string[] | undefined, starterId: string): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const carId of rawOwnedCars ?? []) {
    if (!CAR_MAP.has(carId) || seen.has(carId)) {
      continue;
    }
    seen.add(carId);
    normalized.push(carId);
  }

  if (normalized.length === 0) {
    normalized.push(starterId);
  }

  return normalized;
}

export function createDefaultProfile(): PlayerProfile {
  const starter = CARS[0];

  return {
    schemaVersion: SCHEMA_VERSION,
    money: 1000,
    ownedCars: [starter.id],
    selectedCarId: starter.id,
    ownedCosmetics: [],
    equippedCosmeticsByCar: {
      [starter.id]: {},
    },
    upgradesByCar: {
      [starter.id]: createEmptyUpgrades(),
    },
    equippedUpgradesByCar: {
      [starter.id]: createDefaultUpgradeEquipped(),
    },
    leagueProgress: Object.fromEntries(
      LEAGUES.map((league) => [String(league.id), { wins: 0, racesCompleted: 0 }]),
    ),
    pityCounter: 0,
    victoriesWithoutBox: 0,
  };
}

export function ensureProfileShape(profile: PlayerProfile): PlayerProfile {
  const normalized = structuredClone(profile);
  const starter = CARS[0];

  normalized.ownedCars = normalizeOwnedCars(normalized.ownedCars, starter.id);
  normalized.selectedCarId =
    CAR_MAP.has(normalized.selectedCarId) && normalized.ownedCars.includes(normalized.selectedCarId)
      ? normalized.selectedCarId
      : normalized.ownedCars[0];

  normalized.upgradesByCar ??= {};
  normalized.equippedUpgradesByCar ??= {};
  normalized.equippedCosmeticsByCar ??= {};

  for (const carId of normalized.ownedCars) {
    normalized.upgradesByCar[carId] = {
      ...createEmptyUpgrades(),
      ...(normalized.upgradesByCar[carId] ?? {}),
    };
    normalized.equippedUpgradesByCar[carId] = {
      ...createDefaultUpgradeEquipped(),
      ...(normalized.equippedUpgradesByCar[carId] ?? {}),
    };
    normalized.equippedCosmeticsByCar[carId] = normalized.equippedCosmeticsByCar[carId] ?? {};
  }

  normalized.leagueProgress ??= {};
  for (const league of LEAGUES) {
    const key = String(league.id);
    normalized.leagueProgress[key] ??= { wins: 0, racesCompleted: 0 };
  }

  normalized.ownedCosmetics = Array.isArray(normalized.ownedCosmetics) ? normalized.ownedCosmetics : [];
  normalized.pityCounter = Math.max(0, normalized.pityCounter ?? 0);
  normalized.victoriesWithoutBox = Math.max(0, normalized.victoriesWithoutBox ?? 0);
  normalized.schemaVersion = SCHEMA_VERSION;

  return normalized;
}
