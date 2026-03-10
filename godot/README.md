# TurboPixel Godot Replatform (M1 -> M2)

Este diretorio contem a base de migracao para Godot 4.x.

## Objetivo atual

1. Fechar M1 tecnico (determinismo + fixture persistente de replay).
2. Avancar M2 (shell UX + progressao de liga + cosmeticos + HUD placeholder).
3. Manter estrategia offline-first durante a transicao.

## Estrutura

1. `domain/`: simulacao e regras de corrida
2. `application/`: RaceService e DeterministicReplayService
3. `infrastructure/`: save local + game store
4. `presentation/`: scripts de UX
5. `scenes/`: cenas Godot
6. `tools/`: scripts de benchmark/automacao

## Como abrir

1. Abra `godot/project.godot` no Godot 4.
2. Rode a cena principal (`res://scenes/app_root.tscn`).
3. Fluxos disponiveis:
   - Menu: fixture check + probe deterministico
   - Garage: compra/selecao de carro
   - Upgrades: compra de upgrades basicos
   - Cosmetics: compra/equip de cosmetico
   - Race: simulacao de corrida e shift

## Observacao

Esta fase ainda e base de producao. Conteudo final, arte 2.5D e balanceamento avancado entram nas fases seguintes.

## Fixture de replay

- O primeiro `Run fixture check` cria baseline em `user://deterministic_replay_fixture_v1.json`.
- As execucoes seguintes validam digest, resultado e ticks contra o baseline salvo.

## Benchmark de frame-time web

1. Gere export web em `godot/export/web`.
2. Execute `npm run benchmark:godot:web:local`.
3. Consulte resultado em `godot/benchmarks/latest.json`.
4. Guia completo em `godot/docs/web-frame-benchmark.md`.
