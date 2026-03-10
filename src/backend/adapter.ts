import type { PlayerProfile } from '../types';
import type {
  CloudProfileRecordV1,
  LeaderboardEntryV1,
  SeasonEventStateV1,
  SyncEnvelopeV1,
  SyncState,
} from './contracts';

export interface BackendAdapter {
  readonly provider: 'local' | 'supabase';
  readonly version: 'v1';
  isRemoteEnabled(): boolean;
  getSyncState(): SyncState;
  queueProfileSync(envelope: SyncEnvelopeV1<CloudProfileRecordV1>): Promise<SyncState>;
  flushProfileSync(playerId: string): Promise<SyncState>;
  upsertLeaderboardEntry(envelope: SyncEnvelopeV1<LeaderboardEntryV1>): Promise<SyncState>;
  fetchLeaderboard(seasonId: string, limit: number): Promise<LeaderboardEntryV1[]>;
  submitSeasonEventState(envelope: SyncEnvelopeV1<SeasonEventStateV1>): Promise<SyncState>;
}

function createOperationId(): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createProfileChecksum(profile: PlayerProfile): string {
  const payload = JSON.stringify(profile);
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createProfileRecordV1(input: {
  playerId: string;
  deviceId: string;
  revision: number;
  profile: PlayerProfile;
  syncState: SyncState;
  nowIso?: string;
}): CloudProfileRecordV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();

  return {
    schemaVersion: 1,
    playerId: input.playerId,
    deviceId: input.deviceId,
    revision: input.revision,
    checksum: createProfileChecksum(input.profile),
    updatedAtIso: nowIso,
    syncState: input.syncState,
    profile: structuredClone(input.profile),
  };
}

export function createProfileSyncEnvelope(input: {
  playerId: string;
  deviceId: string;
  revision: number;
  profile: PlayerProfile;
  syncState?: SyncState;
  nowIso?: string;
}): SyncEnvelopeV1<CloudProfileRecordV1> {
  const syncState = input.syncState ?? 'queued_sync';
  const nowIso = input.nowIso ?? new Date().toISOString();

  return {
    schemaVersion: 1,
    operationId: createOperationId(),
    operation: 'upsert_profile',
    queuedAtIso: nowIso,
    retryCount: 0,
    syncState,
    payload: createProfileRecordV1({
      playerId: input.playerId,
      deviceId: input.deviceId,
      revision: input.revision,
      profile: input.profile,
      syncState,
      nowIso,
    }),
  };
}

export function createLeaderboardEnvelope(input: {
  entry: LeaderboardEntryV1;
  syncState?: SyncState;
  nowIso?: string;
}): SyncEnvelopeV1<LeaderboardEntryV1> {
  const syncState = input.syncState ?? 'queued_sync';
  const nowIso = input.nowIso ?? new Date().toISOString();

  return {
    schemaVersion: 1,
    operationId: createOperationId(),
    operation: 'upsert_leaderboard_entry',
    queuedAtIso: nowIso,
    retryCount: 0,
    syncState,
    payload: {
      ...input.entry,
      updatedAtIso: nowIso,
    },
  };
}

export function createSeasonEventEnvelope(input: {
  state: SeasonEventStateV1;
  syncState?: SyncState;
  nowIso?: string;
}): SyncEnvelopeV1<SeasonEventStateV1> {
  const syncState = input.syncState ?? 'queued_sync';
  const nowIso = input.nowIso ?? new Date().toISOString();

  return {
    schemaVersion: 1,
    operationId: createOperationId(),
    operation: 'upsert_season_event_state',
    queuedAtIso: nowIso,
    retryCount: 0,
    syncState,
    payload: {
      ...input.state,
      updatedAtIso: nowIso,
    },
  };
}
