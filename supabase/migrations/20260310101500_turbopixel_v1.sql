-- TurboPixel Supabase schema V1
-- Staging-first migration artifact.

create table public.player_profiles (
  player_id uuid primary key,
  profile_version integer not null default 1,
  profile_json jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leaderboard_seasons (
  season_id text primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.leaderboard_entries (
  season_id text not null references public.leaderboard_seasons(season_id) on delete cascade,
  player_id uuid not null,
  display_name text not null,
  best_time_ms integer not null check (best_time_ms > 0),
  wins integer not null default 0 check (wins >= 0),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);

create index idx_leaderboard_entries_rank
  on public.leaderboard_entries (season_id, best_time_ms asc);

create table public.season_event_states (
  season_id text not null,
  event_id text not null,
  player_id uuid not null,
  points integer not null default 0 check (points >= 0),
  claimed_reward_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, event_id, player_id)
);

create table public.sync_audit_log (
  id bigserial primary key,
  player_id uuid not null,
  operation text not null,
  result_state text not null check (
    result_state in ('local_only', 'queued_sync', 'synced', 'sync_conflict')
  ),
  payload_bytes integer not null check (payload_bytes >= 0),
  created_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.season_event_states enable row level security;
alter table public.sync_audit_log enable row level security;

create policy player_profiles_select_own
  on public.player_profiles
  for select
  using (auth.uid() = player_id);

create policy player_profiles_upsert_own
  on public.player_profiles
  for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create policy leaderboard_entries_read_all
  on public.leaderboard_entries
  for select
  using (true);

create policy leaderboard_entries_write_own
  on public.leaderboard_entries
  for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create policy season_event_states_select_own
  on public.season_event_states
  for select
  using (auth.uid() = player_id);

create policy season_event_states_write_own
  on public.season_event_states
  for all
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create policy sync_audit_log_insert_service_only
  on public.sync_audit_log
  for insert
  with check (auth.role() = 'service_role');
