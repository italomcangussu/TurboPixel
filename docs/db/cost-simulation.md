# Simulacao de Custo/Uso - Free Tier

Data base: 2026-03-10

## Hipoteses

1. Cloud profile medio: 8 KB por jogador.
2. Event state medio: 1.5 KB por jogador/evento ativo.
3. Leaderboard entry media: 0.3 KB por jogador/temporada.
4. Telemetria bruta e minimizada para reduzir custo.
5. Sem multiplayer nesta fase.

## Cenarios

### Cenario A - Tiny

1. MAU: 5.000
2. Sync profile: 20 writes por jogador/mes
3. Reads profile: 30 por jogador/mes
4. Leaderboard reads: 5 por jogador/mes

Resultado estimado:

1. Armazenamento DB: ~160 MB
2. Egress: ~2.2 GB/mes
3. Writes mensais: ~100.000
4. Status free tier: **OK**

### Cenario B - Growth

1. MAU: 25.000
2. Sync profile: 30 writes por jogador/mes
3. Reads profile: 40 por jogador/mes
4. Leaderboard reads: 8 por jogador/mes

Resultado estimado:

1. Armazenamento DB: ~420 MB
2. Egress: ~6.7 GB/mes
3. Writes mensais: ~750.000
4. Status free tier: **Risco de exceder egress**

Mitigacoes:

1. Cache local agressivo de leaderboard.
2. Polling menos frequente.
3. Compactacao de payload.

### Cenario C - Stress

1. MAU: 50.000
2. Sync profile: 40 writes por jogador/mes
3. Reads profile: 60 por jogador/mes
4. Leaderboard reads: 12 por jogador/mes

Resultado estimado:

1. Armazenamento DB: ~780 MB
2. Egress: ~15+ GB/mes
3. Writes mensais: ~2.000.000
4. Status free tier: **Nao sustentavel sem upgrade/otimizacao forte**

## Leitura executiva

1. Free tier atende bem fase inicial (Tiny).
2. No Growth, egress tende a ser o primeiro gargalo.
3. No Stress, storage + egress passam limites de forma previsivel.

## Guardrails recomendados

1. Gate automatico de leitura de leaderboard por sessao.
2. Snapshot de profile em eventos relevantes (nao a cada tela).
3. Retencao curta para logs de sync.
4. Monitoramento mensal de consumo antes de habilitar online em escala.

## Fontes

1. https://supabase.com/docs/guides/platform/billing-on-supabase
2. https://firebase.google.com/pricing
3. https://neon.tech/pricing
4. https://turso.tech/pricing
