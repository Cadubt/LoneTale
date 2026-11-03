import type { Id, JsonPrimitive } from './json';

/**
 * Comparadores suportados pelas condicoes numericas/por valor.
 * Declarativos: nenhuma expressao e interpretada como codigo.
 */
export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export type QuestStatusValue = 'locked' | 'available' | 'active' | 'completed' | 'failed';

/** Como uma escolha indisponivel deve ser apresentada ao jogador. */
export type UnavailableBehavior = 'hide' | 'disable';

export interface ConditionAll {
  type: 'all';
  conditions: Condition[];
}

export interface ConditionAny {
  type: 'any';
  conditions: Condition[];
}

export interface ConditionNot {
  type: 'not';
  condition: Condition;
}

export interface ConditionAlways {
  type: 'always';
}

export interface ConditionNever {
  type: 'never';
}

export interface ConditionHasItem {
  type: 'hasItem';
  itemId: Id;
  quantity?: number;
}

export interface ConditionHasEquippedItem {
  type: 'hasEquippedItem';
  itemId?: Id;
  slot?: string;
}

export interface ConditionHasSkill {
  type: 'hasSkill';
  skillId: Id;
}

export interface ConditionAttributeAtLeast {
  type: 'attributeAtLeast';
  attributeId: Id;
  value: number;
}

export interface ConditionAttributeCompare {
  type: 'attributeCompare';
  attributeId: Id;
  operator: ComparisonOperator;
  value: number;
}

export interface ConditionHasClass {
  type: 'hasClass';
  classIds: Id[];
}

export interface ConditionHasRace {
  type: 'hasRace';
  raceIds: Id[];
}

export interface ConditionGoldAtLeast {
  type: 'goldAtLeast';
  value: number;
}

export interface ConditionResourceAtLeast {
  type: 'resourceAtLeast';
  resourceId: Id;
  value: number;
  /** Compara contra a fracao atual/maxima (0..1) em vez do valor absoluto. */
  asRatio?: boolean;
}

export interface ConditionFlagEquals {
  type: 'flagEquals';
  flag: Id;
  value: JsonPrimitive;
}

export interface ConditionFlagCompare {
  type: 'flagCompare';
  flag: Id;
  operator: ComparisonOperator;
  value: number;
}

export interface ConditionQuestStatus {
  type: 'questStatus';
  questId: Id;
  status: QuestStatusValue | QuestStatusValue[];
}

export interface ConditionQuestStageAtLeast {
  type: 'questStageAtLeast';
  questId: Id;
  stage: number;
}

export interface ConditionEnemyDefeated {
  type: 'enemyDefeated';
  enemyId: Id;
  count?: number;
}

export interface ConditionNodeVisited {
  type: 'nodeVisited';
  nodeId: Id;
  times?: number;
}

export interface ConditionChoiceTaken {
  type: 'choiceTaken';
  nodeId: Id;
  choiceId: Id;
}

export interface ConditionNpcRelation {
  type: 'npcRelationAtLeast';
  npcId: Id;
  value: number;
}

export interface ConditionLevelAtLeast {
  type: 'levelAtLeast';
  value: number;
}

export interface ConditionEndingReached {
  type: 'endingReached';
  endingId: Id;
}

/**
 * Condicao declarativa. Expressoes compostas usam `all` / `any` / `not`.
 * O avaliador nunca executa `eval` nem qualquer codigo vindo do conteudo.
 */
export type Condition =
  | ConditionAll
  | ConditionAny
  | ConditionNot
  | ConditionAlways
  | ConditionNever
  | ConditionHasItem
  | ConditionHasEquippedItem
  | ConditionHasSkill
  | ConditionAttributeAtLeast
  | ConditionAttributeCompare
  | ConditionHasClass
  | ConditionHasRace
  | ConditionGoldAtLeast
  | ConditionResourceAtLeast
  | ConditionFlagEquals
  | ConditionFlagCompare
  | ConditionQuestStatus
  | ConditionQuestStageAtLeast
  | ConditionEnemyDefeated
  | ConditionNodeVisited
  | ConditionChoiceTaken
  | ConditionNpcRelation
  | ConditionLevelAtLeast
  | ConditionEndingReached;

export type ConditionType = Condition['type'];

/** Resultado detalhado da avaliacao, usado para explicar escolhas bloqueadas. */
export interface ConditionResult {
  satisfied: boolean;
  /** Condicoes folha que falharam, na ordem de avaliacao. */
  failed: Array<{ condition: Condition; reason: string }>;
}
