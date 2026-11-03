import { describe, expect, it } from 'vitest';

import { EngineError } from '../errors';
import { averageRoll, isValidDice, maxRoll, minRoll, parseDice, rollDice } from '../random/dice';
import { SeededRng } from '../random/rng';

describe('expressoes de dados', () => {
  it('interpreta as formas suportadas', () => {
    expect(parseDice('1d6')).toMatchObject({ count: 1, sides: 6, modifier: 0 });
    expect(parseDice('2d6+3')).toMatchObject({ count: 2, sides: 6, modifier: 3 });
    expect(parseDice('1d20-1')).toMatchObject({ count: 1, sides: 20, modifier: -1 });
    expect(parseDice(' 1 D 10 ').expression).toBe('1d10');
  });

  it('recusa expressoes invalidas em vez de executar codigo', () => {
    for (const expression of ['', 'd6', '1d', 'abc', '1d6; rm -rf /', '1+1', '1e3d6', '0d6', '1d1']) {
      expect(() => parseDice(expression)).toThrow(EngineError);
      expect(isValidDice(expression)).toBe(false);
    }
  });

  it('calcula limites e media para balanceamento no Studio', () => {
    expect(minRoll('2d6+1')).toBe(3);
    expect(maxRoll('2d6+1')).toBe(13);
    expect(averageRoll('2d6+1')).toBe(8);
  });

  it('rola dentro dos limites e soma bonus externos', () => {
    const rng = new SeededRng('dados');
    for (let i = 0; i < 200; i += 1) {
      const roll = rollDice('2d6+1', rng, 2);
      expect(roll.dice).toHaveLength(2);
      expect(roll.natural).toBeGreaterThanOrEqual(2);
      expect(roll.natural).toBeLessThanOrEqual(12);
      expect(roll.total).toBe(roll.natural + 1 + 2);
    }
  });
});

describe('gerador aleatorio seeded', () => {
  it('produz a mesma sequencia para a mesma semente', () => {
    const left = new SeededRng('lonetale');
    const right = new SeededRng('lonetale');
    const a = Array.from({ length: 50 }, () => left.int(1, 20));
    const b = Array.from({ length: 50 }, () => right.int(1, 20));
    expect(a).toEqual(b);
  });

  it('produz sequencias diferentes para sementes diferentes', () => {
    const a = Array.from({ length: 20 }, (_, index) => new SeededRng(`seed-${index}`).int(1, 1000));
    expect(new Set(a).size).toBeGreaterThan(10);
  });

  it('retoma exatamente de onde parou a partir de { seed, cursor }', () => {
    const original = new SeededRng('retomada');
    const consumed = Array.from({ length: 7 }, () => original.int(1, 100));
    const expected = Array.from({ length: 5 }, () => original.int(1, 100));

    const restored = SeededRng.fromState({ seed: 'retomada', cursor: consumed.length });
    expect(restored.cursor).toBe(7);
    expect(Array.from({ length: 5 }, () => restored.int(1, 100))).toEqual(expected);
  });

  it('respeita os limites inclusivos de int', () => {
    const rng = new SeededRng('limites');
    const values = Array.from({ length: 500 }, () => rng.int(3, 5));
    expect(Math.min(...values)).toBe(3);
    expect(Math.max(...values)).toBe(5);
  });

  it('escolhe por peso de forma proporcional', () => {
    const rng = new SeededRng('pesos');
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i += 1) {
      const index = rng.weightedIndex([1, 3, 6]);
      counts[index] = (counts[index] ?? 0) + 1;
    }
    expect(counts[0]).toBeLessThan(counts[1] as number);
    expect(counts[1]).toBeLessThan(counts[2] as number);
    expect((counts[2] as number) / 3000).toBeGreaterThan(0.5);
  });
});
