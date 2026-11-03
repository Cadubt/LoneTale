import {
  itemQuantity,
  recomputeResourceMaxima,
  totalArmor,
} from '../character/derive';
import type { CompiledAdventure } from '../compile/compiled-adventure';
import { evaluateCondition } from '../conditions/evaluate';
import { EngineError } from '../errors';
import type { SeededRng } from '../random/rng';
import type { Id } from '../types/json';
import type { Effect, EffectEntry } from '../types/effects';
import type { GameEvent } from '../types/events';
import type { CharacterState, GameState, QuestState } from '../types/state';

/** Pedido de navegacao produzido por um efeito. */
export type Navigation =
  | { kind: 'node'; nodeId: Id }
  | { kind: 'ending'; endingId: Id }
  | {
      kind: 'combat';
      enemyIds: Id[];
      onVictoryNodeId?: Id;
      onDefeatNodeId?: Id;
      onFleeNodeId?: Id;
      fleeAllowed?: boolean;
    };

export interface EffectContext {
  compiled: CompiledAdventure;
  /** Estado mutavel: o motor sempre opera sobre um clone do estado persistido. */
  state: GameState;
  rng: SeededRng;
  events: GameEvent[];
  /**
   * Escopo da visita atual (`node:<id>#<visita>`), usado nas chaves de
   * idempotencia dos efeitos `perVisit`.
   */
  scope: string;
  navigation: Navigation | null;
  /** Indica que a cadeia de efeitos foi interrompida (final ou combate). */
  halted: boolean;
}

export function createEffectContext(
  compiled: CompiledAdventure,
  state: GameState,
  rng: SeededRng,
  events: GameEvent[],
  scope: string,
): EffectContext {
  return { compiled, state, rng, events, scope, navigation: null, halted: false };
}

/** Chave de idempotencia de um efeito, conforme o seu modo de execucao. */
function idempotencyKey(effect: EffectEntry, path: string, scope: string): string | null {
  switch (effect.mode) {
    case 'once':
      if (!effect.id) {
        throw new EngineError(
          'ADVENTURE_INVALID',
          `Efeito com mode "once" sem id em ${path}: nao e possivel garantir execucao unica.`,
          { path },
        );
      }
      return `once:${effect.id}`;
    case 'perVisit':
      return `visit:${scope}:${effect.id ?? path}`;
    default:
      return null;
  }
}

/**
 * Aplica uma lista de efeitos, em ordem, respeitando:
 * - `when`: condicao de guarda;
 * - `mode`: `once` / `perVisit` / `always`, via chaves persistidas em
 *   `state.consumedEffects` (protege contra recarregar a pagina, reenvio de
 *   requisicao ou reconexao);
 * - interrupcao: `endAdventure` e `startCombat` encerram a cadeia.
 *
 * Erros lancados aqui abortam o passo inteiro. Como o motor trabalha sobre um
 * clone do estado, nada e aplicado parcialmente.
 */
export function applyEffects(
  effects: EffectEntry[] | undefined,
  pathPrefix: string,
  context: EffectContext,
): void {
  if (!effects) {
    return;
  }
  for (let index = 0; index < effects.length; index += 1) {
    if (context.halted) {
      return;
    }
    const effect = effects[index] as EffectEntry;
    const path = `${pathPrefix}[${index}]`;

    if (effect.when && !evaluateCondition(effect.when, context)) {
      context.events.push({ type: 'effectSkipped', effect, reason: 'condition' });
      continue;
    }

    const key = idempotencyKey(effect, path, context.scope);
    if (key) {
      if (context.state.consumedEffects.includes(key)) {
        context.events.push({ type: 'effectSkipped', effect, reason: `already-applied:${effect.mode}` });
        continue;
      }
      context.state.consumedEffects.push(key);
    }

    applyEffect(effect, context);
  }
}

function pushEvent(context: EffectContext, event: GameEvent): void {
  context.events.push(event);
}

