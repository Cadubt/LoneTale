import { createCharacter, createInitialState, getCharacterCreationOptions, type CharacterCreationOptions, type CreateStateOptions } from '../character/create';
import {
  attributeModifier,
  effectiveAttributes,
  itemQuantity,
  recomputeResourceMaxima,
} from '../character/derive';
import {
  collectCombatOutcome,
  playerAttack,
  playerFlee,
  playerUseItem,
  playerUseSkill,
  startCombat,
} from '../combat/combat';
import { CompiledAdventure, compileAdventure } from '../compile/compiled-adventure';
import { evaluateCondition, explainCondition, firstFailureReason } from '../conditions/evaluate';
import {
  applyEffects,
  createCheckpoint,
  createEffectContext,
  equipItem,
  unequipSlot,
  type EffectContext,
  type Navigation,
} from '../effects/apply';
import { EngineError, SequenceMismatchError } from '../errors';
import { rollDice } from '../random/dice';
import { SeededRng } from '../random/rng';
import type { AdventureDocument, ChoiceTarget } from '../types/adventure';
import type { CharacterDraft, PlayerAction } from '../types/actions';
import type { DiceRoll } from '../types/dice';
import type { GameEvent } from '../types/events';
import type { Id } from '../types/json';
import type { GameState } from '../types/state';
import type { NodeView } from '../types/view';
import { buildView } from '../view/build-view';

/** Limite de saltos automaticos entre nos em um unico passo (anti-loop). */
const MAX_AUTOMATIC_HOPS = 64;

export interface StepResult {
  state: GameState;
  events: GameEvent[];
  view: NodeView;
}

/**
 * Motor de aventuras.
 *
 * Interpreta o documento JSON e executa as regras da partida. E puro: recebe um
 * estado, devolve um novo estado, os eventos ocorridos e a projecao para o
 * cliente. Nao conhece HTTP, banco de dados nem o frontend -- a persistencia e
 * a transacao ficam na camada de aplicacao.
 */
export class AdventureEngine {
  readonly adventure: CompiledAdventure;

  constructor(adventure: CompiledAdventure | AdventureDocument) {
    this.adventure =
      adventure instanceof CompiledAdventure ? adventure : compileAdventure(adventure);
  }

  get creationOptions(): CharacterCreationOptions {
    return getCharacterCreationOptions(this.adventure);
  }

  /** Valida um rascunho de personagem sem iniciar a partida (pre-visualizacao). */
  previewCharacter(draft: CharacterDraft, seed = 'preview') {
    return createCharacter(this.adventure, draft, new SeededRng(seed));
  }

  /** Cria a partida e entra no no inicial, aplicando os seus efeitos de entrada. */
  startGame(draft: CharacterDraft, options: CreateStateOptions = {}): StepResult {
    const initial = createInitialState(this.adventure, draft, options);
    const startNodeId = initial.currentNodeId;
    // `enterNode` cuida da contagem de visitas e dos efeitos de entrada.
    initial.currentNodeId = startNodeId;
    initial.visitedNodes = {};

    const events: GameEvent[] = [];
    const rng = SeededRng.fromState(initial.rng);
    const context = createEffectContext(this.adventure, initial, rng, events, 'bootstrap');

    this.enterNode(context, startNodeId, { recordHistory: false });
    return this.finishStep(context, options.now);
  }

  view(state: GameState): NodeView {
    return buildView(this.adventure, state);
  }

  /**
   * Aplica uma acao do jogador.
   *
   * Trabalha sobre um clone profundo do estado recebido: se algo falhar, o
   * estado original permanece intacto, o que da atomicidade ao passo inteiro
   * quando combinado com uma transacao no banco.
   */
  apply(state: GameState, action: PlayerAction, options: { now?: Date } = {}): StepResult {
    if (state.sequence !== action.expectedSequence) {
      throw new SequenceMismatchError(action.expectedSequence, state.sequence);
    }

    const working = structuredClone(state);
    const events: GameEvent[] = [];
    const rng = SeededRng.fromState(working.rng);
    const visits = working.visitedNodes[working.currentNodeId] ?? 1;
    const context = createEffectContext(
      this.adventure,
      working,
      rng,
      events,
      `node:${working.currentNodeId}#${visits}`,
    );

    if (working.status !== 'active' && action.type !== 'restoreCheckpoint') {
      throw new EngineError('GAME_FINISHED', 'Esta partida ja foi encerrada.');
    }

    this.dispatch(context, action);
    return this.finishStep(context, options.now);
  }

