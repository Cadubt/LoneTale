import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import { EngineError } from '../errors';
import { isValidDice } from '../random/dice';
import { ADVENTURE_JSON_SCHEMA } from '../schema';
import { CURRENT_SCHEMA_VERSION, type AdventureDocument } from '../types/adventure';
import type { Condition } from '../types/conditions';
import type { EffectEntry } from '../types/effects';
import type { Id } from '../types/json';
import { outgoingNodeIds, walkAdventure } from './walk';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  /** Codigo estavel, adequado para traducao na interface do Studio. */
  code: string;
  /** Caminho JSON-ish dentro do documento, ex.: nodes[3].choices[1].conditions. */
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

let cachedValidator: ValidateFunction | null = null;

function getStructuralValidator(): ValidateFunction {
  if (!cachedValidator) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      allowUnionTypes: true,
    });
    addFormats(ajv);
    cachedValidator = ajv.compile(ADVENTURE_JSON_SCHEMA);
  }
  return cachedValidator;
}

function formatAjvError(error: ErrorObject): ValidationIssue {
  const path = error.instancePath ? error.instancePath.replace(/^\//, '').replace(/\//g, '.') : '(raiz)';
  const extra =
    error.keyword === 'additionalProperties' && typeof error.params.additionalProperty === 'string'
      ? ` (propriedade desconhecida: "${error.params.additionalProperty}")`
      : '';
  return {
    severity: 'error',
    code: `schema.${error.keyword}`,
    path,
    message: `${error.message ?? 'documento invalido'}${extra}`,
  };
}

interface Issues {
  error(code: string, path: string, message: string): void;
  warn(code: string, path: string, message: string): void;
}

function createIssueCollector(): { issues: ValidationIssue[]; api: Issues } {
  const issues: ValidationIssue[] = [];
  return {
    issues,
    api: {
      error: (code, path, message) => issues.push({ severity: 'error', code, path, message }),
      warn: (code, path, message) => issues.push({ severity: 'warning', code, path, message }),
    },
  };
}

function findDuplicates(ids: Id[]): Id[] {
  const seen = new Set<Id>();
  const duplicates = new Set<Id>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * Valida um documento de aventura em duas camadas:
 *
 * 1. Estrutural, contra o JSON Schema versionado.
 * 2. Semantica: integridade referencial (todo id citado existe), unicidade de
 *    ids, expressoes de dados, idempotencia de efeitos `once` e alcancabilidade
 *    dos nos.
 *
 * Erros impedem a publicacao; avisos sao apresentados no Studio.
 */
export function validateAdventure(input: unknown): ValidationResult {
  const { issues, api } = createIssueCollector();
  const validate = getStructuralValidator();

  if (!validate(input)) {
    for (const error of validate.errors ?? []) {
      issues.push(formatAjvError(error));
    }
    return splitIssues(issues);
  }

  const doc = input as AdventureDocument;
  validateSemantics(doc, api);
  return splitIssues(issues);
}

function splitIssues(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  return { valid: errors.length === 0, errors, warnings };
}

function validateSemantics(doc: AdventureDocument, issues: Issues): void {
  // --- versao do contrato -------------------------------------------------
  const [docMajor] = doc.schemaVersion.split('.');
  const [currentMajor] = CURRENT_SCHEMA_VERSION.split('.');
  if (docMajor !== currentMajor) {
    issues.error(
      'schemaVersion.unsupported',
      'schemaVersion',
      `Versao de contrato "${doc.schemaVersion}" incompativel com a suportada por este motor (${CURRENT_SCHEMA_VERSION}).`,
    );
  }

  // --- unicidade de identificadores --------------------------------------
  const collections: Array<[string, Array<{ id: Id }> | undefined]> = [
    ['nodes', doc.nodes],
    ['attributes', doc.attributes],
    ['resources', doc.resources],
    ['classes', doc.classes],
    ['races', doc.races],
    ['skills', doc.skills],
    ['items', doc.items],
    ['enemies', doc.enemies],
    ['npcs', doc.npcs],
    ['quests', doc.quests],
    ['variables', doc.variables],
    ['endings', doc.endings],
    ['assets', doc.assets],
  ];
  for (const [name, list] of collections) {
    const duplicates = findDuplicates((list ?? []).map((entry) => entry.id));
    for (const duplicate of duplicates) {
      issues.error('id.duplicated', name, `Identificador duplicado em ${name}: "${duplicate}".`);
    }
  }

  const nodeIds = new Set(doc.nodes.map((node) => node.id));
  const attributeIds = new Set(doc.attributes.map((entry) => entry.id));
  const resourceIds = new Set(doc.resources.map((entry) => entry.id));
  const classIds = new Set(doc.classes.map((entry) => entry.id));
  const raceIds = new Set(doc.races.map((entry) => entry.id));
  const skillIds = new Set((doc.skills ?? []).map((entry) => entry.id));
  const itemIds = new Set((doc.items ?? []).map((entry) => entry.id));
  const enemyIds = new Set((doc.enemies ?? []).map((entry) => entry.id));
  const npcIds = new Set((doc.npcs ?? []).map((entry) => entry.id));
  const questIds = new Set((doc.quests ?? []).map((entry) => entry.id));
  const variableIds = new Set((doc.variables ?? []).map((entry) => entry.id));
  const endingIds = new Set(doc.endings.map((entry) => entry.id));
  const assetIds = new Set((doc.assets ?? []).map((entry) => entry.id));
  const equipmentSlots = new Set(doc.ruleset.inventory?.equipmentSlots ?? []);

  const requireRef = (
    set: Set<Id>,
    id: Id | undefined,
    kind: string,
    path: string,
    code = 'ref.missing',
  ): void => {
    if (id === undefined) {
      return;
    }
    if (!set.has(id)) {
      issues.error(code, path, `${kind} "${id}" nao existe no documento.`);
    }
  };

  const requireAsset = (id: Id | undefined, path: string): void => {
    if (id === undefined) {
      return;
    }
    if (!assetIds.has(id)) {
      issues.warn('asset.missing', path, `Asset "${id}" nao foi declarado em "assets".`);
    }
  };

  const requireDice = (expression: string | undefined, path: string): void => {
    if (expression === undefined) {
      return;
    }
    if (!isValidDice(expression)) {
      issues.error('dice.invalid', path, `Expressao de dados invalida: "${expression}".`);
      return;
    }
    const allowed = doc.ruleset.allowedDice;
    if (allowed && allowed.length > 0 && !allowed.includes(expression)) {
      issues.warn(
        'dice.notAllowed',
        path,
        `Expressao "${expression}" nao consta em ruleset.allowedDice.`,
      );
    }
  };

  // --- ruleset -------------------------------------------------------------
  requireDice(doc.ruleset.skillCheck.defaultDice, 'ruleset.skillCheck.defaultDice');
  requireDice(doc.ruleset.combat.initiativeDice, 'ruleset.combat.initiativeDice');
  requireDice(doc.ruleset.combat.fleeCheck?.dice, 'ruleset.combat.fleeCheck.dice');
  requireDice(doc.ruleset.combat.attackRules?.hitDice, 'ruleset.combat.attackRules.hitDice');
  requireRef(
    attributeIds,
    doc.ruleset.combat.fleeCheck?.attributeId,
    'Atributo',
    'ruleset.combat.fleeCheck.attributeId',
  );
  requireRef(
    attributeIds,
    doc.ruleset.combat.attackRules?.attackAttributeId,
    'Atributo',
    'ruleset.combat.attackRules.attackAttributeId',
  );
  requireRef(
    attributeIds,
    doc.ruleset.combat.attackRules?.damageAttributeId,
    'Atributo',
    'ruleset.combat.attackRules.damageAttributeId',
  );
  requireRef(resourceIds, doc.ruleset.death.vitalResourceId, 'Recurso', 'ruleset.death.vitalResourceId');
  requireRef(endingIds, doc.ruleset.death.endingId, 'Final', 'ruleset.death.endingId');
  requireRef(nodeIds, doc.ruleset.death.nodeId, 'No', 'ruleset.death.nodeId');

  if (doc.ruleset.death.onVitalDepleted === 'ending' && !doc.ruleset.death.endingId) {
    issues.error(
      'death.endingRequired',
      'ruleset.death',
      'Com onVitalDepleted = "ending" e obrigatorio informar endingId.',
    );
  }
  if (doc.ruleset.death.onVitalDepleted === 'goto' && !doc.ruleset.death.nodeId) {
    issues.error(
      'death.nodeRequired',
      'ruleset.death',
      'Com onVitalDepleted = "goto" e obrigatorio informar nodeId.',
    );
  }

  if (!doc.resources.some((resource) => resource.vital) && !doc.ruleset.death.vitalResourceId) {
    issues.warn(
      'resource.noVital',
      'resources',
      'Nenhum recurso marcado como vital; o primeiro da lista sera usado como pontos de vida.',
    );
  }

  const thresholds = doc.ruleset.progression.xpThresholds;
  for (let i = 1; i < thresholds.length; i += 1) {
    if ((thresholds[i] ?? 0) <= (thresholds[i - 1] ?? 0)) {
      issues.error(
        'progression.thresholdsNotAscending',
        `ruleset.progression.xpThresholds[${i}]`,
        'Os limites de experiencia devem ser estritamente crescentes.',
      );
      break;
    }
  }

  doc.resources.forEach((resource, index) => {
    requireRef(
      attributeIds,
      resource.derivedFrom?.attributeId,
      'Atributo',
      `resources[${index}].derivedFrom.attributeId`,
    );
  });

  doc.ruleset.progression.onLevelUp?.resourceGains?.forEach((gain, index) => {
    requireRef(
      resourceIds,
      gain.resourceId,
      'Recurso',
      `ruleset.progression.onLevelUp.resourceGains[${index}].resourceId`,
    );
  });

  // --- criacao de personagem ----------------------------------------------
  const creation = doc.characterCreation;
  requireRef(nodeIds, creation.startNodeId, 'No inicial', 'characterCreation.startNodeId');
  requireDice(creation.attributes.rollDice, 'characterCreation.attributes.rollDice');
  creation.allowedClassIds?.forEach((id, index) => {
    requireRef(classIds, id, 'Classe', `characterCreation.allowedClassIds[${index}]`);
  });
  creation.allowedRaceIds?.forEach((id, index) => {
    requireRef(raceIds, id, 'Raca', `characterCreation.allowedRaceIds[${index}]`);
  });
  creation.startingSkillIds?.forEach((id, index) => {
    requireRef(skillIds, id, 'Pericia', `characterCreation.startingSkillIds[${index}]`);
  });
  creation.startingItems?.forEach((entry, index) => {
    requireRef(itemIds, entry.itemId, 'Item', `characterCreation.startingItems[${index}].itemId`);
    if (entry.slot && equipmentSlots.size > 0 && !equipmentSlots.has(entry.slot)) {
      issues.error(
        'slot.unknown',
        `characterCreation.startingItems[${index}].slot`,
        `Slot "${entry.slot}" nao consta em ruleset.inventory.equipmentSlots.`,
      );
    }
  });
  if (creation.attributes.method === 'pointBuy' && creation.attributes.points === undefined) {
    issues.error(
      'creation.pointsRequired',
      'characterCreation.attributes',
      'O metodo "pointBuy" exige a quantidade de pontos a distribuir.',
    );
  }
  if (creation.attributes.method === 'roll' && !creation.attributes.rollDice) {
    issues.error(
      'creation.rollDiceRequired',
      'characterCreation.attributes',
      'O metodo "roll" exige a expressao de dados em rollDice.',
    );
  }
  if ((creation.allowedClassIds ?? doc.classes).length === 0) {
    issues.error('creation.noClasses', 'characterCreation.allowedClassIds', 'Nenhuma classe disponivel.');
  }
  if ((creation.allowedRaceIds ?? doc.races).length === 0) {
    issues.error('creation.noRaces', 'characterCreation.allowedRaceIds', 'Nenhuma raca disponivel.');
  }

  // --- definicoes de conteudo ---------------------------------------------
  const checkModifiers = (
    modifiers: { attributes?: Record<Id, number>; resources?: Record<Id, number> } | undefined,
    path: string,
  ): void => {
    for (const id of Object.keys(modifiers?.attributes ?? {})) {
      requireRef(attributeIds, id, 'Atributo', `${path}.attributes.${id}`);
    }
    for (const id of Object.keys(modifiers?.resources ?? {})) {
      requireRef(resourceIds, id, 'Recurso', `${path}.resources.${id}`);
    }
  };

  doc.classes.forEach((entry, index) => {
    checkModifiers(entry.modifiers, `classes[${index}].modifiers`);
    entry.startingSkillIds?.forEach((id, i) => {
      requireRef(skillIds, id, 'Pericia', `classes[${index}].startingSkillIds[${i}]`);
    });
    entry.startingItems?.forEach((item, i) => {
      requireRef(itemIds, item.itemId, 'Item', `classes[${index}].startingItems[${i}].itemId`);
    });
    entry.allowedRaceIds?.forEach((id, i) => {
      requireRef(raceIds, id, 'Raca', `classes[${index}].allowedRaceIds[${i}]`);
    });
    requireAsset(entry.portrait, `classes[${index}].portrait`);
  });

  doc.races.forEach((entry, index) => {
    checkModifiers(entry.modifiers, `races[${index}].modifiers`);
    entry.allowedClassIds?.forEach((id, i) => {
      requireRef(classIds, id, 'Classe', `races[${index}].allowedClassIds[${i}]`);
    });
    requireAsset(entry.portrait, `races[${index}].portrait`);
    for (const [fieldId, optionIds] of Object.entries(entry.appearanceRestrictions ?? {})) {
      const field = creation.appearanceFields?.find((candidate) => candidate.id === fieldId);
      if (!field) {
        issues.error(
          'appearance.fieldMissing',
          `races[${index}].appearanceRestrictions.${fieldId}`,
          `Campo de aparencia "${fieldId}" nao foi declarado em characterCreation.appearanceFields.`,
        );
        continue;
      }
      const allowed = new Set((field.options ?? []).map((option) => option.id));
      optionIds.forEach((optionId) => {
        if (!allowed.has(optionId)) {
          issues.error(
            'appearance.optionMissing',
            `races[${index}].appearanceRestrictions.${fieldId}`,
            `Opcao "${optionId}" nao existe no campo de aparencia "${fieldId}".`,
          );
        }
      });
    }
  });

  doc.skills?.forEach((entry, index) => {
    requireRef(resourceIds, entry.cost?.resourceId, 'Recurso', `skills[${index}].cost.resourceId`);
    requireDice(entry.combat?.damageDice, `skills[${index}].combat.damageDice`);
    requireRef(
      attributeIds,
      entry.combat?.scalingAttributeId,
      'Atributo',
      `skills[${index}].combat.scalingAttributeId`,
    );
  });

  doc.items?.forEach((entry, index) => {
    requireDice(entry.stats?.damageDice, `items[${index}].stats.damageDice`);
    requireAsset(entry.image, `items[${index}].image`);
    requireAsset(entry.icon, `items[${index}].icon`);
    for (const id of Object.keys(entry.stats?.attributeModifiers ?? {})) {
      requireRef(attributeIds, id, 'Atributo', `items[${index}].stats.attributeModifiers.${id}`);
    }
    for (const id of Object.keys(entry.stats?.resourceMaxModifiers ?? {})) {
      requireRef(resourceIds, id, 'Recurso', `items[${index}].stats.resourceMaxModifiers.${id}`);
    }
    const needsSlot = entry.kind === 'weapon' || entry.kind === 'armor' || entry.kind === 'shield' || entry.kind === 'accessory';
    if (needsSlot && !entry.slot) {
      issues.error(
        'item.slotRequired',
        `items[${index}].slot`,
        `Itens do tipo "${entry.kind}" precisam declarar o slot de equipamento.`,
      );
    }
    if (entry.slot && equipmentSlots.size > 0 && !equipmentSlots.has(entry.slot)) {
      issues.error(
        'slot.unknown',
        `items[${index}].slot`,
        `Slot "${entry.slot}" nao consta em ruleset.inventory.equipmentSlots.`,
      );
    }
    if (entry.kind === 'consumable' && !entry.useEffects?.length) {
      issues.warn(
        'item.consumableWithoutEffect',
        `items[${index}]`,
        'Consumivel sem useEffects nao faz nada ao ser usado.',
      );
    }
  });

  doc.enemies?.forEach((entry, index) => {
    requireDice(entry.attack?.dice, `enemies[${index}].attack.dice`);
    requireAsset(entry.image, `enemies[${index}].image`);
    for (const id of Object.keys(entry.attributes ?? {})) {
      requireRef(attributeIds, id, 'Atributo', `enemies[${index}].attributes.${id}`);
    }
    entry.loot?.forEach((loot, i) => {
      requireRef(itemIds, loot.itemId, 'Item', `enemies[${index}].loot[${i}].itemId`);
    });
    entry.abilities?.forEach((ability, i) => {
      requireDice(ability.damageDice, `enemies[${index}].abilities[${i}].damageDice`);
    });
    if (entry.gold && entry.gold.min > entry.gold.max) {
      issues.error(
        'enemy.goldRange',
        `enemies[${index}].gold`,
        'O ouro minimo nao pode ser maior que o maximo.',
      );
    }
    if (!entry.attack?.dice && !entry.attack?.flatDamage && !entry.abilities?.length) {
      issues.warn(
        'enemy.harmless',
        `enemies[${index}]`,
        'Criatura sem ataque nem habilidades nunca causa dano.',
      );
    }
  });

  doc.npcs?.forEach((entry, index) => {
    requireAsset(entry.portrait, `npcs[${index}].portrait`);
  });

  doc.endings.forEach((entry, index) => {
    requireAsset(entry.image, `endings[${index}].image`);
  });

  doc.assets?.forEach((entry, index) => {
    if (!/^(https?:\/\/|\/|[\w./-]+$)/.test(entry.src)) {
      issues.warn('asset.srcSuspicious', `assets[${index}].src`, `Origem "${entry.src}" nao parece uma URL ou caminho valido.`);
    }
  });

  // --- condicoes e efeitos -------------------------------------------------
  const seenOnceEffectIds = new Map<Id, string>();
  /** Pericias citadas em condicoes `hasSkill`: servem como requisito, nao como acao. */
  const skillsUsedAsRequirement = new Set<Id>();

  const checkCondition = (condition: Condition, path: string): void => {
    switch (condition.type) {
      case 'hasItem':
        requireRef(itemIds, condition.itemId, 'Item', `${path}.itemId`);
        break;
      case 'hasEquippedItem':
        requireRef(itemIds, condition.itemId, 'Item', `${path}.itemId`);
        if (condition.slot && equipmentSlots.size > 0 && !equipmentSlots.has(condition.slot)) {
          issues.error('slot.unknown', `${path}.slot`, `Slot "${condition.slot}" nao existe.`);
        }
        break;
      case 'hasSkill':
        requireRef(skillIds, condition.skillId, 'Pericia', `${path}.skillId`);
        skillsUsedAsRequirement.add(condition.skillId);
        break;
      case 'attributeAtLeast':
      case 'attributeCompare':
        requireRef(attributeIds, condition.attributeId, 'Atributo', `${path}.attributeId`);
        break;
      case 'hasClass':
        condition.classIds.forEach((id, i) => {
          requireRef(classIds, id, 'Classe', `${path}.classIds[${i}]`);
        });
        break;
      case 'hasRace':
        condition.raceIds.forEach((id, i) => {
          requireRef(raceIds, id, 'Raca', `${path}.raceIds[${i}]`);
        });
        break;
      case 'resourceAtLeast':
        requireRef(resourceIds, condition.resourceId, 'Recurso', `${path}.resourceId`);
        break;
      case 'flagEquals':
      case 'flagCompare':
        if (!variableIds.has(condition.flag)) {
          issues.warn(
            'variable.undeclared',
            `${path}.flag`,
            `Variavel "${condition.flag}" nao foi declarada em "variables"; sera tratada como ausente.`,
          );
        }
        break;
      case 'questStatus':
      case 'questStageAtLeast':
        requireRef(questIds, condition.questId, 'Missao', `${path}.questId`);
        break;
      case 'enemyDefeated':
        requireRef(enemyIds, condition.enemyId, 'Criatura', `${path}.enemyId`);
        break;
      case 'nodeVisited':
      case 'choiceTaken':
        requireRef(nodeIds, condition.nodeId, 'No', `${path}.nodeId`);
        break;
      case 'npcRelationAtLeast':
        requireRef(npcIds, condition.npcId, 'NPC', `${path}.npcId`);
        break;
      case 'endingReached':
        requireRef(endingIds, condition.endingId, 'Final', `${path}.endingId`);
        break;
      case 'all':
      case 'any':
        if (condition.conditions.length === 0) {
          issues.warn('condition.empty', path, 'Lista de condicoes vazia e sempre satisfeita.');
        }
        break;
      default:
        break;
    }
  };

  const checkEffect = (effect: EffectEntry, path: string): void => {
    if (effect.mode === 'once') {
      if (!effect.id) {
        issues.error(
          'effect.onceRequiresId',
          path,
          'Efeitos com mode = "once" precisam de um "id" estavel: ele e a chave de idempotencia persistida.',
        );
      } else {
        const previous = seenOnceEffectIds.get(effect.id);
        if (previous) {
          issues.error(
            'effect.onceIdDuplicated',
            path,
            `O id de efeito "${effect.id}" ja e usado em ${previous}. Ids de efeitos "once" devem ser unicos no documento.`,
          );
        } else {
          seenOnceEffectIds.set(effect.id, path);
        }
      }
    }

    switch (effect.type) {
      case 'addItem':
      case 'removeItem':
      case 'consumeItem':
      case 'equipItem':
        requireRef(itemIds, effect.itemId, 'Item', `${path}.itemId`);
        if (effect.type === 'equipItem' && effect.slot && equipmentSlots.size > 0 && !equipmentSlots.has(effect.slot)) {
          issues.error('slot.unknown', `${path}.slot`, `Slot "${effect.slot}" nao existe.`);
        }
        break;
      case 'unequipItem':
        if (equipmentSlots.size > 0 && !equipmentSlots.has(effect.slot)) {
          issues.error('slot.unknown', `${path}.slot`, `Slot "${effect.slot}" nao existe.`);
        }
        break;
      case 'heal':
      case 'damage':
        requireRef(resourceIds, effect.resourceId, 'Recurso', `${path}.resourceId`);
        break;
      case 'restoreResource':
      case 'spendResource':
      case 'modifyResourceMax':
        requireRef(resourceIds, effect.resourceId, 'Recurso', `${path}.resourceId`);
        break;
      case 'modifyAttribute':
        requireRef(attributeIds, effect.attributeId, 'Atributo', `${path}.attributeId`);
        break;
      case 'unlockSkill':
        requireRef(skillIds, effect.skillId, 'Pericia', `${path}.skillId`);
        break;
      case 'startCombat':
        if (effect.enemyIds.length === 0) {
          issues.error('combat.noEnemies', `${path}.enemyIds`, 'startCombat precisa de ao menos uma criatura.');
        }
        effect.enemyIds.forEach((id, i) => {
          requireRef(enemyIds, id, 'Criatura', `${path}.enemyIds[${i}]`);
        });
        requireRef(nodeIds, effect.onVictoryNodeId, 'No', `${path}.onVictoryNodeId`);
        requireRef(nodeIds, effect.onDefeatNodeId, 'No', `${path}.onDefeatNodeId`);
        requireRef(nodeIds, effect.onFleeNodeId, 'No', `${path}.onFleeNodeId`);
        break;
      case 'setQuestStatus':
      case 'advanceQuestStage':
        requireRef(questIds, effect.questId, 'Missao', `${path}.questId`);
        break;
      case 'modifyNpcRelation':
        requireRef(npcIds, effect.npcId, 'NPC', `${path}.npcId`);
        break;
      case 'setFlag':
      case 'incrementFlag':
        if (!variableIds.has(effect.flag)) {
          issues.warn(
            'variable.undeclared',
            `${path}.flag`,
            `Variavel "${effect.flag}" nao foi declarada em "variables".`,
          );
        } else if (effect.type === 'incrementFlag') {
          const variable = doc.variables?.find((candidate) => candidate.id === effect.flag);
          if (variable && variable.type !== 'number') {
            issues.error(
              'variable.typeMismatch',
              `${path}.flag`,
              `incrementFlag exige uma variavel numerica; "${effect.flag}" e do tipo "${variable.type}".`,
            );
          }
        }
        break;
      case 'endAdventure':
        requireRef(endingIds, effect.endingId, 'Final', `${path}.endingId`);
        break;
      case 'goto':
        requireRef(nodeIds, effect.nodeId, 'No', `${path}.nodeId`);
        break;
      case 'rollTable':
        effect.outcomes.forEach((outcome, i) => {
          requireRef(nodeIds, outcome.nodeId, 'No', `${path}.outcomes[${i}].nodeId`);
        });
        break;
      default:
        break;
    }
  };

  walkAdventure(doc, {
    condition: checkCondition,
    effect: checkEffect,
    choice: (choice, path) => {
      if (!choice.target && !choice.effects?.some((effect) => effect.type === 'goto' || effect.type === 'endAdventure' || effect.type === 'startCombat')) {
        issues.warn(
          'choice.noTarget',
          path,
          'Escolha sem "target" e sem efeito de navegacao mantem o jogador no mesmo no.',
        );
      }
      if (choice.unavailableBehavior && !choice.conditions) {
        issues.warn(
          'choice.behaviorWithoutConditions',
          path,
          'unavailableBehavior nao tem efeito em uma escolha sem condicoes.',
        );
      }
    },
    node: (node, path) => {
      requireAsset(node.image, `${path}.image`);
      node.media?.forEach((media, i) => requireAsset(media.assetId, `${path}.media[${i}].assetId`));
      requireAsset(node.audio?.musicAssetId, `${path}.audio.musicAssetId`);
      requireAsset(node.audio?.ambienceAssetId, `${path}.audio.ambienceAssetId`);
      requireAsset(node.audio?.sfxAssetId, `${path}.audio.sfxAssetId`);
      requireRef(nodeIds, node.fallbackNodeId, 'No', `${path}.fallbackNodeId`);

      if (node.entryConditions && !node.fallbackNodeId) {
        issues.error(
          'node.fallbackRequired',
          `${path}.fallbackNodeId`,
          'Nos com entryConditions precisam de fallbackNodeId para o caso de a condicao falhar.',
        );
      }

      const duplicateChoiceIds = findDuplicates((node.choices ?? []).map((choice) => choice.id));
      for (const duplicate of duplicateChoiceIds) {
        issues.error(
          'choice.idDuplicated',
          `${path}.choices`,
          `Escolha duplicada "${duplicate}" no no "${node.id}".`,
        );
      }

      switch (node.type) {
        case 'dialogue':
          requireRef(npcIds, node.npcId, 'NPC', `${path}.npcId`);
          node.lines.forEach((line, i) => {
            requireRef(npcIds, line.speakerNpcId, 'NPC', `${path}.lines[${i}].speakerNpcId`);
            requireAsset(line.portrait, `${path}.lines[${i}].portrait`);
          });
          break;
        case 'combat':
          node.encounter.enemies.forEach((entry, i) => {
            requireRef(enemyIds, entry.enemyId, 'Criatura', `${path}.encounter.enemies[${i}].enemyId`);
          });
          requireRef(nodeIds, node.encounter.onVictoryNodeId, 'No', `${path}.encounter.onVictoryNodeId`);
          requireRef(nodeIds, node.encounter.onDefeatNodeId, 'No', `${path}.encounter.onDefeatNodeId`);
          requireRef(nodeIds, node.encounter.onFleeNodeId, 'No', `${path}.encounter.onFleeNodeId`);
          requireAsset(node.encounter.backgroundAssetId, `${path}.encounter.backgroundAssetId`);
          if (!doc.ruleset.combat.enabled) {
            issues.error(
              'combat.disabled',
              path,
              'Existe um no de combate, mas ruleset.combat.enabled e falso.',
            );
          }
          if ((node.encounter.fleeAllowed ?? doc.ruleset.combat.fleeAllowed) && !node.encounter.onFleeNodeId) {
            issues.warn(
              'combat.fleeWithoutNode',
              `${path}.encounter.onFleeNodeId`,
              'Fuga permitida sem onFleeNodeId: o jogador voltara ao no anterior.',
            );
          }
          break;
        case 'merchant':
          requireRef(npcIds, node.npcId, 'NPC', `${path}.npcId`);
          requireRef(nodeIds, node.leaveNodeId, 'No', `${path}.leaveNodeId`);
          node.stock.forEach((entry, i) => {
            requireRef(itemIds, entry.itemId, 'Item', `${path}.stock[${i}].itemId`);
            const item = doc.items?.find((candidate) => candidate.id === entry.itemId);
            if (entry.price === undefined && item && item.value === undefined) {
              issues.error(
                'merchant.priceMissing',
                `${path}.stock[${i}]`,
                `Sem "price" no estoque e sem "value" no item "${entry.itemId}" o preco fica indefinido.`,
              );
            }
          });
          break;
        case 'discovery':
          requireRef(nodeIds, node.continueNodeId, 'No', `${path}.continueNodeId`);
          break;
        case 'event':
          requireRef(nodeIds, node.continueNodeId, 'No', `${path}.continueNodeId`);
          node.outcomes?.forEach((outcome, i) => {
            requireRef(nodeIds, outcome.nodeId, 'No', `${path}.outcomes[${i}].nodeId`);
          });
          if (!node.outcomes?.length && !node.continueNodeId && !node.choices?.length) {
            issues.error(
              'event.noResolution',
              path,
              'No de evento sem outcomes, continueNodeId nem escolhas e um beco sem saida.',
            );
          }
          break;
        case 'skillCheck': {
          const check = node.check;
          requireRef(attributeIds, check.attributeId, 'Atributo', `${path}.check.attributeId`);
          requireRef(skillIds, check.skillId, 'Pericia', `${path}.check.skillId`);
          requireDice(check.dice, `${path}.check.dice`);
          requireRef(nodeIds, check.onSuccessNodeId, 'No', `${path}.check.onSuccessNodeId`);
          requireRef(nodeIds, check.onFailureNodeId, 'No', `${path}.check.onFailureNodeId`);
          requireRef(nodeIds, check.onCriticalSuccessNodeId, 'No', `${path}.check.onCriticalSuccessNodeId`);
          requireRef(nodeIds, check.onCriticalFailureNodeId, 'No', `${path}.check.onCriticalFailureNodeId`);
          check.itemBonuses?.forEach((bonus, i) => {
            requireRef(itemIds, bonus.itemId, 'Item', `${path}.check.itemBonuses[${i}].itemId`);
          });
          if (doc.ruleset.skillCheck.mode === 'diceVsDifficulty' && !check.attributeId) {
            issues.warn(
              'skillCheck.noAttribute',
              `${path}.check.attributeId`,
              'Teste sem atributo usara apenas a rolagem e os bonus fixos.',
            );
          }
          break;
        }
        case 'checkpoint':
          requireRef(nodeIds, node.continueNodeId, 'No', `${path}.continueNodeId`);
          break;
        case 'ending':
          requireRef(endingIds, node.endingId, 'Final', `${path}.endingId`);
          break;
        case 'story':
          if (!node.choices?.length) {
            issues.warn(
              'node.deadEnd',
              path,
              'No narrativo sem escolhas: o jogador nao tem como prosseguir.',
            );
          }
          break;
        default:
          break;
      }
    },
  });

  // --- pericias sem efeito nem uso como requisito --------------------------
  doc.skills?.forEach((entry, index) => {
    if (entry.kind !== 'active') {
      return;
    }
    const hasOutcome = Boolean(entry.combat) || (entry.effects?.length ?? 0) > 0;
    if (!hasOutcome && !skillsUsedAsRequirement.has(entry.id)) {
      issues.warn(
        'skill.activeWithoutEffect',
        `skills[${index}]`,
        'Pericia ativa sem efeitos, sem dados de combate e nunca exigida por uma condicao "hasSkill": ela nao faz nada.',
      );
    }
  });

  // --- alcancabilidade -----------------------------------------------------
  if (nodeIds.has(creation.startNodeId)) {
    const reachable = new Set<Id>();
    const queue: Id[] = [creation.startNodeId];
    while (queue.length > 0) {
      const current = queue.pop() as Id;
      if (reachable.has(current)) {
        continue;
      }
      reachable.add(current);
      const node = doc.nodes.find((candidate) => candidate.id === current);
      if (!node) {
        continue;
      }
      for (const target of outgoingNodeIds(node)) {
        if (nodeIds.has(target) && !reachable.has(target)) {
          queue.push(target);
        }
      }
    }
    for (const node of doc.nodes) {
      if (!reachable.has(node.id)) {
        issues.warn(
          'node.unreachable',
          `nodes:${node.id}`,
          `O no "${node.id}" nao e alcancavel a partir de "${creation.startNodeId}".`,
        );
      }
    }
  }

  // --- finais --------------------------------------------------------------
  const referencedEndings = new Set<Id>();
  for (const node of doc.nodes) {
    if (node.type === 'ending') {
      referencedEndings.add(node.endingId);
    }
    for (const effect of [...(node.onEnter ?? []), ...(node.onExit ?? [])]) {
      if (effect.type === 'endAdventure') {
        referencedEndings.add(effect.endingId);
      }
    }
    for (const choice of node.choices ?? []) {
      if (choice.target?.kind === 'ending') {
        referencedEndings.add(choice.target.endingId);
      }
      for (const effect of choice.effects ?? []) {
        if (effect.type === 'endAdventure') {
          referencedEndings.add(effect.endingId);
        }
      }
    }
  }
  if (doc.ruleset.death.endingId) {
    referencedEndings.add(doc.ruleset.death.endingId);
  }
  for (const ending of doc.endings) {
    if (!referencedEndings.has(ending.id)) {
      issues.warn(
        'ending.unreferenced',
        `endings:${ending.id}`,
        `O final "${ending.id}" nunca e alcancado por nenhum no, escolha ou efeito.`,
      );
    }
  }
  if (referencedEndings.size === 0) {
    issues.warn('ending.none', 'nodes', 'A aventura nao possui nenhum caminho que leve a um final.');
  }
}

/** Valida e devolve o documento tipado, lancando `EngineError` em caso de erro. */
export function assertValidAdventure(input: unknown): AdventureDocument {
  const result = validateAdventure(input);
  if (!result.valid) {
    throw new EngineError('ADVENTURE_INVALID', formatIssues(result.errors), {
      errors: result.errors,
      warnings: result.warnings,
    });
  }
  return input as AdventureDocument;
}

export function formatIssues(issues: ValidationIssue[], limit = 10): string {
  const shown = issues.slice(0, limit).map((issue) => `- ${issue.path}: ${issue.message}`);
  const remaining = issues.length - shown.length;
  const suffix = remaining > 0 ? `\n- ... e outros ${remaining} problema(s).` : '';
  return `Aventura invalida (${issues.length} problema(s)):\n${shown.join('\n')}${suffix}`;
}
