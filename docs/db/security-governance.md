# Seguranca e Governanca - DB Track

## Objetivo

Definir controles minimos para ativacao online futura sem quebrar o launch offline-first.

## Principios

1. Cliente nao e fonte de verdade para ranking.
2. Menor privilegio em todas as tabelas.
3. Zero trust entre payload cliente e persistencia.
4. Observabilidade minima obrigatoria antes de abrir rollout.

## Controles obrigatorios

### 1) Identidade e autenticacao

1. Identidade unica por jogador (UUID).
2. Sessao autenticada para operacoes de escrita cloud.
3. Chaves de servico apenas no backend/funcoes, nunca no cliente.

### 2) RLS e autorizacao

1. `player_profiles`: acesso somente do proprio `player_id`.
2. `season_event_states`: acesso/escrita somente do proprio `player_id`.
3. `leaderboard_entries`: leitura publica; escrita somente do proprio jogador.
4. `sync_audit_log`: escrita por servico, sem leitura publica.

### 3) Protecao anti-spam

1. Limite de frequencia por jogador em writes (ex.: >= 300ms entre requests sensiveis).
2. Limite de payload por operacao (ex.: 64 KB por envelope).
3. Quotas por minuto para endpoints de sync.
4. Backoff exponencial em retries do cliente.

### 4) Anti-cheat basico (V1)

1. Leaderboard aceita somente melhoria monotona de `best_time_ms`.
2. Rejeitar saltos improvaveis de performance fora de janela valida.
3. Registrar score suspeito em trilha de auditoria.
4. Permitir quarantena de score antes de publicar ranking global.

### 5) Integridade e conflitos

1. Escrita de perfil com `profile_version` crescente.
2. Se `profile_version` stale, retornar conflito (`sync_conflict`).
3. Cliente deve resolver conflito por merge deterministico ou escolha explicita.

### 6) Observabilidade e operacao

1. Dashboard de erros de sync por estado:
   - `local_only`
   - `queued_sync`
   - `synced`
   - `sync_conflict`
2. Alertas para:
   - erro > 2% em writes
   - aumento anormal de `sync_conflict`
   - pico de egress acima de threshold do free tier

### 7) Retencao e privacidade

1. `sync_audit_log`: retencao curta (30 dias).
2. Eventos detalhados: manter agregados para custo baixo.
3. Processo de exclusao de conta/dados documentado.

## Gate de seguranca antes da ativacao online

1. Revisao de RLS concluida.
2. Testes de autorizacao negativos e positivos.
3. Testes de limite de payload e rate limit.
4. Simulacao de conflito validada.
5. Kill-switch de feature flag validado.