  // -------------------------------------------------------------------------
  // Despacho de acoes
  // -------------------------------------------------------------------------

  private dispatch(context: EffectContext, action: PlayerAction): void {
    const state = context.state;

    if (state.combat && !isCombatAction(action.type) && action.type !== 'restoreCheckpoint') {
      throw new EngineError(
        'ACTION_NOT_ALLOWED',
        'Resolva o combate antes de realizar outras acoes.',
      );
    }

    switch (action.type) {
      case 'choose':
        this.handleChoose(context, action.nodeId, action.choiceId);
        break;
      case 'continue':
        this.handleContinue(context);
        break;
      case 'rollSkillCheck':
        this.handleSkillCheck(context);
        break;
      case 'combatAttack':
        playerAttack(context, action.targetInstanceId);
        this.settleCombat(context);
        break;
      case 'combatSkill':
        playerUseSkill(context, action.skillId, action.targetInstanceId);
        this.settleCombat(context);
        break;
      case 'combatItem':
        playerUseItem(context, action.itemId);
        this.settleCombat(context);
        break;
      case 'combatFlee':
        playerFlee(context);
        this.settleCombat(context);
        break;
      case 'buyItem':
        this.handleBuy(context, action.itemId, action.quantity ?? 1);
        break;
      case 'sellItem':
        this.handleSell(context, action.itemId, action.quantity ?? 1);
        break;
      case 'useItem':
        this.handleUseItem(context, action.itemId);
        break;
      case 'equipItem':
        equipItem(context, action.itemId, action.slot);
        break;
      case 'unequipItem':
        unequipSlot(context, action.slot);
        break;
      case 'allocateAttribute':
        this.handleAllocateAttribute(context, action.attributeId, action.points);
        break;
      case 'restoreCheckpoint':
        this.handleRestoreCheckpoint(context);
        break;
      default: {
        const unknown = action as { type?: string };
        throw new EngineError('ACTION_NOT_ALLOWED', `Acao desconhecida: "${String(unknown.type)}".`);
      }
    }
  }

  private handleChoose(context: EffectContext, nodeId: Id, choiceId: Id): void {
    const state = context.state;
    if (nodeId !== state.currentNodeId) {
      throw new EngineError(
        'ACTION_NOT_ALLOWED',
        `A escolha pertence ao no "${nodeId}", mas a partida esta em "${state.currentNodeId}".`,
        { expected: state.currentNodeId, received: nodeId },
      );
    }

    const node = this.adventure.node(state.currentNodeId);
    const choice = (node.choices ?? []).find((candidate) => candidate.id === choiceId);
    if (!choice) {
      throw new EngineError('CHOICE_NOT_FOUND', `A escolha "${choiceId}" nao existe neste no.`, {
        nodeId,
        choiceId,
      });
    }

    const choiceKey = `${node.id}:${choice.id}`;
    if (choice.once && state.takenChoices.includes(choiceKey)) {
      throw new EngineError('CHOICE_ALREADY_TAKEN', 'Esta escolha so pode ser feita uma vez.', {
        nodeId,
        choiceId,
      });
    }

    const evaluation = explainCondition(choice.conditions, context);
    if (!evaluation.satisfied) {
      throw new EngineError(
        'CHOICE_UNAVAILABLE',
        choice.unavailableLabel ?? firstFailureReason(evaluation) ?? 'Escolha indisponivel.',
        { nodeId, choiceId, reasons: evaluation.failed.map((entry) => entry.reason) },
      );
    }

    // Custos primeiro: se faltar recurso, o passo inteiro falha sem efeito.
    applyEffects(choice.cost, `${choiceKey}.cost`, context);

    state.takenChoices.push(choiceKey);
    context.events.push({
      type: 'choiceTaken',
      nodeId: node.id,
      choiceId: choice.id,
      label: choice.label,
    });

    applyEffects(choice.effects, `${choiceKey}.effects`, context);

    const navigation = this.resolveNavigation(context, choice.target);
    this.travel(context, navigation);
  }

