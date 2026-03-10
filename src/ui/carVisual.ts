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

function hasEquippedCosmetic(profile: PlayerProfile, carId: string, category: CosmeticCategory): boolean {
  return Boolean(profile.equippedCosmeticsByCar[carId]?.[category]);
}

function warnMissingFrame(frame: string): void {
  if (warnedFrames.has(frame)) {
    return;
  }
  warnedFrames.add(frame);
  console.warn(`[carVisual] missing atlas frame: ${frame}`);
}

function getWheelAnchor(spriteKey: string): { leftX: number; rightX: number; y: number } {
  const tunedAnchors: Record<string, { leftX: number; rightX: number; y: number }> = {
    supra_a80: { leftX: -43, rightX: 43, y: 21 },
    rx7_fd: { leftX: -41, rightX: 43, y: 21 },
    nsx_na1: { leftX: -42, rightX: 42, y: 21 },
    skyline_r34: { leftX: -43, rightX: 44, y: 22 },
    challenger_hellcat: { leftX: -45, rightX: 43, y: 22 },
    corvette_zr1_c7: { leftX: -42, rightX: 43, y: 21 },
    shelby_gt500: { leftX: -45, rightX: 43, y: 22 },
    porsche_911_gt3: { leftX: -42, rightX: 42, y: 21 },
    gtr_r35_nismo: { leftX: -44, rightX: 43, y: 22 },
    f8_tributo: { leftX: -42, rightX: 42, y: 21 },
    mclaren_720s: { leftX: -42, rightX: 42, y: 21 },
    aventador_svj: { leftX: -43, rightX: 43, y: 21 },
  };
  return tunedAnchors[spriteKey] ?? { leftX: -42, rightX: 42, y: 21 };
}

function createWheelSpinnerHub(
  scene: Phaser.Scene,
  x: number,
  y: number,
  wheelColor: number,
): Phaser.GameObjects.Container {
  const hub = scene.add.container(0, 0);
  const spokeColor = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.IntegerToColor(wheelColor),
    Phaser.Display.Color.IntegerToColor(0xffffff),
    100,
    58,
  );
  const spokeTint = Phaser.Display.Color.GetColor(spokeColor.r, spokeColor.g, spokeColor.b);
  const spokes: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < 3; i += 1) {
    const spoke = scene.add.rectangle(0, 0, 0.75, 5.6, spokeTint, 0.42);
    spoke.setRotation(Phaser.Math.DegToRad(i * 45));
    spokes.push(spoke);
  }
  const cap = scene.add.circle(0, 0, 0.95, spokeTint, 0.56);
  hub.add([...spokes, cap]);
  const overlay = scene.add.container(x, y, [hub]);
  overlay.setAlpha(0.3);
  return overlay;
}

function createDebugFallback(
  scene: Phaser.Scene,
  car: CarSpec,
  accentColor: number,
): { objects: Phaser.GameObjects.GameObject[]; wheelHubs: Phaser.GameObjects.Container[] } {
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
  return {
    objects: [shadow, accent, body, cabin, wheelLeft, wheelRight, label, name],
    wheelHubs: [],
  };
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
  const hasSpoilerCustom = hasEquippedCosmetic(config.profile, config.car.id, 'spoiler');
  const hasKitCustom = hasEquippedCosmetic(config.profile, config.car.id, 'bodykit');
  const frame = `veh_${config.car.spriteKey}_${config.variant ?? 'idle'}`;
  const objects: Phaser.GameObjects.GameObject[] = [];
  const wheelHubs: Phaser.GameObjects.Container[] = [];

  if (hasFrame(scene, 'vehiclesAtlas', frame)) {
    const glowY = config.variant === 'race' ? 28 : 26;
    const glowWidth = config.variant === 'race' ? 120 : 108;
    const underGlow = scene.add.ellipse(2, glowY, glowWidth, 9, config.car.accentColor, config.variant === 'race' ? 0.22 : 0.1);
    const spriteShadow = scene.add.ellipse(0, 30, 138, 22, 0x000000, 0.28);
    const base = scene.add.sprite(0, 0, 'vehiclesAtlas', frame);
    base.setOrigin(0.5, 0.5);
    if (bodyColor !== config.car.color) {
      base.setTint(bodyColor);
    }

    const headlightGlow = scene.add.ellipse(78, 10, 24, 6, config.car.headlightTint, config.variant === 'race' ? 0.6 : 0.3);
    const taillightGlow = scene.add.ellipse(-78, 12, 22, 6, config.car.taillightTint, config.variant === 'race' ? 0.56 : 0.3);
    const wheelAnchor = getWheelAnchor(config.car.spriteKey);
    const wheelLeftHub = createWheelSpinnerHub(scene, wheelAnchor.leftX, wheelAnchor.y, wheelColor);
    const wheelRightHub = createWheelSpinnerHub(scene, wheelAnchor.rightX, wheelAnchor.y, wheelColor);
    wheelHubs.push(wheelLeftHub, wheelRightHub);

    objects.push(spriteShadow, underGlow, headlightGlow, taillightGlow, base, wheelLeftHub, wheelRightHub);
    if (hasKitCustom) {
      const splitter = scene.add.rectangle(58, 24, 28, 4, kitColor, 0.44);
      const diffuser = scene.add.rectangle(-57, 24, 24, 4, kitColor, 0.44);
      objects.push(splitter, diffuser);
    }
    if (hasSpoilerCustom) {
      const spoiler = scene.add.rectangle(-52, -12, 18, 4, spoilerColor, 0.46);
      objects.push(spoiler);
    }
  } else {
    warnMissingFrame(frame);
    const fallback = createDebugFallback(scene, config.car, config.car.accentColor);
    wheelHubs.push(...fallback.wheelHubs);
    objects.push(...fallback.objects);
  }

  const container = scene.add.container(config.x, config.y, objects);
  container.setScale(config.scale);
  container.setData('wheelHubs', wheelHubs);
  return container;
}
