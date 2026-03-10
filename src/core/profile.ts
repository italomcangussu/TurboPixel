import { CAR_MAP, CARS } from '../data/cars';
import { LEAGUES } from '../data/leagues';
import { SCHEMA_VERSION } from './constants';
import { createDefaultUpgradeEquipped, createEmptyUpgrades } from './upgrades';
import type { PlayerProfile } from '../types';

const LEGACY_CAR_ID_MAP: Record<string, string> = {
  // Old v0 -> modern JDM
  'vortex-72': 'jdm-supra',
  'falcon-rs': 'eu-f500',
  'aurora-gt': 'eu-f147',
  'ember-v12': 'jdm-sky-r34',
  'monarch-x': 'jdm-rx',
  'retro-blaze': 'eu-mini',
  'nova-r': 'jdm-evo',
  'zenith-s': 'jdm-ns',
  'orion-z': 'jdm-s2k',
  'pulse-rx': 'dg-rail',
  'specter-gtx': 'dg-funny',
  'hyperion-r': 'dg-outlaw',

  // Old v1 -> modern JDM
  'bolt-sprint': 'jdm-supra',
  'neon-comet': 'eu-f500',
  'sunset-cruiser': 'eu-f147',
  'apex-razor': 'jdm-sky-r34',
  'chrome-drifter': 'jdm-rx',
  'route-66': 'eu-mini',
  'nova-burst': 'jdm-evo',
  'pulse-gtx': 'jdm-ns',
  'midnight-heritage': 'jdm-s2k',
  'titan-rig': 'dg-rail',
  'royal-vinyl': 'dg-funny',
  'atlas-truck-r': 'dg-outlaw',
  'viper-lane': 'eu-gof1',
  'iron-hauler': 'dg-supstk',
  'cargo-brawler': 'dg-jet',
  'diesel-thunder': 'dg-awb',
};

function normalizeCarId(carId: string): string | null {
  const mapped = LEGACY_CAR_ID_MAP[carId] ?? carId;
  return CAR_MAP.has(mapped) ? mapped : null;
}

function remapByCarId<T extends object>(source: Record<string, T> | undefined): Record<string, T> {
  if (!source) {
    return {};
  }

  const remapped: Record<string, T> = {};
  for (const [rawId, value] of Object.entries(source)) {
    const normalizedId = normalizeCarId(rawId);
    if (!normalizedId) {
      continue;
    }
    if (!remapped[normalizedId]) {
      remapped[normalizedId] = value;
      continue;
    }
    remapped[normalizedId] = {
      ...remapped[normalizedId],
      ...value,
    } as T;
  }
  return remapped;
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

  normalized.upgradesByCar = remapByCarId(normalized.upgradesByCar);
  normalized.equippedUpgradesByCar = remapByCarId(normalized.equippedUpgradesByCar);
  normalized.equippedCosmeticsByCar = remapByCarId(normalized.equippedCosmeticsByCar);

  const normalizedOwnedCars: string[] = [];
  const seen = new Set<string>();
  for (const rawCarId of normalized.ownedCars ?? []) {
    const mappedId = normalizeCarId(rawCarId);
    if (!mappedId || seen.has(mappedId)) {
      continue;
    }
    seen.add(mappedId);
    normalizedOwnedCars.push(mappedId);
  }

  if (normalizedOwnedCars.length === 0) {
    normalizedOwnedCars.push(starter.id);
  }

  normalized.ownedCars = normalizedOwnedCars;
  const selectedCarId = normalizeCarId(normalized.selectedCarId);
  normalized.selectedCarId = selectedCarId && seen.has(selectedCarId) ? selectedCarId : normalized.ownedCars[0];

  for (const car of normalized.ownedCars) {
    if (!normalized.upgradesByCar[car]) {
      normalized.upgradesByCar[car] = createEmptyUpgrades();
    }
    normalized.upgradesByCar[car] = {
      ...createEmptyUpgrades(),
      ...normalized.upgradesByCar[car],
    };
    if (!normalized.equippedUpgradesByCar) {
      normalized.equippedUpgradesByCar = {};
    }
    if (!normalized.equippedUpgradesByCar[car]) {
      normalized.equippedUpgradesByCar[car] = createDefaultUpgradeEquipped();
    }
    normalized.equippedUpgradesByCar[car] = {
      ...createDefaultUpgradeEquipped(),
      ...normalized.equippedUpgradesByCar[car],
    };
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
