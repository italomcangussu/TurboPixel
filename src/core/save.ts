import { SCHEMA_VERSION, STORAGE_BACKUP_KEY, STORAGE_KEY } from './constants';
import { createDefaultProfile, ensureProfileShape } from './profile';
import { createDefaultUpgradeEquipped } from './upgrades';
import type { PlayerProfile } from '../types';

interface LegacyProfileV0 {
  money: number;
  ownedCars: string[];
  selectedCarId: string;
}

interface LegacyProfileV1 extends Omit<PlayerProfile, 'schemaVersion' | 'equippedUpgradesByCar'> {
  schemaVersion: 1;
}

function isLegacyV0(input: unknown): input is LegacyProfileV0 {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const candidate = input as LegacyProfileV0;
  return (
    typeof candidate.money === 'number' &&
    Array.isArray(candidate.ownedCars) &&
    typeof candidate.selectedCarId === 'string'
  );
}

function migrateProfile(data: unknown): PlayerProfile {
  if (!data || typeof data !== 'object') {
    throw new Error('invalid-profile');
  }

  const candidate = data as Partial<PlayerProfile>;
  if (candidate.schemaVersion === SCHEMA_VERSION) {
    return ensureProfileShape(candidate as PlayerProfile);
  }

  if (candidate.schemaVersion === 1) {
    const legacy = candidate as LegacyProfileV1;
    const upgraded = ensureProfileShape({
      ...legacy,
      schemaVersion: SCHEMA_VERSION,
      equippedUpgradesByCar: {},
    } as PlayerProfile);

    for (const carId of upgraded.ownedCars) {
      const levels = upgraded.upgradesByCar[carId] ?? {
        motor: 0,
        cambio: 0,
        turbo: 0,
        peso: 0,
        tracao: 0,
        aerodinamica: 0,
        embreagem: 0,
        ecu: 0,
      };
      const equipped = createDefaultUpgradeEquipped();
      equipped.motor = levels.motor > 0;
      equipped.cambio = levels.cambio > 0;
      equipped.turbo = levels.turbo > 0;
      equipped.peso = levels.peso > 0;
      upgraded.equippedUpgradesByCar[carId] = equipped;
    }

    upgraded.schemaVersion = SCHEMA_VERSION;
    return upgraded;
  }

  if (candidate.schemaVersion === undefined && isLegacyV0(data)) {
    const migrated = createDefaultProfile();
    migrated.money = data.money;
    migrated.ownedCars = [...new Set(data.ownedCars)];
    migrated.selectedCarId = data.selectedCarId;
    return ensureProfileShape(migrated);
  }

  throw new Error('unsupported-schema');
}

function safeParse(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}

export function saveProfile(profile: PlayerProfile): void {
  const payload = JSON.stringify(profile);
  localStorage.setItem(STORAGE_BACKUP_KEY, localStorage.getItem(STORAGE_KEY) ?? payload);
  localStorage.setItem(STORAGE_KEY, payload);
}

export function loadProfile(): { profile: PlayerProfile; recoveredFromBackup: boolean } {
  const primary = localStorage.getItem(STORAGE_KEY);

  if (!primary) {
    const profile = createDefaultProfile();
    saveProfile(profile);
    return { profile, recoveredFromBackup: false };
  }

  try {
    const profile = migrateProfile(safeParse(primary));
    return { profile, recoveredFromBackup: false };
  } catch {
    const backup = localStorage.getItem(STORAGE_BACKUP_KEY);
    if (backup) {
      try {
        const profile = migrateProfile(safeParse(backup));
        saveProfile(profile);
        return { profile, recoveredFromBackup: true };
      } catch {
        // fall through and reset
      }
    }

    const resetProfile = createDefaultProfile();
    saveProfile(resetProfile);
    return { profile: resetProfile, recoveredFromBackup: true };
  }
}
