import Phaser from 'phaser';

export interface RaceHud {
  timerText: Phaser.GameObjects.Text;
  speedText: Phaser.GameObjects.Text;
  gearText: Phaser.GameObjects.Text;
  shiftText: Phaser.GameObjects.Text;
  countdownText: Phaser.GameObjects.Text;
  resumeText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  rpmNeedle: Phaser.GameObjects.Rectangle;
}

export function createRaceHud(scene: Phaser.Scene): RaceHud {
  const { width, height } = scene.scale;
  const timerText = scene.add
    .text(width / 2, 30, 'Tempo: 0.00s', {
      fontFamily: 'Rajdhani',
      fontSize: '28px',
      fontStyle: '700',
      color: '#f6fbff',
    })
    .setOrigin(0.5);

  const shiftText = scene.add
    .text(width / 2, height - 144, 'Aguardando launch...', {
      fontFamily: 'Rajdhani',
      fontStyle: '700 italic',
      fontSize: '30px',
      color: '#ffd08c',
      stroke: '#10161e',
      strokeThickness: 6,
    })
    .setOrigin(0.5);

  const countdownText = scene.add
    .text(width / 2, 130, '3', {
      fontFamily: 'Teko',
      fontSize: '88px',
      fontStyle: '700',
      color: '#fff0c8',
      stroke: '#151b23',
      strokeThickness: 8,
    })
    .setOrigin(0.5);

  const resumeText = scene.add
    .text(width / 2, height / 2, '', {
      fontFamily: 'Rajdhani',
      fontSize: '38px',
      fontStyle: '700',
      color: '#fff4e0',
      stroke: '#141923',
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(12);

  const hintText = scene.add
    .text(width - 126, height - 168, 'SPACE launch  |  ENTER shift', {
      fontFamily: 'Rajdhani',
      fontSize: '18px',
      fontStyle: '600',
      color: '#d6e6f7',
    })
    .setOrigin(0.5);

  const x = 122;
  const y = height - 106;
  const radius = 82;
  const bg = scene.add.graphics();
  bg.fillStyle(0x10161f, 0.88);
  bg.lineStyle(4, 0x36475e, 1);
  bg.fillCircle(x, y, radius);
  bg.strokeCircle(x, y, radius);

  for (let i = 0; i <= 8; i += 1) {
    const angle = Phaser.Math.DegToRad(180 + i * 22.5);
    const isRedline = i >= 7;
    bg.lineStyle(isRedline ? 4 : 2, isRedline ? 0xff5852 : 0xa6b5ca, 1);
    const startX = x + Math.cos(angle) * (radius - 16);
    const startY = y + Math.sin(angle) * (radius - 16);
    const endX = x + Math.cos(angle) * radius;
    const endY = y + Math.sin(angle) * radius;
    bg.lineBetween(startX, startY, endX, endY);

    const labelX = x + Math.cos(angle) * (radius - 32);
    const labelY = y + Math.sin(angle) * (radius - 32);
    scene.add
      .text(labelX, labelY, `${i}`, {
        fontFamily: 'Rajdhani',
        fontSize: '18px',
        fontStyle: '700',
        color: isRedline ? '#ff5852' : '#edf5ff',
      })
      .setOrigin(0.5);
  }

  const speedText = scene.add
    .text(x, y + 8, '0', {
      fontFamily: 'Teko',
      fontSize: '42px',
      fontStyle: '700',
      color: '#ffffff',
    })
    .setOrigin(0.5, 1);

  scene.add
    .text(x, y + 28, 'km/h', {
      fontFamily: 'Rajdhani',
      fontSize: '14px',
      fontStyle: '600',
      color: '#9fb0c7',
    })
    .setOrigin(0.5, 1);

  const gearText = scene.add
    .text(x, y + 56, 'N', {
      fontFamily: 'Teko',
      fontSize: '28px',
      fontStyle: '700',
      color: '#66ccff',
    })
    .setOrigin(0.5, 1);

  const rpmNeedle = scene.add.rectangle(x, y, radius - 16, 4, 0xff5550);
  rpmNeedle.setOrigin(0, 0.5);
  rpmNeedle.setRotation(Phaser.Math.DegToRad(180));

  const pin = scene.add.graphics();
  pin.fillStyle(0x46586f, 1);
  pin.fillCircle(x, y, 7);

  return {
    timerText,
    speedText,
    gearText,
    shiftText,
    countdownText,
    resumeText,
    hintText,
    rpmNeedle,
  };
}
