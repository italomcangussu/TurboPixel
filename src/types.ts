export type CarEra = '90s' | '00s' | '10s';
export type CosmeticCategory = 'spoiler' | 'rodas' | 'bodykit' | 'pintura';
export type CosmeticRarity = 'comum' | 'rara' | 'epica' | 'lendaria';
export type UpgradeType = 'motor' | 'cambio' | 'turbo' | 'peso' | 'tracao' | 'aerodinamica' | 'embreagem' | 'ecu';

export interface CarSpec {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  yearLabel: string;
  garageTag: string;
  era: CarEra;
  archetype: 'sport';
  tier: number;
  baseTorque: number;
  redlineRpm: number;
  gearRatios: [number, number, number, number, number, number];
  price: number;
  unlockLeague: number;
  color: number;
  accentColor: number;
  headlightTint: number;
  taillightTint: number;
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
  skyTopColor: number;
  skyBottomColor: number;
  asphaltColor: number;
  rubberColor: number;
  laneStripeColor: number;
  barrierPrimary: number;
  barrierAccent: number;
  lightAccent: number;
  environment: 'forest' | 'industrial' | 'airfield';
  timeOfDay: 'day' | 'sunset' | 'dusk';
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
  trackId: string | null;
  phase: 'countdown' | 'racing' | 'finished' | null;
  countdownLights: number;
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
