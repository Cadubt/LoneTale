import {
  attributeModifier,
  effectiveAttributes,
  equippedWeapon,
  itemQuantity,
  totalArmor,
} from '../character/derive';
import { evaluateCondition } from '../conditions/evaluate';
import { applyEffect, applyEffects, grantExperience, type EffectContext, type Navigation } from '../effects/apply';
import { EngineError } from '../errors';
import { rollDice } from '../random/dice';
import type { CombatRules, EnemyAbility, EnemyDefinition, SkillDefinition } from '../types/adventure';
import type { Id } from '../types/json';
import type { CombatantState, CombatState } from '../types/state';

export interface StartCombatOptions {
  nodeId: Id;
  enemies: Array<{ enemyId: Id; count?: number }>;
  onVictoryNodeId: Id;
  onDefeatNodeId?: Id;
  onFleeNodeId?: Id;
  fleeAllowed?: boolean;
  surpriseRound?: 'player' | 'enemy' | 'none';
}

function combatRules(context: EffectContext): CombatRules {
  return context.compiled.doc.ruleset.combat;
}

function instantiateEnemy(
  definition: EnemyDefinition,
  index: number,
  suffix: number,
): CombatantState {
  return {
    instanceId: `${definition.id}#${index}`,
    enemyId: definition.id,
    name: suffix > 1 ? `${definition.name} ${suffix}` : definition.name,
    hp: definition.hp,
    maxHp: definition.hp,
    armor: definition.armor ?? 0,
    initiative: definition.initiative ?? 0,
    alive: true,
    cooldowns: {},
  };
}

/** Monta o estado inicial do combate e decide quem age primeiro. */
export function startCombat(context: EffectContext, options: StartCombatOptions): void {
  const rules = combatRules(context);
  if (!rules.enabled) {
    throw new EngineError('ACTION_NOT_ALLOWED', 'Combate desabilitado nesta aventura.');
  }

  const enemies: CombatantState[] = [];
  let index = 0;
  for (const entry of options.enemies) {
    const definition = context.compiled.enemy(entry.enemyId);
    const count = entry.count ?? 1;
    for (let i = 0; i < count; i += 1) {
      enemies.push(instantiateEnemy(definition, index, count > 1 ? i + 1 : 1));
      index += 1;
    }
  }
  if (enemies.length === 0) {
    throw new EngineError('ADVENTURE_INVALID', 'Encontro de combate sem criaturas.');
  }

  let turn: 'player' | 'enemies' = 'player';
  if (options.surpriseRound === 'enemy') {
    turn = 'enemies';
  } else if (options.surpriseRound !== 'player') {
    if (rules.initiative === 'enemyFirst') {
      turn = 'enemies';
    } else if (rules.initiative === 'roll') {
      const dice = rules.initiativeDice ?? '1d20';
      const attributes = effectiveAttributes(context.compiled, context.state.character);
      const attributeId = rules.attackRules?.attackAttributeId;
      const bonus = attributeId
        ? attributeModifier(context.compiled.doc.ruleset, attributes[attributeId] ?? 0)
        : 0;
      const playerRoll = rollDice(dice, context.rng, bonus);
      const bestEnemyInitiative = Math.max(...enemies.map((enemy) => enemy.initiative));
      const enemyRoll = rollDice(dice, context.rng, bestEnemyInitiative);
      context.events.push({ type: 'diceRolled', purpose: 'initiative:player', roll: playerRoll });
      context.events.push({ type: 'diceRolled', purpose: 'initiative:enemies', roll: enemyRoll });
      turn = playerRoll.total >= enemyRoll.total ? 'player' : 'enemies';
    }
  }

  const combat: CombatState = {
    nodeId: options.nodeId,
    round: 1,
    enemies,
    turn,
    fleeAllowed: options.fleeAllowed ?? rules.fleeAllowed,
    onVictoryNodeId: options.onVictoryNodeId,
    skillCooldowns: {},
  };
  if (options.onDefeatNodeId !== undefined) {
    combat.onDefeatNodeId = options.onDefeatNodeId;
  }
  if (options.onFleeNodeId !== undefined) {
    combat.onFleeNodeId = options.onFleeNodeId;
  }

  context.state.combat = combat;
  context.events.push({
    type: 'combatStarted',
    nodeId: options.nodeId,
    enemyIds: enemies.map((enemy) => enemy.enemyId),
  });

  if (turn === 'enemies') {
    runEnemyTurn(context);
  }
}

