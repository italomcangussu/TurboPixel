import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BackendAdapter } from './adapter';
import type {
  CloudProfileRecordV1,
  LeaderboardEntryV1,
  SeasonEventStateV1,
  SyncEnvelopeV1,
  SyncState,
} from './contracts';

interface SupabaseBackendAdapterOptions {
  syncEnabled: boolean;
  supabaseUrl: string;
  supabasePublishableKey: string;
  maxPayloadBytes?: number;
  minWriteIntervalMs?: number;
  now?: () => number;
}

interface PlayerProfileRow {
  player_id: string;
  profile_version: number;
}

interface LeaderboardEntryRow {
  season_id: string;
  player_id: string;
  display_name: string;
  best_time_ms: number;
  wins: number;
  updated_at: string;
}

export class SupabaseBackendAdapter implements BackendAdapter {
  readonly provider = 'supabase';

  readonly version = 'v1';

  private syncState: SyncState = 'local_only';

  private readonly pendingProfiles = new Map<string, SyncEnvelopeV1<CloudProfileRecordV1>>();

  private readonly lastWriteAtByPlayer = new Map<string, number>();

  private readonly maxPayloadBytes: number;

  private readonly minWriteIntervalMs: number;

  private readonly now: () => number;

  private readonly client: SupabaseClient | null;

  constructor(private readonly options: SupabaseBackendAdapterOptions) {
    this.maxPayloadBytes = options.maxPayloadBytes ?? 64 * 1024;
    this.minWriteIntervalMs = options.minWriteIntervalMs ?? 300;
    this.now = options.now ?? (() => Date.now());
    this.client = this.createSupabaseClient();
  }

  isRemoteEnabled(): boolean {
    return this.options.syncEnabled && this.client !== null;
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

    const remoteRevision = await this.fetchRemoteProfileRevision(playerId);
    if (remoteRevision === 'retry_later') {
      this.syncState = 'queued_sync';
      return this.syncState;
    }

    if (remoteRevision >= queued.payload.revision) {
      this.syncState = 'sync_conflict';
      return this.syncState;
    }

    const client = this.getClientOrThrow();
    const payload = queued.payload;
    const { error } = await client.from('player_profiles').upsert(
      {
        player_id: payload.playerId,
        profile_version: payload.revision,
        profile_json: payload.profile,
        checksum: payload.checksum,
        updated_at: payload.updatedAtIso,
      },
      {
        onConflict: 'player_id',
      },
    );

    if (error) {
      this.syncState = 'queued_sync';
      return this.syncState;
    }

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

    const client = this.getClientOrThrow();
    const { data: existing, error: existingError } = await client
      .from('leaderboard_entries')
      .select('best_time_ms,wins')
      .eq('season_id', envelope.payload.seasonId)
      .eq('player_id', envelope.payload.playerId)
      .maybeSingle<{ best_time_ms: number; wins: number }>();

    if (existingError) {
      this.syncState = 'queued_sync';
      return this.syncState;
    }

    const nextBestTimeMs = existing
      ? Math.min(existing.best_time_ms, envelope.payload.bestTimeMs)
      : envelope.payload.bestTimeMs;
    const nextWins = existing ? Math.max(existing.wins, envelope.payload.wins) : envelope.payload.wins;

    const { error } = await client.from('leaderboard_entries').upsert(
      {
        season_id: envelope.payload.seasonId,
        player_id: envelope.payload.playerId,
        display_name: envelope.payload.displayName,
        best_time_ms: nextBestTimeMs,
        wins: nextWins,
        updated_at: envelope.payload.updatedAtIso,
      },
      {
        onConflict: 'season_id,player_id',
      },
    );

    if (error) {
      this.syncState = 'queued_sync';
      return this.syncState;
    }

    this.syncState = 'synced';
    return this.syncState;
  }

  async fetchLeaderboard(seasonId: string, limit: number): Promise<LeaderboardEntryV1[]> {
    if (!this.isRemoteEnabled()) {
      return [];
    }

    const client = this.getClientOrThrow();
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const { data, error } = await client
      .from('leaderboard_entries')
      .select('season_id,player_id,display_name,best_time_ms,wins,updated_at')
      .eq('season_id', seasonId)
      .order('best_time_ms', { ascending: true })
      .limit(safeLimit)
      .returns<LeaderboardEntryRow[]>();

    if (error || !data) {
      return [];
    }

    return data.map((entry) => ({
      schemaVersion: 1,
      seasonId: entry.season_id,
      playerId: entry.player_id,
      displayName: entry.display_name,
      bestTimeMs: entry.best_time_ms,
      wins: entry.wins,
      updatedAtIso: entry.updated_at,
    }));
  }

  async submitSeasonEventState(envelope: SyncEnvelopeV1<SeasonEventStateV1>): Promise<SyncState> {
    if (!this.isRemoteEnabled()) {
      this.syncState = 'local_only';
      return this.syncState;
    }

    const playerId = envelope.payload.playerId;
    this.enforceWriteLimits(playerId, envelope.payload);

    const client = this.getClientOrThrow();
    const { error } = await client.from('season_event_states').upsert(
      {
        season_id: envelope.payload.seasonId,
        event_id: envelope.payload.eventId,
        player_id: envelope.payload.playerId,
        points: envelope.payload.points,
        claimed_reward_ids: envelope.payload.claimedRewardIds,
        updated_at: envelope.payload.updatedAtIso,
      },
      {
        onConflict: 'season_id,event_id,player_id',
      },
    );

    if (error) {
      this.syncState = 'queued_sync';
      return this.syncState;
    }

    this.syncState = 'synced';
    return this.syncState;
  }

  private createSupabaseClient(): SupabaseClient | null {
    if (!this.options.supabaseUrl || !this.options.supabasePublishableKey) {
      return null;
    }

    return createClient(this.options.supabaseUrl, this.options.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  private getClientOrThrow(): SupabaseClient {
    if (!this.client) {
      throw new Error('supabase-not-configured');
    }

    return this.client;
  }

  private async fetchRemoteProfileRevision(playerId: string): Promise<number | 'retry_later'> {
    const client = this.getClientOrThrow();
    const { data, error } = await client
      .from('player_profiles')
      .select('player_id,profile_version')
      .eq('player_id', playerId)
      .maybeSingle<PlayerProfileRow>();

    if (error) {
      return 'retry_later';
    }

    return data?.profile_version ?? 0;
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
