import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const URL = process.env.VISUAL_CHECK_URL ?? 'http://127.0.0.1:4173/';
const OUTPUT_DIR = path.resolve('output/visual-check');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCanvas(page) {
  await page.waitForFunction(() => document.querySelector('canvas'));
  const handle = await page.evaluateHandle(() => {
    let best = null;
    let bestArea = 0;
    for (const canvas of document.querySelectorAll('canvas')) {
      const area = (canvas.width || canvas.clientWidth || 0) * (canvas.height || canvas.clientHeight || 0);
      if (area > bestArea) {
        best = canvas;
        bestArea = area;
      }
    }
    return best;
  });
  return handle.asElement();
}

async function getState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? 'null');
  return JSON.parse(raw);
}

async function waitForMode(page, expectedMode, timeoutMs = 6000) {
  await page.waitForFunction(
    (mode) => {
      const text = window.render_game_to_text?.();
      if (!text) return false;
      try {
        const parsed = JSON.parse(text);
        return parsed?.mode === mode;
      } catch {
        return false;
      }
    },
    expectedMode,
    { timeout: timeoutMs },
  );
}

async function waitForGame(page, timeoutMs = 12000) {
  await page.waitForFunction(() => !!window.__turbopixel_game, { timeout: timeoutMs });
}

async function waitForSceneActive(page, sceneKey, timeoutMs = 6000) {
  await page.waitForFunction(
    (key) => Boolean(window.__turbopixel_game?.scene?.isActive?.(key)),
    sceneKey,
    { timeout: timeoutMs },
  );
}

async function captureCanvas(canvas, fileName) {
  await canvas.screenshot({ path: path.join(OUTPUT_DIR, fileName), type: 'png' });
}

async function writeJson(fileName, value) {
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), JSON.stringify(value, null, 2));
}

async function driveRaceScene(page, frames) {
  await page.evaluate((frameCount) => {
    const raceScene = window.__turbopixel_game?.scene.keys.RaceScene;
    if (!raceScene) {
      throw new Error('RaceScene is not active');
    }

    let launchRegistered = false;

    for (let frame = 0; frame < frameCount; frame += 1) {
      raceScene.advanceDeterministic(1000 / 60);

      if (!launchRegistered && raceScene.engine.getElapsedMs() >= 3000) {
        raceScene.handleLaunchOrShift(true);
        launchRegistered = true;
      }

      const player = raceScene.engine.getPlayerCar();
      const playerState = raceScene.engine.getPlayerState();
      if (playerState.launched && player.getGear() < 6 && player.getIdealPassedAtMs() !== null) {
        raceScene.handleLaunchOrShift(false);
      }

      if (raceScene.engine.getPhase() === 'finished') {
        break;
      }
    }
  }, frames);
}

async function main() {
  ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ type: 'console.error', text: msg.text() });
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push({ type: 'pageerror', text: String(error) });
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await waitForGame(page);
  await page.waitForTimeout(1600);

  const canvas = await getCanvas(page);

  await page.evaluate(() => {
    window.__turbopixel_game?.scene.start('MenuScene');
  });
  await waitForMode(page, 'menu', 12000);
  await wait(600);

  await captureCanvas(canvas, 'menu.png');
  await writeJson('menu.json', await getState(page));

  await page.evaluate(() => {
    window.__turbopixel_game?.scene.start('GarageScene');
  });
  await waitForMode(page, 'garage');
  await captureCanvas(canvas, 'garage-page-1.png');
  await writeJson('garage-page-1.json', await getState(page));

  await page.evaluate(() => {
    const garageScene = window.__turbopixel_game?.scene.keys.GarageScene;
    if (!garageScene) return;
    garageScene.page = 1;
    garageScene.scene.restart();
  });
  await wait(700);
  await captureCanvas(canvas, 'garage-page-2.png');
  await writeJson('garage-page-2.json', await getState(page));

  await page.evaluate(() => {
    window.__turbopixel_game?.scene.start('MenuScene');
  });
  await waitForMode(page, 'menu', 12000);

  await page.evaluate(() => {
    window.__turbopixel_game?.scene.start('LeagueScene');
  });
  await waitForMode(page, 'league');
  await page.evaluate(() => {
    const leagueScene = window.__turbopixel_game?.scene.keys.LeagueScene;
    leagueScene?.startSelectedRace?.();
  });
  await waitForMode(page, 'race');
  await wait(350);

  await captureCanvas(canvas, 'race-countdown.png');
  await writeJson('race-countdown.json', await getState(page));

  await driveRaceScene(page, 340);
  await captureCanvas(canvas, 'race-active.png');
  await writeJson('race-active.json', await getState(page));

  await driveRaceScene(page, 1400);
  const raceState = await getState(page);
  if (raceState?.mode === 'race' && raceState?.phase === 'finished') {
    await page.evaluate(() => {
      const game = window.__turbopixel_game;
      const raceScene = game?.scene.keys.RaceScene;
      raceScene?.scene.stop();
      game?.scene.start('ResultScene');
    });
  }

  await waitForSceneActive(page, 'ResultScene', 6000);
  await wait(800);
  const resultState = await getState(page);
  await captureCanvas(canvas, 'result.png');
  await writeJson('result.json', resultState);

  await writeJson('console-errors.json', consoleErrors);
  await browser.close();

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