  private handleContinue(context: EffectContext): void {
    const node = this.adventure.node(context.state.currentNodeId);
    let target: Id | undefined;

    switch (node.type) {
      case 'merchant':
        target = node.leaveNodeId;
        break;
      case 'discovery':
      case 'event':
        target = node.continueNodeId;
        break;
      case 'checkpoint':
        target = node.continueNodeId;
        break;
      default:
        target = undefined;
    }

    if (!target) {
      throw new EngineError(
        'ACTION_NOT_ALLOWED',
        'Nao ha para onde seguir automaticamente a partir deste no.',
        { nodeId: node.id },
      );
    }
    this.travel(context, { kind: 'node', nodeId: target });
  }

  private handleSkillCheck(context: EffectContext): void {
    const state = context.state;
    const node = this.adventure.node(state.currentNodeId);
    if (node.type !== 'skillCheck') {
      throw new EngineError('ACTION_NOT_ALLOWED', 'Este no nao e um teste de habilidade.');
    }

    const check = node.check;
    const rules = this.adventure.doc.ruleset.skillCheck;
    const character = state.character;
    const attributes = effectiveAttributes(this.adventure, character);

    const attributeValue = check.attributeId ? (attributes[check.attributeId] ?? 0) : 0;
    const attributeBonus = check.attributeId
      ? attributeModifier(this.adventure.doc.ruleset, attributeValue)
      : 0;
    const skillBonus =
      check.skillId && character.skillIds.includes(check.skillId) ? (rules.skillBonus ?? 0) : 0;
    const itemBonus = (check.itemBonuses ?? []).reduce(
      (total, entry) => total + (itemQuantity(character, entry.itemId) > 0 ? entry.bonus : 0),
      0,
    );
    const bonus = attributeBonus + skillBonus + itemBonus + (check.bonus ?? 0);

    let total: number;
    let roll: DiceRoll | undefined;
    let critical: 'success' | 'failure' | null = null;

    if (rules.mode === 'attributeVsDifficulty') {
      total = attributeValue + bonus;
    } else {
      const expression = check.dice ?? rules.defaultDice;
      roll = rollDice(expression, context.rng, bonus);
      total = roll.total;
      context.events.push({ type: 'diceRolled', purpose: `skillCheck:${node.id}`, roll });
      if (rules.criticalSuccessOn !== undefined && roll.natural >= rules.criticalSuccessOn) {
        critical = 'success';
      } else if (rules.criticalFailureOn !== undefined && roll.natural <= rules.criticalFailureOn) {
        critical = 'failure';
      }
    }

    const success = critical === 'success' ? true : critical === 'failure' ? false : total >= check.difficulty;

    const attempts = (state.pendingSkillCheck?.nodeId === node.id
      ? state.pendingSkillCheck.attempts
      : 0) + 1;

    context.events.push({
      type: 'skillCheckResolved',
      nodeId: node.id,
      success,
      critical,
      total,
      difficulty: check.difficulty,
      ...(roll ? { roll } : {}),
    });

    applyEffects(
      success ? check.onSuccessEffects : check.onFailureEffects,
      `${node.id}.check.${success ? 'onSuccessEffects' : 'onFailureEffects'}`,
      context,
    );

    if (!success && check.retryAllowed) {
      state.pendingSkillCheck = { nodeId: node.id, attempts };
      const death = this.resolveDeath(context);
      if (death) {
        this.travel(context, death);
      }
      return;
    }

    state.pendingSkillCheck = null;

    const targetId = success
      ? (critical === 'success' ? check.onCriticalSuccessNodeId : undefined) ?? check.onSuccessNodeId
      : (critical === 'failure' ? check.onCriticalFailureNodeId : undefined) ?? check.onFailureNodeId;

    const navigation = this.resolveNavigation(context, { kind: 'node', nodeId: targetId });
    this.travel(context, navigation);
  }

