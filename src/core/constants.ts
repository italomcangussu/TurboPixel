import type { CosmeticRarity, UpgradeType } from '../types';

export const SCHEMA_VERSION = 2;

export const STORAGE_KEY = 'turbopixel_save_v1';
export const STORAGE_BACKUP_KEY = 'turbopixel_save_backup_v1';
export const ENABLE_REMOTE_BACKEND_SYNC = import.meta.env.VITE_ENABLE_REMOTE_BACKEND_SYNC === 'true';
export const BACKEND_PROVIDER = import.meta.env.VITE_BACKEND_PROVIDER === 'supabase' ? 'supabase' : 'local';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const LOCAL_PLAYER_ID = 'local-player';
export const LOCAL_DEVICE_ID = 'web-default-device';
export const RUNTIME_PLAYER_ID = import.meta.env.VITE_PLAYER_ID ?? LOCAL_PLAYER_ID;
export const RUNTIME_DEVICE_ID = import.meta.env.VITE_DEVICE_ID ?? LOCAL_DEVICE_ID;

export const RACE_DISTANCE_METERS = 400;
export const GREEN_LIGHT_AT_MS = 3000;
export const PERFECT_WINDOW_MS = 120;
export const GOOD_WINDOW_MS = 300;
export const SHIFT_DEBOUNCE_MS = 120;

export const PERFECT_BUFF_TORQUE_MULTIPLIER = 1.1;
export const PERFECT_BUFF_DURATION_MS = 1000;
export const MISS_DEBUFF_TORQUE_MULTIPLIER = 0.85;
export const MISS_DEBUFF_DURATION_MS = 1200;
export const OVERREV_THRESHOLD_RATIO = 0.98;
export const OVERREV_TRIGGER_MS = 500;
export const OVERREV_DEBUFF_TORQUE_MULTIPLIER = 0.92;
export const OVERREV_DEBUFF_DURATION_MS = 1000;

export const LAUNCH_BONUS_WINDOW_MS = 150;
export const LAUNCH_BONUS_MULTIPLIER = 1.06;
export const LAUNCH_BONUS_DURATION_MS = 800;
export const FALSE_START_PENALTY_MS = 250;

export const REWARD_BASE_BY_LEAGUE: Record<number, number> = {
  1: 150,
  2: 220,
  3: 310,
  4: 430,
  5: 580,
};

export const PERFECT_SHIFT_BONUS_MONEY = 24;
export const LOSS_REWARD_MULTIPLIER = 0.4;

export const LOOT_BOX_CHANCE = 0.45;
export const LOOT_BOX_GUARANTEE_WINS = 3;
export const PITY_THRESHOLD = 20;
export const FULL_COLLECTION_FALLBACK_MONEY = 250;

export const LOOT_RARITY_WEIGHTS: Record<CosmeticRarity, number> = {
  comum: 60,
  rara: 28,
  epica: 10,
  lendaria: 2,
};

export const LOOT_RARITY_ORDER: CosmeticRarity[] = ['comum', 'rara', 'epica', 'lendaria'];

export const UPGRADE_LEVEL_COSTS = [400, 800, 1300, 2000, 3000];

export const MAX_UPGRADE_LEVEL = 5;

export const UPGRADE_ORDER: UpgradeType[] = [
  'motor',
  'cambio',
  'turbo',
  'peso',
  'tracao',
  'aerodinamica',
  'embreagem',
  'ecu',
];

export const UPGRADE_TYPE_COST_MULTIPLIER: Record<UpgradeType, number> = {
  motor: 1.15,
  cambio: 1.0,
  turbo: 1.2,
  peso: 0.95,
  tracao: 1.05,
  aerodinamica: 1.1,
  embreagem: 0.9,
  ecu: 1.25,
};
