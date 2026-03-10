# Setup de Staging - Supabase (Proxima Fase)

Escopo: preparar ambiente de staging, sem tocar producao.

## 1) Pré-requisitos

1. Projeto Supabase de staging criado.
2. Chave publishable e URL do projeto.
3. Estrategia de autentificacao definida para testes (anon + login simples ou conta de QA).

## 2) Aplicar schema V1

Usar a migração:

1. `supabase/migrations/20260310101500_turbopixel_v1.sql`

Validar:

1. Tabelas criadas:
   - `player_profiles`
   - `leaderboard_seasons`
   - `leaderboard_entries`
   - `season_event_states`
   - `sync_audit_log`
2. RLS habilitada nas tabelas protegidas.
3. Policies criadas conforme desenho de seguranca.

## 3) Configurar frontend local para staging

Criar `.env.local` a partir de `.env.example`:

1. `VITE_BACKEND_PROVIDER=supabase`
2. `VITE_ENABLE_REMOTE_BACKEND_SYNC=true`
3. `VITE_PLAYER_ID=<uuid-de-teste>`
4. `VITE_DEVICE_ID=<identificador-de-dispositivo>`
5. `VITE_SUPABASE_URL=<staging-url>`
6. `VITE_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>`

## 4) Validações obrigatórias

1. Sync de profile:
   - `queued_sync -> synced`
2. Conflito de revisão:
   - stale write -> `sync_conflict`
3. Leaderboard:
   - leitura publica funcionando
   - escrita restrita ao jogador autenticado
4. Event state:
   - sem vazamento entre jogadores
5. Rate/payload:
   - payload muito grande rejeitado
   - spam de escrita bloqueado

## 5) Critério para avançar

1. Nenhuma falha de isolamento de dados.
2. Latência dentro da meta para operações principais.
3. Custo estimado de staging sob controle.
4. Kill-switch validado (`VITE_ENABLE_REMOTE_BACKEND_SYNC=false`).
