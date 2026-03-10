# Supabase Artifacts (Staging-Ready)

Este diretório contém somente artefatos de preparação para a próxima fase.

Escopo atual:

1. Migração SQL inicial (`migrations/20260310101500_turbopixel_v1.sql`).
2. Sem deploy automático e sem configuração de produção.

Uso sugerido (quando iniciar staging):

1. Criar projeto Supabase de staging.
2. Aplicar migrações no ambiente de staging.
3. Configurar variáveis no frontend (`.env.local`).
4. Validar RLS e fluxo de sync antes de qualquer rollout.
