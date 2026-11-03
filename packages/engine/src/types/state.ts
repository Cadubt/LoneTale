import type { QuestStatusValue } from './conditions';
import type { Id, JsonPrimitive } from './json';

/** Versao do formato do snapshot de estado. */
export const CURRENT_STATE_VERSION = '1.0.0';

export interface ResourcePool {
  current: number;
  max: number;
}

export interface InventoryEntry {
  itemId: Id;
  quantity: number;
}

export interface CharacterState {
  name: string;
  classId: Id | null;
  raceId: Id | null;
  level: number;
  experience: number;
  /** Valores base escolhidos na criacao + modificacoes permanentes. */
  attributes: Record<Id, number>;
  resources: Record<Id, ResourcePool>;
  gold: number;
  inventory: InventoryEntry[];
  /** slot -> itemId. */
  equipment: Record<string, Id | null>;
  skillIds: Id[];
  appearance: Record<Id, JsonPrimitive>;
  description?: string;
  /** Pontos pendentes de distribuicao apos subir de nivel. */
  pendingAttributePoints?: number;
}

export interface CombatantState {
  /** Identificador da instancia dentro do combate (enemyId#n). */
  instanceId: string;
  enemyId: Id;
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  initiative: number;
  alive: boolean;
  cooldowns?: Record<Id, number>;
}

export interface CombatState {
  /** No de combate que originou o encontro. */
  nodeId: Id;
  round: number;
  enemies: CombatantState[];
  /** De quem e a vez. */
  turn: 'player' | 'enemies';
  fleeAllowed: boolean;
  onVictoryNodeId: Id;
  onDefeatNodeId?: Id;
  onFleeNodeId?: Id;
  skillCooldowns?: Record<Id, number>;
  resolution?: 'victory' | 'defeat' | 'fled';
}

export interface PendingSkillCheck {
  nodeId: Id;
  attempts: number;
}

export interface QuestState {
  status: QuestStatusValue;
  stage: number;
}

export interface CheckpointSnapshot {
  nodeId: Id;
  label?: string;
  /** Sequencia em que o checkpoint foi criado. */
  sequence: number;
  character: CharacterState;
  flags: Record<Id, JsonPrimitive>;
  quests: Record<Id, QuestState>;
  npcRelations: Record<Id, number>;
  visitedNodes: Record<Id, number>;
  defeatedEnemies: Record<Id, number>;
  takenChoices: string[];
  consumedEffects: string[];
  merchantPurchases: Record<string, number>;
}

export type GameStatus = 'creating' | 'active' | 'completed' | 'defeated' | 'abandoned';

export interface RngState {
  /** Semente textual da partida; permite reproducao deterministica. */
  seed: string;
  /** Quantidade de numeros ja consumidos. */
  cursor: number;
}

/**
 * Estado completo de uma partida. Serializavel como JSON puro
 * (persistido como snapshot NVARCHAR(MAX) + tabelas relacionais).
 */
export interface GameState {
  stateVersion: string;
  adventureId: Id;
  /** Versao de conteudo a qual a partida esta presa de forma imutavel. */
  adventureVersion: string;
  status: GameStatus;
  currentNodeId: Id;
  previousNodeId: Id | null;
  /** Pilha de retorno para alvos `back`. */
  nodeHistory: Id[];
  /** Sequencia monotonica: usada para idempotencia e concorrencia otimista. */
  sequence: number;
  character: CharacterState;
  flags: Record<Id, JsonPrimitive>;
  visitedNodes: Record<Id, number>;
  quests: Record<Id, QuestState>;
  npcRelations: Record<Id, number>;
  defeatedEnemies: Record<Id, number>;
  /** `nodeId:choiceId` das escolhas ja tomadas. */
  takenChoices: string[];
  /** Chaves de efeitos `once`/`perVisit` ja aplicados. */
  consumedEffects: string[];
  /** `nodeId:itemId` -> quantidade ja comprada, para estoque limitado. */
  merchantPurchases: Record<string, number>;
  reachedEndings: Id[];
  endingId: Id | null;
  combat: CombatState | null;
  pendingSkillCheck: PendingSkillCheck | null;
  checkpoint: CheckpointSnapshot | null;
  rng: RngState;
  startedAt: string;
  updatedAt: string;
  /** Tempo total de jogo em segundos, acumulado pelo servico. */
  playtimeSeconds?: number;
}