function requireCombat(context: EffectContext): CombatState {
  const combat = context.state.combat;
  if (!combat) {
    throw new EngineError('COMBAT_NOT_ACTIVE', 'Nenhum combate em andamento.');
  }
  if (combat.resolution) {
    throw new EngineError('COMBAT_NOT_ACTIVE', 'Este combate ja terminou.');
  }
  return combat;
}

function requirePlayerTurn(context: EffectContext): CombatState {
  const combat = requireCombat(context);
  if (combat.turn !== 'player') {
    throw new EngineError('COMBAT_NOT_PLAYER_TURN', 'Nao e a sua vez neste combate.');
  }
  return combat;
}

function pickTarget(combat: CombatState, instanceId?: string): CombatantState {
  if (instanceId) {
    const target = combat.enemies.find((enemy) => enemy.instanceId === instanceId);
    if (!target) {
      throw new EngineError('ENEMY_NOT_FOUND', `Alvo "${instanceId}" nao existe neste combate.`);
    }
    if (!target.alive) {
      throw new EngineError('ENEMY_NOT_FOUND', `${target.name} ja foi derrotado.`);
    }
    return target;
  }
  const first = combat.enemies.find((enemy) => enemy.alive);
  if (!first) {
    throw new EngineError('ENEMY_NOT_FOUND', 'Nao ha alvos vivos.');
  }
  return first;
}

function playerDefense(context: EffectContext): number {
  const rules = combatRules(context);
  const attributes = effectiveAttributes(context.compiled, context.state.character);
  const base = rules.attackRules?.playerDefenseBase ?? 10;
  const attributeId = rules.attackRules?.defenseAttributeId;
  const bonus = attributeId
    ? attributeModifier(context.compiled.doc.ruleset, attributes[attributeId] ?? 0)
    : 0;
  return base + bonus + totalArmor(context.compiled, context.state.character);
}

function applyDamageToEnemy(
  context: EffectContext,
  target: CombatantState,
  rawDamage: number,
  ignoreArmor = false,
): number {
  const rules = combatRules(context);
  const minimum = rules.minimumDamage ?? 0;
  let damage = Math.max(0, Math.floor(rawDamage));
  if (!ignoreArmor && rules.armorMode === 'subtract') {
    damage = Math.max(minimum, damage - target.armor);
  }
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp === 0 && target.alive) {
    target.alive = false;
    context.events.push({
      type: 'combatantDefeated',
      instanceId: target.instanceId,
      enemyId: target.enemyId,
      name: target.name,
    });
  }
  return damage;
}

function damageToPlayer(context: EffectContext, rawDamage: number, ignoreArmor = false): number {
  const rules = combatRules(context);
  const pool = context.state.character.resources[context.compiled.vitalResourceId];
  if (!pool) {
    return 0;
  }
  let damage = Math.max(0, Math.floor(rawDamage));
  if (!ignoreArmor && rules.armorMode === 'subtract') {
    const minimum = rules.minimumDamage ?? 0;
    damage = Math.max(minimum, damage - totalArmor(context.compiled, context.state.character));
  }
  const before = pool.current;
  pool.current = Math.max(0, pool.current - damage);
  if (pool.current !== before) {
    context.events.push({
      type: 'resourceChanged',
      resourceId: context.compiled.vitalResourceId,
      delta: pool.current - before,
      current: pool.current,
      max: pool.max,
    });
  }
  return before - pool.current;
}