  private handleBuy(context: EffectContext, itemId: Id, quantity: number): void {
    const state = context.state;
    const node = this.adventure.node(state.currentNodeId);
    if (node.type !== 'merchant') {
      throw new EngineError('ACTION_NOT_ALLOWED', 'Nao ha um comerciante neste local.');
    }
    if (quantity < 1) {
      throw new EngineError('ACTION_NOT_ALLOWED', 'Quantidade invalida.');
    }

    const entry = node.stock.find((candidate) => candidate.itemId === itemId);
    if (!entry) {
      throw new EngineError('ITEM_NOT_FOUND', 'Este item nao esta a venda aqui.', { itemId });
    }
    if (entry.when && !evaluateCondition(entry.when, context)) {
      throw new EngineError('ITEM_NOT_FOUND', 'Este item nao esta disponivel agora.', { itemId });
    }

    const item = this.adventure.item(itemId);
    const price = entry.price ?? item.value ?? 0;
    const stockKey = `${node.id}:${itemId}`;

    if (entry.quantity !== undefined && entry.quantity >= 0) {
      const purchased = state.merchantPurchases[stockKey] ?? 0;
      if (purchased + quantity > entry.quantity) {
        throw new EngineError(
          'ITEM_NOT_FOUND',
          `O comerciante tem apenas ${entry.quantity - purchased} unidade(s) de ${item.name}.`,
          { itemId, remaining: entry.quantity - purchased },
        );
      }
      state.merchantPurchases[stockKey] = purchased + quantity;
    }

    applyEffects(
      [
        { type: 'spendGold', amount: price * quantity },
        { type: 'addItem', itemId, quantity },
      ],
      `${node.id}.buy.${itemId}`,
      context,
    );
  }

  private handleSell(context: EffectContext, itemId: Id, quantity: number): void {
    const state = context.state;
    const node = this.adventure.node(state.currentNodeId);
    if (node.type !== 'merchant') {
      throw new EngineError('ACTION_NOT_ALLOWED', 'Nao ha um comerciante neste local.');
    }
    if (node.buysFromPlayer === false) {
      throw new EngineError('ACTION_NOT_ALLOWED', 'Este comerciante nao compra nada.');
    }
    if (quantity < 1) {
      throw new EngineError('ACTION_NOT_ALLOWED', 'Quantidade invalida.');
    }

    const item = this.adventure.item(itemId);
    if (item.bound || item.kind === 'quest') {
      throw new EngineError('ACTION_NOT_ALLOWED', `${item.name} nao pode ser vendido.`, { itemId });
    }
    if (itemQuantity(state.character, itemId) < quantity) {
      throw new EngineError('ITEM_NOT_OWNED', `Voce nao possui ${quantity}x ${item.name}.`, { itemId });
    }

    const rate = node.buybackRate ?? this.adventure.doc.ruleset.economy?.merchantBuybackRate ?? 0.5;
    const unitPrice = Math.max(0, Math.floor((item.value ?? 0) * rate));

    applyEffects(
      [
        { type: 'consumeItem', itemId, quantity },
        { type: 'grantGold', amount: unitPrice * quantity },
      ],
      `${node.id}.sell.${itemId}`,
      context,
    );
  }

