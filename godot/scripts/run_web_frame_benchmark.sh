#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="${GODOT_WEB_DIR:-$ROOT_DIR/godot/export/web}"
PORT="${GODOT_BENCHMARK_PORT:-8060}"
DURATION_MS="${GODOT_BENCHMARK_DURATION_MS:-20000}"
WARMUP_MS="${GODOT_BENCHMARK_WARMUP_MS:-3000}"
OUTPUT_PATH="${GODOT_BENCHMARK_OUTPUT:-$ROOT_DIR/godot/benchmarks/latest.json}"
SCREENSHOT_PATH="${GODOT_BENCHMARK_SCREENSHOT:-$ROOT_DIR/godot/benchmarks/latest.png}"

if [[ ! -d "$WEB_DIR" ]]; then
  echo "Godot web export directory not found: $WEB_DIR"
  echo "Expected an exported build with index.html in this directory."
  exit 1
fi

if [[ ! -f "$WEB_DIR/index.html" ]]; then
  echo "index.html not found in export directory: $WEB_DIR"
  exit 1
fi

cd "$WEB_DIR"
python3 -m http.server "$PORT" >/tmp/godot-benchmark-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT

sleep 1

cd "$ROOT_DIR"
node godot/tools/web_frame_benchmark.mjs \
  --url "http://127.0.0.1:${PORT}/index.html" \
  --duration-ms "$DURATION_MS" \
  --warmup-ms "$WARMUP_MS" \
  --output "$OUTPUT_PATH" \
  --screenshot "$SCREENSHOT_PATH"

echo ""
echo "Benchmark completed."
echo "JSON: $OUTPUT_PATH"
echo "Screenshot: $SCREENSHOT_PATH"
