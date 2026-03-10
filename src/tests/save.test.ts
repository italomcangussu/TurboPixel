import { loadProfile } from '../core/save';
import { STORAGE_KEY } from '../core/constants';

describe('save migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates legacy v0 profile', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        money: 2222,
        ownedCars: ['vortex-72', 'falcon-rs'],
        selectedCarId: 'falcon-rs',
      }),
    );

    const loaded = loadProfile();

    expect(loaded.profile.schemaVersion).toBe(2);
    expect(loaded.profile.money).toBe(2222);
    expect(loaded.profile.ownedCars).toContain('eu-f500');
    expect(loaded.profile.selectedCarId).toBe('eu-f500');
    expect(loaded.profile.leagueProgress['1']).toBeDefined();
  });

  it('migrates schema v1 profile and preserves old upgrade levels', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        money: 3300,
        ownedCars: ['vortex-72'],
        selectedCarId: 'vortex-72',
        ownedCosmetics: [],
        equippedCosmeticsByCar: { 'vortex-72': {} },
        upgradesByCar: {
          'vortex-72': {
            motor: 2,
            cambio: 1,
            turbo: 0,
            peso: 3,
          },
        },
        leagueProgress: { '1': { wins: 1, racesCompleted: 1 } },
        pityCounter: 0,
        victoriesWithoutBox: 0,
      }),
    );

    const loaded = loadProfile();

    expect(loaded.profile.schemaVersion).toBe(2);
    expect(loaded.profile.ownedCars).toContain('jdm-supra');
    expect(loaded.profile.selectedCarId).toBe('jdm-supra');
    expect(loaded.profile.upgradesByCar['jdm-supra'].motor).toBe(2);
    expect(loaded.profile.upgradesByCar['jdm-supra'].tracao).toBe(0);
    expect(loaded.profile.equippedUpgradesByCar['jdm-supra'].motor).toBe(true);
    expect(loaded.profile.equippedUpgradesByCar['jdm-supra'].cambio).toBe(true);
    expect(loaded.profile.equippedUpgradesByCar['jdm-supra'].turbo).toBe(false);
    expect(loaded.profile.equippedUpgradesByCar['jdm-supra'].tracao).toBe(false);
  });

  it('normalizes legacy car ids even when schema is already v2', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        money: 2500,
        ownedCars: ['vortex-72', 'pulse-rx'],
        selectedCarId: 'pulse-rx',
        ownedCosmetics: [],
        equippedCosmeticsByCar: { 'pulse-rx': {} },
        upgradesByCar: {
          'pulse-rx': {
            motor: 1,
            cambio: 0,
            turbo: 0,
            peso: 0,
            tracao: 0,
            aerodinamica: 0,
            embreagem: 0,
            ecu: 0,
          },
        },
        equippedUpgradesByCar: {
          'pulse-rx': {
            motor: true,
            cambio: false,
            turbo: false,
            peso: false,
            tracao: false,
            aerodinamica: false,
            embreagem: false,
            ecu: false,
          },
        },
        leagueProgress: {
          '1': { wins: 0, racesCompleted: 0 },
          '2': { wins: 0, racesCompleted: 0 },
          '3': { wins: 0, racesCompleted: 0 },
          '4': { wins: 0, racesCompleted: 0 },
          '5': { wins: 0, racesCompleted: 0 },
        },
        pityCounter: 0,
        victoriesWithoutBox: 0,
      }),
    );

    const loaded = loadProfile();

    expect(loaded.profile.ownedCars).toEqual(expect.arrayContaining(['jdm-supra', 'dg-rail']));
    expect(loaded.profile.selectedCarId).toBe('dg-rail');
    expect(loaded.profile.upgradesByCar['dg-rail'].motor).toBe(1);
    expect(loaded.profile.equippedUpgradesByCar['dg-rail'].motor).toBe(true);
  });
});
