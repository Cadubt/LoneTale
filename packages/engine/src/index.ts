/**
 * @lonetale/engine - Adventure Engine
 *
 * Nucleo do LoneTale: interpreta aventuras declaradas em JSON e executa as
 * regras da partida. Nao depende de framework, HTTP nem banco de dados, de modo
 * que o motor funciona independentemente do frontend e pode ser testado e
 * reutilizado (API, ferramentas de linha de comando, simulacoes do Studio).
 */

// Contrato e tipos
export * from './types/json';
export * from './types/conditions';
export * from './types/effects';
export * from './types/adventure';
export * from './types/state';
export * from './types/events';
export * from './types/dice';
export * from './types/actions';
export * from './types/view';

// Erros
export * from './errors';

// Registros de tipos declarativos
export { CONDITION_TYPES, EFFECT_TYPES, NODE_TYPES } from './registry';

// Schema
export { ADVENTURE_JSON_SCHEMA, ADVENTURE_SCHEMA_ID } from './schema';

// Validacao
export {
  validateAdventure,
  assertValidAdventure,
  formatIssues,
  type IssueSeverity,
  type ValidationIssue,
  type ValidationResult,
} from './validation/validate-adventure';
export { walkAdventure, walkCondition, walkEffects, outgoingNodeIds, type Visitor } from './validation/walk';

// Compilacao
export { CompiledAdventure, compileAdventure } from './compile/compiled-adventure';

// Aleatoriedade e dados
export { SeededRng, createSeed } from './random/rng';
export {
  parseDice,
  rollDice,
  isValidDice,
  normalizeDice,
  maxRoll,
  minRoll,
  averageRoll,
} from './random/dice';

// Condicoes
export { evaluateCondition, explainCondition, firstFailureReason, type EvaluationContext } from './conditions/evaluate';

// Efeitos
export {
  applyEffect,
  applyEffects,
  createEffectContext,
  createCheckpoint,
  equipItem,
  unequipSlot,
  grantExperience,
  type EffectContext,
  type Navigation,
} from './effects/apply';

// Personagem
export {
  createCharacter,
  createInitialState,
  getCharacterCreationOptions,
  type CharacterCreationOptions,
  type CreateStateOptions,
} from './character/create';
export {
  attributeModifier,
  effectiveAttribute,
  effectiveAttributes,
  equippedItems,
  equippedWeapon,
  experienceToNextLevel,
  isEquipped,
  itemQuantity,
  recomputeResourceMaxima,
  resourceMaximum,
  totalArmor,
} from './character/derive';

// Combate
export {
  startCombat,
  playerAttack,
  playerUseSkill,
  playerUseItem,
  playerFlee,
  runEnemyTurn,
  finishCombat,
  collectCombatOutcome,
  type StartCombatOptions,
} from './combat/combat';

// Projecao para o cliente
export { buildView } from './view/build-view';

// Motor
export { AdventureEngine, createEngine, type StepResult } from './engine/adventure-engine';
