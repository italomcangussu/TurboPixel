#!/usr/bin/env node

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_URL = "http://127.0.0.1:8060/index.html";
const DEFAULT_DURATION_MS = 20000;
const DEFAULT_WARMUP_MS = 3000;
const DEFAULT_OUTPUT = "godot/benchmarks/latest.json";
const DEFAULT_SCREENSHOT = "godot/benchmarks/latest.png";

function readArg(name, fallback) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const rank = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedValues[lower];
  const weight = rank - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function computeMetrics(frameTimes) {
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const total = frameTimes.reduce((sum, v) => sum + v, 0);
  const avg = frameTimes.length === 0 ? 0 : total / frameTimes.length;
  const variance =
    frameTimes.length === 0
      ? 0
      : frameTimes.reduce((sum, v) => sum + (v - avg) ** 2, 0) / frameTimes.length;
  const stdDev = Math.sqrt(variance);

  return {
    samples: frameTimes.length,
    frame_time_ms: {
      min: sorted[0] ?? 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1] ?? 0,
      avg,
      std_dev: stdDev,
    },
    fps: {
      avg: avg > 0 ? 1000 / avg : 0,
      p95: percentile(sorted, 95) > 0 ? 1000 / percentile(sorted, 95) : 0,
    },
  };
}

function evaluateGate(metrics) {
  const p95 = metrics.frame_time_ms.p95;
  const p99 = metrics.frame_time_ms.p99;
  const max = metrics.frame_time_ms.max;
  const pass = p95 <= 22 && p99 <= 30 && max <= 60;
  return {
    pass,
    thresholds_ms: {
      p95_max: 22,
      p99_max: 30,
      max_max: 60,
    },
    observed_ms: { p95, p99, max },
  };
}

async function run() {
  const url = readArg("url", DEFAULT_URL);
  const durationMs = Number(readArg("duration-ms", String(DEFAULT_DURATION_MS)));
  const warmupMs = Number(readArg("warmup-ms", String(DEFAULT_WARMUP_MS)));
  const outputPath = resolve(readArg("output", DEFAULT_OUTPUT));
  const screenshotPath = resolve(readArg("screenshot", DEFAULT_SCREENSHOT));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);

  const sampled = await page.evaluate(
    async ({ durationMsInner, warmupMsInner }) => {
      const start = performance.now();
      const end = start + durationMsInner;
      const warmupEnd = start + warmupMsInner;
      const frameTimes = [];
      let last = performance.now();

      await new Promise((resolvePromise) => {
        const step = (now) => {
          const delta = now - last;
          last = now;
          if (now >= warmupEnd) frameTimes.push(delta);
          if (now < end) {
            requestAnimationFrame(step);
            return;
          }
          resolvePromise();
        };
        requestAnimationFrame(step);
      });

      return {
        frameTimes,
        userAgent: navigator.userAgent,
      };
    },
    { durationMsInner: durationMs, warmupMsInner: warmupMs },
  );

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  const metrics = computeMetrics(sampled.frameTimes);
  const gate = evaluateGate(metrics);
  const result = {
    benchmark: "godot_web_frame_time_v1",
    measured_at_unix: Math.floor(Date.now() / 1000),
    url,
    duration_ms: durationMs,
    warmup_ms: warmupMs,
    runtime: {
      user_agent: sampled.userAgent,
      console_errors_count: consoleErrors.length,
      console_errors: consoleErrors,
    },
    metrics,
    gate,
    artifacts: {
      screenshot: screenshotPath,
    },
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(screenshotPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");

  const status = gate.pass ? "PASS" : "WARN";
  process.stdout.write(
    [
      `[${status}] Frame-time benchmark`,
      `URL: ${url}`,
      `Samples: ${metrics.samples}`,
      `p95: ${metrics.frame_time_ms.p95.toFixed(3)}ms`,
      `p99: ${metrics.frame_time_ms.p99.toFixed(3)}ms`,
      `max: ${metrics.frame_time_ms.max.toFixed(3)}ms`,
      `avg fps: ${metrics.fps.avg.toFixed(2)}`,
      `Output: ${outputPath}`,
      `Screenshot: ${screenshotPath}`,
    ].join("\n"),
  );
}

run().catch((error) => {
  process.stderr.write(`Benchmark failed: ${error?.stack ?? String(error)}\n`);
  process.exit(1);
});