  private handleUseItem(context: EffectContext, itemId: Id): void {
    const item = this.adventure.item(itemId);
    if (itemQuantity(context.state.character, itemId) <= 0) {
      throw new EngineError('ITEM_NOT_OWNED', `Voce nao possui ${item.name}.`, { itemId });
    }
    if (item.kind !== 'consumable' || !item.useEffects?.length) {
      throw new EngineError('ACTION_NOT_ALLOWED', `${item.name} nao pode ser usado.`, { itemId });
    }
    if (item.requirements && !evaluateCondition(item.requirements, context)) {
      throw new EngineError(
        'ITEM_REQUIREMENTS_NOT_MET',
        `Voce nao atende aos requisitos para usar ${item.name}.`,
        { itemId },
      );
    }

    applyEffects(item.useEffects, `items.${itemId}.useEffects`, context);
    if (item.consumedOnUse ?? true) {
      applyEffects([{ type: 'consumeItem', itemId, quantity: 1 }], `items.${itemId}.consume`, context);
    }

    const navigation = context.halted ? context.navigation : (context.navigation ?? null);
    if (navigation) {
      this.travel(context, navigation);
    } else {
      const death = this.resolveDeath(context);
      if (death) {
        this.travel(context, death);
      }
    }
  }

  private handleAllocateAttribute(context: EffectContext, attributeId: Id, points: number): void {
    const character = context.state.character;
    const pending = character.pendingAttributePoints ?? 0;
    if (points < 1) {
      throw new EngineError('ACTION_NOT_ALLOWED', 'Informe ao menos 1 ponto.');
    }
    if (points > pending) {
      throw new EngineError('ACTION_NOT_ALLOWED', `Voce tem apenas ${pending} ponto(s) disponivel(is).`);
    }
    const definition = this.adventure.attributes.get(attributeId);
    if (!definition) {
      throw new EngineError('ACTION_NOT_ALLOWED', `Atributo "${attributeId}" nao existe.`);
    }
    const current = character.attributes[attributeId] ?? definition.default;
    if (current + points > definition.max) {
      throw new EngineError(
        'ACTION_NOT_ALLOWED',
        `${definition.name} nao pode passar de ${definition.max}.`,
      );
    }

    character.attributes[attributeId] = current + points;
    character.pendingAttributePoints = pending - points;
    recomputeResourceMaxima(this.adventure, character);
    context.events.push({
      type: 'attributeChanged',
      attributeId,
      delta: points,
      value: current + points,
    });
  }

  private handleRestoreCheckpoint(context: EffectContext): void {
    const state = context.state;
    const checkpoint = state.checkpoint;
    if (!checkpoint) {
      throw new EngineError('CHECKPOINT_NOT_FOUND', 'Esta partida nao tem ponto de retomada.');
    }

    state.character = structuredClone(checkpoint.character);
    state.flags = { ...checkpoint.flags };
    state.quests = structuredClone(checkpoint.quests);
    state.npcRelations = { ...checkpoint.npcRelations };
    state.visitedNodes = { ...checkpoint.visitedNodes };
    state.defeatedEnemies = { ...checkpoint.defeatedEnemies };
    state.takenChoices = [...checkpoint.takenChoices];
    state.consumedEffects = [...checkpoint.consumedEffects];
    state.merchantPurchases = { ...checkpoint.merchantPurchases };
    state.combat = null;
    state.pendingSkillCheck = null;
    state.endingId = null;
    state.status = 'active';
    state.currentNodeId = checkpoint.nodeId;
    state.previousNodeId = null;
    state.nodeHistory = [];

    context.events.push({ type: 'checkpointRestored', nodeId: checkpoint.nodeId });
    this.enterNode(context, checkpoint.nodeId, { recordHistory: false });
  }

  // -------------------------------------------------------------------------
  // Navegacao
  // -------------------------------------------------------------------------

