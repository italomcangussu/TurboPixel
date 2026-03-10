import Phaser from 'phaser';

export interface TextButton {
  container: Phaser.GameObjects.Container;
  setLabel: (label: string) => void;
  setActive: (active: boolean) => void;
}

export function createTextButton(
  scene: Phaser.Scene,
  config: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    onClick: () => void;
    fillColor?: number;
  },
): TextButton {
  const baseFill = config.fillColor ?? 0x23304a;
  const hoverFill = 0x2d4d73;
  const pressedFill = 0x3f6a9c;
  const touchPadding = Math.max(10, Math.round(Math.min(config.width, config.height) * 0.2));

  const glow = scene.add.rectangle(0, 0, config.width + 6, config.height + 6, 0x49cfff, 0.08).setOrigin(0.5);
  const rect = scene.add
    .rectangle(0, 0, config.width, config.height, baseFill, 0.96)
    .setOrigin(0.5)
    .setStrokeStyle(2, 0x8ec9ff, 0.9);
  const shine = scene.add.rectangle(0, -config.height * 0.22, config.width - 8, config.height * 0.26, 0xffffff, 0.08);

  const text = scene.add
    .text(0, 0, config.label, {
      fontFamily: 'Teko',
      fontSize: `${Math.max(18, Math.round(config.height * 0.52))}px`,
      fontStyle: '600',
      color: '#f2f7ff',
      align: 'center',
    })
    .setOrigin(0.5);

  const hitZone = scene.add
    .zone(0, 0, config.width + touchPadding * 2, config.height + touchPadding * 2)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  const container = scene.add.container(config.x, config.y, [glow, rect, shine, text, hitZone]);
  container.setSize(config.width + touchPadding * 2, config.height + touchPadding * 2);

  hitZone.on('pointerover', () => {
    rect.setFillStyle(hoverFill, 0.98);
    glow.setFillStyle(0x49cfff, 0.12);
  });

  hitZone.on('pointerout', () => {
    rect.setFillStyle(baseFill, 0.96);
    glow.setFillStyle(0x49cfff, 0.08);
  });

  hitZone.on('pointerdown', () => {
    rect.setFillStyle(pressedFill, 1);
    glow.setFillStyle(0x49cfff, 0.16);
    config.onClick();
  });

  hitZone.on('pointerup', () => {
    rect.setFillStyle(baseFill, 0.96);
    glow.setFillStyle(0x49cfff, 0.08);
  });

  return {
    container,
    setLabel(nextLabel: string) {
      text.setText(nextLabel);
    },
    setActive(active: boolean) {
      hitZone.disableInteractive();
      if (active) {
        hitZone.setInteractive({ useHandCursor: true });
        rect.setFillStyle(baseFill, 0.96);
        glow.setFillStyle(0x49cfff, 0.08);
      } else {
        rect.setFillStyle(0x3d3d3d, 0.75);
        glow.setFillStyle(0x49cfff, 0.03);
      }
    },
  };
}