function resolveResourceId(context: EffectContext, resourceId?: Id): Id {
  return resourceId ?? context.compiled.vitalResourceId;
}

function changeResource(
  context: EffectContext,
  resourceId: Id,
  delta: number,
  options: { full?: boolean; allowNegativeCheck?: boolean } = {},
): void {
  const character = context.state.character;
  const pool = character.resources[resourceId];
  if (!pool) {
    throw new EngineError(
      'INSUFFICIENT_RESOURCE',
      `Recurso "${resourceId}" nao existe na ficha do personagem.`,
      { resourceId },
    );
  }
  const before = pool.current;
  if (options.full) {
    pool.current = pool.max;
  } else {
    pool.current = Math.max(0, Math.min(pool.max, pool.current + delta));
  }
  if (pool.current !== before) {
    pushEvent(context, {
      type: 'resourceChanged',
      resourceId,
      delta: pool.current - before,
      current: pool.current,
      max: pool.max,
    });
  }
}

function addItemToInventory(
  compiled: CompiledAdventure,
  character: CharacterState,
  itemId: Id,
  quantity: number,
): void {
  const item = compiled.item(itemId);
  const maxSlots = compiled.doc.ruleset.inventory?.maxSlots;
  const stackable = item.stackable ?? (item.kind === 'consumable' || item.kind === 'misc');
  const maxStack = item.maxStack ?? (stackable ? 99 : 1);

  let remaining = quantity;
  if (stackable) {
    for (const entry of character.inventory) {
      if (entry.itemId !== itemId || remaining <= 0) {
        continue;
      }
      const room = maxStack - entry.quantity;
      if (room > 0) {
        const added = Math.min(room, remaining);
        entry.quantity += added;
        remaining -= added;
      }
    }
  }
  while (remaining > 0) {
    if (maxSlots !== undefined && character.inventory.length >= maxSlots) {
      throw new EngineError(
        'ITEM_NOT_FOUND',
        `Inventario cheio: nao e possivel carregar mais ${item.name}.`,
        { itemId, maxSlots },
      );
    }
    const added = stackable ? Math.min(maxStack, remaining) : 1;
    character.inventory.push({ itemId, quantity: added });
    remaining -= added;
  }
}

function removeItemFromInventory(
  character: CharacterState,
  itemId: Id,
  quantity: number,
): number {
  let remaining = quantity;
  for (const entry of character.inventory) {
    if (entry.itemId !== itemId || remaining <= 0) {
      continue;
    }
    const taken = Math.min(entry.quantity, remaining);
    entry.quantity -= taken;
    remaining -= taken;
  }
  character.inventory = character.inventory.filter((entry) => entry.quantity > 0);
  return quantity - remaining;
}

function unequipIfEquipped(context: EffectContext, itemId: Id): void {
  const character = context.state.character;
  for (const [slot, equipped] of Object.entries(character.equipment)) {
    if (equipped === itemId) {
      character.equipment[slot] = null;
      pushEvent(context, { type: 'itemUnequipped', itemId, slot });
    }
  }
}

export function equipItem(context: EffectContext, itemId: Id, slot?: string): void {
  const { compiled } = context;
  const character = context.state.character;
  const item = compiled.item(itemId);
  const targetSlot = slot ?? item.slot;

  if (!targetSlot) {
    throw new EngineError('SLOT_INVALID', `O item "${item.name}" nao e equipavel.`, { itemId });
  }
  if (compiled.equipmentSlots.length > 0 && !compiled.equipmentSlots.includes(targetSlot)) {
    throw new EngineError('SLOT_INVALID', `Slot "${targetSlot}" nao existe nesta aventura.`, {
      slot: targetSlot,
    });
  }
  if (itemQuantity(character, itemId) <= 0) {
    throw new EngineError('ITEM_NOT_OWNED', `Voce nao possui ${item.name}.`, { itemId });
  }
  if (item.requirements && !evaluateCondition(item.requirements, context)) {
    throw new EngineError(
      'ITEM_REQUIREMENTS_NOT_MET',
      `Voce nao atende aos requisitos para usar ${item.name}.`,
      { itemId },
    );
  }

  const previous = character.equipment[targetSlot];
  if (previous) {
    character.equipment[targetSlot] = null;
    pushEvent(context, { type: 'itemUnequipped', itemId: previous, slot: targetSlot });
  }
  character.equipment[targetSlot] = itemId;
  pushEvent(context, { type: 'itemEquipped', itemId, slot: targetSlot });
  recomputeResourceMaxima(compiled, character);
}