  /**
   * Decide para onde ir: uma cadeia de efeitos interrompida (combate/final)
   * tem prioridade; depois o `target` declarado; por fim um `goto` nos efeitos.
   */
  private resolveNavigation(
    context: EffectContext,
    target: ChoiceTarget | undefined,
  ): Navigation | null {
    if (context.halted && context.navigation) {
      return context.navigation;
    }

    const death = this.resolveDeath(context);
    if (death) {
      return death;
    }

    if (!target) {
      return context.navigation;
    }

    switch (target.kind) {
      case 'node':
        return { kind: 'node', nodeId: target.nodeId };
      case 'ending':
        return { kind: 'ending', endingId: target.endingId };
      case 'stay':
        return null;
      case 'back': {
        const previous = context.state.nodeHistory[context.state.nodeHistory.length - 1];
        if (!previous) {
          return null;
        }
        context.state.nodeHistory.pop();
        return { kind: 'node', nodeId: previous };
      }
      case 'random': {
        const index = context.rng.weightedIndex(target.options.map((option) => option.weight));
        const option = target.options[index];
        return option ? { kind: 'node', nodeId: option.nodeId } : null;
      }
      case 'conditional': {
        for (const branch of target.branches) {
          if (evaluateCondition(branch.when, context)) {
            return { kind: 'node', nodeId: branch.nodeId };
          }
        }
        return target.otherwiseNodeId ? { kind: 'node', nodeId: target.otherwiseNodeId } : null;
      }
      default:
        return null;
    }
  }

  private travel(context: EffectContext, navigation: Navigation | null): void {
    if (!navigation) {
      return;
    }
    switch (navigation.kind) {
      case 'node':
        this.enterNode(context, navigation.nodeId, { recordHistory: true });
        break;
      case 'ending':
        this.finishAdventure(context, navigation.endingId);
        break;
      case 'combat':
        this.beginCombat(context, navigation);
        break;
      default:
        break;
    }
  }

  private beginCombat(context: EffectContext, navigation: Navigation & { kind: 'combat' }): void {
    const fallback = context.state.currentNodeId;
    startCombat(context, {
      nodeId: context.state.currentNodeId,
      enemies: navigation.enemyIds.map((enemyId) => ({ enemyId })),
      onVictoryNodeId: navigation.onVictoryNodeId ?? fallback,
      ...(navigation.onDefeatNodeId !== undefined
        ? { onDefeatNodeId: navigation.onDefeatNodeId }
        : {}),
      ...(navigation.onFleeNodeId !== undefined ? { onFleeNodeId: navigation.onFleeNodeId } : {}),
      ...(navigation.fleeAllowed !== undefined ? { fleeAllowed: navigation.fleeAllowed } : {}),
    });
    this.settleCombat(context);
  }

  /** Fecha um combate resolvido e segue para o destino correspondente. */
  private settleCombat(context: EffectContext): void {
    const combat = context.state.combat;
    if (!combat?.resolution) {
      return;
    }
    const resolution = combat.resolution;
    const navigation = collectCombatOutcome(context);

    const node = this.adventure.nodes.get(combat.nodeId);
    if (node?.type === 'combat') {
      applyEffects(
        resolution === 'victory'
          ? node.encounter.onVictoryEffects
          : resolution === 'defeat'
            ? node.encounter.onDefeatEffects
            : undefined,
        `${node.id}.encounter.${resolution}Effects`,
        context,
      );
    }

    if (resolution === 'defeat' && !navigation) {
      const death = this.resolveDeath(context, { force: true });
      this.travel(context, death);
      return;
    }

    if (context.halted && context.navigation) {
      this.travel(context, context.navigation);
      return;
    }

    this.travel(context, navigation);
  }

