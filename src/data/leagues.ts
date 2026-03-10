import type { LeagueSpec } from '../types';

export const LEAGUES: LeagueSpec[] = [
  {
    id: 1,
    name: 'Liga Rua',
    aiReactionMs: 260,
    aiError: 'high',
    entryRequirementLeague: 1,
  },
  {
    id: 2,
    name: 'Liga Nitro',
    aiReactionMs: 220,
    aiError: 'medium',
    entryRequirementLeague: 1,
  },
  {
    id: 3,
    name: 'Liga Turbo',
    aiReactionMs: 180,
    aiError: 'good',
    entryRequirementLeague: 2,
  },
  {
    id: 4,
    name: 'Liga Apex',
    aiReactionMs: 150,
    aiError: 'perfect',
    entryRequirementLeague: 3,
  },
  {
    id: 5,
    name: 'Liga Lenda',
    aiReactionMs: 120,
    aiError: 'elite',
    entryRequirementLeague: 4,
  },
];

export const RACES_PER_LEAGUE = 6;
