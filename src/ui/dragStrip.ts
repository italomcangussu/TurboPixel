import Phaser from 'phaser';
import { RACE_DISTANCE_METERS } from '../core/constants';
import type { TrackSpec } from '../types';

export const DRAG_TREE_X = 228;
export const DRAG_MIN_X = 170;
export const DRAG_MAX_X = 1110;
export const AI_LANE_Y = 284;
export const PLAYER_LANE_Y = 468;

interface MovingLayer {
  graphics: Phaser.GameObjects.Graphics;
  speedOffset: number;
  xPos: number;
}

export interface DragStripVisual {
  layers: MovingLayer[];
  streaks: Phaser.GameObjects.Group;
  updateTree: (lights: number, phase: 'countdown' | 'racing' | 'finished') => void;
}

function colorToStyle(color: number): Phaser.Display.Color {
  return Phaser.Display.Color.IntegerToColor(color);
}

function lerpColor(start: number, end: number, t: number): number {
  const a = colorToStyle(start);
  const b = colorToStyle(end);
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 1, t);
  return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
}

function createForestLayer(scene: Phaser.Scene, yBase: number, color: number, width: number, amplitude: number): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.fillStyle(color, 1);
  for (let x = -80; x < width * 2; x += 56) {
    const height = amplitude + ((x / 56) % 3) * 10;
    gfx.fillTriangle(x, yBase, x + 34, yBase - height, x + 68, yBase);
  }
  return gfx;
}

function createIndustrialLayer(scene: Phaser.Scene, yBase: number, color: number, width: number): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.fillStyle(color, 1);
  for (let x = -80; x < width * 2; x += 120) {
    const stackHeight = 28 + (Math.abs(x) % 3) * 16;
    gfx.fillRect(x, yBase - stackHeight, 74, stackHeight);
    gfx.fillRect(x + 84, yBase - stackHeight - 12, 10, stackHeight + 12);
    gfx.lineStyle(3, color + 0x090909, 0.6);
    gfx.lineBetween(x + 89, yBase - stackHeight - 12, x + 120, yBase - stackHeight - 38);
  }
  return gfx;
}

function createAirfieldLayer(scene: Phaser.Scene, yBase: number, color: number, width: number): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.fillStyle(color, 1);
  for (let x = -120; x < width * 2; x += 190) {
    gfx.fillRect(x, yBase - 20, 120, 20);
    gfx.fillTriangle(x + 120, yBase, x + 170, yBase, x + 145, yBase - 24);
    gfx.fillRect(x + 148, yBase - 46, 8, 46);
  }
  return gfx;
}

function createMovingLayer(
  scene: Phaser.Scene,
  track: TrackSpec,
  depth: number,
  speedOffset: number,
): MovingLayer {
  const width = scene.scale.width;
  const yBase = 196 + depth * 24;
  let graphics: Phaser.GameObjects.Graphics;

  if (track.environment === 'forest') {
    graphics = createForestLayer(scene, yBase, depth === 0 ? 0x6a8d7c : depth === 1 ? 0x426d55 : 0x2a5138, width, 78 - depth * 12);
  } else if (track.environment === 'industrial') {
    graphics = createIndustrialLayer(scene, yBase, depth === 0 ? 0x68768b : depth === 1 ? 0x445266 : 0x273444, width);
  } else {
    graphics = createAirfieldLayer(scene, yBase, depth === 0 ? 0x6d717b : depth === 1 ? 0x454a55 : 0x2c313a, width);
  }

  return { graphics, speedOffset, xPos: 0 };
}

