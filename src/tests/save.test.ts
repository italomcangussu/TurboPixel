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

    expect(loaded.profile.schemaVersion).toBe(1);
    expect(loaded.profile.money).toBe(2222);
    expect(loaded.profile.ownedCars).toContain('falcon-rs');
    expect(loaded.profile.selectedCarId).toBe('falcon-rs');
    expect(loaded.profile.leagueProgress['1']).toBeDefined();
  });
});
