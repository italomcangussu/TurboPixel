import {
  BACKEND_PROVIDER,
  ENABLE_REMOTE_BACKEND_SYNC,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from '../core/constants';
import type { BackendAdapter } from './adapter';
import { LocalOnlyBackendAdapter } from './localAdapter';
import { SupabaseBackendAdapter } from './supabaseAdapter';

function createBackendAdapter(): BackendAdapter {
  if (BACKEND_PROVIDER === 'supabase') {
    return new SupabaseBackendAdapter({
      syncEnabled: ENABLE_REMOTE_BACKEND_SYNC,
      supabaseUrl: SUPABASE_URL,
      supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
    });
  }

  return new LocalOnlyBackendAdapter({
    syncEnabled: ENABLE_REMOTE_BACKEND_SYNC,
  });
}

export const backendAdapter = createBackendAdapter();
