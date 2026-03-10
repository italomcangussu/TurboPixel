import type { BackendAdapter } from './adapter';
import type {
  CloudProfileRecordV1,
  LeaderboardEntryV1,
  SeasonEventStateV1,
  SyncEnvelopeV1,
  SyncState,
} from './contracts';

export interface LocalOnlyBackendAdapterOptions {
  syncEnabled: boolean;
  maxPayloadBytes?: number;
  minWriteIntervalMs?: number;
  now?: () => number;
}

export class LocalOnlyBackendAdapter implements BackendAdapter {
  readonly provider = 'local';

  readonly version = 'v1';

  private syncState: SyncState = 'local_only';

  private readonly pendingProfiles = new Map<string, SyncEnvelopeV1<CloudProfileRecordV1>>();

  private readonly latestProfileRevision = new Map<string, number>();

  private readonly leaderboardBySeason = new Map<string, LeaderboardEntryV1[]>();

  private readonly seasonEventStateByPlayerEvent = new Map<string, SeasonEventStateV1>();

  private readonly lastWriteAtByPlayer = new Map<string, number>();

  private readonly maxPayloadBytes: number;

  private readonly minWriteIntervalMs: number;

  private readonly now: () => number;

  constructor(private readonly options: LocalOnlyBackendAdapterOptions) {
    this.maxPayloadBytes = options.maxPayloadBytes ?? 64 * 1024;
    this.minWriteIntervalMs = options.minWriteIntervalMs ?? 300;
    this.now = options.now ?? (() => Date.now());
  }

  isRemoteEnabled(): boolean {
    return this.options.syncEnabled;
  }

  getSyncState(): SyncState {
    return this.syncState;
  }

  async queueProfileSync(envelope: SyncEnvelopeV1<CloudProfileRecordV1>): Promise<SyncState> {
    if (!this.isRemoteEnabled()) {
      this.syncState = 'local_only';
      return this.syncState;
    }

    const playerId = envelope.payload.playerId;
    this.enforceWriteLimits(playerId, envelope.payload);

    this.pendingProfiles.set(playerId, {
      ...envelope,
      syncState: 'queued_sync',
      payload: {
        ...envelope.payload,
        syncState: 'queued_sync',
      },
    });
    this.syncState = 'queued_sync';
    return this.syncState;
  }

  async flushProfileSync(playerId: string): Promise<SyncState> {
    if (!this.isRemoteEnabled()) {
      this.syncState = 'local_only';
      return this.syncState;
    }

    const queued = this.pendingProfiles.get(playerId);
    if (!queued) {
      if (this.syncState !== 'sync_conflict') {
        this.syncState = 'synced';
      }
      return this.syncState;
    }

    const latestRevision = this.latestProfileRevision.get(playerId) ?? 0;
    if (queued.payload.revision <= latestRevision) {
      this.syncState = 'sync_conflict';
      return this.syncState;
    }

    this.latestProfileRevision.set(playerId, queued.payload.revision);
    this.pendingProfiles.delete(playerId);
    this.syncState = 'synced';
    return this.syncState;
  }

  async upsertLeaderboardEntry(envelope: SyncEnvelopeV1<LeaderboardEntryV1>): Promise<SyncState> {
    if (!this.isRemoteEnabled()) {
      this.syncState = 'local_only';
      return this.syncState;
    }

    const playerId = envelope.payload.playerId;
    this.enforceWriteLimits(playerId, envelope.payload);

    const current = this.leaderboardBySeason.get(envelope.payload.seasonId) ?? [];
    const existingIndex = current.findIndex((entry) => entry.playerId === envelope.payload.playerId);

    if (existingIndex >= 0) {
      const existing = current[existingIndex];
      const bestTimeMs = Math.min(existing.bestTimeMs, envelope.payload.bestTimeMs);
      current[existingIndex] = {
        ...envelope.payload,
        bestTimeMs,
        wins: Math.max(existing.wins, envelope.payload.wins),
      };
    } else {
      current.push(envelope.payload);
    }

    current.sort((a, b) => a.bestTimeMs - b.bestTimeMs);
    this.leaderboardBySeason.set(envelope.payload.seasonId, current);
    this.syncState = 'synced';
    return this.syncState;
  }

  async fetchLeaderboard(seasonId: string, limit: number): Promise<LeaderboardEntryV1[]> {
    const entries = this.leaderboardBySeason.get(seasonId) ?? [];
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return entries.slice(0, safeLimit);
  }

  async submitSeasonEventState(envelope: SyncEnvelopeV1<SeasonEventStateV1>): Promise<SyncState> {
    if (!this.isRemoteEnabled()) {
      this.syncState = 'local_only';
      return this.syncState;
    }

    const playerId = envelope.payload.playerId;
    this.enforceWriteLimits(playerId, envelope.payload);

    const key = this.eventStateKey(
      envelope.payload.playerId,
      envelope.payload.seasonId,
      envelope.payload.eventId,
    );
    this.seasonEventStateByPlayerEvent.set(key, envelope.payload);
    this.syncState = 'synced';
    return this.syncState;
  }

  private eventStateKey(playerId: string, seasonId: string, eventId: string): string {
    return `${playerId}::${seasonId}::${eventId}`;
  }

  private enforceWriteLimits(playerId: string, payload: unknown): void {
    this.enforcePayloadLimit(payload);
    this.enforceRateLimit(playerId);
  }

  private enforcePayloadLimit(payload: unknown): void {
    const bytes = this.measurePayloadBytes(payload);
    if (bytes > this.maxPayloadBytes) {
      throw new Error('payload-too-large');
    }
  }

  private enforceRateLimit(playerId: string): void {
    const now = this.now();
    const lastWriteAt = this.lastWriteAtByPlayer.get(playerId);
    if (lastWriteAt !== undefined && now - lastWriteAt < this.minWriteIntervalMs) {
      throw new Error('rate-limit');
    }
    this.lastWriteAtByPlayer.set(playerId, now);
  }

  private measurePayloadBytes(payload: unknown): number {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  }
}
