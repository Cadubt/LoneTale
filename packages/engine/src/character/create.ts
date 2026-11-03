import type { CompiledAdventure } from '../compile/compiled-adventure';
import { EngineError } from '../errors';
import { rollDice } from '../random/dice';
import { SeededRng, createSeed } from '../random/rng';
import type {
  AppearanceFieldDefinition,
  AttributeDefinition,
  ClassDefinition,
  RaceDefinition,
  StartingItem,
} from '../types/adventure';
import type { CharacterDraft } from '../types/actions';
import type { Id, JsonPrimitive } from '../types/json';
import {
  CURRENT_STATE_VERSION,
  type CharacterState,
  type GameState,
  type QuestState,
} from '../types/state';
import { recomputeResourceMaxima, resourceMaximum } from './derive';

export interface CharacterCreationOptions {
  startNodeId: Id;
  intro?: string;
  name: { required: boolean; minLength: number; maxLength: number; suggestions: string[] };
  classes: Array<
    Pick<ClassDefinition, 'id' | 'name' | 'description' | 'modifiers' | 'portrait' | 'tags'> & {
      allowedRaceIds: Id[] | null;
    }
  >;
  races: Array<
    Pick<RaceDefinition, 'id' | 'name' | 'description' | 'modifiers' | 'portrait'> & {
      allowedClassIds: Id[] | null;
      appearanceRestrictions: Record<Id, Id[]> | null;
    }
  >;
  attributes: {
    method: 'pointBuy' | 'fixed' | 'roll';
    points: number;
    minPerAttribute: number;
    maxPerAttribute: number;
    rollDice?: string;
    definitions: AttributeDefinition[];
  };
  appearanceFields: AppearanceFieldDefinition[];
  allowDescription: boolean;
  descriptionMaxLength: number;
  startingGold: number;
}

/**
 * Opcoes de criacao derivadas do JSON da aventura.
 *
 * Cada aventura decide o quanto o jogador pode personalizar: uma historia pode
 * exigir um mago humano (uma classe e uma raca permitidas) e outra liberar
 * todas as combinacoes.
 */
export function getCharacterCreationOptions(
  compiled: CompiledAdventure,
): CharacterCreationOptions {
  const creation = compiled.doc.characterCreation;
  const allowedClassIds = creation.allowedClassIds;
  const allowedRaceIds = creation.allowedRaceIds;

  const classes = compiled.doc.classes
    .filter((entry) => !allowedClassIds || allowedClassIds.includes(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      ...(entry.modifiers !== undefined ? { modifiers: entry.modifiers } : {}),
      ...(entry.portrait !== undefined ? { portrait: entry.portrait } : {}),
      ...(entry.tags !== undefined ? { tags: entry.tags } : {}),
      allowedRaceIds: entry.allowedRaceIds ?? null,
    }));

  const races = compiled.doc.races
    .filter((entry) => !allowedRaceIds || allowedRaceIds.includes(entry.id))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      ...(entry.modifiers !== undefined ? { modifiers: entry.modifiers } : {}),
      ...(entry.portrait !== undefined ? { portrait: entry.portrait } : {}),
      allowedClassIds: entry.allowedClassIds ?? null,
      appearanceRestrictions: entry.appearanceRestrictions ?? null,
    }));

  const attributeRules = creation.attributes;

  return {
    startNodeId: creation.startNodeId,
    ...(creation.intro !== undefined ? { intro: creation.intro } : {}),
    name: {
      required: creation.name?.required ?? true,
      minLength: creation.name?.minLength ?? 2,
      maxLength: creation.name?.maxLength ?? 40,
      suggestions: creation.name?.suggestions ?? [],
    },
    classes,
    races,
    attributes: {
      method: attributeRules.method,
      points: attributeRules.points ?? 0,
      minPerAttribute: attributeRules.minPerAttribute ?? 0,
      maxPerAttribute: attributeRules.maxPerAttribute ?? Number.POSITIVE_INFINITY,
      ...(attributeRules.rollDice !== undefined ? { rollDice: attributeRules.rollDice } : {}),
      definitions: compiled.doc.attributes,
    },
    appearanceFields: creation.appearanceFields ?? [],
    allowDescription: creation.allowDescription ?? true,
    descriptionMaxLength: creation.descriptionMaxLength ?? 500,
    startingGold: creation.startingGold ?? 0,
  };
}

function invalid(message: string, details?: Record<string, unknown>): never {
  throw new EngineError('CHARACTER_INVALID', message, details);
}

