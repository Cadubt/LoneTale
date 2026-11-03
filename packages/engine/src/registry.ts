import type { ConditionType } from './types/conditions';
import type { EffectType } from './types/effects';
import type { NodeType } from './types/adventure';

/**
 * Registros canonicos dos tipos declarativos suportados pelo motor.
 *
 * Existem para manter o JSON Schema e os tipos TypeScript sincronizados:
 * as asercoes de exaustividade abaixo quebram a compilacao se um tipo novo
 * for adicionado a uma union sem entrar nesta lista, e os testes comparam
 * estas listas com os `const` declarados no schema.
 */
export const CONDITION_TYPES = [
  'all',
  'any',
  'not',
  'always',
  'never',
  'hasItem',
  'hasEquippedItem',
  'hasSkill',
  'attributeAtLeast',
  'attributeCompare',
  'hasClass',
  'hasRace',
  'goldAtLeast',
  'resourceAtLeast',
  'flagEquals',
  'flagCompare',
  'questStatus',
  'questStageAtLeast',
  'enemyDefeated',
  'nodeVisited',
  'choiceTaken',
  'npcRelationAtLeast',
  'levelAtLeast',
  'endingReached',
] as const satisfies readonly ConditionType[];

export const EFFECT_TYPES = [
  'addItem',
  'removeItem',
  'consumeItem',
  'equipItem',
  'unequipItem',
  'grantGold',
  'spendGold',
  'heal',
  'damage',
  'restoreResource',
  'spendResource',
  'modifyResourceMax',
  'modifyAttribute',
  'grantExperience',
  'unlockSkill',
  'startCombat',
  'setQuestStatus',
  'advanceQuestStage',
  'modifyNpcRelation',
  'setFlag',
  'incrementFlag',
  'endAdventure',
  'goto',
  'setCheckpoint',
  'rollTable',
] as const satisfies readonly EffectType[];

export const NODE_TYPES = [
  'story',
  'dialogue',
  'combat',
  'merchant',
  'discovery',
  'event',
  'skillCheck',
  'checkpoint',
  'ending',
] as const satisfies readonly NodeType[];

/** `true` apenas quando `Registered` cobre toda a union `All`. */
type Exhaustive<All extends string, Registered extends readonly string[]> =
  Exclude<All, Registered[number]> extends never ? true : never;

// Asercoes em tempo de compilacao: faltando um tipo, `never` quebra o build.
const _conditionsAreExhaustive: Exhaustive<ConditionType, typeof CONDITION_TYPES> = true;
const _effectsAreExhaustive: Exhaustive<EffectType, typeof EFFECT_TYPES> = true;
const _nodesAreExhaustive: Exhaustive<NodeType, typeof NODE_TYPES> = true;
void _conditionsAreExhaustive;
void _effectsAreExhaustive;
void _nodesAreExhaustive;
