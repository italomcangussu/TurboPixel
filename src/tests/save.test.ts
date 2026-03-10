import { loadProfile, saveProfile } from '../core/save';
import { SCHEMA_VERSION, STORAGE_BACKUP_KEY, STORAGE_KEY } from '../core/constants';
import { createDefaultProfile } from '../core/profile';

describe('save reboot v3', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a fresh v3 profile when storage is empty', () => {
    const loaded = loadProfile();

    expect(loaded.recoveredFromBackup).toBe(false);
    expect(loaded.profile.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.profile.ownedCars).toEqual(['supra-a80']);
    expect(loaded.profile.selectedCarId).toBe('supra-a80');
  });

  it('loads a valid schema v3 profile from primary storage', () => {
    const profile = createDefaultProfile();
    profile.money = 3450;
    profile.ownedCars.push('rx7-fd');
    profile.selectedCarId = 'rx7-fd';
    profile.upgradesByCar['rx7-fd'] = {
      motor: 2,
      cambio: 1,
      turbo: 0,
      peso: 0,
      tracao: 0,
      aerodinamica: 0,
      embreagem: 0,
      ecu: 0,
    };
    saveProfile(profile);

    const loaded = loadProfile();

    expect(loaded.recoveredFromBackup).toBe(false);
    expect(loaded.profile.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.profile.money).toBe(3450);
    expect(loaded.profile.ownedCars).toEqual(['supra-a80', 'rx7-fd']);
    expect(loaded.profile.selectedCarId).toBe('rx7-fd');
    expect(loaded.profile.upgradesByCar['rx7-fd'].motor).toBe(2);
  });

  it('resets unsupported old schema data to a fresh v3 profile', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        money: 99999,
        ownedCars: ['jdm-supra', 'dg-rail'],
        selectedCarId: 'dg-rail',
      }),
    );

    const loaded = loadProfile();

    expect(loaded.recoveredFromBackup).toBe(true);
    expect(loaded.profile.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.profile.ownedCars).toEqual(['supra-a80']);
    expect(loaded.profile.selectedCarId).toBe('supra-a80');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('supra-a80');
  });

  it('recovers from a valid backup when primary storage is corrupted', () => {
    const backup = createDefaultProfile();
    backup.money = 2222;
    localStorage.setItem(STORAGE_KEY, '{broken');
    localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify(backup));

    const loaded = loadProfile();

    expect(loaded.recoveredFromBackup).toBe(true);
    expect(loaded.profile.money).toBe(2222);
    expect(loaded.profile.schemaVersion).toBe(SCHEMA_VERSION);
  });
});