function resolveAttributes(
  compiled: CompiledAdventure,
  draft: CharacterDraft,
  options: CharacterCreationOptions,
  rng: SeededRng,
): Record<Id, number> {
  const definitions = compiled.doc.attributes;
  const result: Record<Id, number> = {};

  if (options.attributes.method === 'fixed') {
    for (const attribute of definitions) {
      result[attribute.id] = attribute.default;
    }
    return result;
  }

  if (options.attributes.method === 'roll') {
    const expression = options.attributes.rollDice;
    if (!expression) {
      invalid('A aventura usa atributos por rolagem, mas nao declarou rollDice.');
    }
    for (const attribute of definitions) {
      const roll = rollDice(expression, rng);
      result[attribute.id] = Math.max(attribute.min, Math.min(attribute.max, roll.total));
    }
    return result;
  }

  // pointBuy
  const provided = draft.attributes ?? {};
  const unknownKeys = Object.keys(provided).filter((key) => !compiled.attributes.has(key));
  if (unknownKeys.length > 0) {
    invalid(`Atributos desconhecidos: ${unknownKeys.join(', ')}.`, { unknownKeys });
  }

  const min = options.attributes.minPerAttribute;
  const max = options.attributes.maxPerAttribute;
  let spent = 0;

  for (const attribute of definitions) {
    const base = provided[attribute.id];
    if (base === undefined) {
      invalid(`O atributo "${attribute.name}" nao foi distribuido.`, { attributeId: attribute.id });
    }
    if (!Number.isInteger(base)) {
      invalid(`O atributo "${attribute.name}" deve receber um valor inteiro.`);
    }
    const floor = Math.max(attribute.min, min);
    const ceiling = Math.min(attribute.max, max);
    if (base < floor || base > ceiling) {
      invalid(
        `O atributo "${attribute.name}" deve ficar entre ${floor} e ${ceiling} (recebido: ${base}).`,
        { attributeId: attribute.id, min: floor, max: ceiling },
      );
    }
    result[attribute.id] = base;
    spent += base - floor;
  }

  if (spent !== options.attributes.points) {
    invalid(
      `Distribua exatamente ${options.attributes.points} ponto(s) de atributo (usados: ${spent}).`,
      { required: options.attributes.points, spent },
    );
  }

  return result;
}

function resolveAppearance(
  draft: CharacterDraft,
  options: CharacterCreationOptions,
  race: RaceDefinition | undefined,
): Record<Id, JsonPrimitive> {
  const provided = draft.appearance ?? {};
  const appearance: Record<Id, JsonPrimitive> = {};

  for (const field of options.appearanceFields) {
    const value = provided[field.id] ?? field.default;
    if (value === undefined || value === null || value === '') {
      if (field.required) {
        invalid(`O campo de aparencia "${field.label}" e obrigatorio.`, { fieldId: field.id });
      }
      continue;
    }

    switch (field.kind) {
      case 'select': {
        const restriction = race?.appearanceRestrictions?.[field.id];
        const allowed = (field.options ?? []).filter(
          (option) => !restriction || restriction.includes(option.id),
        );
        if (!allowed.some((option) => option.id === value)) {
          invalid(`Opcao invalida para "${field.label}".`, {
            fieldId: field.id,
            allowed: allowed.map((option) => option.id),
          });
        }
        break;
      }
      case 'number': {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          invalid(`O campo "${field.label}" espera um numero.`, { fieldId: field.id });
        }
        if (field.min !== undefined && value < field.min) {
          invalid(`"${field.label}" deve ser no minimo ${field.min}.`, { fieldId: field.id });
        }
        if (field.max !== undefined && value > field.max) {
          invalid(`"${field.label}" deve ser no maximo ${field.max}.`, { fieldId: field.id });
        }
        break;
      }
      case 'color': {
        if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
          invalid(`"${field.label}" espera uma cor no formato #RRGGBB.`, { fieldId: field.id });
        }
        break;
      }
      case 'text': {
        if (typeof value !== 'string') {
          invalid(`"${field.label}" espera texto.`, { fieldId: field.id });
        }
        if (field.maxLength !== undefined && value.length > field.maxLength) {
          invalid(`"${field.label}" excede ${field.maxLength} caracteres.`, { fieldId: field.id });
        }
        break;
      }
      default:
        break;
    }

    appearance[field.id] = value;
  }

  return appearance;
}

function applyStartingItems(
  compiled: CompiledAdventure,
  character: CharacterState,
  entries: StartingItem[] | undefined,
): void {
  for (const entry of entries ?? []) {
    const item = compiled.item(entry.itemId);
    const quantity = entry.quantity ?? 1;
    const stackable = item.stackable ?? (item.kind === 'consumable' || item.kind === 'misc');
    if (stackable) {
      const existing = character.inventory.find((slot) => slot.itemId === entry.itemId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        character.inventory.push({ itemId: entry.itemId, quantity });
      }
    } else {
      for (let i = 0; i < quantity; i += 1) {
        character.inventory.push({ itemId: entry.itemId, quantity: 1 });
      }
    }
    const slot = entry.slot ?? item.slot;
    if (entry.equip && slot) {
      character.equipment[slot] = entry.itemId;
    }
  }
}

