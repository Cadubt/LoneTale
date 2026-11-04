import {
  attributeModifier,
  effectiveAttributes,
  experienceToNextLevel,
  isEquipped,
  itemQuantity,
  totalArmor,
} from '../character/derive';
import type { CompiledAdventure } from '../compile/compiled-adventure';
import { explainCondition, firstFailureReason, summarizeRequirements } from '../conditions/evaluate';
import type { AdventureNode } from '../types/adventure';
import type { EffectEntry } from '../types/effects';
import type { Id } from '../types/json';
import type { GameState } from '../types/state';
import type {
  AssetView,
  ChoiceView,
  CharacterSheetView,
  CombatView,
  DialogueLineView,
  InventoryItemView,
  MerchantView,
  NodeView,
  PlayerActionType,
  QuestView,
  SkillCheckView,
} from '../types/view';

function asset(compiled: CompiledAdventure, assetId: Id | undefined): AssetView | null {
  if (!assetId) {
    return null;
  }
  const definition = compiled.assets.get(assetId);
  if (!definition) {
    return null;
  }
  return {
    id: definition.id,
    kind: definition.kind,
    src: definition.src,
    ...(definition.alt !== undefined ? { alt: definition.alt } : {}),
  };
}

/** Rotulos legiveis dos custos de uma escolha, anunciados antes de confirmar. */
function describeCosts(
  compiled: CompiledAdventure,
  costs: EffectEntry[] | undefined,
): Array<{ kind: string; label: string }> {
  const currency = compiled.doc.ruleset.economy?.currencyName ?? 'ouro';
  const described: Array<{ kind: string; label: string }> = [];
  for (const cost of costs ?? []) {
    switch (cost.type) {
      case 'spendGold':
        described.push({ kind: 'gold', label: `${cost.amount} de ${currency}` });
        break;
      case 'spendResource':
        described.push({
          kind: 'resource',
          label: `${cost.amount} de ${compiled.label('resource', cost.resourceId)}`,
        });
        break;
      case 'consumeItem':
      case 'removeItem':
        described.push({
          kind: 'item',
          label: `${cost.quantity ?? 1}x ${compiled.label('item', cost.itemId)}`,
        });
        break;
      default:
        break;
    }
  }
  return described;
}

function buildChoices(compiled: CompiledAdventure, state: GameState, node: AdventureNode): ChoiceView[] {
  const context = { compiled, state };
  const views: ChoiceView[] = [];

  const ordered = [...(node.choices ?? [])].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  );

  for (const choice of ordered) {
    const alreadyTaken =
      choice.once === true && state.takenChoices.includes(`${node.id}:${choice.id}`);
    const result = explainCondition(choice.conditions, context);
    const available = result.satisfied && !alreadyTaken;

    if (!available) {
      const behavior = choice.unavailableBehavior ?? 'disable';
      if (behavior === 'hide' || alreadyTaken) {
        continue;
      }
    }

    const costs = describeCosts(compiled, choice.cost);
    const view: ChoiceView = {
      id: choice.id,
      label: choice.label,
      available,
      conditional: Boolean(choice.conditions),
    };
    if (available && choice.conditions) {
      const satisfied = summarizeRequirements(choice.conditions, context);
      if (satisfied) {
        view.satisfiedLabel = satisfied;
      }
    }
    if (choice.description !== undefined) {
      view.description = choice.description;
    }
    if (!available) {
      view.blockedReason = choice.unavailableLabel ?? firstFailureReason(result) ?? 'Indisponivel.';
    }
    if (choice.icon !== undefined) {
      view.icon = choice.icon;
    }
    if (choice.order !== undefined) {
      view.order = choice.order;
    }
    if (costs.length > 0) {
      view.costs = costs;
    }
    views.push(view);
  }

  return views;
}

