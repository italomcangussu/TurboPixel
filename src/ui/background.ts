import Phaser from 'phaser';

export function drawAtmosphere(scene: Phaser.Scene, palette?: { top: number; bottom: number; glow: number }): void {
  const width = scene.scale.width;
  const height = scene.scale.height;

  const top = palette?.top ?? 0x141f34;
  const bottom = palette?.bottom ?? 0x0e111a;
  const glow = palette?.glow ?? 0x2d4f7f;

  const stripes = 18;
  for (let i = 0; i < stripes; i += 1) {
    const t = i / (stripes - 1);
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(top),
      Phaser.Display.Color.IntegerToColor(bottom),
      1,
      t,
    );
    const packed = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
    scene.add.rectangle(width / 2, (height / stripes) * i + height / stripes / 2, width, height / stripes + 1, packed);
  }

  scene.add.ellipse(width * 0.78, height * 0.2, width * 0.5, height * 0.3, glow, 0.22);

  for (let i = 0; i < 32; i += 1) {
    const x = (i * 137) % width;
    const y = (i * 83) % Math.floor(height * 0.6);
    const alpha = 0.25 + ((i * 11) % 40) / 100;
    scene.add.rectangle(x, y, 2, 2, 0xc5d6ff, alpha);
  }
}