/** Ataque basico do personagem com a arma equipada. */
export function playerAttack(context: EffectContext, targetInstanceId?: string): void {
  const combat = requirePlayerTurn(context);
  const target = pickTarget(combat, targetInstanceId);
  const rules = combatRules(context);
  const ruleset = context.compiled.doc.ruleset;
  const character = context.state.character;
  const attributes = effectiveAttributes(context.compiled, character);
  const weapon = equippedWeapon(context.compiled, character);

  let hit = true;
  let hitRoll;
  if (rules.attackRules?.mode === 'rollToHit') {
    const dice = rules.attackRules.hitDice ?? '1d20';
    const attackAttributeId = rules.attackRules.attackAttributeId;
    const bonus = attackAttributeId
      ? attributeModifier(ruleset, attributes[attackAttributeId] ?? 0)
      : 0;
    hitRoll = rollDice(dice, context.rng, bonus);
    hit = hitRoll.total >= (target.armor + (rules.attackRules.playerDefenseBase ?? 10));
    context.events.push({ type: 'diceRolled', purpose: 'attack', roll: hitRoll });
  }

  let damage = 0;
  if (hit) {
    const damageDice = weapon?.stats?.damageDice ?? rules.attackRules?.unarmedDamageDice;
    const flat = weapon?.stats?.flatDamage ?? 0;
    const damageAttributeId = rules.attackRules?.damageAttributeId;
    const attributeBonus = damageAttributeId
      ? attributeModifier(ruleset, attributes[damageAttributeId] ?? 0)
      : 0;
    let raw = flat + attributeBonus;
    if (damageDice) {
      const roll = rollDice(damageDice, context.rng);
      context.events.push({ type: 'diceRolled', purpose: 'damage', roll });
      raw += roll.total;
    }
    damage = applyDamageToEnemy(context, target, Math.max(1, raw));
  }

  context.events.push({
    type: 'combatAttack',
    source: 'player',
    actorName: character.name,
    targetName: target.name,
    hit,
    damage,
    ...(hitRoll ? { roll: hitRoll } : {}),
  });

  endPlayerTurn(context);
}

/** Uso de uma pericia ativa em combate. */
export function playerUseSkill(
  context: EffectContext,
  skillId: Id,
  targetInstanceId?: string,
): void {
  const combat = requirePlayerTurn(context);
  const skill = context.compiled.skills.get(skillId);
  if (!skill) {
    throw new EngineError('SKILL_NOT_AVAILABLE', `Pericia "${skillId}" nao existe.`);
  }
  assertSkillUsable(context, skill);

  if (skill.cost) {
    applyEffect({ type: 'spendResource', resourceId: skill.cost.resourceId, amount: skill.cost.amount }, context);
  }

  const character = context.state.character;
  const attributes = effectiveAttributes(context.compiled, character);
  const scaling = skill.combat?.scalingAttributeId;
  const bonus = scaling ? attributeModifier(context.compiled.doc.ruleset, attributes[scaling] ?? 0) : 0;

  let totalDamage = 0;
  let healing = 0;

  if (skill.combat?.healing) {
    healing = skill.combat.healing + bonus;
    applyEffect({ type: 'heal', amount: healing }, context);
  }

  if (skill.combat?.damageDice || skill.combat?.flatDamage) {
    const targets =
      skill.combat.targets === 'all'
        ? combat.enemies.filter((enemy) => enemy.alive)
        : [pickTarget(combat, targetInstanceId)];
    for (const target of targets) {
      let raw = (skill.combat.flatDamage ?? 0) + bonus;
      if (skill.combat.damageDice) {
        const roll = rollDice(skill.combat.damageDice, context.rng);
        context.events.push({ type: 'diceRolled', purpose: `skill:${skillId}`, roll });
        raw += roll.total;
      }
      const dealt = applyDamageToEnemy(context, target, Math.max(1, raw));
      totalDamage += dealt;
      context.events.push({
        type: 'combatAttack',
        source: 'player',
        actorName: character.name,
        targetName: target.name,
        hit: true,
        damage: dealt,
      });
    }
  }

  applyEffects(skill.effects, `skills.${skillId}.effects`, context);

  if (skill.combat?.cooldownRounds) {
    combat.skillCooldowns = combat.skillCooldowns ?? {};
    combat.skillCooldowns[skillId] = skill.combat.cooldownRounds;
  }

  context.events.push({
    type: 'combatSkillUsed',
    skillId,
    ...(totalDamage > 0 ? { damage: totalDamage } : {}),
    ...(healing > 0 ? { healing } : {}),
  });

  endPlayerTurn(context);
}

export function assertSkillUsable(context: EffectContext, skill: SkillDefinition): void {
  const character = context.state.character;
  if (!character.skillIds.includes(skill.id)) {
    throw new EngineError('SKILL_NOT_AVAILABLE', `Voce nao conhece ${skill.name}.`);
  }
  if (skill.kind !== 'active') {
    throw new EngineError('SKILL_NOT_AVAILABLE', `${skill.name} nao e uma pericia ativa.`);
  }
  if (skill.requirements && !evaluateCondition(skill.requirements, context)) {
    throw new EngineError('SKILL_NOT_AVAILABLE', `Requisitos de ${skill.name} nao atendidos.`);
  }
  if (skill.cost) {
    const pool = character.resources[skill.cost.resourceId];
    if (!pool || pool.current < skill.cost.amount) {
      throw new EngineError(
        'INSUFFICIENT_RESOURCE',
        `${skill.name} exige ${skill.cost.amount} de ${context.compiled.label('resource', skill.cost.resourceId)}.`,
      );
    }
  }
  const cooldown = context.state.combat?.skillCooldowns?.[skill.id] ?? 0;
  if (cooldown > 0) {
    throw new EngineError(
      'SKILL_ON_COOLDOWN',
      `${skill.name} estara disponivel em ${cooldown} rodada(s).`,
    );
  }
}

