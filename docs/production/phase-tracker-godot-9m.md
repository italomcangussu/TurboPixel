# Plano Mestre de Producao - TurboPixel 2.5D (Godot, 9 meses)

Status de execucao atualizado em 2026-03-10.

## Linha de fases

1. M1: Replatform Godot + trilha DB (pesquisa, matriz, ADR)
2. M2-M4: Paridade funcional e UX core
3. M5-M6: Expansao de conteudo e tuning IA/economia
4. M7-M8: Alpha/Beta, performance e hardening
5. M9: Release Web
6. Pos-launch: habilitacao online conforme gates

## Status atual

### M1 - Em fechamento (quase concluido)

Concluido:

1. Trilha DB completa (ADR, matriz, esquema, seguranca, custo, backlog)
2. Contratos de backend no cliente (`BackendAdapter`, envelopes e sync states)
3. Feature flags para manter launch offline-first
4. Scaffold inicial Godot em `godot/` com arquitetura por camadas
5. Nucleo de corrida deterministico com tick fixo 60 Hz
6. `DeterministicReplayService` com probe de repetibilidade por hash
7. Persistencia local + GameStore com economia/garagem/upgrades basicos
8. Fixture persistente de replay em `user://deterministic_replay_fixture_v1.json` (bootstrap + verificacao)
9. Tooling de benchmark web criado (`benchmark:godot:web` + `benchmark:godot:web:local`)

Pendente para fechar M1:

1. Rodar benchmark de frame-time no export web real e anexar resultado baseline

### M2 - Iniciado

Concluido:

1. Shell de UX com navegacao entre Menu/Garage/Upgrades/Race
2. Acoes basicas de compra/selecao/upgrades conectadas ao store
3. Fluxo de corrida acessivel pelo shell
4. Modulo de cosmeticos no shell (compra + equip por carro)
5. Progressao de liga por resultado de corrida (8 ligas, pontos, promocoes, wins/losses)
6. HUD visual placeholder de corrida (barras de distancia + RPM/Gear)
7. Microcopy do shell refinada para leitura de liga e resumo de corrida

Pendente para M2:

1. Migrar menus e textos finais do design de produto
2. Expandir catalogo cosmetico para o alvo de conteudo planejado
3. Evoluir HUD 2.5D placeholder para layout final de arte

### M3-M9 - Nao iniciado

## Regras de continuidade

1. Manter runtime online desligado por padrao
2. Toda feature de corrida deve passar por simulacao deterministica primeiro
3. Separar dominio de apresentacao em todos os modulos novos
4. Nao bloquear entrega web atual durante a migracao

## Proxima entrega recomendada

1. Executar `npm run benchmark:godot:web:local` com export web e registrar baseline no tracker
2. Evoluir layout visual do HUD para assinatura 2.5D final (arte, tipografia, hierarquia)
