import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 96;
const COLUMNS = 6;
const VARIANTS = ['idle', 'race'];
const MIN_TRANSPARENCY_RATIO = 0.05;

const PATHS = {
  carsTs: 'src/data/cars.ts',
  manifest: 'public/assets/vehicles/source/manual/manifest.json',
  atlasPng: 'public/assets/vehicles/vehicles_atlas.png',
  atlasJson: 'public/assets/vehicles/vehicles_atlas.json',
  atlasSvg: 'public/assets/vehicles/source/vehicles_atlas.svg',
};

function fail(message) {
  throw new Error(`[vehicles-atlas] ${message}`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensurePositiveNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    fail(`${label} must be a positive number`);
  }
}

function ensureNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(`${label} must be a number`);
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function extractSpriteKeysFromCarsTs(source) {
  const matches = [...source.matchAll(/spriteKey:\s*'([^']+)'/g)];
  const keys = [];
  const seen = new Set();
  for (const match of matches) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  if (keys.length === 0) {
    fail('no spriteKey entries found in src/data/cars.ts');
  }
  return keys;
}

function validateFrameContract(frameConfig) {
  if (!frameConfig || typeof frameConfig !== 'object') {
    fail('manifest.frame is required');
  }
  if (frameConfig.width !== FRAME_WIDTH || frameConfig.height !== FRAME_HEIGHT || frameConfig.columns !== COLUMNS) {
    fail(`manifest.frame must be { width: ${FRAME_WIDTH}, height: ${FRAME_HEIGHT}, columns: ${COLUMNS} }`);
  }
}

function validateManifestEntry(entry, spriteKey, rootDir) {
  if (!entry || typeof entry !== 'object') {
    fail(`manifest entry for ${spriteKey} is missing`);
  }
  if (entry.spriteKey !== spriteKey) {
    fail(`manifest entry spriteKey mismatch. Expected ${spriteKey}, received ${entry.spriteKey}`);
  }
  if (typeof entry.sourcePng !== 'string' || entry.sourcePng.length === 0) {
    fail(`sourcePng is required for ${spriteKey}`);
  }

  const sourcePath = path.resolve(rootDir, entry.sourcePng);
  return {
    spriteKey,
    sourcePath,
    sourcePng: entry.sourcePng,
    align: {
      scale: entry.align?.scale ?? 1,
      offsetX: entry.align?.offsetX ?? 0,
      offsetY: entry.align?.offsetY ?? 0,
    },
    bounds: {
      minX: entry.bounds?.minX,
      maxX: entry.bounds?.maxX,
      minY: entry.bounds?.minY,
      maxY: entry.bounds?.maxY,
    },
    orientation: {
      noseX: entry.orientation?.noseX,
      tailX: entry.orientation?.tailX,
    },
    raceFx: {
      smoke: entry.raceFx?.smoke ?? 1,
      trail: entry.raceFx?.trail ?? 1,
      wheelBlur: entry.raceFx?.wheelBlur ?? 1,
      rearGlow: entry.raceFx?.rearGlow ?? 1,
    },
  };
}

function validateEntryValues(entry) {
  ensurePositiveNumber(entry.align.scale, `${entry.spriteKey}.align.scale`);
  ensureNumber(entry.align.offsetX, `${entry.spriteKey}.align.offsetX`);
  ensureNumber(entry.align.offsetY, `${entry.spriteKey}.align.offsetY`);

  ensureNumber(entry.bounds.minX, `${entry.spriteKey}.bounds.minX`);
  ensureNumber(entry.bounds.maxX, `${entry.spriteKey}.bounds.maxX`);
  ensureNumber(entry.bounds.minY, `${entry.spriteKey}.bounds.minY`);
  ensureNumber(entry.bounds.maxY, `${entry.spriteKey}.bounds.maxY`);

  if (entry.bounds.minX >= entry.bounds.maxX || entry.bounds.minY >= entry.bounds.maxY) {
    fail(`${entry.spriteKey}.bounds min values must be smaller than max values`);
  }

  if (
    entry.bounds.minX < 0 ||
    entry.bounds.maxX > FRAME_WIDTH ||
    entry.bounds.minY < 0 ||
    entry.bounds.maxY > FRAME_HEIGHT
  ) {
    fail(`${entry.spriteKey}.bounds must stay inside frame ${FRAME_WIDTH}x${FRAME_HEIGHT}`);
  }

  ensureNumber(entry.orientation.noseX, `${entry.spriteKey}.orientation.noseX`);
  ensureNumber(entry.orientation.tailX, `${entry.spriteKey}.orientation.tailX`);
  if (entry.orientation.noseX <= entry.orientation.tailX) {
    fail(`${entry.spriteKey}.orientation invalid: noseX must be greater than tailX`);
  }

  ensureNumber(entry.raceFx.smoke, `${entry.spriteKey}.raceFx.smoke`);
  ensureNumber(entry.raceFx.trail, `${entry.spriteKey}.raceFx.trail`);
  ensureNumber(entry.raceFx.wheelBlur, `${entry.spriteKey}.raceFx.wheelBlur`);
  ensureNumber(entry.raceFx.rearGlow, `${entry.spriteKey}.raceFx.rearGlow`);

  if (entry.raceFx.smoke < 0 || entry.raceFx.trail < 0 || entry.raceFx.wheelBlur < 0 || entry.raceFx.rearGlow < 0) {
    fail(`${entry.spriteKey}.raceFx values must be >= 0`);
  }
}