function buildCharacterSheet(compiled: CompiledAdventure, state: GameState): CharacterSheetView {
  const character = state.character;
  const totals = effectiveAttributes(compiled, character);

  return {
    name: character.name,
    ...(character.classId
      ? { className: compiled.classes.get(character.classId)?.name ?? character.classId }
      : {}),
    ...(character.raceId
      ? { raceName: compiled.races.get(character.raceId)?.name ?? character.raceId }
      : {}),
    level: character.level,
    experience: character.experience,
    experienceToNextLevel: experienceToNextLevel(compiled, character),
    gold: character.gold,
    attributes: compiled.doc.attributes
      .filter((attribute) => attribute.visible !== false)
      .map((attribute) => {
        const total = totals[attribute.id] ?? attribute.default;
        return {
          id: attribute.id,
          name: attribute.name,
          ...(attribute.abbreviation !== undefined ? { abbreviation: attribute.abbreviation } : {}),
          base: character.attributes[attribute.id] ?? attribute.default,
          total,
          modifier: attributeModifier(compiled.doc.ruleset, total),
        };
      }),
    resources: compiled.doc.resources.map((resource) => {
      const pool = character.resources[resource.id] ?? { current: 0, max: 0 };
      return {
        id: resource.id,
        name: resource.name,
        ...(resource.abbreviation !== undefined ? { abbreviation: resource.abbreviation } : {}),
        current: pool.current,
        max: pool.max,
        vital: resource.id === compiled.vitalResourceId,
        ...(resource.color !== undefined ? { color: resource.color } : {}),
      };
    }),
    armor: totalArmor(compiled, character),
    skills: character.skillIds.map((skillId) => {
      const skill = compiled.skills.get(skillId);
      return {
        id: skillId,
        name: skill?.name ?? skillId,
        kind: skill?.kind ?? 'passive',
        ...(skill?.description !== undefined ? { description: skill.description } : {}),
      };
    }),
    appearance: character.appearance,
    ...(character.description !== undefined ? { description: character.description } : {}),
    pendingAttributePoints: character.pendingAttributePoints ?? 0,
  };
}