  /**
   * Entra em um no: valida condicoes de entrada, conta a visita, grava
   * checkpoint, aplica efeitos de entrada e resolve comportamentos automaticos
   * (combate, evento aleatorio, checkpoint, final), seguindo as cadeias de
   * navegacao produzidas pelos efeitos.
   */
  private enterNode(
    context: EffectContext,
    nodeId: Id,
    options: { recordHistory: boolean },
  ): void {
    const state = context.state;
    let targetId = nodeId;
    let recordHistory = options.recordHistory;

    for (let hop = 0; hop < MAX_AUTOMATIC_HOPS; hop += 1) {
      const node = this.adventure.node(targetId);

      // Condicoes de entrada: falha redireciona para o fallback.
      if (node.entryConditions && !evaluateCondition(node.entryConditions, context)) {
        if (!node.fallbackNodeId) {
          throw new EngineError(
            'ADVENTURE_INVALID',
            `O no "${node.id}" tem condicoes de entrada mas nenhum fallbackNodeId.`,
            { nodeId: node.id },
          );
        }
        targetId = node.fallbackNodeId;
        continue;
      }

      if (state.currentNodeId !== targetId) {
        context.events.push({ type: 'nodeExited', nodeId: state.currentNodeId });
        applyEffects(
          this.adventure.nodes.get(state.currentNodeId)?.onExit,
          `${state.currentNodeId}.onExit`,
          context,
        );
        if (recordHistory) {
          state.nodeHistory.push(state.currentNodeId);
          if (state.nodeHistory.length > 50) {
            state.nodeHistory.shift();
          }
        }
        state.previousNodeId = state.currentNodeId;
      }
      recordHistory = true;

      state.currentNodeId = targetId;
      const visitCount = (state.visitedNodes[targetId] ?? 0) + 1;
      state.visitedNodes[targetId] = visitCount;
      context.scope = `node:${targetId}#${visitCount}`;
      context.navigation = null;
      context.halted = false;
      context.events.push({ type: 'nodeEntered', nodeId: targetId, visitCount });

      this.applyRegeneration(context);

      if (node.checkpoint === true || node.type === 'checkpoint') {
        const label = node.type === 'checkpoint' ? node.label : undefined;
        state.checkpoint = createCheckpoint(state, label);
        context.events.push({
          type: 'checkpointSaved',
          nodeId: targetId,
          ...(label !== undefined ? { label } : {}),
        });
      }

      applyEffects(node.onEnter, `${targetId}.onEnter`, context);

      if (node.type === 'discovery') {
        applyEffects(node.rewards, `${targetId}.rewards`, context);
      }

      if (node.type === 'event' && node.outcomes?.length) {
        const index = context.rng.weightedIndex(node.outcomes.map((outcome) => outcome.weight));
        const outcome = node.outcomes[index];
        if (outcome) {
          applyEffects(outcome.effects, `${targetId}.outcomes[${index}].effects`, context);
          if (outcome.nodeId && !context.halted) {
            context.navigation = { kind: 'node', nodeId: outcome.nodeId };
          }
        }
      }

      const death = this.resolveDeath(context);
      if (death) {
        if (death.kind === 'node') {
          targetId = death.nodeId;
          continue;
        }
        this.travel(context, death);
        return;
      }

      if (node.type === 'ending') {
        this.finishAdventure(context, node.endingId);
        return;
      }

      if (context.navigation) {
        const next = context.navigation;
        if (next.kind === 'node') {
          targetId = next.nodeId;
          continue;
        }
        this.travel(context, next);
        return;
      }

      if (node.type === 'combat') {
        startCombat(context, {
          nodeId: targetId,
          enemies: node.encounter.enemies,
          onVictoryNodeId: node.encounter.onVictoryNodeId,
          ...(node.encounter.onDefeatNodeId !== undefined
            ? { onDefeatNodeId: node.encounter.onDefeatNodeId }
            : {}),
          ...(node.encounter.onFleeNodeId !== undefined
            ? { onFleeNodeId: node.encounter.onFleeNodeId }
            : {}),
          ...(node.encounter.fleeAllowed !== undefined
            ? { fleeAllowed: node.encounter.fleeAllowed }
            : {}),
          ...(node.encounter.surpriseRound !== undefined
            ? { surpriseRound: node.encounter.surpriseRound }
            : {}),
        });
        this.settleCombat(context);
        return;
      }

      if (node.type === 'checkpoint') {
        targetId = node.continueNodeId;
        continue;
      }

      if (node.type === 'skillCheck') {
        state.pendingSkillCheck = { nodeId: targetId, attempts: 0 };
      }

      return;
    }

    throw new EngineError(
      'ADVENTURE_INVALID',
      `Cadeia de navegacao automatica excedeu ${MAX_AUTOMATIC_HOPS} saltos a partir de "${nodeId}": verifique se ha um ciclo de nos sem interacao.`,
      { nodeId },
    );
  }