function buildFrames(spriteKeys) {
  const frames = {};
  let index = 0;
  for (const key of spriteKeys) {
    for (const variant of VARIANTS) {
      const x = (index % COLUMNS) * FRAME_WIDTH;
      const y = Math.floor(index / COLUMNS) * FRAME_HEIGHT;
      const frameName = `veh_${key}_${variant}`;
      frames[frameName] = {
        frame: { x, y, w: FRAME_WIDTH, h: FRAME_HEIGHT },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: FRAME_WIDTH, h: FRAME_HEIGHT },
        sourceSize: { w: FRAME_WIDTH, h: FRAME_HEIGHT },
      };
      index += 1;
    }
  }
  return frames;
}

function buildReferenceSvg(width, height, frames) {
  const cells = Object.entries(frames)
    .map(([name, spec]) => {
      const x = spec.frame.x;
      const y = spec.frame.y;
      return `<rect x="${x}" y="${y}" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" fill="none" stroke="#1f2f4a" stroke-opacity="0.25" stroke-width="1"/>\n<text x="${x + 6}" y="${y + 12}" fill="#dbe6ff" fill-opacity="0.65" font-family="Rajdhani, monospace" font-size="8">${name}</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#060a12"/>
  <image href="../vehicles_atlas.png" x="0" y="0" width="${width}" height="${height}" image-rendering="pixelated"/>
  <g>${cells}</g>
</svg>\n`;
}

function toDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function composeAtlasWithPlaywright(entries, spriteKeys) {
  const rows = Math.ceil((spriteKeys.length * VARIANTS.length) / COLUMNS);
  const atlasWidth = COLUMNS * FRAME_WIDTH;
  const atlasHeight = rows * FRAME_HEIGHT;

  const sourcePayload = [];
  for (const entry of entries) {
    const bytes = await fs.readFile(entry.sourcePath).catch(() => {
      fail(`missing source PNG for ${entry.spriteKey}: ${entry.sourcePng}`);
    });
    sourcePayload.push({
      ...entry,
      dataUrl: toDataUrl(bytes),
    });
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: atlasWidth, height: atlasHeight }, deviceScaleFactor: 1 });
    await page.setContent('<!doctype html><html><body style="margin:0;background:transparent;"></body></html>');

    const result = await page.evaluate(
      async ({ cars, spriteKeys, frameWidth, frameHeight, columns, variants, minTransparencyRatio }) => {
        const rows = Math.ceil((spriteKeys.length * variants.length) / columns);
        const atlasWidth = columns * frameWidth;
        const atlasHeight = rows * frameHeight;

        const loadImage = (src) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`could not load image ${src.slice(0, 48)}...`));
            img.src = src;
          });

        const scanAlphaBBox = (data, width, height, threshold) => {
          let minX = width;
          let minY = height;
          let maxX = -1;
          let maxY = -1;
          let opaque = 0;
          let transparent = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const alpha = data[(y * width + x) * 4 + 3];
              if (alpha > threshold) {
                opaque += 1;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              } else {
                transparent += 1;
              }
            }
          }
          if (maxX < minX || maxY < minY) {
            return null;
          }
          return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
            transparentRatio: transparent / (width * height),
            opaque,
          };
        };

        const drawShadow = (ctx, x, y, width, isRace) => {
          ctx.save();
          ctx.globalAlpha = isRace ? 0.42 : 0.3;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.ellipse(x, y, width * (isRace ? 0.52 : 0.48), isRace ? 9 : 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };

        const drawRaceFx = (ctx, spec, drawBox) => {
          const rearX = drawBox.x + drawBox.w * 0.08;
          const frontX = drawBox.x + drawBox.w * 0.92;
          const wheelY = drawBox.y + drawBox.h * 0.88;
          const rearWheelX = drawBox.x + drawBox.w * 0.28;
          const frontWheelX = drawBox.x + drawBox.w * 0.72;

          const smokePower = Math.max(0, spec.raceFx.smoke);
          const trailPower = Math.max(0, spec.raceFx.trail);
          const wheelPower = Math.max(0, spec.raceFx.wheelBlur);
          const rearGlowPower = Math.max(0, spec.raceFx.rearGlow);

          if (trailPower > 0) {
            const trailWidth = drawBox.w * (0.45 + 0.3 * Math.min(1.5, trailPower));
            const grad = ctx.createLinearGradient(drawBox.x - trailWidth * 0.65, wheelY + 3, drawBox.x + drawBox.w * 0.52, wheelY + 3);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.35, `rgba(137, 201, 255, ${0.08 * trailPower})`);
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(drawBox.x - trailWidth * 0.65, wheelY, trailWidth, 6);
          }

          if (smokePower > 0) {
            const smokeRadiusX = drawBox.w * (0.16 + 0.12 * Math.min(1.5, smokePower));
            const smokeGrad = ctx.createRadialGradient(rearX - smokeRadiusX * 0.15, wheelY - 2, 1, rearX, wheelY - 1, smokeRadiusX);
            smokeGrad.addColorStop(0, `rgba(255,255,255,${0.38 * smokePower})`);
            smokeGrad.addColorStop(0.45, `rgba(240,245,250,${0.22 * smokePower})`);
            smokeGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = smokeGrad;
            ctx.beginPath();
            ctx.ellipse(rearX, wheelY - 1, smokeRadiusX, 9 + 4 * smokePower, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          if (wheelPower > 0) {
            const blurOpacity = Math.min(0.26, 0.16 * wheelPower);
            ctx.fillStyle = `rgba(150,180,220,${blurOpacity})`;
            ctx.beginPath();
            ctx.ellipse(rearWheelX, wheelY, drawBox.w * 0.085, 5.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(frontWheelX, wheelY, drawBox.w * 0.085, 5.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          if (rearGlowPower > 0) {
            const glowGrad = ctx.createRadialGradient(rearX - 2, drawBox.y + drawBox.h * 0.58, 1, rearX, drawBox.y + drawBox.h * 0.58, drawBox.w * 0.14);
            glowGrad.addColorStop(0, `rgba(255,72,72,${0.38 * rearGlowPower})`);
            glowGrad.addColorStop(1, 'rgba(255,72,72,0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.ellipse(rearX, drawBox.y + drawBox.h * 0.58, drawBox.w * 0.14, 5, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          const headGlow = ctx.createRadialGradient(frontX, drawBox.y + drawBox.h * 0.58, 1, frontX, drawBox.y + drawBox.h * 0.58, drawBox.w * 0.09);
          headGlow.addColorStop(0, 'rgba(160,240,255,0.22)');
          headGlow.addColorStop(1, 'rgba(160,240,255,0)');
          ctx.fillStyle = headGlow;
          ctx.beginPath();
          ctx.ellipse(frontX, drawBox.y + drawBox.h * 0.58, drawBox.w * 0.09, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        };

        const drawIdleFx = (ctx, drawBox) => {
          const rearX = drawBox.x + drawBox.w * 0.08;
          const frontX = drawBox.x + drawBox.w * 0.92;
          ctx.fillStyle = 'rgba(255,72,72,0.1)';
          ctx.beginPath();
          ctx.ellipse(rearX, drawBox.y + drawBox.h * 0.58, drawBox.w * 0.08, 3.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(140,235,255,0.1)';
          ctx.beginPath();
          ctx.ellipse(frontX, drawBox.y + drawBox.h * 0.58, drawBox.w * 0.07, 3.1, 0, 0, Math.PI * 2);
          ctx.fill();
        };

        const atlasCanvas = document.createElement('canvas');
        atlasCanvas.width = atlasWidth;
        atlasCanvas.height = atlasHeight;
        const atlasCtx = atlasCanvas.getContext('2d', { willReadFrequently: true });
        if (!atlasCtx) {
          throw new Error('could not create atlas context');
        }

        atlasCtx.clearRect(0, 0, atlasWidth, atlasHeight);

        let frameIndex = 0;

        for (const spriteKey of spriteKeys) {
          const spec = cars.find((entry) => entry.spriteKey === spriteKey);
          if (!spec) {
            throw new Error(`manifest missing spriteKey ${spriteKey}`);
          }

          const image = await loadImage(spec.dataUrl);
          if (spec.orientation.noseX > image.width || spec.orientation.tailX < 0) {
            throw new Error(`${spriteKey}: orientation noseX/tailX must reference source image width`);
          }

          const sourceCanvas = document.createElement('canvas');
          sourceCanvas.width = image.width;
          sourceCanvas.height = image.height;
          const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
          if (!sourceCtx) {
            throw new Error(`${spriteKey}: could not create source context`);
          }
          sourceCtx.clearRect(0, 0, image.width, image.height);
          sourceCtx.drawImage(image, 0, 0);

          const sourceData = sourceCtx.getImageData(0, 0, image.width, image.height);
          const sourceBox = scanAlphaBBox(sourceData.data, image.width, image.height, 8);
          if (!sourceBox) {
            throw new Error(`${spriteKey}: source PNG has no visible pixels`);
          }
          if (sourceBox.transparentRatio < minTransparencyRatio) {
            throw new Error(`${spriteKey}: source PNG transparency too low (${sourceBox.transparentRatio.toFixed(3)}). Expected transparent background`);
          }

          if (spec.orientation.noseX <= spec.orientation.tailX) {
            throw new Error(`${spriteKey}: orientation invalid. noseX must be greater than tailX`);
          }

          const boundsWidth = spec.bounds.maxX - spec.bounds.minX;
          const boundsHeight = spec.bounds.maxY - spec.bounds.minY;
          if (boundsWidth <= 0 || boundsHeight <= 0) {
            throw new Error(`${spriteKey}: invalid bounds`);
          }

          const fitScale = Math.min(boundsWidth / sourceBox.width, boundsHeight / sourceBox.height);
          const drawScale = fitScale * spec.align.scale;
          const drawWidth = sourceBox.width * drawScale;
          const drawHeight = sourceBox.height * drawScale;
          const drawCenterX = (spec.bounds.minX + spec.bounds.maxX) / 2 + spec.align.offsetX;
          const drawCenterY = (spec.bounds.minY + spec.bounds.maxY) / 2 + spec.align.offsetY;
          const drawX = drawCenterX - drawWidth / 2;
          const drawY = drawCenterY - drawHeight / 2;
          const drawBox = { x: drawX, y: drawY, w: drawWidth, h: drawHeight };

          const validateCanvas = document.createElement('canvas');
          validateCanvas.width = frameWidth;
          validateCanvas.height = frameHeight;
          const validateCtx = validateCanvas.getContext('2d', { willReadFrequently: true });
          if (!validateCtx) {
            throw new Error(`${spriteKey}: could not create validation context`);
          }

          validateCtx.clearRect(0, 0, frameWidth, frameHeight);
          validateCtx.drawImage(
            sourceCanvas,
            sourceBox.minX,
            sourceBox.minY,
            sourceBox.width,
            sourceBox.height,
            drawX,
            drawY,
            drawWidth,
            drawHeight,
          );

          const validated = validateCtx.getImageData(0, 0, frameWidth, frameHeight);
          const frameBox = scanAlphaBBox(validated.data, frameWidth, frameHeight, 8);
          if (!frameBox) {
            throw new Error(`${spriteKey}: no visible pixels after transform`);
          }

          if (
            frameBox.minX < spec.bounds.minX ||
            frameBox.maxX > spec.bounds.maxX ||
            frameBox.minY < spec.bounds.minY ||
            frameBox.maxY > spec.bounds.maxY
          ) {
            throw new Error(
              `${spriteKey}: envelope out of bounds. actual=[${frameBox.minX},${frameBox.maxX},${frameBox.minY},${frameBox.maxY}] expected=[${spec.bounds.minX},${spec.bounds.maxX},${spec.bounds.minY},${spec.bounds.maxY}]`,
            );
          }

          for (const variant of variants) {
            const frameX = (frameIndex % columns) * frameWidth;
            const frameY = Math.floor(frameIndex / columns) * frameHeight;
            const isRace = variant === 'race';

            atlasCtx.save();
            atlasCtx.beginPath();
            atlasCtx.rect(frameX, frameY, frameWidth, frameHeight);
            atlasCtx.clip();
            atlasCtx.translate(frameX, frameY);

            drawShadow(atlasCtx, drawBox.x + drawBox.w * 0.5, drawBox.y + drawBox.h * 0.95, drawBox.w, isRace);
            if (isRace) {
              drawRaceFx(atlasCtx, spec, drawBox);
            } else {
              drawIdleFx(atlasCtx, drawBox);
            }

            atlasCtx.drawImage(
              sourceCanvas,
              sourceBox.minX,
              sourceBox.minY,
              sourceBox.width,
              sourceBox.height,
              drawBox.x,
              drawBox.y,
              drawBox.w,
              drawBox.h,
            );

            atlasCtx.restore();
            frameIndex += 1;
          }
        }

        return {
          atlasDataUrl: atlasCanvas.toDataURL('image/png'),
          width: atlasWidth,
          height: atlasHeight,
        };
      },
      {
        cars: sourcePayload,
        spriteKeys,
        frameWidth: FRAME_WIDTH,
        frameHeight: FRAME_HEIGHT,
        columns: COLUMNS,
        variants: VARIANTS,
        minTransparencyRatio: MIN_TRANSPARENCY_RATIO,
      },
    );

    const base64 = result.atlasDataUrl.replace(/^data:image\/png;base64,/, '');
    return {
      png: Buffer.from(base64, 'base64'),
      width: result.width,
      height: result.height,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const root = process.cwd();

  const carsTsPath = path.resolve(root, PATHS.carsTs);
  const manifestPath = path.resolve(root, PATHS.manifest);
  const outAtlasPngPath = path.resolve(root, PATHS.atlasPng);
  const outAtlasJsonPath = path.resolve(root, PATHS.atlasJson);
  const outAtlasSvgPath = path.resolve(root, PATHS.atlasSvg);

  const carsTsSource = await fs.readFile(carsTsPath, 'utf8');
  const spriteKeys = extractSpriteKeysFromCarsTs(carsTsSource);

  const manifest = await readJson(manifestPath);
  validateFrameContract(manifest.frame);

  if (!Array.isArray(manifest.cars) || manifest.cars.length === 0) {
    fail('manifest.cars must be a non-empty array');
  }

  const manifestByKey = new Map();
  for (const entry of manifest.cars) {
    if (!entry?.spriteKey) {
      fail('every manifest car must define spriteKey');
    }
    if (manifestByKey.has(entry.spriteKey)) {
      fail(`duplicate manifest spriteKey: ${entry.spriteKey}`);
    }
    manifestByKey.set(entry.spriteKey, entry);
  }

  for (const key of spriteKeys) {
    if (!manifestByKey.has(key)) {
      fail(`manifest is missing spriteKey from cars.ts: ${key}`);
    }
  }

  for (const key of manifestByKey.keys()) {
    if (!spriteKeys.includes(key)) {
      fail(`manifest has unknown spriteKey not present in cars.ts: ${key}`);
    }
  }

  const entries = spriteKeys.map((key) => {
    const parsed = validateManifestEntry(manifestByKey.get(key), key, root);
    validateEntryValues(parsed);
    return parsed;
  });

  const frames = buildFrames(spriteKeys);
  const { png, width, height } = await composeAtlasWithPlaywright(entries, spriteKeys);

  await fs.mkdir(path.dirname(outAtlasPngPath), { recursive: true });
  await fs.mkdir(path.dirname(outAtlasJsonPath), { recursive: true });
  await fs.mkdir(path.dirname(outAtlasSvgPath), { recursive: true });

  await fs.writeFile(outAtlasPngPath, png);
  await fs.writeFile(outAtlasJsonPath, JSON.stringify({ frames }, null, 2));
  await fs.writeFile(outAtlasSvgPath, buildReferenceSvg(width, height, frames), 'utf8');

  console.log(`[vehicles-atlas] generated ${path.relative(root, outAtlasPngPath)}`);
  console.log(`[vehicles-atlas] generated ${path.relative(root, outAtlasJsonPath)}`);
  console.log(`[vehicles-atlas] generated ${path.relative(root, outAtlasSvgPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
