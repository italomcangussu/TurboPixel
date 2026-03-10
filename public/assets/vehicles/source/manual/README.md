# Manual Vehicle Atlas Pipeline (PNG-first)

This folder is the source of truth for vehicle art.

## Input contract

- One PNG per car in `public/assets/vehicles/source/manual/png/`.
- PNG must be side-view with transparent background.
- Car must face to the right.
- File name must match `spriteKey` from `src/data/cars.ts`:
  - `supra_a80.png`
  - `rx7_fd.png`
  - `nsx_na1.png`
  - `skyline_r34.png`
  - `challenger_hellcat.png`
  - `corvette_zr1_c7.png`
  - `shelby_gt500.png`
  - `porsche_911_gt3.png`
  - `gtr_r35_nismo.png`
  - `f8_tributo.png`
  - `mclaren_720s.png`
  - `aventador_svj.png`

## Manifest

Edit `manifest.json` for per-car tuning:

- `align.scale`: multiplies fit scale.
- `align.offsetX`, `align.offsetY`: fine position adjustments in frame pixels.
- `bounds`: allowed car envelope inside `192x96` frame.
- `orientation.noseX` and `orientation.tailX`: must satisfy `noseX > tailX`.
- `raceFx`: intensity multipliers for generated race effects.

## Generate atlas

Run:

```bash
node scripts/generate-vehicles-atlas.mjs
```

Outputs:

- `public/assets/vehicles/vehicles_atlas.png`
- `public/assets/vehicles/vehicles_atlas.json`
- `public/assets/vehicles/source/vehicles_atlas.svg`

## Fail-fast rules

Generation fails if:

- required PNG is missing,
- transparency is too low,
- orientation is invalid (`noseX <= tailX`),
- transformed car exceeds configured bounds,
- frame contract differs from `192x96`, `6` columns, `24` frames.
