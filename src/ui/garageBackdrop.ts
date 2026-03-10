import Phaser from 'phaser';

export function drawGarageBackdrop(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const gfx = scene.add.graphics();

  gfx.fillGradientStyle(0x10151d, 0x10151d, 0x0a0e14, 0x0a0e14, 1);
  gfx.fillRect(0, 0, width, height);

  gfx.fillGradientStyle(0x212a36, 0x212a36, 0x121821, 0x121821, 1);
  gfx.fillRoundedRect(28, 24, width - 56, height - 48, 24);
  gfx.lineStyle(3, 0x7c90ac, 0.9);
  gfx.strokeRoundedRect(28, 24, width - 56, height - 48, 24);

  gfx.fillStyle(0x0f141d, 0.96);
  gfx.fillRect(52, 48, width - 104, 88);
  gfx.lineStyle(2, 0x8ca4c3, 0.85);
  gfx.strokeRect(52, 48, width - 104, 88);

  for (let i = 0; i < 12; i += 1) {
    gfx.fillStyle(0x39485c, 0.75);
    gfx.fillCircle(70 + i * 96, 68, 3);
    gfx.fillCircle(70 + i * 96, 116, 3);
  }

  gfx.fillStyle(0x151c26, 0.92);
  gfx.fillRoundedRect(width - 220, height - 162, 150, 92, 16);
  gfx.lineStyle(2, 0x55657d, 0.72);
  gfx.strokeRoundedRect(width - 220, height - 162, 150, 92, 16);
  gfx.fillStyle(0x6e2f2e, 0.92);
  gfx.fillRect(width - 200, height - 142, 112, 18);
  gfx.fillRect(width - 200, height - 118, 112, 18);
  gfx.fillRect(width - 200, height - 94, 112, 18);

  scene.add.rectangle(width / 2, 92, width - 120, 8, 0x49cfff, 0.16);
  scene.add.rectangle(width / 2, 136, width - 120, 3, 0x4c617c, 0.7);
}