/** Uso de um consumivel durante o combate (gasta o turno). */
export function playerUseItem(context: EffectContext, itemId: Id): void {
  requirePlayerTurn(context);
  const item = context.compiled.item(itemId);
  if (itemQuantity(context.state.character, itemId) <= 0) {
    throw new EngineError('ITEM_NOT_OWNED', `Voce nao possui ${item.name}.`);
  }
  if (item.kind !== 'consumable') {
    throw new EngineError('ACTION_NOT_ALLOWED', `${item.name} nao pode ser usado em combate.`);
  }
  applyEffects(item.useEffects, `items.${itemId}.useEffects`, context);
  if (item.consumedOnUse ?? true) {
    applyEffect({ type: 'consumeItem', itemId, quantity: 1 }, context);
  }
  endPlayerTurn(context);
}

/** Tentativa de fuga: pode exigir um teste declarado no ruleset. */
export function playerFlee(context: EffectContext): void {
  const combat = requirePlayerTurn(context);
  if (!combat.fleeAllowed) {
    throw new EngineError('FLEE_NOT_ALLOWED', 'Nao e possivel fugir deste combate.');
  }
  const rules = combatRules(context);
  const check = rules.fleeCheck;

  if (check) {
    const attributes = effectiveAttributes(context.compiled, context.state.character);
    const bonus = check.attributeId
      ? attributeModifier(context.compiled.doc.ruleset, attributes[check.attributeId] ?? 0)
      : 0;
    const roll = rollDice(check.dice ?? rules.initiativeDice ?? '1d20', context.rng, bonus);
    context.events.push({ type: 'diceRolled', purpose: 'flee', roll });
    if (roll.total < check.difficulty) {
      context.events.push({
        type: 'warning',
        code: 'flee.failed',
        message: 'A fuga falhou.',
      });
      endPlayerTurn(context);
      return;
    }
  }

  combat.resolution = 'fled';
  context.events.push({ type: 'combatEnded', nodeId: combat.nodeId, resolution: 'fled' });
}

function endPlayerTurn(context: EffectContext): void {
  const combat = requireCombat(context);
  if (combat.enemies.every((enemy) => !enemy.alive)) {
    finishCombat(context, 'victory');
    return;
  }
  combat.turn = 'enemies';
  runEnemyTurn(context);
}

function pickAbility(context: EffectContext, enemy: CombatantState, definition: EnemyDefinition): EnemyAbility | null {
  for (const ability of definition.abilities ?? []) {
    const cooldown = enemy.cooldowns?.[ability.id] ?? 0;
    if (cooldown > 0) {
      continue;
    }
    if (context.rng.chance(ability.chance ?? 0.25)) {
      return ability;
    }
  }
  return null;
}

