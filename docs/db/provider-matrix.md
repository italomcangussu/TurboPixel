# Matriz Comparativa - Provedores Gratuitos (DB Track)

Data de corte: 2026-03-10

## Requisitos funcionais do game

1. Cloud save por jogador.
2. Leaderboard sazonal com consulta rapida.
3. Estados de eventos sazonais.
4. Eventos de telemetria basica para tuning.
5. Seguranca por usuario e trilha de auditoria.

## Criterios e peso

1. Custo zero real no free tier - peso 30%
2. Cobertura funcional (save/ranking/eventos) - peso 25%
3. Seguranca aplicavel (RLS/regras/isolamento) - peso 20%
4. Complexidade operacional para squad pequena - peso 15%
5. Lock-in de curto prazo (menor e melhor) - peso 10%

Escala de score: 1 (pior) a 5 (melhor)

## Matriz

| Provedor | Custo (30) | Cobertura (25) | Seguranca (20) | Operacao (15) | Lock-in (10) | Score ponderado |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase Postgres | 4.5 | 5.0 | 4.5 | 4.5 | 4.0 | **4.60** |
| Firebase (Spark) | 4.5 | 4.0 | 4.0 | 4.5 | 2.5 | 4.00 |
| Neon (Postgres) | 4.0 | 3.5 | 4.0 | 3.0 | 4.5 | 3.80 |
| Turso (SQLite) | 4.0 | 3.0 | 3.5 | 4.0 | 3.5 | 3.60 |

## Evidencias resumidas (free tier)

### Supabase

1. Free plan com quotas publicadas para DB/Auth/Egress/Edge/Realtimes.
2. Stack unificada: Postgres + Auth + RLS + API + Edge Functions.
3. Bom fit para modelagem relacional de ranking e historico.

### Firebase

1. Spark plan com limites diarios e mensais para servicos principais.
2. Excelente DX para apps mobile/web.
3. Modelo de dados e regras podem aumentar lock-in para consultas analiticas e migracao.

### Neon

1. Postgres serverless com free tier baseado em limites de uso/compute.
2. Bom para SQL padrao e baixo lock-in de banco.
3. Requer composicao com outros servicos para auth/politicas de produto.

### Turso

1. Free tier com limites de bancos ativos e armazenamento total.
2. Excelente latencia edge para padroes simples.
3. Para ranking/eventos mais ricos, demanda mais desenho de aplicacao e governanca.

## Conclusao

1. Vencedor tecnico-operacional: **Supabase Postgres**.
2. Mantem custo inicial baixo, reduz complexidade e atende os 3 casos-chave (save, ranking, eventos).
3. Recomendacao final: manter launch offline-first e habilitar online somente apos gates de seguranca/performance.

## Fontes

1. https://supabase.com/docs/guides/platform/billing-on-supabase
2. https://firebase.google.com/pricing
3. https://neon.tech/pricing
4. https://turso.tech/pricing
