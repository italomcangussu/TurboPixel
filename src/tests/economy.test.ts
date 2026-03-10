import { applyRaceEconomy, calculateMoneyReward } from '../core/economy';
import { createDefaultProfile } from '../core/profile';

describe('economy', () => {
  it('calculates money reward for win/loss', () => {
    expect(calculateMoneyReward(1, 'player', 2)).toBe(160);
    expect(calculateMoneyReward(5, 'player', 0)).toBe(500);
    expect(calculateMoneyReward(2, 'ai', 4)).toBe(63);
  });

  it('guarantees loot box after third win without drop', () => {
    const profile = createDefaultProfile();

    const noDropA = applyRaceEconomy(profile, {
      league: 1,
      winner: 'player',
      perfectShifts: 0,
      random: { next: () => 0.99 },
    });
    expect(noDropA.lootBoxGranted).toBe(false);
    expect(noDropA.updatedProfile.victoriesWithoutBox).toBe(1);

    const noDropB = applyRaceEconomy(noDropA.updatedProfile, {
      league: 1,
      winner: 'player',
      perfectShifts: 0,
      random: { next: () => 0.99 },
    });
    expect(noDropB.lootBoxGranted).toBe(false);
    expect(noDropB.updatedProfile.victoriesWithoutBox).toBe(2);

    const guaranteed = applyRaceEconomy(noDropB.updatedProfile, {
      league: 1,
      winner: 'player',
      perfectShifts: 0,
      random: { next: () => 0.99 },
    });
    expect(guaranteed.lootBoxGranted).toBe(true);
    expect(guaranteed.updatedProfile.victoriesWithoutBox).toBe(0);
  });
});
