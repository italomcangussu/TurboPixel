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
  archetype: string,
  bodyColor: number,
  spoilerColor: number,
  kitColor: number,
  wheelColor: number,
): Phaser.GameObjects.GameObject[] {
  let bodyWidth = 150;
  let bodyHeight = 40;
  let cabinX = 20;
  let cabinWidth = 65;
  let cabinHeight = 22;
  let wheelBaseRear = 45;
  let wheelBaseFront = -45;
  let wheelSizeRear = 8;
  let wheelSizeFront = 8;
  let spoilerConfig = { x: 64, y: -20, w: 26, h: 6, enabled: true };
  let shadowConfig = { w: 155, h: 30, offY: 18 };

  switch (archetype) {
    case 'dragster':
      bodyWidth = 220;
      bodyHeight = 30;
      cabinX = -50;
      cabinWidth = 40;
      cabinHeight = 25;
      wheelBaseRear = -80;
      wheelBaseFront = 95;
      wheelSizeRear = 16;
      wheelSizeFront = 5;
      spoilerConfig = { x: -95, y: -25, w: 30, h: 10, enabled: true };
      shadowConfig = { w: 225, h: 30, offY: 18 };
      break;
    case 'retro_compact':
      bodyWidth = 110;
      bodyHeight = 50;
      cabinX = 0;
      cabinWidth = 70;
      cabinHeight = 35;
      wheelBaseRear = 30;
      wheelBaseFront = -30;
      wheelSizeRear = 7;
      wheelSizeFront = 7;
      spoilerConfig = { x: 0, y: 0, w: 0, h: 0, enabled: false };
      shadowConfig = { w: 115, h: 30, offY: 18 };
      break;
    case 'jdm':
    case 'sport':
    default:
      // Keep standard sleek proportions
      break;
  }

  const shadow = scene.add.rectangle(5, shadowConfig.offY, shadowConfig.w, shadowConfig.h, 0x000000, 0.4);
  const body = scene.add.rectangle(0, 0, bodyWidth, bodyHeight, bodyColor).setStrokeStyle(2, 0x222222, 0.8);
  const cabin = scene.add.rectangle(cabinX, -(bodyHeight/2 + cabinHeight/2 - 2), cabinWidth, cabinHeight, 0x111625);
  
  const glintX = cabinX + cabinWidth/3;
  const glintY = -(bodyHeight/2 + cabinHeight/2);
  const windowGlint = scene.add.rectangle(glintX, glintY, 10, 8, 0xffffff, 0.15).setAngle(-20);
  
  const objects: Phaser.GameObjects.GameObject[] = [shadow, body, cabin, windowGlint];

  if (spoilerConfig.enabled) {
    const spoiler = scene.add.rectangle(spoilerConfig.x, spoilerConfig.y, spoilerConfig.w, spoilerConfig.h, spoilerColor);
    objects.push(spoiler);
  }

  const kitFront = scene.add.rectangle(-bodyWidth/2 + 3, bodyHeight/2 - 6, 12, 12, kitColor);
  const kitRear = scene.add.rectangle(bodyWidth/2 - 3, bodyHeight/2 - 6, 12, 12, kitColor);
  objects.push(kitFront, kitRear);
  
  // Render wheels
  const wheelFrontBg = scene.add.circle(wheelBaseFront, bodyHeight/2 + 4, wheelSizeFront + 4, 0x0a0a0a);
  const wheelFront = scene.add.circle(wheelBaseFront, bodyHeight/2 + 4, wheelSizeFront, wheelColor);
  const wheelRearBg = scene.add.circle(wheelBaseRear, bodyHeight/2 + 4, wheelSizeRear + 4, 0x0a0a0a);
  const wheelRear = scene.add.circle(wheelBaseRear, bodyHeight/2 + 4, wheelSizeRear, wheelColor);
  objects.push(wheelFrontBg, wheelFront, wheelRearBg, wheelRear);

  return objects;
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
    objects.push(...createProceduralFallback(scene, config.car.archetype, bodyColor, spoilerColor, kitColor, wheelColor));
  }

  const container = scene.add.container(config.x, config.y, objects);
  container.setScale(config.scale);
  return container;
}
