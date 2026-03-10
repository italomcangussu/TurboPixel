import { SCHEMA_VERSION, STORAGE_BACKUP_KEY, STORAGE_KEY } from './constants';
import { createDefaultProfile, ensureProfileShape } from './profile';
import type { PlayerProfile } from '../types';

function migrateProfile(data: unknown): PlayerProfile {
  if (!data || typeof data !== 'object') {
    throw new Error('invalid-profile');
  }

  const candidate = data as Partial<PlayerProfile>;
  if (candidate.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('unsupported-schema');
  }

  return ensureProfileShape(candidate as PlayerProfile);
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