/** Monta a ficha inicial a partir do rascunho enviado pelo jogador. */
export function createCharacter(
  compiled: CompiledAdventure,
  draft: CharacterDraft,
  rng: SeededRng,
): CharacterState {
  const options = getCharacterCreationOptions(compiled);

  const name = (draft.name ?? '').trim();
  if (options.name.required || name.length > 0) {
    if (name.length < options.name.minLength || name.length > options.name.maxLength) {
      invalid(
        `O nome deve ter entre ${options.name.minLength} e ${options.name.maxLength} caracteres.`,
      );
    }
  }

  if (options.classes.length === 0 || options.races.length === 0) {
    invalid('A aventura nao oferece nenhuma combinacao valida de classe e raca.');
  }

  const classId = draft.classId ?? (options.classes.length === 1 ? options.classes[0]?.id : undefined);
  const raceId = draft.raceId ?? (options.races.length === 1 ? options.races[0]?.id : undefined);

  if (!classId) {
    invalid('Escolha uma classe.');
  }
  if (!raceId) {
    invalid('Escolha uma especie.');
  }

  const classEntry = options.classes.find((entry) => entry.id === classId);
  if (!classEntry) {
    invalid(`A classe "${classId}" nao esta disponivel nesta aventura.`, { classId });
  }
  const raceEntry = options.races.find((entry) => entry.id === raceId);
  if (!raceEntry) {
    invalid(`A especie "${raceId}" nao esta disponivel nesta aventura.`, { raceId });
  }
  if (classEntry.allowedRaceIds && !classEntry.allowedRaceIds.includes(raceId)) {
    invalid(`${classEntry.name} nao pode ser ${raceEntry.name} nesta aventura.`);
  }
  if (raceEntry.allowedClassIds && !raceEntry.allowedClassIds.includes(classId)) {
    invalid(`${raceEntry.name} nao pode seguir a classe ${classEntry.name} nesta aventura.`);
  }

  const description = (draft.description ?? '').trim();
  if (description.length > 0) {
    if (!options.allowDescription) {
      invalid('Esta aventura nao permite descricao livre do personagem.');
    }
    if (description.length > options.descriptionMaxLength) {
      invalid(`A descricao excede ${options.descriptionMaxLength} caracteres.`);
    }
  }

  const raceDefinition = compiled.races.get(raceId);
  const appearance = resolveAppearance(draft, options, raceDefinition);
  const attributes = resolveAttributes(compiled, draft, options, rng);

  const character: CharacterState = {
    name: name.length > 0 ? name : 'Andarilho',
    classId,
    raceId,
    level: 1,
    experience: 0,
    attributes,
    resources: {},
    gold: options.startingGold,
    inventory: [],
    equipment: Object.fromEntries(compiled.equipmentSlots.map((slot) => [slot, null])),
    skillIds: [],
    appearance,
    ...(description.length > 0 ? { description } : {}),
    pendingAttributePoints: 0,
  };

  const classDefinition = compiled.classes.get(classId);
  const skillIds = new Set<Id>([
    ...(compiled.doc.characterCreation.startingSkillIds ?? []),
    ...(classDefinition?.startingSkillIds ?? []),
  ]);
  character.skillIds = [...skillIds];

  applyStartingItems(compiled, character, compiled.doc.characterCreation.startingItems);
  applyStartingItems(compiled, character, classDefinition?.startingItems);

  for (const resource of compiled.doc.resources) {
    const max = resourceMaximum(compiled, character, resource.id);
    character.resources[resource.id] = { current: max, max };
  }
  recomputeResourceMaxima(compiled, character);

  return character;
}

export interface CreateStateOptions {
  /** Semente para rolagens; informe um valor fixo para partidas deterministicas. */
  seed?: string;
  now?: Date;
}

/** Cria o estado inicial de uma partida, pronto para ser persistido. */
export function createInitialState(
  compiled: CompiledAdventure,
  draft: CharacterDraft,
  options: CreateStateOptions = {},
): GameState {
  const seed = options.seed ?? createSeed();
  const rng = new SeededRng(seed);
  const character = createCharacter(compiled, draft, rng);
  const timestamp = (options.now ?? new Date()).toISOString();

  const flags: Record<Id, JsonPrimitive> = {};
  for (const variable of compiled.doc.variables ?? []) {
    flags[variable.id] = variable.initial;
  }

  const quests: Record<Id, QuestState> = {};
  for (const quest of compiled.doc.quests ?? []) {
    quests[quest.id] = { status: quest.initialStatus ?? 'locked', stage: 0 };
  }

  const npcRelations: Record<Id, number> = {};
  for (const npc of compiled.doc.npcs ?? []) {
    npcRelations[npc.id] = npc.initialRelation ?? 0;
  }

  return {
    stateVersion: CURRENT_STATE_VERSION,
    adventureId: compiled.id,
    adventureVersion: compiled.version,
    status: 'active',
    currentNodeId: compiled.doc.characterCreation.startNodeId,
    previousNodeId: null,
    nodeHistory: [],
    sequence: 0,
    character,
    flags,
    visitedNodes: {},
    quests,
    npcRelations,
    defeatedEnemies: {},
    takenChoices: [],
    consumedEffects: [],
    merchantPurchases: {},
    reachedEndings: [],
    endingId: null,
    combat: null,
    pendingSkillCheck: null,
    checkpoint: null,
    rng: rng.toState(),
    startedAt: timestamp,
    updatedAt: timestamp,
    playtimeSeconds: 0,
  };
}
