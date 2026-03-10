import { createProfileSyncEnvelope } from '../backend/adapter';
import type { SyncState } from '../backend/contracts';
import { backendAdapter } from '../backend/runtime';
import { CARS, CAR_MAP } from '../data/cars';
import { COSMETIC_MAP, COSMETICS } from '../data/cosmetics';
import { LEAGUES, RACES_PER_LEAGUE } from '../data/leagues';
import { TRACKS } from '../data/tracks';
import { applyRaceEconomy } from '../core/economy';
import { RUNTIME_DEVICE_ID, RUNTIME_PLAYER_ID } from '../core/constants';
import { openLootBox } from '../core/loot';
import { SeededRng } from '../core/random';
import { loadProfile, saveProfile } from '../core/save';
import {
  createDefaultUpgradeEquipped,
  createEmptyUpgrades,
  getActiveUpgradeLevels,
  getUpgradeCost,
  nextUpgradeLevel,
  withToggledEquip,
} from '../core/upgrades';
import type {
  CarSpec,
  CosmeticCategory,
  CosmeticItem,
  LeagueSpec,
  LootBoxResult,
  PlayerProfile,
  RaceConfig,
  RaceResult,
  UpgradeLevels,
  UpgradeType,
} from '../types';

export type SceneMode =
  | 'boot'
  | 'menu'
  | 'garage'
  | 'customization'
  | 'upgrades'
  | 'league'
  | 'race'
  | 'result'
  | 'rewards';

class GameStore {
  private profileData: PlayerProfile;

  private profileRevision = 0;

  private pendingRaceConfig: RaceConfig | null = null;

  private latestRaceResultData: RaceResult | null = null;

  private pendingLootBox = false;

  private latestLootBoxData: LootBoxResult | null = null;

  private recoveredFromBackup = false;

  private modeData: SceneMode = 'boot';

  constructor() {
    const loaded = loadProfile();
    this.profileData = loaded.profile;
    this.recoveredFromBackup = loaded.recoveredFromBackup;
  }

  get mode(): SceneMode {
    return this.modeData;
  }

  set mode(value: SceneMode) {
    this.modeData = value;
  }

  wasRecoveredFromBackup(): boolean {
    return this.recoveredFromBackup;
  }

  syncState(): SyncState {
    return backendAdapter.getSyncState();
  }

  profile(): PlayerProfile {
    return this.profileData;
  }

  selectedCar(): CarSpec {
    return CAR_MAP.get(this.profileData.selectedCarId) ?? CARS[0];
  }

  allCars(): CarSpec[] {
    return CARS;
  }

  allCosmetics(): CosmeticItem[] {
    return COSMETICS;
  }

  latestRaceResult(): RaceResult | null {
    return this.latestRaceResultData;
  }

  latestLootBox(): LootBoxResult | null {
    return this.latestLootBoxData;
  }

  hasPendingLootBox(): boolean {
    return this.pendingLootBox;
  }

  getLeague(leagueId: number): LeagueSpec {
    return LEAGUES.find((league) => league.id === leagueId) ?? LEAGUES[0];
  }

  canAccessLeague(leagueId: number): boolean {
    if (leagueId === 1) {
      return true;
    }

    const previousKey = String(leagueId - 1);
    const previous = this.profileData.leagueProgress[previousKey];
    return (previous?.racesCompleted ?? 0) >= RACES_PER_LEAGUE;
  }

  buyCar(carId: string): { ok: boolean; reason?: string } {
    const car = CAR_MAP.get(carId);
    if (!car) {
      return { ok: false, reason: 'Carro nao encontrado' };
    }

    if (this.profileData.ownedCars.includes(carId)) {
      return { ok: false, reason: 'Carro ja comprado' };
    }

    if (!this.canAccessLeague(car.unlockLeague)) {
      return { ok: false, reason: 'Liga bloqueada para este carro' };
    }

    if (this.profileData.money < car.price) {
      return { ok: false, reason: 'Dinheiro insuficiente' };
    }

    this.profileData.money -= car.price;
    this.profileData.ownedCars.push(carId);
    this.profileData.upgradesByCar[carId] = createEmptyUpgrades();
    this.profileData.equippedUpgradesByCar[carId] = createDefaultUpgradeEquipped();
    this.profileData.equippedCosmeticsByCar[carId] = {};
    this.persist();

    return { ok: true };
  }

