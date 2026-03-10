import type { LeagueSpec } from '../types';

export const LEAGUES: LeagueSpec[] = [
  {
    id: 1,
    name: 'Liga Rua',
    aiReactionMs: 300,
    aiError: 'high',
    entryRequirementLeague: 1,
  },
  {
    id: 2,
    name: 'Liga Nitro',
    aiReactionMs: 245,
    aiError: 'medium',
    entryRequirementLeague: 1,
  },
  {
    id: 3,
    name: 'Liga Turbo',
    aiReactionMs: 200,
    aiError: 'good',
    entryRequirementLeague: 2,
  },
  {
    id: 4,
    name: 'Liga Apex',
    aiReactionMs: 165,
    aiError: 'perfect',
    entryRequirementLeague: 3,
  },
  {
    id: 5,
    name: 'Liga Lenda',
    aiReactionMs: 135,
    aiError: 'elite',
    entryRequirementLeague: 4,
  },
];

export const RACES_PER_LEAGUE = 6;
