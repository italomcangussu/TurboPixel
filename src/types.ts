export type CarEra = 'esportivo' | 'retro' | 'truck' | '90s' | '00s' | '80s' | '70s' | '60s' | '10s' | 'classic' | 'modern';
export type CosmeticCategory = 'spoiler' | 'rodas' | 'bodykit' | 'pintura';
export type CosmeticRarity = 'comum' | 'rara' | 'epica' | 'lendaria';
export type UpgradeType = 'motor' | 'cambio' | 'turbo' | 'peso' | 'tracao' | 'aerodinamica' | 'embreagem' | 'ecu';

export interface CarSpec {
  id: string;
  name: string;
  era: CarEra;
  archetype: 'sport' | 'retro' | 'truck' | 'jdm' | 'retro_compact' | 'dragster';
  tier: number;
  baseTorque: number;
  redlineRpm: number;
  gearRatios: [number, number, number, number, number, number];
  price: number;
  unlockLeague: number;
  color: number;
  spriteKey: string;
  weightKg: number;
  dragCoef: number;
  tractionBias: number;
}

export interface CosmeticItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  rarity: CosmeticRarity;
  carCompatibility: string[];
  visualRef: string;
  color: number;
}

export interface UpgradeLevels {
  motor: number;
  cambio: number;
  turbo: number;
  peso: number;
  tracao: number;
  aerodinamica: number;
  embreagem: number;
  ecu: number;
}

export type UpgradeEquipped = Record<UpgradeType, boolean>;

export interface LeagueProgress {
  wins: number;
  racesCompleted: number;
}

export interface PlayerProfile {
  schemaVersion: number;
  money: number;
  ownedCars: string[];
  selectedCarId: string;
  ownedCosmetics: string[];
  equippedCosmeticsByCar: Record<string, Partial<Record<CosmeticCategory, string>>>;
  upgradesByCar: Record<string, UpgradeLevels>;
  equippedUpgradesByCar: Record<string, UpgradeEquipped>;
  leagueProgress: Record<string, LeagueProgress>;
  pityCounter: number;
  victoriesWithoutBox: number;
}

export interface RaceConfig {
  league: number;
  raceNumber: number;
  trackId: string;
  playerCarId: string;
  aiCarId: string;
  seed: number;
}

export interface RaceResult {
  winner: 'player' | 'ai';
  playerTimeMs: number;
  aiTimeMs: number;
  perfectShifts: number;
  moneyEarned: number;
  lootBoxGranted: boolean;
  falseStartPenaltyMs: number;
}

export interface LootBoxResult {
  rarity: CosmeticRarity;
  itemId: string;
  isDuplicate: false;
  fallbackMoney?: number;
}

export interface TrackSpec {
  id: string;
  name: string;
  horizonColor: number;
  roadColor: number;
  accentColor: number;
}

export interface LeagueSpec {
  id: number;
  name: string;
  aiReactionMs: number;
  aiError: 'high' | 'medium' | 'good' | 'perfect' | 'elite';
  entryRequirementLeague: number;
}

export interface RaceTextState {
  coordinateSystem: string;
  mode: string;
  league: number | null;
  raceNumber: number | null;
  player: {
    carId: string | null;
    gear: number;
    rpm: number;
    distanceM: number;
    speedMps: number;
    launched: boolean;
  };
  ai: {
    carId: string | null;
    gear: number;
    rpm: number;
    distanceM: number;
    speedMps: number;
    launched: boolean;
  };
  timerMs: number;
  money: number;
  result: RaceResult | null;
}