/** Turno das criaturas: cada uma age uma vez, na ordem do encontro. */
export function runEnemyTurn(context: EffectContext): void {
  const combat = requireCombat(context);
  const rules = combatRules(context);
  const character = context.state.character;
  const vital = context.state.character.resources[context.compiled.vitalResourceId];

  for (const enemy of combat.enemies) {
    if (!enemy.alive || (vital && vital.current <= 0)) {
      continue;
    }
    const definition = context.compiled.enemy(enemy.enemyId);
    const ability = pickAbility(context, enemy, definition);

    if (ability) {
      let raw = ability.flatDamage ?? 0;
      if (ability.damageDice) {
        const roll = rollDice(ability.damageDice, context.rng);
        context.events.push({ type: 'diceRolled', purpose: `ability:${ability.id}`, roll });
        raw += roll.total;
      }
      const dealt = raw > 0 ? damageToPlayer(context, raw) : 0;
      if (ability.healing) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + ability.healing);
      }
      applyEffects(ability.applyEffects, `enemies.${enemy.enemyId}.abilities.${ability.id}`, context);
      if (ability.cooldownRounds) {
        enemy.cooldowns = enemy.cooldowns ?? {};
        enemy.cooldowns[ability.id] = ability.cooldownRounds;
      }
      context.events.push({
        type: 'combatSkillUsed',
        skillId: ability.id,
        targetName: character.name,
        ...(dealt > 0 ? { damage: dealt } : {}),
      });
      continue;
    }

    let hit = true;
    let hitRoll;
    if (rules.attackRules?.mode === 'rollToHit') {
      const dice = rules.attackRules.hitDice ?? '1d20';
      hitRoll = rollDice(dice, context.rng, definition.attack?.hitBonus ?? 0);
      hit = hitRoll.total >= playerDefense(context);
      context.events.push({ type: 'diceRolled', purpose: 'enemyAttack', roll: hitRoll });
    }

    let damage = 0;
    if (hit) {
      let raw = definition.attack?.flatDamage ?? 0;
      if (definition.attack?.dice) {
        const roll = rollDice(definition.attack.dice, context.rng);
        context.events.push({ type: 'diceRolled', purpose: 'enemyDamage', roll });
        raw += roll.total;
      }
      damage = raw > 0 ? damageToPlayer(context, raw) : 0;
    }

    context.events.push({
      type: 'combatAttack',
      source: 'enemy',
      actorName: enemy.name,
      targetName: character.name,
      hit,
      damage,
      ...(hitRoll ? { roll: hitRoll } : {}),
    });
  }

  // Reduz cooldowns ao fim da rodada.
  for (const enemy of combat.enemies) {
    for (const [abilityId, value] of Object.entries(enemy.cooldowns ?? {})) {
      if (value > 0) {
        (enemy.cooldowns as Record<string, number>)[abilityId] = value - 1;
      }
    }
  }
  for (const [skillId, value] of Object.entries(combat.skillCooldowns ?? {})) {
    if (value > 0) {
      (combat.skillCooldowns as Record<string, number>)[skillId] = value - 1;
    }
  }

  context.events.push({ type: 'combatRoundEnded', round: combat.round });

  const vitalAfter = context.state.character.resources[context.compiled.vitalResourceId];
  if (vitalAfter && vitalAfter.current <= 0) {
    finishCombat(context, 'defeat');
    return;
  }

  combat.round += 1;
  combat.turn = 'player';

  if (rules.maxRounds !== undefined && combat.round > rules.maxRounds) {
    finishCombat(context, 'fled');
  }
}

/** Marca o combate como resolvido; as recompensas sao aplicadas no fechamento. */
export function finishCombat(context: EffectContext, resolution: 'victory' | 'defeat' | 'fled'): void {
  const combat = requireCombat(context);
  combat.resolution = resolution;
  context.events.push({ type: 'combatEnded', nodeId: combat.nodeId, resolution });
}

/**
 * Fecha um combate resolvido: concede experiencia, ouro e tesouro em caso de
 * vitoria e devolve para onde o jogador deve seguir.
 */
export function collectCombatOutcome(context: EffectContext): Navigation | null {
  const combat = context.state.combat;
  if (!combat?.resolution) {
    return null;
  }

  if (combat.resolution === 'victory') {
    for (const enemy of combat.enemies) {
      const definition = context.compiled.enemy(enemy.enemyId);
      context.state.defeatedEnemies[enemy.enemyId] =
        (context.state.defeatedEnemies[enemy.enemyId] ?? 0) + 1;

      if (definition.experience) {
        grantExperience(context, definition.experience);
      }
      if (definition.gold) {
        const amount = context.rng.int(definition.gold.min, definition.gold.max);
        if (amount > 0) {
          applyEffect({ type: 'grantGold', amount }, context);
        }
      }
      for (const loot of definition.loot ?? []) {
        const chance = loot.chance ?? 1;
        if (chance >= 1 || context.rng.chance(chance)) {
          applyEffect({ type: 'addItem', itemId: loot.itemId, quantity: loot.quantity ?? 1 }, context);
        }
      }
    }
  }

  const target =
    combat.resolution === 'victory'
      ? combat.onVictoryNodeId
      : combat.resolution === 'defeat'
        ? combat.onDefeatNodeId
        : combat.onFleeNodeId;

  context.state.combat = null;
  return target ? { kind: 'node', nodeId: target } : null;
}
