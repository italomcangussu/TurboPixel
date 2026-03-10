import { MAX_UPGRADE_LEVEL, UPGRADE_LEVEL_COSTS, UPGRADE_ORDER, UPGRADE_TYPE_COST_MULTIPLIER } from './constants';
import type { UpgradeEquipped, UpgradeLevels, UpgradeType } from '../types';

export function createEmptyUpgrades(): UpgradeLevels {
  return {
    motor: 0,
    cambio: 0,
    turbo: 0,
    peso: 0,
    tracao: 0,
    aerodinamica: 0,
    embreagem: 0,
    ecu: 0,
  };
}

export function createDefaultUpgradeEquipped(): UpgradeEquipped {
  return {
    motor: false,
    cambio: false,
    turbo: false,
    peso: false,
    tracao: false,
    aerodinamica: false,
    embreagem: false,
    ecu: false,
  };
}

export function clampUpgradeLevel(level: number): number {
  return Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(level)));
}

export function getUpgradeCost(currentLevel: number, type: UpgradeType): number | null {
  if (currentLevel < 0 || currentLevel >= UPGRADE_LEVEL_COSTS.length) {
    return null;
  }
  const base = UPGRADE_LEVEL_COSTS[currentLevel];
  return Math.round(base * UPGRADE_TYPE_COST_MULTIPLIER[type]);
}

export function nextUpgradeLevel(levels: UpgradeLevels, type: UpgradeType): UpgradeLevels {
  return {
    ...levels,
    [type]: clampUpgradeLevel(levels[type] + 1),
  };
}

export function withToggledEquip(equipped: UpgradeEquipped, type: UpgradeType): UpgradeEquipped {
  return {
    ...equipped,
    [type]: !equipped[type],
  };
}

export function getActiveUpgradeLevels(levels: UpgradeLevels, equipped: UpgradeEquipped): UpgradeLevels {
  const active = createEmptyUpgrades();
  for (const type of UPGRADE_ORDER) {
    active[type] = equipped[type] ? levels[type] : 0;
  }
  return active;
}

export function getTorqueMultiplier(levels: UpgradeLevels, gear: number): number {
  const motorBoost = 1 + levels.motor * 0.03;
  const turboBoost = gear >= 3 ? 1 + levels.turbo * 0.03 : 1;
  const weightBoost = 1 + levels.peso * 0.02;
  return motorBoost * turboBoost * weightBoost;
}

export function getShiftWindowBonusMs(levels: UpgradeLevels): number {
  return levels.cambio * 10;
}

export function getShiftLagReduction(levels: UpgradeLevels): number {
  return levels.cambio * 0.02;
}

export function getLaunchBonusMultiplier(levels: UpgradeLevels): number {
  return 1 + levels.tracao * 0.01;
}

export function getFalseStartPenaltyReduction(levels: UpgradeLevels): number {
  return levels.tracao * 0.08;
}

export function getDragReduction(levels: UpgradeLevels): number {
  return levels.aerodinamica * 0.02;
}

export function getShiftDebounceReductionMs(levels: UpgradeLevels): number {
  return levels.embreagem * 8;
}

export function getRedlineMultiplier(levels: UpgradeLevels): number {
  return 1 + levels.ecu * 0.015;
}

export function getOverRevToleranceBonusMs(levels: UpgradeLevels): number {
  return levels.ecu * 20;
}