export function unequipSlot(context: EffectContext, slot: string): void {
  const character = context.state.character;
  const itemId = character.equipment[slot];
  if (!itemId) {
    return;
  }
  character.equipment[slot] = null;
  pushEvent(context, { type: 'itemUnequipped', itemId, slot });
  recomputeResourceMaxima(context.compiled, character);
}

export function grantExperience(context: EffectContext, amount: number): void {
  const { compiled } = context;
  const character = context.state.character;
  const progression = compiled.doc.ruleset.progression;
  if (!progression.enabled || amount <= 0) {
    return;
  }
  character.experience += amount;
  pushEvent(context, { type: 'experienceGained', amount, total: character.experience });

  const maxLevel = progression.maxLevel ?? progression.xpThresholds.length + 1;
  while (character.level < maxLevel) {
    const threshold = progression.xpThresholds[character.level - 1];
    if (threshold === undefined || character.experience < threshold) {
      break;
    }
    character.level += 1;
    const gains = progression.onLevelUp;
    const points = gains?.attributePoints ?? 0;
    if (points > 0) {
      character.pendingAttributePoints = (character.pendingAttributePoints ?? 0) + points;
    }
    for (const gain of gains?.resourceGains ?? []) {
      const pool = character.resources[gain.resourceId];
      if (pool) {
        pool.max = Math.max(1, pool.max + gain.maxDelta);
        if (gain.restore) {
          pool.current = pool.max;
        } else {
          pool.current = Math.min(pool.max, pool.current + Math.max(0, gain.maxDelta));
        }
      }
    }
    recomputeResourceMaxima(compiled, character);
    pushEvent(context, {
      type: 'leveledUp',
      level: character.level,
      attributePoints: character.pendingAttributePoints ?? 0,
    });
  }
}

function setQuest(context: EffectContext, questId: Id, next: QuestState): void {
  context.state.quests[questId] = next;
  pushEvent(context, {
    type: 'questChanged',
    questId,
    status: next.status,
    stage: next.stage,
  });
}

