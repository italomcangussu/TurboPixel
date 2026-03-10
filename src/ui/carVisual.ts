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

export function createCarVisual(
  scene: Phaser.Scene,
  config: {
    x: number;
    y: number;
    scale: number;
    car: CarSpec;
    profile: PlayerProfile;
  },
): Phaser.GameObjects.Container {
  const bodyColor = getEquippedColor(config.profile, config.car.id, 'pintura', config.car.color);
  const wheelColor = getEquippedColor(config.profile, config.car.id, 'rodas', 0x2f2f2f);
  const spoilerColor = getEquippedColor(config.profile, config.car.id, 'spoiler', 0x7f8aa3);
  const kitColor = getEquippedColor(config.profile, config.car.id, 'bodykit', 0x1c1f2a);

  const body = scene.add.rectangle(0, 0, 150, 40, bodyColor).setStrokeStyle(2, 0xffffff, 0.35);
  const cabin = scene.add.rectangle(20, -18, 65, 22, Phaser.Display.Color.IntegerToColor(bodyColor).brighten(15).color);
  const spoiler = scene.add.rectangle(64, -20, 26, 6, spoilerColor);
  const kitFront = scene.add.rectangle(-72, 10, 15, 8, kitColor);
  const kitRear = scene.add.rectangle(72, 10, 15, 8, kitColor);
  const wheelFront = scene.add.circle(-45, 24, 11, wheelColor).setStrokeStyle(2, 0x101010);
  const wheelRear = scene.add.circle(45, 24, 11, wheelColor).setStrokeStyle(2, 0x101010);

  const container = scene.add.container(config.x, config.y, [
    body,
    cabin,
    spoiler,
    kitFront,
    kitRear,
    wheelFront,
    wheelRear,
  ]);
  container.setScale(config.scale);

  return container;
}
