import {
  LOOT_BOX_CHANCE,
  LOOT_BOX_GUARANTEE_WINS,
  LOSS_REWARD_MULTIPLIER,
  PERFECT_SHIFT_BONUS_MONEY,
  REWARD_BASE_BY_LEAGUE,
} from './constants';
import type { PlayerProfile } from '../types';

export interface EconomyOutcome {
  moneyEarned: number;
  lootBoxGranted: boolean;
  updatedProfile: PlayerProfile;
}

export interface RandomSource {
  next: () => number;
}

export function calculateMoneyReward(
  league: number,
  winner: 'player' | 'ai',
  perfectShifts: number,
): number {
  const base = REWARD_BASE_BY_LEAGUE[league] ?? REWARD_BASE_BY_LEAGUE[1];
  if (winner === 'player') {
    return base + perfectShifts * PERFECT_SHIFT_BONUS_MONEY;
  }
  return Math.round(base * LOSS_REWARD_MULTIPLIER);
}

export function shouldGrantLootBox(profile: PlayerProfile, random: RandomSource): boolean {
  if (profile.victoriesWithoutBox >= LOOT_BOX_GUARANTEE_WINS - 1) {
    return true;
  }
  return random.next() < LOOT_BOX_CHANCE;
}

export function applyRaceEconomy(
  profile: PlayerProfile,
  params: {
    league: number;
    winner: 'player' | 'ai';
    perfectShifts: number;
    random: RandomSource;
  },
): EconomyOutcome {
  const updated = structuredClone(profile);
  const moneyEarned = calculateMoneyReward(params.league, params.winner, params.perfectShifts);

  updated.money += moneyEarned;

  let lootBoxGranted = false;
  if (params.winner === 'player') {
    lootBoxGranted = shouldGrantLootBox(updated, params.random);
    if (lootBoxGranted) {
      updated.victoriesWithoutBox = 0;
    } else {
      updated.victoriesWithoutBox += 1;
    }
  }

  const progressKey = String(params.league);
  const progress = updated.leagueProgress[progressKey] ?? { wins: 0, racesCompleted: 0 };
  progress.racesCompleted = Math.min(6, progress.racesCompleted + 1);
  if (params.winner === 'player') {
    progress.wins += 1;
  }
  updated.leagueProgress[progressKey] = progress;

  return {
    moneyEarned,
    lootBoxGranted,
    updatedProfile: updated,
  };
}
