import Phaser from 'phaser';
import './style.css';
import { advanceTime } from './runtime/hooks';
import { getTextSnapshot } from './runtime/textState';
import { BootScene } from './scenes/BootScene';
import { CustomizationScene } from './scenes/CustomizationScene';
import { GarageScene } from './scenes/GarageScene';
import { LeagueScene } from './scenes/LeagueScene';
import { MenuScene } from './scenes/MenuScene';
import { RaceScene } from './scenes/RaceScene';
import { ResultScene } from './scenes/ResultScene';
import { RewardsScene } from './scenes/RewardsScene';
import { UpgradesScene } from './scenes/UpgradesScene';

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    __turbopixel_game?: Phaser.Game;
  }
}

async function clearLocalPwaCacheForDebug(): Promise<void> {
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalHost) {
    return;
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  }
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app container');
}

void clearLocalPwaCacheForDebug();

app.innerHTML = `
  <div class="shell">
    <div class="orientation-warning" id="orientation-warning">
      Gire o aparelho para landscape para correr.
    </div>
    <div id="game-root"></div>
  </div>
`;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 1280,
  height: 720,
  backgroundColor: '#0f1220',
  scene: [
    BootScene,
    MenuScene,
    GarageScene,
    CustomizationScene,
    UpgradesScene,
    LeagueScene,
    RaceScene,
    ResultScene,
    RewardsScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 2,
  },
  banner: false,
});

const orientationWarning = document.querySelector<HTMLDivElement>('#orientation-warning');

function refreshOrientationHint(): void {
  if (!orientationWarning) {
    return;
  }
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  orientationWarning.style.display = isPortrait ? 'flex' : 'none';
}

window.addEventListener('resize', refreshOrientationHint);
refreshOrientationHint();

window.addEventListener('keydown', async (event) => {
  if (event.key.toLowerCase() === 'f') {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
      return;
    }
    await document.exitFullscreen().catch(() => undefined);
  }
});

window.render_game_to_text = () => JSON.stringify(getTextSnapshot());
window.advanceTime = (ms: number) => advanceTime(ms);
window.__turbopixel_game = game;

void game;
