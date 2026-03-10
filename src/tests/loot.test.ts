import { openLootBox, rollLootRarity } from '../core/loot';
import { createDefaultProfile } from '../core/profile';
import { COSMETICS } from '../data/cosmetics';

describe('loot box', () => {
  it('applies pity to epic after threshold', () => {
    const rarity = rollLootRarity(20, {
      next: () => 0,
      nextInt: () => 0,
    });

    expect(rarity).toBe('epica');
  });

  it('never returns duplicate when new item exists', () => {
    const profile = createDefaultProfile();
    const commonItems = COSMETICS.filter((item) => item.rarity === 'comum');
    const firstItem = commonItems[0];

    profile.ownedCosmetics = [firstItem.id];

    const opened = openLootBox(profile, COSMETICS, {
      next: () => 0.01,
      nextInt: () => 0,
    });

    expect(opened.result.isDuplicate).toBe(false);
    expect(opened.result.itemId).not.toBe(firstItem.id);
  });
});
