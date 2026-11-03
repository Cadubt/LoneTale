import type { Condition, QuestStatusValue } from './conditions';
import type { Id, JsonPrimitive } from './json';

/**
 * Politica de execucao de um efeito.
 * - `once`: executa uma unica vez na partida (recompensas unicas).
 * - `perVisit`: uma vez por visita ao no.
 * - `always`: toda vez que o efeito e alcancado (repetivel).
 */
export type EffectMode = 'once' | 'perVisit' | 'always';

export interface EffectAddItem {
  type: 'addItem';
  itemId: Id;
  quantity?: number;
}

export interface EffectRemoveItem {
  type: 'removeItem';
  itemId: Id;
  quantity?: number;
  /** Falha a operacao inteira quando o item nao esta disponivel. */
  required?: boolean;
}

export interface EffectConsumeItem {
  type: 'consumeItem';
  itemId: Id;
  quantity?: number;
}

export interface EffectEquipItem {
  type: 'equipItem';
  itemId: Id;
  slot?: string;
}

export interface EffectUnequipItem {
  type: 'unequipItem';
  slot: string;
}

export interface EffectGrantGold {
  type: 'grantGold';
  amount: number;
}

export interface EffectSpendGold {
  type: 'spendGold';
  amount: number;
}

export interface EffectHeal {
  type: 'heal';
  amount: number;
  resourceId?: Id;
  /** Restaura o recurso ao maximo, ignorando `amount`. */
  full?: boolean;
}

export interface EffectDamage {
  type: 'damage';
  amount: number;
  resourceId?: Id;
  ignoreArmor?: boolean;
}

export interface EffectRestoreResource {
  type: 'restoreResource';
  resourceId: Id;
  amount: number;
  full?: boolean;
}

export interface EffectSpendResource {
  type: 'spendResource';
  resourceId: Id;
  amount: number;
}

export interface EffectModifyResourceMax {
  type: 'modifyResourceMax';
  resourceId: Id;
  delta: number;
}

export interface EffectModifyAttribute {
  type: 'modifyAttribute';
  attributeId: Id;
  delta: number;
}

export interface EffectGrantExperience {
  type: 'grantExperience';
  amount: number;
}

export interface EffectUnlockSkill {
  type: 'unlockSkill';
  skillId: Id;
}

export interface EffectStartCombat {
  type: 'startCombat';
  enemyIds: Id[];
  onVictoryNodeId?: Id;
  onDefeatNodeId?: Id;
  onFleeNodeId?: Id;
  fleeAllowed?: boolean;
}

export interface EffectSetQuestStatus {
  type: 'setQuestStatus';
  questId: Id;
  status: QuestStatusValue;
  stage?: number;
}

export interface EffectAdvanceQuestStage {
  type: 'advanceQuestStage';
  questId: Id;
  stage?: number;
}

export interface EffectModifyNpcRelation {
  type: 'modifyNpcRelation';
  npcId: Id;
  delta: number;
}

export interface EffectSetFlag {
  type: 'setFlag';
  flag: Id;
  value: JsonPrimitive;
}

export interface EffectIncrementFlag {
  type: 'incrementFlag';
  flag: Id;
  delta: number;
}

export interface EffectEndAdventure {
  type: 'endAdventure';
  endingId: Id;
}

export interface EffectGoto {
  type: 'goto';
  nodeId: Id;
}

export interface EffectSetCheckpoint {
  type: 'setCheckpoint';
  label?: string;
}

export interface EffectRollTableOutcome {
  weight: number;
  effects?: EffectEntry[];
  nodeId?: Id;
  label?: string;
}

export interface EffectRollTable {
  type: 'rollTable';
  tableId?: Id;
  outcomes: EffectRollTableOutcome[];
}

export type Effect =
  | EffectAddItem
  | EffectRemoveItem
  | EffectConsumeItem
  | EffectEquipItem
  | EffectUnequipItem
  | EffectGrantGold
  | EffectSpendGold
  | EffectHeal
  | EffectDamage
  | EffectRestoreResource
  | EffectSpendResource
  | EffectModifyResourceMax
  | EffectModifyAttribute
  | EffectGrantExperience
  | EffectUnlockSkill
  | EffectStartCombat
  | EffectSetQuestStatus
  | EffectAdvanceQuestStage
  | EffectModifyNpcRelation
  | EffectSetFlag
  | EffectIncrementFlag
  | EffectEndAdventure
  | EffectGoto
  | EffectSetCheckpoint
  | EffectRollTable;

export type EffectType = Effect['type'];

/**
 * Efeito com metadados de execucao.
 * `id` e obrigatorio para `mode: 'once'`: e a chave de idempotencia persistida.
 */
export type EffectEntry = Effect & {
  id?: Id;
  mode?: EffectMode;
  when?: Condition;
};