  /** Regeneracao passiva declarada por recurso, aplicada ao entrar em um no. */
  private applyRegeneration(context: EffectContext): void {
    for (const resource of this.adventure.doc.resources) {
      if (!resource.regenPerNode) {
        continue;
      }
      const pool = context.state.character.resources[resource.id];
      if (!pool || pool.current <= 0 || pool.current >= pool.max) {
        continue;
      }
      const before = pool.current;
      pool.current = Math.min(pool.max, pool.current + resource.regenPerNode);
      if (pool.current !== before) {
        context.events.push({
          type: 'resourceChanged',
          resourceId: resource.id,
          delta: pool.current - before,
          current: pool.current,
          max: pool.max,
        });
      }
    }
  }

  /** Aplica as regras de morte quando o recurso vital chega a zero. */
  private resolveDeath(
    context: EffectContext,
    options: { force?: boolean } = {},
  ): Navigation | null {
    const state = context.state;
    const vitalId = this.adventure.vitalResourceId;
    const pool = state.character.resources[vitalId];
    if (!options.force && (!pool || pool.current > 0)) {
      return null;
    }

    context.events.push({ type: 'characterDied', resourceId: vitalId });
    const rules = this.adventure.doc.ruleset.death;

    switch (rules.onVitalDepleted) {
      case 'restartCheckpoint': {
        const checkpoint = state.checkpoint;
        if (!checkpoint) {
          state.status = 'defeated';
          return rules.endingId ? { kind: 'ending', endingId: rules.endingId } : null;
        }
        state.character = structuredClone(checkpoint.character);
        state.flags = { ...checkpoint.flags };
        state.quests = structuredClone(checkpoint.quests);
        state.npcRelations = { ...checkpoint.npcRelations };
        state.visitedNodes = { ...checkpoint.visitedNodes };
        state.defeatedEnemies = { ...checkpoint.defeatedEnemies };
        state.takenChoices = [...checkpoint.takenChoices];
        state.consumedEffects = [...checkpoint.consumedEffects];
        state.merchantPurchases = { ...checkpoint.merchantPurchases };
        state.combat = null;
        state.pendingSkillCheck = null;
        context.events.push({ type: 'checkpointRestored', nodeId: checkpoint.nodeId });
        return { kind: 'node', nodeId: checkpoint.nodeId };
      }
      case 'goto':
        return rules.nodeId ? { kind: 'node', nodeId: rules.nodeId } : null;
      case 'ending':
      default:
        state.status = 'defeated';
        return rules.endingId ? { kind: 'ending', endingId: rules.endingId } : null;
    }
  }

  private finishAdventure(context: EffectContext, endingId: Id): void {
    const state = context.state;
    const ending = this.adventure.ending(endingId);

    state.endingId = endingId;
    if (!state.reachedEndings.includes(endingId)) {
      state.reachedEndings.push(endingId);
    }
    state.combat = null;
    state.pendingSkillCheck = null;
    state.status = ending.kind === 'defeat' ? 'defeated' : 'completed';

    context.halted = false;
    applyEffects(ending.effects, `endings.${endingId}.effects`, context);
    context.halted = true;

    context.events.push({
      type: 'adventureEnded',
      endingId,
      ...(ending.kind !== undefined ? { kind: ending.kind } : {}),
    });
  }

  private finishStep(context: EffectContext, now?: Date): StepResult {
    const state = context.state;
    state.sequence += 1;
    state.rng = context.rng.toState();
    state.updatedAt = (now ?? new Date()).toISOString();

    return {
      state,
      events: context.events,
      view: buildView(this.adventure, state),
    };
  }
}

function isCombatAction(type: PlayerAction['type']): boolean {
  return (
    type === 'combatAttack' ||
    type === 'combatSkill' ||
    type === 'combatItem' ||
    type === 'combatFlee'
  );
}

export function createEngine(adventure: AdventureDocument | CompiledAdventure): AdventureEngine {
  return new AdventureEngine(adventure);
}
