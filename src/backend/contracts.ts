import type { PlayerProfile } from '../types';

export type SyncState = 'local_only' | 'queued_sync' | 'synced' | 'sync_conflict';

export type SyncOperation =
  | 'upsert_profile'
  | 'upsert_leaderboard_entry'
  | 'upsert_season_event_state';

export interface CloudProfileRecordV1 {
  schemaVersion: 1;
  playerId: string;
  deviceId: string;
  revision: number;
  checksum: string;
  updatedAtIso: string;
  syncState: SyncState;
  profile: PlayerProfile;
}

export interface LeaderboardEntryV1 {
  schemaVersion: 1;
  seasonId: string;
  playerId: string;
  displayName: string;
  bestTimeMs: number;
  wins: number;
  updatedAtIso: string;
}

export interface SeasonEventStateV1 {
  schemaVersion: 1;
  seasonId: string;
  eventId: string;
  playerId: string;
  points: number;
  claimedRewardIds: string[];
  updatedAtIso: string;
}

export interface SyncEnvelopeV1<TPayload> {
  schemaVersion: 1;
  operationId: string;
  operation: SyncOperation;
  queuedAtIso: string;
  retryCount: number;
  syncState: SyncState;
  payload: TPayload;
}
