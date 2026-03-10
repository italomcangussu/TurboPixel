import { CARS } from './cars';
import type { CosmeticCategory, CosmeticItem, CosmeticRarity } from '../types';

const RARITY_PATTERN: CosmeticRarity[] = [
  'comum',
  'comum',
  'comum',
  'comum',
  'comum',
  'comum',
  'comum',
  'comum',
  'rara',
  'rara',
  'rara',
  'rara',
  'epica',
  'epica',
  'lendaria',
];

const CATEGORY_NAMES: Record<CosmeticCategory, string[]> = {
  spoiler: [
    'Ducktail',
    'Street Blade',
    'Aero Twin',
    'Heritage Arc',
    'Night Fang',
    'Turbo Crest',
    'Stormline',
    'Sunset Wing',
    'Vector Lip',
    'Mirage Hook',
    'Crown Lift',
    'Steel Drift',
    'Nova Tail',
    'Phantom Wing',
    'Titan Arc',
  ],
  rodas: [
    'Circuit 5',
    'Retro Mesh',
    'Monoblock',
    'Blade Ring',
    'Street Forge',
    'Apex Vane',
    'Pulse Rotor',
    'Shadow Dish',
    'Orbit Edge',
    'Flux Line',
    'Helix Grid',
    'Vector Rim',
    'Crown Alloy',
    'Eclipse Pro',
    'Legend Split',
  ],
  bodykit: [
    'Street Trim',
    'Muscle Pack',
    'Retro Flare',
    'Carbon Rail',
    'Boost Arch',
    'Circuit Core',
    'Apex Nose',
    'Shadow Side',
    'Turbo Sculpt',
    'Racer Edge',
    'Storm Vein',
    'Glide Shell',
    'Vortex Pack',
    'Phantom Aero',
    'Titan Kit',
  ],
  pintura: [
    'Brasa Vermelha',
    'Azul Glacier',
    'Verde Signal',
    'Cinza Gunmetal',
    'Laranja Race',
    'Branco Aurora',
    'Amarelo Pulse',
    'Roxo Nitro',
    'Cobre Clutch',
    'Preto Obsidian',
    'Rosa Neon',
    'Ciano Byte',
    'Dourado Rally',
    'Prata Lendaria',
    'Arco Pixel',
  ],
};

const CATEGORY_COLORS: Record<CosmeticCategory, number[]> = {
  spoiler: [
    0x7e90af, 0x6f8ba8, 0x8a9eb8, 0x6982a0, 0x7a8cb5, 0x90a4bc, 0x6e7d95, 0x8199c4,
    0x5d7fb6, 0x5f8ac0, 0x88a1d6, 0x6f9ad1, 0x7cb0df, 0x9bc1ff, 0xb0d2ff,
  ],
  rodas: [
    0x9b9b9b, 0xa9a9a9, 0x8f8f8f, 0xb1b1b1, 0x999999, 0xb8b8b8, 0x8a8a8a, 0xc2c2c2,
    0x9f8f73, 0xa69477, 0x8f7b5f, 0xb8a57a, 0xd0b879, 0xf0d28f, 0xffe2a8,
  ],
  bodykit: [
    0x5f6679, 0x697189, 0x576174, 0x626e80, 0x747f96, 0x4f5f78, 0x63708a, 0x7a8699,
    0x5288a8, 0x4e96b5, 0x5aa7c8, 0x72b3d3, 0x7fc8df, 0xa0def8, 0xb9f0ff,
  ],
  pintura: [
    0xc84343, 0x4478d1, 0x40b36d, 0x5a6068, 0xd28534, 0xe8ecef, 0xe2cf45, 0x7b52cc,
    0xa56b40, 0x1e2228, 0xd04aa8, 0x34c6d3, 0xd0a12b, 0xd3d9df, 0xb7a3ff,
  ],
};

function buildCategory(category: CosmeticCategory): CosmeticItem[] {
  const names = CATEGORY_NAMES[category];
  const colors = CATEGORY_COLORS[category];

  return names.map((name, index) => ({
    id: `${category}-${index + 1}`,
    name,
    category,
    rarity: RARITY_PATTERN[index],
    carCompatibility: CARS.map((car) => car.id),
    visualRef: `${category}_${index + 1}`,
    color: colors[index],
  }));
}

export const COSMETICS: CosmeticItem[] = [
  ...buildCategory('spoiler'),
  ...buildCategory('rodas'),
  ...buildCategory('bodykit'),
  ...buildCategory('pintura'),
];

export const COSMETIC_MAP = new Map(COSMETICS.map((item) => [item.id, item]));
