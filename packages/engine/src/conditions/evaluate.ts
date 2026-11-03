import type { CompiledAdventure } from '../compile/compiled-adventure';
import { effectiveAttributes, itemQuantity } from '../character/derive';
import type {
  ComparisonOperator,
  Condition,
  ConditionResult,
  QuestStatusValue,
} from '../types/conditions';
import type { Id, JsonPrimitive } from '../types/json';
import type { GameState } from '../types/state';

function compare(left: number, operator: ComparisonOperator, right: number): boolean {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    default:
      return false;
  }
}

function toNumber(value: JsonPrimitive | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export interface EvaluationContext {
  compiled: CompiledAdventure;
  state: GameState;
}

/**
 * Avalia uma condicao declarativa.
 *
 * Toda a arvore e percorrida por correspondencia de tipos: nada vindo do
 * conteudo da aventura e interpretado como codigo (sem `eval`, sem `Function`).
 */
export function evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
  return explainCondition(condition, context).satisfied;
}

/** Como `evaluateCondition`, mas coleta os motivos das falhas para a interface. */
export function explainCondition(
  condition: Condition | undefined,
  context: EvaluationContext,
): ConditionResult {
  if (!condition) {
    return { satisfied: true, failed: [] };
  }
  const failed: Array<{ condition: Condition; reason: string }> = [];
  const satisfied = evaluate(condition, context, failed);
  return { satisfied, failed };
}

function fail(
  condition: Condition,
  reason: string,
  failed: Array<{ condition: Condition; reason: string }>,
): false {
  failed.push({ condition, reason });
  return false;
}

