import { EngineError } from '../errors';
import type { DiceRoll, DiceSpec, Rng } from '../types/dice';

const DICE_PATTERN = /^\s*(\d{1,3})\s*[dD]\s*(\d{1,4})\s*(?:([+-])\s*(\d{1,4})\s*)?$/;

const MAX_DICE_COUNT = 100;
const MAX_DICE_SIDES = 1000;

/** Interpreta uma expressao como `2d6+3`. Nunca executa codigo. */
export function parseDice(expression: string): DiceSpec {
  const match = DICE_PATTERN.exec(expression);
  if (!match) {
    throw new EngineError(
      'DICE_EXPRESSION_INVALID',
      `Expressao de dados invalida: "${expression}". Use o formato NdM(+K), ex.: 1d20, 2d6+3.`,
      { expression },
    );
  }
  const count = Number.parseInt(match[1] as string, 10);
  const sides = Number.parseInt(match[2] as string, 10);
  const sign = match[3] === '-' ? -1 : 1;
  const modifier = match[4] ? sign * Number.parseInt(match[4], 10) : 0;

  if (count < 1 || count > MAX_DICE_COUNT) {
    throw new EngineError(
      'DICE_EXPRESSION_INVALID',
      `Quantidade de dados fora do limite (1..${MAX_DICE_COUNT}): "${expression}".`,
      { expression },
    );
  }
  if (sides < 2 || sides > MAX_DICE_SIDES) {
    throw new EngineError(
      'DICE_EXPRESSION_INVALID',
      `Numero de faces fora do limite (2..${MAX_DICE_SIDES}): "${expression}".`,
      { expression },
    );
  }

  return { count, sides, modifier, expression: normalizeDice({ count, sides, modifier }) };
}

export function normalizeDice(spec: Pick<DiceSpec, 'count' | 'sides' | 'modifier'>): string {
  if (spec.modifier === 0) {
    return `${spec.count}d${spec.sides}`;
  }
  const sign = spec.modifier > 0 ? '+' : '-';
  return `${spec.count}d${spec.sides}${sign}${Math.abs(spec.modifier)}`;
}

export function isValidDice(expression: string): boolean {
  try {
    parseDice(expression);
    return true;
  } catch {
    return false;
  }
}

/** Rola uma expressao de dados usando o gerador fornecido. */
export function rollDice(expression: string, rng: Rng, bonus = 0): DiceRoll {
  const spec = parseDice(expression);
  const dice: number[] = [];
  let natural = 0;
  for (let i = 0; i < spec.count; i += 1) {
    const face = rng.int(1, spec.sides);
    dice.push(face);
    natural += face;
  }
  const roll: DiceRoll = {
    expression: spec.expression,
    dice,
    modifier: spec.modifier,
    natural,
    total: natural + spec.modifier + bonus,
  };
  if (bonus !== 0) {
    roll.bonus = bonus;
  }
  return roll;
}

/** Valor maximo possivel, usado pelo Studio para balancear dificuldades. */
export function maxRoll(expression: string): number {
  const spec = parseDice(expression);
  return spec.count * spec.sides + spec.modifier;
}

/** Valor minimo possivel. */
export function minRoll(expression: string): number {
  const spec = parseDice(expression);
  return spec.count + spec.modifier;
}

/** Media esperada, usada pelo Studio para balancear encontros. */
export function averageRoll(expression: string): number {
  const spec = parseDice(expression);
  return spec.count * ((spec.sides + 1) / 2) + spec.modifier;
}
