import { CARS } from '../data/cars';
import { LEAGUES } from '../data/leagues';
import { SCHEMA_VERSION } from './constants';
import { createDefaultUpgradeEquipped, createEmptyUpgrades } from './upgrades';
import type { PlayerProfile } from '../types';

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

  for (const car of normalized.ownedCars) {
    if (!normalized.upgradesByCar[car]) {
      normalized.upgradesByCar[car] = createEmptyUpgrades();
    }
    if (!normalized.equippedUpgradesByCar) {
      normalized.equippedUpgradesByCar = {};
    }
    if (!normalized.equippedUpgradesByCar[car]) {
      normalized.equippedUpgradesByCar[car] = createDefaultUpgradeEquipped();
    }
    if (!normalized.equippedCosmeticsByCar[car]) {
      normalized.equippedCosmeticsByCar[car] = {};
    }
  }

  for (const league of LEAGUES) {
    const key = String(league.id);
    if (!normalized.leagueProgress[key]) {
      normalized.leagueProgress[key] = { wins: 0, racesCompleted: 0 };
    }
  }

  normalized.schemaVersion = SCHEMA_VERSION;
  normalized.pityCounter = Math.max(0, normalized.pityCounter ?? 0);
  normalized.victoriesWithoutBox = Math.max(0, normalized.victoriesWithoutBox ?? 0);

  return normalized;
}
