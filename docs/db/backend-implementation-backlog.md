# Backlog Pos-Decisao - Implementacao Backend Online

Escopo: iniciar somente apos release web e aprovacao de gates.

## Epic 1 - Foundation Supabase

1. Criar projeto Supabase de staging.
2. Aplicar schema V1 e RLS.
3. Configurar segredo e ambientes (`dev/staging/prod`).
4. Criar monitoramento basico de uso free tier.

Status atual (2026-03-10):

1. Parcialmente concluido em codigo/documentacao:
   - migration SQL V1 adicionada em `supabase/migrations/20260310101500_turbopixel_v1.sql`
   - adapter Supabase adicionado no frontend com selecao por env
   - `.env.example` e guia de staging adicionados
2. Pendente:
   - provisionar projeto de staging e validar policies em ambiente real

Criterio de aceite:

1. Migrações reproduziveis e idempotentes.
2. RLS validada com testes de acesso permitido/negado.

## Epic 2 - Auth + Identidade de Jogador

1. Definir estrategia de identificacao (anon auth + link opcional).
2. Mapear `player_id` local para identidade cloud.
3. Criar fluxo de recovery de sessao.

Criterio de aceite:

1. Jogador logado mantem isolamento de dados por `player_id`.

## Epic 3 - Cloud Save (Profile Sync)

1. Implementar endpoint/função para upsert de profile com `profile_version`.
2. Resolver conflitos (`sync_conflict`) com politica deterministic merge.
3. Atualizar cliente para retry/backoff.

Criterio de aceite:

1. Cenarios de conflito cobertos em teste automatizado.
2. Perda de dados nao ocorre em fluxo normal de sync.

## Epic 4 - Leaderboards

1. Publicacao de tempo e vitorias por temporada.
2. Regra de melhora monotona de `best_time_ms`.
3. Query paginada para top-N e ranking pessoal.

Criterio de aceite:

1. Update invalido de score e rejeitado.
2. Consulta top-N abaixo da meta de latencia definida.

## Epic 5 - Season Events

1. Persistencia de pontos e rewards resgatados.
2. Idempotencia em claim de reward.
3. Auditoria minima de alteracoes relevantes.

Criterio de aceite:

1. Nao existe reward duplicado por retry.

## Epic 6 - Hardening e Operacao

1. Rate limit por jogador para writes.
2. Limite de payload por endpoint.
3. Alertas para erro, conflito e consumo de cota.
4. Kill-switch da feature online.

Criterio de aceite:

1. Sistema volta para modo offline sem corromper save local.

## Priorizacao sugerida (ordem)

1. Epic 1
2. Epic 2
3. Epic 3
4. Epic 4
5. Epic 5
6. Epic 6

## Dependencias

1. Release web concluido.
2. Janela de QA para testes de sync.
3. Revalidacao de limites e preco no momento da ativacao.
