import { createProfileSyncEnvelope } from '../backend/adapter';
import { LocalOnlyBackendAdapter } from '../backend/localAdapter';
import { createDefaultProfile } from '../core/profile';

function makeEnvelope(revision: number) {
  return createProfileSyncEnvelope({
    playerId: 'player-001',
    deviceId: 'device-web',
    revision,
    profile: createDefaultProfile(),
    nowIso: '2026-03-10T12:00:00.000Z',
  });
}

describe('backend sync state machine', () => {
  it('remains local_only when remote sync is disabled', async () => {
    const adapter = new LocalOnlyBackendAdapter({
      syncEnabled: false,
    });

    expect(await adapter.queueProfileSync(makeEnvelope(1))).toBe('local_only');
    expect(await adapter.flushProfileSync('player-001')).toBe('local_only');
    expect(adapter.getSyncState()).toBe('local_only');
  });

  it('moves from queued_sync to synced when flush succeeds', async () => {
    const adapter = new LocalOnlyBackendAdapter({
      syncEnabled: true,
      minWriteIntervalMs: 0,
    });

    expect(await adapter.queueProfileSync(makeEnvelope(1))).toBe('queued_sync');
    expect(await adapter.flushProfileSync('player-001')).toBe('synced');
    expect(adapter.getSyncState()).toBe('synced');
  });

  it('enters sync_conflict when revision is stale', async () => {
    const adapter = new LocalOnlyBackendAdapter({
      syncEnabled: true,
      minWriteIntervalMs: 0,
    });

    await adapter.queueProfileSync(makeEnvelope(2));
    await adapter.flushProfileSync('player-001');

    await adapter.queueProfileSync(makeEnvelope(1));
    expect(await adapter.flushProfileSync('player-001')).toBe('sync_conflict');
    expect(adapter.getSyncState()).toBe('sync_conflict');
  });

  it('rejects profile payloads above limit', async () => {
    const adapter = new LocalOnlyBackendAdapter({
      syncEnabled: true,
      maxPayloadBytes: 500,
      minWriteIntervalMs: 0,
    });

    const largeProfile = createDefaultProfile();
    largeProfile.ownedCosmetics = Array.from({ length: 500 }, (_, index) => `cosmetic-${index}`);

    const largeEnvelope = createProfileSyncEnvelope({
      playerId: 'player-001',
      deviceId: 'device-web',
      revision: 1,
      profile: largeProfile,
      nowIso: '2026-03-10T12:00:00.000Z',
    });

    await expect(adapter.queueProfileSync(largeEnvelope)).rejects.toThrow('payload-too-large');
  });

  it('throttles writes faster than minimum interval', async () => {
    let now = 1000;
    const adapter = new LocalOnlyBackendAdapter({
      syncEnabled: true,
      minWriteIntervalMs: 500,
      now: () => now,
    });

    await adapter.queueProfileSync(makeEnvelope(1));
    now += 100;

    await expect(adapter.queueProfileSync(makeEnvelope(2))).rejects.toThrow('rate-limit');
  });
});
