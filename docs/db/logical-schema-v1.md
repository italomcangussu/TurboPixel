# Modelo Logico V1 - Supabase Postgres

Status: aprovado para implementacao pos-launch (nao provisionado nesta fase).

## Objetivos de dados

1. Persistir perfil cloud por jogador com controle de revisao.
2. Publicar/consultar leaderboard por temporada.
3. Registrar estado de eventos sazonais por jogador.
4. Registrar trilha de sync e auditoria minima.

## Entidades principais

### 1) `player_profiles`

Responsabilidade:

1. Estado principal do jogador em cloud.

Campos:

1. `player_id` (uuid, pk)
2. `profile_version` (int, controle de revisao otimista)
3. `profile_json` (jsonb)
4. `checksum` (text)
5. `updated_at` (timestamptz)
6. `created_at` (timestamptz)

Regras:

1. Um perfil por jogador.
2. `profile_version` deve crescer monotonicamente.

### 2) `leaderboard_seasons`

Responsabilidade:

1. Configuracao de temporadas.

Campos:

1. `season_id` (text, pk)
2. `starts_at` (timestamptz)
3. `ends_at` (timestamptz)
4. `is_active` (bool)
5. `created_at` (timestamptz)

### 3) `leaderboard_entries`

Responsabilidade:

1. Melhor resultado por jogador por temporada.

Campos:

1. `season_id` (text, fk -> leaderboard_seasons)
2. `player_id` (uuid)
3. `display_name` (text)
4. `best_time_ms` (int)
5. `wins` (int)
6. `updated_at` (timestamptz)

Chave:

1. PK composta (`season_id`, `player_id`)

Indices:

1. `idx_leaderboard_entries_rank` em (`season_id`, `best_time_ms` asc)

### 4) `season_event_states`

Responsabilidade:

1. Estado de progressao de eventos por jogador.

Campos:

1. `season_id` (text)
2. `event_id` (text)
3. `player_id` (uuid)
4. `points` (int)
5. `claimed_reward_ids` (jsonb)
6. `updated_at` (timestamptz)
7. `created_at` (timestamptz)

Chave:

1. PK composta (`season_id`, `event_id`, `player_id`)

### 5) `sync_audit_log`

Responsabilidade:

1. Auditoria minima para troubleshooting de sincronizacao.

Campos:

1. `id` (bigserial, pk)
2. `player_id` (uuid)
3. `operation` (text)
4. `result_state` (text: local_only|queued_sync|synced|sync_conflict)
5. `payload_bytes` (int)
6. `created_at` (timestamptz)

Retencao:

1. Janela curta (ex.: 30 dias) para manter custo baixo.

## Politicas de seguranca (RLS)

Regras-base:

1. `player_profiles`: jogador acessa somente sua linha.
2. `season_event_states`: jogador acessa/escreve somente seu estado.
3. `leaderboard_entries`: leitura publica; escrita autenticada limitada ao proprio jogador.
4. `sync_audit_log`: sem leitura publica.

Controles adicionais:

1. Politica de update em `player_profiles` exige `profile_version` crescente.
2. Escrita de leaderboard deve validar melhora legitima de tempo (best_time menor ou igual ao anterior) e limites de variacao.
3. Rate limit por jogador para evitar spam.

## Contratos publicos V1 mapeados

1. `CloudProfileRecordV1` -> `player_profiles`
2. `LeaderboardEntryV1` -> `leaderboard_entries`
3. `SeasonEventStateV1` -> `season_event_states`
4. `SyncEnvelopeV1` -> fila/logica de ingestao + `sync_audit_log`

## Migracao e evolucao

1. Migracoes SQL versionadas (nao aplicar agora).
2. Toda mudanca de contrato deve versionar (`V2`) sem quebrar cliente V1.
3. Preferir adicao de colunas/tabelas antes de alteracao destrutiva.