  selectCar(carId: string): { ok: boolean; reason?: string } {
    if (!this.profileData.ownedCars.includes(carId)) {
      return { ok: false, reason: 'Carro nao possuido' };
    }

    this.profileData.selectedCarId = carId;
    this.persist();
    return { ok: true };
  }

  buyUpgrade(type: UpgradeType): { ok: boolean; reason?: string; nextLevel?: number } {
    const selected = this.profileData.selectedCarId;
    if (!this.profileData.upgradesByCar[selected]) {
      this.profileData.upgradesByCar[selected] = createEmptyUpgrades();
    }
    if (!this.profileData.equippedUpgradesByCar[selected]) {
      this.profileData.equippedUpgradesByCar[selected] = createDefaultUpgradeEquipped();
    }

    const levels = this.profileData.upgradesByCar[selected];
    const cost = getUpgradeCost(levels[type], type);
    if (cost === null) {
      return { ok: false, reason: 'Upgrade maximo' };
    }

    if (this.profileData.money < cost) {
      return { ok: false, reason: 'Dinheiro insuficiente' };
    }

    this.profileData.money -= cost;
    this.profileData.upgradesByCar[selected] = nextUpgradeLevel(levels, type);
    this.profileData.equippedUpgradesByCar[selected][type] = true;
    this.persist();

    return {
      ok: true,
      nextLevel: this.profileData.upgradesByCar[selected][type],
    };
  }

  toggleUpgradeEquip(type: UpgradeType): { ok: boolean; reason?: string; equipped?: boolean } {
    const selected = this.profileData.selectedCarId;
    if (!this.profileData.upgradesByCar[selected]) {
      this.profileData.upgradesByCar[selected] = createEmptyUpgrades();
    }
    if (!this.profileData.equippedUpgradesByCar[selected]) {
      this.profileData.equippedUpgradesByCar[selected] = createDefaultUpgradeEquipped();
    }

    const levels = this.profileData.upgradesByCar[selected];
    if (levels[type] <= 0) {
      return { ok: false, reason: 'Compre ao menos nivel 1 para equipar' };
    }

    const current = this.profileData.equippedUpgradesByCar[selected];
    const next = withToggledEquip(current, type);
    this.profileData.equippedUpgradesByCar[selected] = next;
    this.persist();
    return { ok: true, equipped: next[type] };
  }

  selectedCarUpgradeLevels(): UpgradeLevels {
    const selected = this.profileData.selectedCarId;
    if (!this.profileData.upgradesByCar[selected]) {
      this.profileData.upgradesByCar[selected] = createEmptyUpgrades();
    }
    return this.profileData.upgradesByCar[selected];
  }

  selectedCarUpgradeEquipped(): Record<UpgradeType, boolean> {
    const selected = this.profileData.selectedCarId;
    if (!this.profileData.equippedUpgradesByCar[selected]) {
      this.profileData.equippedUpgradesByCar[selected] = createDefaultUpgradeEquipped();
    }
    return this.profileData.equippedUpgradesByCar[selected];
  }

  selectedCarActiveUpgrades(): UpgradeLevels {
    return getActiveUpgradeLevels(this.selectedCarUpgradeLevels(), this.selectedCarUpgradeEquipped());
  }

  listCosmeticsForCategory(category: CosmeticCategory): CosmeticItem[] {
    return COSMETICS.filter((item) => item.category === category);
  }

  isCosmeticOwned(itemId: string): boolean {
    return this.profileData.ownedCosmetics.includes(itemId);
  }

  equippedItem(carId: string, category: CosmeticCategory): string | null {
    return this.profileData.equippedCosmeticsByCar[carId]?.[category] ?? null;
  }