function buildInventory(compiled: CompiledAdventure, state: GameState): InventoryItemView[] {
  const character = state.character;
  const grouped = new Map<Id, number>();
  for (const entry of character.inventory) {
    grouped.set(entry.itemId, (grouped.get(entry.itemId) ?? 0) + entry.quantity);
  }

  const views: InventoryItemView[] = [];
  for (const [itemId, quantity] of grouped) {
    const item = compiled.items.get(itemId);
    if (!item) {
      continue;
    }
    const requirementsMet = !item.requirements
      ? true
      : explainCondition(item.requirements, { compiled, state }).satisfied;
    views.push({
      itemId,
      name: item.name,
      ...(item.description !== undefined ? { description: item.description } : {}),
      kind: item.kind,
      quantity,
      equipped: isEquipped(character, itemId),
      ...(item.slot !== undefined ? { slot: item.slot } : {}),
      usable: item.kind === 'consumable' ? (item.useEffects?.length ?? 0) > 0 && requirementsMet : false,
      ...(item.value !== undefined ? { value: item.value } : {}),
      icon: asset(compiled, item.icon ?? item.image),
    });
  }
  return views.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

function buildQuests(compiled: CompiledAdventure, state: GameState): QuestView[] {
  const views: QuestView[] = [];
  for (const quest of compiled.doc.quests ?? []) {
    const progress = state.quests[quest.id];
    const status = progress?.status ?? quest.initialStatus ?? 'locked';
    if (quest.hidden && status === 'locked') {
      continue;
    }
    if (status === 'locked') {
      continue;
    }
    const stage = progress?.stage ?? 0;
    const stageDefinition = quest.stages?.find((entry) => entry.stage === stage);
    views.push({
      id: quest.id,
      name: quest.name,
      ...(quest.description !== undefined ? { description: quest.description } : {}),
      status,
      stage,
      ...(stageDefinition?.title !== undefined ? { stageTitle: stageDefinition.title } : {}),
    });
  }
  return views;
}

function buildCombat(compiled: CompiledAdventure, state: GameState): CombatView | undefined {
  const combat = state.combat;
  if (!combat) {
    return undefined;
  }
  const character = state.character;

  const usableSkills = character.skillIds
    .map((skillId) => compiled.skills.get(skillId))
    .filter((skill): skill is NonNullable<typeof skill> => !!skill && skill.kind === 'active')
    .map((skill) => {
      const cooldown = combat.skillCooldowns?.[skill.id] ?? 0;
      const pool = skill.cost ? character.resources[skill.cost.resourceId] : undefined;
      const lacksResource = skill.cost ? !pool || pool.current < skill.cost.amount : false;
      const requirementsMet = skill.requirements
        ? explainCondition(skill.requirements, { compiled, state }).satisfied
        : true;
      const available = cooldown === 0 && !lacksResource && requirementsMet;
      return {
        skillId: skill.id,
        name: skill.name,
        available,
        ...(available
          ? {}
          : {
              blockedReason: cooldown > 0
                ? `Disponivel em ${cooldown} rodada(s).`
                : lacksResource
                  ? `${compiled.label('resource', skill.cost?.resourceId ?? '')} insuficiente.`
                  : 'Requisitos nao atendidos.',
            }),
        ...(skill.cost !== undefined ? { cost: skill.cost } : {}),
      };
    });

  const usableItems = buildInventory(compiled, state)
    .filter((item) => item.usable)
    .map((item) => ({ itemId: item.itemId, name: item.name, quantity: item.quantity }));

  return {
    round: combat.round,
    turn: combat.turn,
    fleeAllowed: combat.fleeAllowed,
    enemies: combat.enemies.map((enemy) => ({
      instanceId: enemy.instanceId,
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      alive: enemy.alive,
      image: asset(compiled, compiled.enemies.get(enemy.enemyId)?.image),
    })),
    usableSkills,
    usableItems,
  };
}

function buildMerchant(
  compiled: CompiledAdventure,
  state: GameState,
  node: AdventureNode,
): MerchantView | undefined {
  if (node.type !== 'merchant') {
    return undefined;
  }
  const context = { compiled, state };
  const buybackRate =
    node.buybackRate ?? compiled.doc.ruleset.economy?.merchantBuybackRate ?? 0.5;

  const stock = node.stock
    .filter((entry) => !entry.when || explainCondition(entry.when, context).satisfied)
    .map((entry) => {
      const item = compiled.items.get(entry.itemId);
      const price = entry.price ?? item?.value ?? 0;
      return {
        itemId: entry.itemId,
        name: item?.name ?? entry.itemId,
        ...(item?.description !== undefined ? { description: item.description } : {}),
        price,
        quantity: entry.quantity ?? -1,
        affordable: state.character.gold >= price,
        image: asset(compiled, item?.icon ?? item?.image),
      };
    })
    .filter((entry) => entry.quantity !== 0);

  const sellable =
    node.buysFromPlayer === false
      ? []
      : buildInventory(compiled, state)
          .filter((item) => {
            const definition = compiled.items.get(item.itemId);
            return !definition?.bound && definition?.kind !== 'quest' && !item.equipped;
          })
          .map((item) => ({
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity,
            price: Math.max(0, Math.floor((item.value ?? 0) * buybackRate)),
          }));

  return {
    ...(node.npcId ? { npcName: compiled.npcs.get(node.npcId)?.name ?? node.npcId } : {}),
    buysFromPlayer: node.buysFromPlayer !== false,
    buybackRate,
    stock,
    sellable,
  };
}

function buildSkillCheck(
  compiled: CompiledAdventure,
  state: GameState,
  node: AdventureNode,
): SkillCheckView | undefined {
  if (node.type !== 'skillCheck') {
    return undefined;
  }
  const check = node.check;
  const attributes = effectiveAttributes(compiled, state.character);
  const attributeBonus = check.attributeId
    ? attributeModifier(compiled.doc.ruleset, attributes[check.attributeId] ?? 0)
    : 0;
  const skillBonus =
    check.skillId && state.character.skillIds.includes(check.skillId)
      ? (compiled.doc.ruleset.skillCheck.skillBonus ?? 0)
      : 0;
  const itemBonus = (check.itemBonuses ?? []).reduce(
    (total, entry) => total + (itemQuantity(state.character, entry.itemId) > 0 ? entry.bonus : 0),
    0,
  );

  return {
    ...(check.attributeId
      ? { attributeName: compiled.label('attribute', check.attributeId) }
      : {}),
    ...(check.skillId ? { skillName: compiled.label('skill', check.skillId) } : {}),
    dice: check.dice ?? compiled.doc.ruleset.skillCheck.defaultDice,
    difficulty: check.difficulty,
    bonus: attributeBonus + skillBonus + itemBonus + (check.bonus ?? 0),
    attempts: state.pendingSkillCheck?.nodeId === node.id ? state.pendingSkillCheck.attempts : 0,
    retryAllowed: check.retryAllowed ?? false,
  };
}

function buildDialogue(
  compiled: CompiledAdventure,
  state: GameState,
  node: AdventureNode,
): DialogueLineView[] | undefined {
  if (node.type !== 'dialogue') {
    return undefined;
  }
  const context = { compiled, state };
  return node.lines
    .filter((line) => !line.when || explainCondition(line.when, context).satisfied)
    .map((line) => {
      const npc = line.speakerNpcId ?? node.npcId;
      return {
        ...(line.speakerName ?? (npc ? compiled.npcs.get(npc)?.name : undefined)
          ? { speakerName: line.speakerName ?? compiled.npcs.get(npc as Id)?.name }
          : {}),
        portrait: asset(compiled, line.portrait ?? (npc ? compiled.npcs.get(npc)?.portrait : undefined)),
        text: line.text,
      };
    });
}

function availableActions(state: GameState, node: AdventureNode, choices: ChoiceView[]): PlayerActionType[] {
  const actions: PlayerActionType[] = [];

  if (state.status !== 'active') {
    if (state.checkpoint) {
      actions.push('restoreCheckpoint');
    }
    return actions;
  }

  if (state.combat) {
    if (state.combat.turn === 'player' && !state.combat.resolution) {
      actions.push('combatAttack', 'combatSkill', 'combatItem');
      if (state.combat.fleeAllowed) {
        actions.push('combatFlee');
      }
    }
    return actions;
  }

  if (choices.some((choice) => choice.available)) {
    actions.push('choose');
  }

  switch (node.type) {
    case 'skillCheck':
      actions.push('rollSkillCheck');
      break;
    case 'merchant':
      actions.push('buyItem');
      if (node.buysFromPlayer !== false) {
        actions.push('sellItem');
      }
      if (node.leaveNodeId) {
        actions.push('continue');
      }
      break;
    case 'discovery':
    case 'event':
      if (
        (node.type === 'discovery' && node.continueNodeId) ||
        (node.type === 'event' && node.continueNodeId)
      ) {
        actions.push('continue');
      }
      break;
    default:
      break;
  }

  actions.push('useItem', 'equipItem', 'unequipItem');
  if ((state.character.pendingAttributePoints ?? 0) > 0) {
    actions.push('allocateAttribute');
  }
  if (state.checkpoint) {
    actions.push('restoreCheckpoint');
  }

  return [...new Set(actions)];
}

/**
 * Projeta o estado para o cliente.
 *
 * Esta e a unica superficie que o frontend consome: as condicoes ja foram
 * avaliadas aqui, no backend, e viajam como `available` + `blockedReason`.
 */
export function buildView(compiled: CompiledAdventure, state: GameState): NodeView {
  const node = compiled.node(state.currentNodeId);
  // Durante o combate ou apos o final, as escolhas do no nao se aplicam.
  const choices =
    state.status === 'active' && !state.combat ? buildChoices(compiled, state, node) : [];
  const ending = state.endingId ? compiled.endings.get(state.endingId) : undefined;

  return {
    adventure: {
      id: compiled.doc.metadata.id,
      title: compiled.doc.metadata.title,
      version: compiled.doc.metadata.version,
    },
    status: state.status,
    sequence: state.sequence,
    node: {
      id: node.id,
      type: node.type,
      ...(node.title !== undefined ? { title: node.title } : {}),
      ...(node.chapter !== undefined ? { chapter: node.chapter } : {}),
      ...(node.text !== undefined ? { text: node.text } : {}),
      image: asset(compiled, node.image),
      ...(node.media
        ? {
            media: node.media
              .map((media) => {
                const resolved = asset(compiled, media.assetId);
                return resolved
                  ? {
                      ...resolved,
                      ...(media.caption !== undefined ? { caption: media.caption } : {}),
                      ...(media.position !== undefined ? { position: media.position } : {}),
                    }
                  : null;
              })
              .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
          }
        : {}),
      ...(node.audio !== undefined ? { audio: node.audio } : {}),
      checkpoint: node.checkpoint === true || node.type === 'checkpoint',
      ...(node.tags !== undefined ? { tags: node.tags } : {}),
    },
    choices,
    ...(buildDialogue(compiled, state, node) ? { dialogue: buildDialogue(compiled, state, node) } : {}),
    ...(buildCombat(compiled, state) ? { combat: buildCombat(compiled, state) } : {}),
    ...(buildMerchant(compiled, state, node) ? { merchant: buildMerchant(compiled, state, node) } : {}),
    ...(buildSkillCheck(compiled, state, node)
      ? { skillCheck: buildSkillCheck(compiled, state, node) }
      : {}),
    ...(ending
      ? {
          ending: {
            id: ending.id,
            title: ending.title,
            ...(ending.text !== undefined ? { text: ending.text } : {}),
            ...(ending.kind !== undefined ? { kind: ending.kind } : {}),
            image: asset(compiled, ending.image),
          },
        }
      : {}),
    character: buildCharacterSheet(compiled, state),
    inventory: buildInventory(compiled, state),
    quests: buildQuests(compiled, state),
    variables: (compiled.doc.variables ?? [])
      .filter((variable) => variable.visible)
      .map((variable) => ({
        id: variable.id,
        label: variable.label ?? variable.id,
        value: state.flags[variable.id] ?? variable.initial,
      })),
    availableActions: availableActions(state, node, choices),
  };
}
