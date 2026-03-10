# Godot Web Frame-Time Benchmark

Este documento padroniza a medicao de frame-time do export web para fechar o gate tecnico de M1.

## Pre-requisitos

1. Build web do projeto Godot em `godot/export/web/index.html`.
2. Node.js com dependencias do repo instaladas (`npm install`).
3. Python 3 para servidor local (`python3 -m http.server`).

## Execucao rapida

No root do repositorio:

```bash
npm run benchmark:godot:web:local
```

Saidas:

1. JSON de metricas: `godot/benchmarks/latest.json`
2. Screenshot da execucao: `godot/benchmarks/latest.png`

## Parametros via ambiente

1. `GODOT_WEB_DIR` (default: `godot/export/web`)
2. `GODOT_BENCHMARK_PORT` (default: `8060`)
3. `GODOT_BENCHMARK_DURATION_MS` (default: `20000`)
4. `GODOT_BENCHMARK_WARMUP_MS` (default: `3000`)
5. `GODOT_BENCHMARK_OUTPUT` (default: `godot/benchmarks/latest.json`)
6. `GODOT_BENCHMARK_SCREENSHOT` (default: `godot/benchmarks/latest.png`)

Exemplo:

```bash
GODOT_BENCHMARK_DURATION_MS=30000 \
GODOT_BENCHMARK_WARMUP_MS=5000 \
npm run benchmark:godot:web:local
```

## Gate padrao

O benchmark marca `pass=true` quando:

1. `p95 <= 22ms`
2. `p99 <= 30ms`
3. `max <= 60ms`

Esses thresholds podem ser ajustados em `godot/tools/web_frame_benchmark.mjs` conforme target de device.