function evaluate(
  condition: Condition,
  context: EvaluationContext,
  failed: Array<{ condition: Condition; reason: string }>,
): boolean {
  const { compiled, state } = context;
  const character = state.character;

  switch (condition.type) {
    case 'always':
      return true;

    case 'never':
      return fail(condition, 'Esta opcao nunca esta disponivel.', failed);

    case 'all': {
      let result = true;
      for (const child of condition.conditions) {
        if (!evaluate(child, context, failed)) {
          result = false;
        }
      }
      return result;
    }

    case 'any': {
      if (condition.conditions.length === 0) {
        return true;
      }
      const branchFailures: Array<{ condition: Condition; reason: string }> = [];
      for (const child of condition.conditions) {
        if (evaluate(child, context, branchFailures)) {
          return true;
        }
      }
      failed.push(...branchFailures);
      return false;
    }

    case 'not': {
      const inner: Array<{ condition: Condition; reason: string }> = [];
      if (evaluate(condition.condition, context, inner)) {
        return fail(condition, 'Uma condicao que deveria ser falsa foi satisfeita.', failed);
      }
      return true;
    }

    case 'hasItem': {
      const needed = condition.quantity ?? 1;
      const owned = itemQuantity(character, condition.itemId);
      if (owned >= needed) {
        return true;
      }
      const name = compiled.label('item', condition.itemId);
      return fail(
        condition,
        needed > 1
          ? `Requer ${needed}x ${name} (voce tem ${owned}).`
          : `Requer ${name}.`,
        failed,
      );
    }

    case 'hasEquippedItem': {
      const equippedIds = Object.entries(character.equipment);
      const matches = equippedIds.some(([slot, itemId]) => {
        if (!itemId) {
          return false;
        }
        if (condition.slot && slot !== condition.slot) {
          return false;
        }
        if (condition.itemId && itemId !== condition.itemId) {
          return false;
        }
        return true;
      });
      if (matches) {
        return true;
      }
      const name = condition.itemId ? compiled.label('item', condition.itemId) : condition.slot;
      return fail(condition, `Requer ${name} equipado.`, failed);
    }

    case 'hasSkill': {
      if (character.skillIds.includes(condition.skillId)) {
        return true;
      }
      return fail(
        condition,
        `Requer a habilidade ${compiled.label('skill', condition.skillId)}.`,
        failed,
      );
    }

    case 'attributeAtLeast': {
      const value = effectiveAttributes(compiled, character)[condition.attributeId] ?? 0;
      if (value >= condition.value) {
        return true;
      }
      return fail(
        condition,
        `Requer ${compiled.label('attribute', condition.attributeId)} ${condition.value} (voce tem ${value}).`,
        failed,
      );
    }

    case 'attributeCompare': {
      const value = effectiveAttributes(compiled, character)[condition.attributeId] ?? 0;
      if (compare(value, condition.operator, condition.value)) {
        return true;
      }
      return fail(
        condition,
        `${compiled.label('attribute', condition.attributeId)} incompativel com o exigido.`,
        failed,
      );
    }

    case 'hasClass': {
      if (character.classId && condition.classIds.includes(character.classId)) {
        return true;
      }
      const names = condition.classIds.map((id) => compiled.classes.get(id)?.name ?? id);
      return fail(condition, `Exclusivo para: ${names.join(', ')}.`, failed);
    }

    case 'hasRace': {
      if (character.raceId && condition.raceIds.includes(character.raceId)) {
        return true;
      }
      const names = condition.raceIds.map((id) => compiled.races.get(id)?.name ?? id);
      return fail(condition, `Exclusivo para: ${names.join(', ')}.`, failed);
    }

    case 'goldAtLeast': {
      if (character.gold >= condition.value) {
        return true;
      }
      const currency = compiled.doc.ruleset.economy?.currencyName ?? 'ouro';
      return fail(
        condition,
        `Requer ${condition.value} de ${currency} (voce tem ${character.gold}).`,
        failed,
      );
    }

    case 'resourceAtLeast': {
      const pool = character.resources[condition.resourceId];
      if (!pool) {
        return fail(
          condition,
          `Recurso ${compiled.label('resource', condition.resourceId)} indisponivel.`,
          failed,
        );
      }
      const value = condition.asRatio ? (pool.max > 0 ? pool.current / pool.max : 0) : pool.current;
      if (value >= condition.value) {
        return true;
      }
      const name = compiled.label('resource', condition.resourceId);
      return fail(
        condition,
        condition.asRatio
          ? `Requer ${Math.round(condition.value * 100)}% de ${name}.`
          : `Requer ${condition.value} de ${name} (voce tem ${pool.current}).`,
        failed,
      );
    }

    case 'flagEquals': {
      const value = state.flags[condition.flag];
      if (value === condition.value) {
        return true;
      }
      return fail(condition, flagReason(compiled, condition.flag), failed);
    }

    case 'flagCompare': {
      const value = toNumber(state.flags[condition.flag]);
      if (compare(value, condition.operator, condition.value)) {
        return true;
      }
      return fail(condition, flagReason(compiled, condition.flag), failed);
    }

    case 'questStatus': {
      const quest = state.quests[condition.questId];
      const expected: QuestStatusValue[] = Array.isArray(condition.status)
        ? condition.status
        : [condition.status];
      const current = quest?.status ?? compiled.quests.get(condition.questId)?.initialStatus ?? 'locked';
      if (expected.includes(current)) {
        return true;
      }
      return fail(
        condition,
        `Depende da missao ${compiled.label('quest', condition.questId)}.`,
        failed,
      );
    }

    case 'questStageAtLeast': {
      const stage = state.quests[condition.questId]?.stage ?? 0;
      if (stage >= condition.stage) {
        return true;
      }
      return fail(
        condition,
        `Depende do avanco da missao ${compiled.label('quest', condition.questId)}.`,
        failed,
      );
    }

    case 'enemyDefeated': {
      const defeated = state.defeatedEnemies[condition.enemyId] ?? 0;
      if (defeated >= (condition.count ?? 1)) {
        return true;
      }
      return fail(
        condition,
        `Requer derrotar ${compiled.label('enemy', condition.enemyId)}.`,
        failed,
      );
    }

    case 'nodeVisited': {
      const visits = state.visitedNodes[condition.nodeId] ?? 0;
      if (visits >= (condition.times ?? 1)) {
        return true;
      }
      return fail(condition, 'Depende de um lugar que voce ainda nao visitou.', failed);
    }

    case 'choiceTaken': {
      if (state.takenChoices.includes(`${condition.nodeId}:${condition.choiceId}`)) {
        return true;
      }
      return fail(condition, 'Depende de uma decisao que voce nao tomou.', failed);
    }

    case 'npcRelationAtLeast': {
      const relation =
        state.npcRelations[condition.npcId] ??
        compiled.npcs.get(condition.npcId)?.initialRelation ??
        0;
      if (relation >= condition.value) {
        return true;
      }
      return fail(
        condition,
        `Requer mais confianca de ${compiled.label('npc', condition.npcId)}.`,
        failed,
      );
    }

    case 'levelAtLeast': {
      if (character.level >= condition.value) {
        return true;
      }
      return fail(condition, `Requer nivel ${condition.value}.`, failed);
    }

    case 'endingReached': {
      if (state.reachedEndings.includes(condition.endingId)) {
        return true;
      }
      return fail(condition, 'Depende de um final que voce ainda nao alcancou.', failed);
    }

    default: {
      // Tipo desconhecido (documento de uma versao futura): bloqueia por seguranca.
      const unknown = condition as { type?: string };
      return fail(
        condition,
        `Condicao de tipo desconhecido: "${String(unknown.type)}".`,
        failed,
      );
    }
  }
}

function flagReason(compiled: CompiledAdventure, flag: Id): string {
  const variable = compiled.variables.get(flag);
  return variable?.label
    ? `Depende de: ${variable.label}.`
    : 'Depende de algo que ainda nao aconteceu.';
}

/** Primeira mensagem de falha, usada como `blockedReason` na interface. */
export function firstFailureReason(result: ConditionResult): string | undefined {
  return result.failed[0]?.reason;
}
