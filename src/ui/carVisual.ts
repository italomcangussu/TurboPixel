import Phaser from 'phaser';
import { COSMETIC_MAP } from '../data/cosmetics';
import type { CarSpec, CosmeticCategory, PlayerProfile } from '../types';

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

function createProceduralFallback(
  scene: Phaser.Scene,
  bodyColor: number,
  spoilerColor: number,
  kitColor: number,
  wheelColor: number,
): Phaser.GameObjects.GameObject[] {
  // Drop shadow
  const shadow = scene.add.rectangle(5, 18, 155, 30, 0x000000, 0.4);
  
  const body = scene.add.rectangle(0, 0, 150, 40, bodyColor).setStrokeStyle(2, 0x222222, 0.8);
  const cabin = scene.add.rectangle(20, -18, 65, 22, 0x111625); // Sleeker dark window
  const windowGlint = scene.add.rectangle(40, -22, 10, 8, 0xffffff, 0.15).setAngle(-20); // Window reflection
  
  const spoiler = scene.add.rectangle(64, -20, 26, 6, spoilerColor);
  const kitFront = scene.add.rectangle(-72, 12, 12, 12, kitColor);
  const kitRear = scene.add.rectangle(72, 12, 12, 12, kitColor);
  
  // Fake internal rim outline
  const wheelFrontBg = scene.add.circle(-45, 24, 12, 0x0a0a0a);
  const wheelFront = scene.add.circle(-45, 24, 8, wheelColor);
  const wheelRearBg = scene.add.circle(45, 24, 12, 0x0a0a0a);
  const wheelRear = scene.add.circle(45, 24, 8, wheelColor);

  return [shadow, body, cabin, windowGlint, spoiler, kitFront, kitRear, wheelFrontBg, wheelFront, wheelRearBg, wheelRear];
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
  const wheelColor = getEquippedColor(config.profile, config.car.id, 'rodas', 0x2f2f2f);
  const spoilerColor = getEquippedColor(config.profile, config.car.id, 'spoiler', 0x7f8aa3);
  const kitColor = getEquippedColor(config.profile, config.car.id, 'bodykit', 0x1c1f2a);

  const objects: Phaser.GameObjects.GameObject[] = [];
  const frame = `veh_${config.car.spriteKey}_${config.variant ?? 'idle'}`;

  if (hasFrame(scene, 'vehiclesAtlas', frame)) {
    const base = scene.add.sprite(0, 0, 'vehiclesAtlas', frame);
    base.setTint(bodyColor);
    base.setOrigin(0.5);
    objects.push(base);

    // Cosmetic layers to preserve tuning feedback on top of the atlas sprite.
    const spoiler = scene.add.rectangle(28, -12, 18, 4, spoilerColor, 0.9);
    const kitFront = scene.add.rectangle(-38, 8, 12, 5, kitColor, 0.9);
    const kitRear = scene.add.rectangle(38, 8, 12, 5, kitColor, 0.9);
    const wheelFront = scene.add.circle(-18, 14, 6, wheelColor, 0.95).setStrokeStyle(1, 0x0f0f0f);
    const wheelRear = scene.add.circle(20, 14, 6, wheelColor, 0.95).setStrokeStyle(1, 0x0f0f0f);
    objects.push(spoiler, kitFront, kitRear, wheelFront, wheelRear);
  } else {
    objects.push(...createProceduralFallback(scene, bodyColor, spoilerColor, kitColor, wheelColor));
  }

  const container = scene.add.container(config.x, config.y, objects);
  container.setScale(config.scale);
  return container;
}
