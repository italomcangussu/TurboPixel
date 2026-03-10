import Phaser from 'phaser';
import { COSMETIC_MAP } from '../data/cosmetics';
import type { CarSpec, CosmeticCategory, PlayerProfile } from '../types';

const warnedFrames = new Set<string>();

function getEquippedColor(
  profile: PlayerProfile,
  carId: string,
  category: CosmeticCategory,
  fallback: number,
): number {
  const equippedId = profile.equippedCosmeticsByCar[carId]?.[category];
  if (!equippedId) {
    return fallback;
  }
  return COSMETIC_MAP.get(equippedId)?.color ?? fallback;
}

function hasFrame(scene: Phaser.Scene, texture: string, frame: string): boolean {
  return scene.textures.exists(texture) && scene.textures.get(texture).has(frame);
}

function warnMissingFrame(frame: string): void {
  if (warnedFrames.has(frame)) {
    return;
  }
  warnedFrames.add(frame);
  console.warn(`[carVisual] missing atlas frame: ${frame}`);
}

function createDebugFallback(scene: Phaser.Scene, car: CarSpec, accentColor: number): Phaser.GameObjects.GameObject[] {
  const shadow = scene.add.ellipse(0, 20, 132, 24, 0x000000, 0.42);
  const body = scene.add.rectangle(0, 0, 138, 42, 0xff00ff, 0.95).setStrokeStyle(3, 0x1b1f2a, 1);
  const cabin = scene.add.rectangle(4, -16, 78, 20, 0x43164a, 0.92).setStrokeStyle(2, 0xffc4ff, 0.5);
  const accent = scene.add.rectangle(0, 12, 120, 5, accentColor, 0.75);
  const wheelLeft = scene.add.circle(-40, 20, 12, 0x111111).setStrokeStyle(2, 0xd9dde3, 0.8);
  const wheelRight = scene.add.circle(42, 20, 12, 0x111111).setStrokeStyle(2, 0xd9dde3, 0.8);
  const label = scene.add
    .text(0, -1, 'MISSING', {
      fontFamily: 'Rajdhani',
      fontSize: '16px',
      fontStyle: '700',
      color: '#101520',
    })
    .setOrigin(0.5);
  const name = scene.add
    .text(0, 34, car.model.toUpperCase(), {
      fontFamily: 'Rajdhani',
      fontSize: '10px',
      fontStyle: '700',
      color: '#ffc3ff',
    })
    .setOrigin(0.5);
  return [shadow, accent, body, cabin, wheelLeft, wheelRight, label, name];
}

export function createCarVisual(
  scene: Phaser.Scene,
  config: {
    x: number;
    y: number;
    scale: number;
    car: CarSpec;
    profile: PlayerProfile;
    variant?: 'idle' | 'race';
  },
): Phaser.GameObjects.Container {
  const bodyColor = getEquippedColor(config.profile, config.car.id, 'pintura', config.car.color);
  const wheelColor = getEquippedColor(config.profile, config.car.id, 'rodas', 0xb8bec8);
  const spoilerColor = getEquippedColor(config.profile, config.car.id, 'spoiler', config.car.accentColor);
  const kitColor = getEquippedColor(config.profile, config.car.id, 'bodykit', config.car.accentColor);
  const frame = `veh_${config.car.spriteKey}_${config.variant ?? 'idle'}`;
  const objects: Phaser.GameObjects.GameObject[] = [];

  if (hasFrame(scene, 'vehiclesAtlas', frame)) {
    const glowY = config.variant === 'race' ? 28 : 26;
    const glowWidth = config.variant === 'race' ? 124 : 108;
    const underGlow = scene.add.ellipse(2, glowY, glowWidth, 10, config.car.accentColor, config.variant === 'race' ? 0.48 : 0.24);
    const spriteShadow = scene.add.ellipse(0, 30, 138, 22, 0x000000, 0.28);
    const base = scene.add.sprite(0, 0, 'vehiclesAtlas', frame);
    base.setOrigin(0.5, 0.5);
    if (bodyColor !== config.car.color) {
      base.setTint(bodyColor);
    }

    const headlightGlow = scene.add.ellipse(78, 10, 24, 6, config.car.headlightTint, config.variant === 'race' ? 0.6 : 0.3);
    const taillightGlow = scene.add.ellipse(-78, 12, 22, 6, config.car.taillightTint, config.variant === 'race' ? 0.56 : 0.3);
    const splitter = scene.add.rectangle(58, 24, 28, 4, kitColor, 0.75);
    const diffuser = scene.add.rectangle(-57, 24, 24, 4, kitColor, 0.75);
    const spoiler = scene.add.rectangle(-52, -12, 18, 4, spoilerColor, 0.72);
    const wheelLeft = scene.add.circle(-42, 24, 7, wheelColor, 0.86).setStrokeStyle(1, 0x101316, 0.9);
    const wheelRight = scene.add.circle(42, 24, 7, wheelColor, 0.86).setStrokeStyle(1, 0x101316, 0.9);

    objects.push(spriteShadow, underGlow, headlightGlow, taillightGlow, base, splitter, diffuser, spoiler, wheelLeft, wheelRight);
  } else {
    warnMissingFrame(frame);
    objects.push(...createDebugFallback(scene, config.car, config.car.accentColor));
  }

  const container = scene.add.container(config.x, config.y, objects);
  container.setScale(config.scale);
  return container;
}
