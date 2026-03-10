# ADR-DB-001 - Banco de Dados Gratuito para Evolucao Online

- Status: Aprovado (fase de decisao)
- Data: 2026-03-10
- Escopo: TurboPixel (launch offline-first)
- Decisores: Produto + Engenharia

## Contexto

TurboPixel sera lancado com experiencia offline-first e save local. O roadmap pos-launch inclui cloud save, leaderboard sazonal e eventos. Foi solicitado um plano com custo zero real no tier gratuito e com baixo overhead operacional para squad pequena.

## Decisao

Adotar **Supabase Postgres** como provedor-alvo para a trilha online futura.

Importante:

1. Nesta fase, nao existe configuracao de producao.
2. O que foi aprovado agora e somente pesquisa, arquitetura, modelo de dados e backlog de implementacao.
3. O runtime continua offline-first com feature flag de sync remoto desligada por padrao.

## Criterios obrigatorios usados na decisao

1. Custo zero no tier gratuito.
2. Cobertura para cloud save + ranking + eventos.
3. Seguranca aplicavel a game online (RLS e controle por usuario).
4. Baixa complexidade operacional.
5. Caminho de migracao sem lock-in critico de curto prazo.

## Alternativas consideradas

1. Firebase (Spark plan)
2. Neon (Postgres serverless)
3. Turso (SQLite distribuido)

Resumo:

1. Firebase tem excelente DX e free tier forte, mas modelo principal orientado a documentos e maior lock-in de regras/SDK para este caso.
2. Neon favorece Postgres puro, mas o free tier depende de limites de compute/hora e exige complementar servicos para auth/edge/regras.
3. Turso e simples e rapido para edge SQLite, mas exige design adicional para ranking/eventos complexos e governanca de escrita.
4. Supabase entrega stack integrada para Postgres + auth + RLS + APIs e reduz custo operacional para o tamanho do time.

## Consequencias

Positivas:

1. Modelo relacional forte para ranking, historico e auditoria.
2. RLS nativo para isolamento por jogador.
3. Caminho claro para migracao futura por ser Postgres.
4. Menor dispersao de ferramentas.

Riscos:

1. Limites do free tier podem estourar em crescimento de egress e armazenamento.
2. Regras mal definidas de RLS podem introduzir brecha de dados.
3. Leaderboard e anti-cheat exigem validacao de servidor/funcao para nao confiar em cliente.

Mitigacoes:

1. Guardrails de payload, frequencia de escrita e retencao de eventos.
2. Revisao de seguranca de politicas antes de habilitar online.
3. Feature flag para rollout gradual com kill-switch.

## Escopo explicitamente fora desta ADR

1. Provisionamento do projeto Supabase em producao.
2. Deploy de funcoes edge em ambiente real.
3. Ativacao de autentificacao em clientes finais.
4. Rollout multiplayer.

## Resultado esperado da fase de decisao

1. `ADR-DB-001` aprovado.
2. Esquema logico V1 com politicas.
3. Backlog pos-decisao pronto para execucao.

## Referencias de preco e limites (consultadas em 2026-03-10)

1. Supabase billing/free usage: https://supabase.com/docs/guides/platform/billing-on-supabase
2. Firebase pricing/free quotas: https://firebase.google.com/pricing
3. Neon pricing: https://neon.tech/pricing
4. Turso pricing: https://turso.tech/pricing
