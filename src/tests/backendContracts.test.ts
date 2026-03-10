import { createProfileRecordV1, createProfileSyncEnvelope } from '../backend/adapter';
import type { SyncState } from '../backend/contracts';
import { createDefaultProfile } from '../core/profile';

describe('backend contracts', () => {
  it('serializes CloudProfileRecordV1 and SyncEnvelopeV1 as JSON', () => {
    const profile = createDefaultProfile();
    const record = createProfileRecordV1({
      playerId: 'player-001',
      deviceId: 'device-web',
      revision: 7,
      profile,
      syncState: 'queued_sync',
      nowIso: '2026-03-10T12:00:00.000Z',
    });

    const envelope = createProfileSyncEnvelope({
      playerId: 'player-001',
      deviceId: 'device-web',
      revision: 7,
      profile,
      syncState: 'queued_sync',
      nowIso: '2026-03-10T12:00:00.000Z',
    });

    const serialized = JSON.stringify({
      record,
      envelope,
    });
    const parsed = JSON.parse(serialized) as {
      record: typeof record;
      envelope: typeof envelope;
    };

    expect(parsed.record.schemaVersion).toBe(1);
    expect(parsed.record.revision).toBe(7);
    expect(parsed.record.syncState).toBe('queued_sync');
    expect(parsed.envelope.schemaVersion).toBe(1);
    expect(parsed.envelope.operation).toBe('upsert_profile');
    expect(parsed.envelope.payload.profile.selectedCarId).toBe(profile.selectedCarId);
  });

  it('exposes the four sync states required by the roadmap', () => {
    const states: SyncState[] = ['local_only', 'queued_sync', 'synced', 'sync_conflict'];
    expect(states).toHaveLength(4);
    expect(new Set(states).size).toBe(4);
  });
});
