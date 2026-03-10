import {
  FULL_COLLECTION_FALLBACK_MONEY,
  LOOT_RARITY_ORDER,
  LOOT_RARITY_WEIGHTS,
  PITY_THRESHOLD,
} from './constants';
import type { CosmeticItem, CosmeticRarity, LootBoxResult, PlayerProfile } from '../types';

export interface RandomSource {
  next: () => number;
  nextInt: (maxExclusive: number) => number;
}

function weightedRarityRoll(random: RandomSource): CosmeticRarity {
  const totalWeight = Object.values(LOOT_RARITY_WEIGHTS).reduce((sum, value) => sum + value, 0);
  let cursor = random.next() * totalWeight;

  for (const rarity of LOOT_RARITY_ORDER) {
    cursor -= LOOT_RARITY_WEIGHTS[rarity];
    if (cursor <= 0) {
      return rarity;
    }
  }

  return 'comum';
}

export function rollLootRarity(pityCounter: number, random: RandomSource): CosmeticRarity {
  if (pityCounter >= PITY_THRESHOLD) {
    return 'epica';
  }
  return weightedRarityRoll(random);
}

function getUnownedItemsByRarity(
  profile: PlayerProfile,
  cosmetics: CosmeticItem[],
  rarity: CosmeticRarity,
): CosmeticItem[] {
  const owned = new Set(profile.ownedCosmetics);
  return cosmetics.filter((item) => item.rarity === rarity && !owned.has(item.id));
}

function resolveRarityWithFallback(
  profile: PlayerProfile,
  cosmetics: CosmeticItem[],
  rolledRarity: CosmeticRarity,
): { rarity: CosmeticRarity; pool: CosmeticItem[] } | null {
  const startIndex = LOOT_RARITY_ORDER.indexOf(rolledRarity);

  for (let index = startIndex; index < LOOT_RARITY_ORDER.length; index += 1) {
    const rarity = LOOT_RARITY_ORDER[index];
    const pool = getUnownedItemsByRarity(profile, cosmetics, rarity);
    if (pool.length > 0) {
      return { rarity, pool };
    }
  }

  for (let index = 0; index < startIndex; index += 1) {
    const rarity = LOOT_RARITY_ORDER[index];
    const pool = getUnownedItemsByRarity(profile, cosmetics, rarity);
    if (pool.length > 0) {
      return { rarity, pool };
    }
  }

  return null;
}

export function openLootBox(
  profile: PlayerProfile,
  cosmetics: CosmeticItem[],
  random: RandomSource,
): { profile: PlayerProfile; result: LootBoxResult } {
  const updatedProfile = structuredClone(profile);
  const rolledRarity = rollLootRarity(updatedProfile.pityCounter, random);
  const resolved = resolveRarityWithFallback(updatedProfile, cosmetics, rolledRarity);

  if (!resolved) {
    updatedProfile.money += FULL_COLLECTION_FALLBACK_MONEY;
    updatedProfile.pityCounter += 1;

    return {
      profile: updatedProfile,
      result: {
        rarity: rolledRarity,
        itemId: 'fallback_money',
        isDuplicate: false,
        fallbackMoney: FULL_COLLECTION_FALLBACK_MONEY,
      },
    };
  }

  const selectedItem = resolved.pool[random.nextInt(resolved.pool.length)];
  updatedProfile.ownedCosmetics.push(selectedItem.id);

  if (resolved.rarity === 'epica' || resolved.rarity === 'lendaria') {
    updatedProfile.pityCounter = 0;
  } else {
    updatedProfile.pityCounter += 1;
  }

  return {
    profile: updatedProfile,
    result: {
      rarity: resolved.rarity,
      itemId: selectedItem.id,
      isDuplicate: false,
    },
  };
}
