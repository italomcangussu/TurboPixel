import type { TrackSpec } from '../types';

export const TRACKS: TrackSpec[] = [
  {
    id: 'mountain-pass',
    name: 'Mountain Pass',
    horizonColor: 0x4a7e93, // Sky blue
    roadColor: 0x1f1f1f, // Dark Asphalt
    accentColor: 0x2e8f46, // Forest green accent
  },
  {
    id: 'forest-dragway',
    name: 'Forest Strip',
    horizonColor: 0x224c6e, 
    roadColor: 0x222222,
    accentColor: 0x8bac36, // Pine green
  },
  {
    id: 'valley-route',
    name: 'Valley Route',
    horizonColor: 0x1a4563,
    roadColor: 0x181818,
    accentColor: 0x429658,
  },
];
