Original prompt: PLEASE IMPLEMENT THIS PLAN: Plano de Criacao do TurboPixel (MVP) com corrida de arrancada 1v1, grafico pixel moderno 2.5D, carros customizaveis, troca de marcha por timing, economia de moeda + caixas, 12 carros, 60 cosmeticos, 5 ligas, save local, Phaser 3 + TypeScript + Vite, testes Vitest e Playwright.

## 2026-03-03
- Projeto Vite vanilla-ts inicializado no diretorio /Users/italomendescangussu/Documents/FredPixel.
- Proximo passo: instalar Phaser e stack de testes, depois implementar arquitetura core/data/scenes.
- Dependencias instaladas: phaser, vitest, playwright, vite-plugin-pwa, @types/node.
- Proximo passo: trocar boilerplate por arquitetura do TurboPixel (core/data/scenes/ui) e hooks de teste.
- Arquitetura base implementada: core (race/economy/loot/save), data catalogos (12 carros, 60 cosmeticos, 5 ligas, 3 pistas), store global, runtime hooks e 9 cenas Phaser.
- Hooks de teste adicionados: window.render_game_to_text e window.advanceTime.
- Testes unitarios adicionados em src/tests para corrida, economia, loot e migracao de save.
- Proximo passo: build/test, corrigir tipagem, validar no browser via Playwright client da skill.
- Build e testes locais validados com sucesso (`npm run build`, `npm test`).
- Validacao Playwright executada via web_game_playwright_client.js contra `vite preview`.
- Artefatos verificados manualmente:
  - /Users/italomendescangussu/Documents/FredPixel/output/web-game-run10/shot-0.png (menu apos corrida com economia atualizada)
  - /Users/italomendescangussu/Documents/FredPixel/output/web-game-run10/shot-1.png (tela de corrida ativa)
  - /Users/italomendescangussu/Documents/FredPixel/output/web-game-run10/state-0.json
  - /Users/italomendescangussu/Documents/FredPixel/output/web-game-run10/state-1.json
- Console errors: nenhum arquivo errors-*.json gerado nos runs finais.

## TODOs / sugestoes para proxima iteracao
- Balancear dificuldade e tempos de corrida (jogador atualmente perde facil na Liga 1 em automacao).
- Adicionar sfx/musica e feedback visual extra para shift perfect/good/miss.
- Melhorar captura automatica de cenarios (payloads separados por tela para reduzir tempo de run).
- Considerar code splitting para reduzir bundle principal (>500kB gzip warning no build).

## 2026-03-10
- Execucao retomada do Plano Mestre de Producao TurboPixel 2.5D (Godot, 9 meses).
- Fase M1 iniciada com scaffold Godot em `godot/` sem remover stack Phaser existente.
- Arquitetura criada em camadas:
  - `godot/domain` (simulacao deterministica)
  - `godot/application` (RaceService)
  - `godot/infrastructure` (ProfileRepository + GameStore autoload)
  - `godot/presentation` e `godot/scenes` (main loop de validacao)
- Tick fixo configurado em 60 Hz no `godot/project.godot`.
- Documentacao de acompanhamento das fases adicionada em `docs/production/phase-tracker-godot-9m.md`.
- README da trilha Godot adicionado em `godot/README.md`.
- Proxima fase executada: transicao M1 -> M2 no eixo Godot.
- Adicionado `DeterministicReplayService` para probe de repetibilidade por hash.
- `GameStore` ampliado com economia basica: compra de carro, selecao e upgrades.
- `RaceService` passou a considerar carro selecionado e upgrades do perfil.
- Nova cena principal `app_root.tscn` com navegacao Menu/Garage/Upgrades/Race.
- `godot/project.godot` atualizado para iniciar em `scenes/app_root.tscn`.
- Proxima fase executada no M2:
  - Fixture persistente de replay (`ReplayFixtureService`) com bootstrap/verify em `user://deterministic_replay_fixture_v1.json`.
  - `GameStore` ampliado com progressao de ligas (8 ligas), pontos, promocoes, wins/losses e resumo economico por corrida.
  - Inventario cosmetico inicial com compra/equip por carro selecionado.
  - HUD visual placeholder na corrida (barras de distancia + RPM/Gear para player e AI).
  - Shell UX atualizado com aba `Cosmetics` e acao de `Run fixture check` no menu.
  - Trilha de benchmark web adicionada:
    - `godot/tools/web_frame_benchmark.mjs` (medicao RAF + p95/p99/max + gate)
    - `godot/scripts/run_web_frame_benchmark.sh` (serve local + run benchmark)
    - scripts npm: `benchmark:godot:web` e `benchmark:godot:web:local`
    - docs: `godot/docs/web-frame-benchmark.md`
  - Microcopy do shell Godot refinada para leitura de liga e ultimo resultado sem JSON cru como output principal.
  - Correcao de runtime web (Phaser):
    - crash em `RaceScene` por uso invalido de `setTint` em `Rectangle` removido.
    - inicializacao de audio movida para gesto do usuario, reduzindo warning de autoplay do `AudioContext`.
    - favicon servido em `/favicon.ico` + `rel=\"icon\"` no `index.html` para eliminar 404.
  - Correcao de UX touch/click nos botoes:
    - `src/ui/button.ts` alterado para usar `Zone` interativa dedicada (em vez de hitArea direto no `Container`).
    - hitbox recebeu `touchPadding` para taps mais tolerantes.
    - acao principal do botao movida para `pointerdown`, reduzindo perda de toque por micro-movimento no release.
    - validacao automatizada com Playwright client da skill `develop-web-game`:
      - clique no centro de `Corridas` agora navega de `menu` para `league` (state-1/state-2).
      - cantos internos de botoes respondem; pontos externos imediatos permanecem em `menu`.
    - regressao checada com `npm run build` e `npm test` (14 testes passando).