/** Aplica um unico efeito ja autorizado (condicao e idempotencia resolvidas). */
export function applyEffect(effect: Effect, context: EffectContext): void {
  const { compiled, state } = context;
  const character = state.character;

  switch (effect.type) {
    case 'addItem': {
      const quantity = effect.quantity ?? 1;
      addItemToInventory(compiled, character, effect.itemId, quantity);
      pushEvent(context, { type: 'itemGained', itemId: effect.itemId, quantity });
      break;
    }

    case 'removeItem':
    case 'consumeItem': {
      const quantity = effect.quantity ?? 1;
      const owned = itemQuantity(character, effect.itemId);
      const required = effect.type === 'consumeItem' || effect.required === true;
      if (required && owned < quantity) {
        throw new EngineError(
          'ITEM_NOT_OWNED',
          `Voce nao possui ${quantity}x ${compiled.label('item', effect.itemId)}.`,
          { itemId: effect.itemId, owned, quantity },
        );
      }
      const removed = removeItemFromInventory(character, effect.itemId, quantity);
      if (itemQuantity(character, effect.itemId) === 0) {
        unequipIfEquipped(context, effect.itemId);
        recomputeResourceMaxima(compiled, character);
      }
      if (removed > 0) {
        pushEvent(context, { type: 'itemLost', itemId: effect.itemId, quantity: removed });
      }
      break;
    }

    case 'equipItem':
      equipItem(context, effect.itemId, effect.slot);
      break;

    case 'unequipItem':
      unequipSlot(context, effect.slot);
      break;

    case 'grantGold': {
      if (effect.amount <= 0) {
        break;
      }
      character.gold += effect.amount;
      pushEvent(context, { type: 'goldChanged', delta: effect.amount, total: character.gold });
      break;
    }

    case 'spendGold': {
      if (effect.amount <= 0) {
        break;
      }
      if (character.gold < effect.amount) {
        const currency = compiled.doc.ruleset.economy?.currencyName ?? 'ouro';
        throw new EngineError(
          'INSUFFICIENT_GOLD',
          `Requer ${effect.amount} de ${currency}; voce tem ${character.gold}.`,
          { required: effect.amount, available: character.gold },
        );
      }
      character.gold -= effect.amount;
      pushEvent(context, { type: 'goldChanged', delta: -effect.amount, total: character.gold });
      break;
    }

    case 'heal':
      changeResource(context, resolveResourceId(context, effect.resourceId), effect.amount, {
        full: effect.full,
      });
      break;

    case 'damage': {
      const resourceId = resolveResourceId(context, effect.resourceId);
      let amount = effect.amount;
      if (!effect.ignoreArmor && compiled.doc.ruleset.combat.armorMode === 'subtract') {
        const armor = totalArmor(compiled, character);
        const minimum = compiled.doc.ruleset.combat.minimumDamage ?? 0;
        amount = Math.max(minimum, amount - armor);
      }
      changeResource(context, resourceId, -amount);
      break;
    }

    case 'restoreResource':
      changeResource(context, effect.resourceId, effect.amount, { full: effect.full });
      break;

    case 'spendResource': {
      const pool = character.resources[effect.resourceId];
      if (!pool || pool.current < effect.amount) {
        throw new EngineError(
          'INSUFFICIENT_RESOURCE',
          `Requer ${effect.amount} de ${compiled.label('resource', effect.resourceId)}.`,
          { resourceId: effect.resourceId, required: effect.amount, available: pool?.current ?? 0 },
        );
      }
      changeResource(context, effect.resourceId, -effect.amount);
      break;
    }

    case 'modifyResourceMax': {
      const pool = character.resources[effect.resourceId];
      if (pool) {
        pool.max = Math.max(1, pool.max + effect.delta);
        pool.current = Math.min(pool.current, pool.max);
        pushEvent(context, {
          type: 'resourceChanged',
          resourceId: effect.resourceId,
          delta: 0,
          current: pool.current,
          max: pool.max,
        });
      }
      break;
    }

    case 'modifyAttribute': {
      const definition = compiled.attributes.get(effect.attributeId);
      if (!definition) {
        break;
      }
      const current = character.attributes[effect.attributeId] ?? definition.default;
      const next = Math.max(definition.min, Math.min(definition.max, current + effect.delta));
      character.attributes[effect.attributeId] = next;
      recomputeResourceMaxima(compiled, character);
      pushEvent(context, {
        type: 'attributeChanged',
        attributeId: effect.attributeId,
        delta: next - current,
        value: next,
      });
      break;
    }

    case 'grantExperience':
      grantExperience(context, effect.amount);
      break;

    case 'unlockSkill': {
      if (!character.skillIds.includes(effect.skillId)) {
        character.skillIds.push(effect.skillId);
        pushEvent(context, { type: 'skillUnlocked', skillId: effect.skillId });
      }
      break;
    }

    case 'startCombat': {
      const navigation: Navigation = { kind: 'combat', enemyIds: effect.enemyIds };
      if (effect.onVictoryNodeId !== undefined) {
        navigation.onVictoryNodeId = effect.onVictoryNodeId;
      }
      if (effect.onDefeatNodeId !== undefined) {
        navigation.onDefeatNodeId = effect.onDefeatNodeId;
      }
      if (effect.onFleeNodeId !== undefined) {
        navigation.onFleeNodeId = effect.onFleeNodeId;
      }
      if (effect.fleeAllowed !== undefined) {
        navigation.fleeAllowed = effect.fleeAllowed;
      }
      context.navigation = navigation;
      context.halted = true;
      break;
    }

    case 'setQuestStatus': {
      const current = state.quests[effect.questId];
      setQuest(context, effect.questId, {
        status: effect.status,
        stage: effect.stage ?? current?.stage ?? 0,
      });
      if (effect.status === 'completed') {
        const quest = compiled.quests.get(effect.questId);
        applyEffects(quest?.rewards, `quests.${effect.questId}.rewards`, context);
      }
      break;
    }

    case 'advanceQuestStage': {
      const current = state.quests[effect.questId] ?? { status: 'active' as const, stage: 0 };
      setQuest(context, effect.questId, {
        status: current.status === 'locked' || current.status === 'available' ? 'active' : current.status,
        stage: effect.stage ?? current.stage + 1,
      });
      break;
    }

    case 'modifyNpcRelation': {
      const base =
        state.npcRelations[effect.npcId] ?? compiled.npcs.get(effect.npcId)?.initialRelation ?? 0;
      const next = base + effect.delta;
      state.npcRelations[effect.npcId] = next;
      pushEvent(context, {
        type: 'npcRelationChanged',
        npcId: effect.npcId,
        delta: effect.delta,
        value: next,
      });
      break;
    }

    case 'setFlag':
      state.flags[effect.flag] = effect.value;
      pushEvent(context, { type: 'flagChanged', flag: effect.flag, value: effect.value });
      break;

    case 'incrementFlag': {
      const current = state.flags[effect.flag];
      const base = typeof current === 'number' ? current : 0;
      const next = base + effect.delta;
      state.flags[effect.flag] = next;
      pushEvent(context, { type: 'flagChanged', flag: effect.flag, value: next });
      break;
    }

    case 'endAdventure':
      context.navigation = { kind: 'ending', endingId: effect.endingId };
      context.halted = true;
      break;

    case 'goto':
      context.navigation = { kind: 'node', nodeId: effect.nodeId };
      break;

    case 'setCheckpoint': {
      const snapshot = createCheckpoint(state, effect.label);
      state.checkpoint = snapshot;
      const event: GameEvent = { type: 'checkpointSaved', nodeId: snapshot.nodeId };
      if (effect.label !== undefined) {
        (event as { label?: string }).label = effect.label;
      }
      pushEvent(context, event);
      break;
    }

    case 'rollTable': {
      const weights = effect.outcomes.map((outcome) => outcome.weight);
      const index = context.rng.weightedIndex(weights);
      const outcome = effect.outcomes[index];
      if (!outcome) {
        break;
      }
      applyEffects(outcome.effects, `rollTable.${effect.tableId ?? 'anon'}.outcome`, context);
      if (outcome.nodeId && !context.halted) {
        context.navigation = { kind: 'node', nodeId: outcome.nodeId };
      }
      break;
    }

    default: {
      const unknown = effect as { type?: string };
      pushEvent(context, {
        type: 'warning',
        code: 'effect.unknown',
        message: `Efeito de tipo desconhecido ignorado: "${String(unknown.type)}".`,
      });
      break;
    }
  }
}

/** Snapshot imutavel do progresso, usado para retomar apos a morte. */
export function createCheckpoint(state: GameState, label?: string) {
  const snapshot = {
    nodeId: state.currentNodeId,
    sequence: state.sequence,
    character: structuredClone(state.character),
    flags: { ...state.flags },
    quests: structuredClone(state.quests),
    npcRelations: { ...state.npcRelations },
    visitedNodes: { ...state.visitedNodes },
    defeatedEnemies: { ...state.defeatedEnemies },
    takenChoices: [...state.takenChoices],
    consumedEffects: [...state.consumedEffects],
    merchantPurchases: { ...state.merchantPurchases },
  };
  return label === undefined ? snapshot : { ...snapshot, label };
}