  equipCosmetic(itemId: string): { ok: boolean; reason?: string } {
    if (!this.profileData.ownedCosmetics.includes(itemId)) {
      return { ok: false, reason: 'Item nao desbloqueado' };
    }

    const item = COSMETIC_MAP.get(itemId);
    if (!item) {
      return { ok: false, reason: 'Item invalido' };
    }

    const carId = this.profileData.selectedCarId;
    if (!this.profileData.equippedCosmeticsByCar[carId]) {
      this.profileData.equippedCosmeticsByCar[carId] = {};
    }

    this.profileData.equippedCosmeticsByCar[carId][item.category] = itemId;
    this.persist();
    return { ok: true };
  }

  createRaceConfig(league: number, raceNumber: number): RaceConfig {
    const track = TRACKS[(raceNumber - 1) % TRACKS.length];
    const racePool = CARS.filter((car) => car.unlockLeague <= league + 1);
    const aiCar = racePool[(raceNumber + league * 3) % racePool.length];
    return {
      league,
      raceNumber,
      trackId: track.id,
      playerCarId: this.profileData.selectedCarId,
      aiCarId: aiCar.id,
      seed: league * 1000 + raceNumber * 77,
    };
  }

  setPendingRace(config: RaceConfig): void {
    this.pendingRaceConfig = config;
  }

  pendingRace(): RaceConfig | null {
    return this.pendingRaceConfig;
  }

  clearPendingRace(): void {
    this.pendingRaceConfig = null;
  }

  applyRaceOutcome(base: {
    league: number;
    winner: 'player' | 'ai';
    playerTimeMs: number;
    aiTimeMs: number;
    perfectShifts: number;
    falseStartPenaltyMs: number;
    raceSeed: number;
  }): RaceResult {
    const rng = new SeededRng(base.raceSeed + this.profileData.money + this.profileData.pityCounter * 13);
    const economy = applyRaceEconomy(this.profileData, {
      league: base.league,
      winner: base.winner,
      perfectShifts: base.perfectShifts,
      random: rng,
    });

    this.profileData = economy.updatedProfile;
    this.pendingLootBox = economy.lootBoxGranted;

    const result: RaceResult = {
      winner: base.winner,
      playerTimeMs: base.playerTimeMs,
      aiTimeMs: base.aiTimeMs,
      perfectShifts: base.perfectShifts,
      moneyEarned: economy.moneyEarned,
      lootBoxGranted: economy.lootBoxGranted,
      falseStartPenaltyMs: base.falseStartPenaltyMs,
    };

    this.latestRaceResultData = result;
    this.persist();
    return result;
  }

  openPendingLootBox(): LootBoxResult | null {
    if (!this.pendingLootBox) {
      this.latestLootBoxData = null;
      return null;
    }

    const seed =
      this.profileData.money +
      this.profileData.ownedCosmetics.length * 37 +
      this.profileData.pityCounter * 53 +
      this.profileData.victoriesWithoutBox * 17;

    const rng = new SeededRng(seed);
    const opened = openLootBox(this.profileData, COSMETICS, rng);
    this.profileData = opened.profile;
    this.latestLootBoxData = opened.result;
    this.pendingLootBox = false;
    this.persist();
    return opened.result;
  }

  resetProfile(): void {
    localStorage.removeItem('turbopixel_save_v1');
    localStorage.removeItem('turbopixel_save_backup_v1');
    const loaded = loadProfile();
    this.profileData = loaded.profile;
    this.pendingRaceConfig = null;
    this.latestRaceResultData = null;
    this.pendingLootBox = false;
    this.latestLootBoxData = null;
    this.recoveredFromBackup = false;
    this.profileRevision = 0;
  }

  private persist(): void {
    this.profileRevision += 1;
    saveProfile(this.profileData);
    const envelope = createProfileSyncEnvelope({
      playerId: RUNTIME_PLAYER_ID,
      deviceId: RUNTIME_DEVICE_ID,
      revision: this.profileRevision,
      profile: this.profileData,
      syncState: 'queued_sync',
    });
    void backendAdapter
      .queueProfileSync(envelope)
      .then((state) => {
        if (state === 'queued_sync' && backendAdapter.isRemoteEnabled()) {
          return backendAdapter.flushProfileSync(RUNTIME_PLAYER_ID).then(() => undefined);
        }
        return undefined;
      })
      .catch(() => undefined);
  }
}

export const gameStore = new GameStore();