export function createDragStrip(scene: Phaser.Scene, track: TrackSpec): DragStripVisual {
  const { width, height } = scene.scale;

  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    scene.add.rectangle(width / 2, (height / 18) * i + height / 36, width, height / 18 + 1, lerpColor(track.skyTopColor, track.skyBottomColor, t));
  }

  if (track.timeOfDay === 'day') {
    scene.add.circle(width - 148, 90, 38, 0xfff1bb, 0.82);
  } else if (track.timeOfDay === 'sunset') {
    scene.add.circle(width - 158, 104, 42, 0xffb05c, 0.86);
  } else {
    scene.add.circle(width - 154, 88, 30, 0xd7ddff, 0.72);
  }

  const layers: MovingLayer[] = [
    createMovingLayer(scene, track, 0, 0.06),
    createMovingLayer(scene, track, 1, 0.14),
    createMovingLayer(scene, track, 2, 0.24),
  ];

  scene.add.rectangle(width / 2, AI_LANE_Y + 10, width, 144, track.asphaltColor, 1);
  scene.add.rectangle(width / 2, PLAYER_LANE_Y + 10, width, 144, track.asphaltColor, 1);
  scene.add.rectangle(width / 2, 372, width, 8, 0x0f1217, 1);
  scene.add.rectangle(width / 2, 232, width, 6, 0x0f1217, 1);
  scene.add.rectangle(width / 2, 556, width, 6, 0x0f1217, 1);

  scene.add.rectangle(width / 2, AI_LANE_Y + 54, width, 38, track.rubberColor, 0.46);
  scene.add.rectangle(width / 2, PLAYER_LANE_Y + 54, width, 38, track.rubberColor, 0.46);
  scene.add.rectangle(DRAG_TREE_X - 18, AI_LANE_Y + 28, 104, 84, track.rubberColor, 0.42);
  scene.add.rectangle(DRAG_TREE_X - 18, PLAYER_LANE_Y + 28, 104, 84, track.rubberColor, 0.42);

  for (let dashX = DRAG_TREE_X + 64; dashX < width - 40; dashX += 96) {
    scene.add.rectangle(dashX, AI_LANE_Y + 46, 52, 6, track.laneStripeColor, 0.72);
    scene.add.rectangle(dashX, PLAYER_LANE_Y + 46, 52, 6, track.laneStripeColor, 0.72);
  }

  scene.add.rectangle(width / 2, 216, width, 10, track.barrierPrimary, 1);
  scene.add.rectangle(width / 2, 548, width, 10, track.barrierPrimary, 1);
  for (let barrierX = 0; barrierX < width; barrierX += 48) {
    scene.add.rectangle(barrierX, 216, 24, 10, track.barrierAccent, 0.88);
    scene.add.rectangle(barrierX + 12, 548, 24, 10, track.barrierAccent, 0.88);
  }

  const boardSpecs = [
    { label: '60 FT', distance: 18.288 },
    { label: '330', distance: 100.584 },
    { label: '1/8', distance: 201.168 },
    { label: '1000', distance: 304.8 },
    { label: '1/4', distance: RACE_DISTANCE_METERS },
  ];

  boardSpecs.forEach((board) => {
    const progress = board.distance / RACE_DISTANCE_METERS;
    const x = DRAG_MIN_X + (DRAG_MAX_X - DRAG_MIN_X) * progress;
    const pole = scene.add.rectangle(x, 250, 6, 54, 0x2c3139, 1);
    pole.setOrigin(0.5, 1);
    const sign = scene.add.rectangle(x, 204, 46, 24, 0xe9edf1, 0.96).setStrokeStyle(2, 0x27313f, 1);
    const text = scene.add.text(x, 204, board.label, {
      fontFamily: 'Teko',
      fontSize: '20px',
      fontStyle: '600',
      color: '#151a21',
    });
    text.setOrigin(0.5, 0.5);
    void sign;
    void pole;
  });

  const treeStand = scene.add.rectangle(DRAG_TREE_X, 386, 12, 172, 0x24282f, 1).setOrigin(0.5, 1);
  treeStand.setStrokeStyle(2, 0x566273, 1);
  scene.add.rectangle(DRAG_TREE_X, 214, 60, 18, 0x0d1116, 0.92).setStrokeStyle(2, 0x576372, 1);
  scene.add.text(DRAG_TREE_X, 214, 'TREE', {
    fontFamily: 'Teko',
    fontSize: '20px',
    fontStyle: '600',
    color: '#dfeaf6',
  }).setOrigin(0.5, 0.5);

  const bulbDefs = [
    { y: 246, color: 0xe6f7ff, alpha: 0.12 },
    { y: 268, color: 0xe6f7ff, alpha: 0.12 },
    { y: 294, color: 0xffc454, alpha: 0.12 },
    { y: 320, color: 0xffc454, alpha: 0.12 },
    { y: 346, color: 0xffc454, alpha: 0.12 },
    { y: 372, color: 0x76ff8c, alpha: 0.12 },
    { y: 398, color: 0xff5d58, alpha: 0.12 },
  ];

  const bulbs = bulbDefs.map((bulb) =>
    scene.add.circle(DRAG_TREE_X, bulb.y, 9, bulb.color, bulb.alpha).setStrokeStyle(2, 0x20242a, 1),
  );

  const streaks = scene.add.group();
  for (let i = 0; i < 36; i += 1) {
    const line = scene.add.rectangle(
      Phaser.Math.Between(0, width),
      Phaser.Math.Between(246, height - 110),
      Phaser.Math.Between(20, 72),
      Phaser.Math.Between(2, 4),
      Phaser.Utils.Array.GetRandom([track.lightAccent, 0xffffff, track.barrierPrimary]),
      Phaser.Math.FloatBetween(0.12, 0.36),
    );
    streaks.add(line);
  }

  return {
    layers,
    streaks,
    updateTree(lights: number, phase: 'countdown' | 'racing' | 'finished') {
      bulbs.forEach((bulb, index) => {
        const baseAlpha = index < 2 ? 0.12 : index < 5 ? 0.13 : 0.12;
        bulb.setAlpha(baseAlpha);
      });

      if (phase === 'countdown') {
        for (let i = 0; i < Math.min(3, lights); i += 1) {
          bulbs[2 + i].setAlpha(0.95);
        }
        return;
      }

      if (phase === 'racing') {
        bulbs[5].setAlpha(0.98);
        return;
      }

      bulbs[6].setAlpha(0.82);
    },
  };
}
