// Shared types (mirrors server/src/types.ts for client use)

export type PronounType = 'he/him' | 'she/her' | 'they/them' | 'they/them (plural)';
export type RelationshipType = 'ally' | 'enemy' | 'neutral';
export type EventStage = 'bloodbath' | 'day' | 'night' | 'feast' | 'all';
export type DeathCause = 'alive' | 'killed' | 'accident' | 'environment' | 'self' | 'infection' | 'exposure' | 'hunger' | 'thirst';

export interface TributeInput {
  id: string;
  name: string;
  pronouns: PronounType;
  imageUrl?: string;
  district?: string;
  skills: string[];
}

export interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  strength: number;
}

export interface SimulationSettings {
  deathsPerRound: number;
  startOnDay: number;
  maxRounds: number;
  feastEnabled: boolean;
}

export interface ResolvedEvent {
  id: string;
  message: string;
  stage: EventStage;
  round: number;
  isFatal: boolean;
  deaths: { tributeId: string; tributeName: string }[];
  killers: { tributeId: string; tributeName: string }[];
  tags: string[];
  cause: DeathCause;
}

export interface SimulationRound {
  roundNumber: number;
  dayPhase: ResolvedEvent[];
  nightPhase: ResolvedEvent[];
  feastPhase?: ResolvedEvent[];
  bloodbathPhase?: ResolvedEvent[];
  survivors: TributeInput[];
  casualties: TributeInput[];
}

export interface SimulationResult {
  id: string;
  totalRounds: number;
  winner?: TributeInput;
  allRounds: SimulationRound[];
  tributeStats: Array<TributeInput & { alive: boolean; deathRound?: number; deathCause: DeathCause; kills: number }>;
  metadata: {
    startedAt: string;
    finishedAt: string;
    totalDeaths: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
