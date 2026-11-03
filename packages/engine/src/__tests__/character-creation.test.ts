import { beforeEach, describe, expect, it } from 'vitest';

import { createCharacter, getCharacterCreationOptions } from '../character/create';
import { effectiveAttributes, resourceMaximum } from '../character/derive';
import { CompiledAdventure, compileAdventure } from '../compile/compiled-adventure';
import { EngineError } from '../errors';
import { SeededRng } from '../random/rng';
import type { AdventureDocument } from '../types/adventure';
import { BRIDGE_ADVENTURE_FILE, loadExampleAdventure } from './helpers/load-example';

const BALANCED = { forca: 11, destreza: 11, inteligencia: 11, constituicao: 11 };

describe('criacao de personagem', () => {
  let doc: AdventureDocument;
  let compiled: CompiledAdventure;
  let rng: SeededRng;

  beforeEach(() => {
    doc = loadExampleAdventure(BRIDGE_ADVENTURE_FILE);
    compiled = compileAdventure(doc);
    rng = new SeededRng('criacao');
  });

  it('expoe apenas as classes e racas permitidas pela aventura', () => {
    const options = getCharacterCreationOptions(compiled);
    expect(options.classes.map((entry) => entry.id)).toEqual(['guerreiro', 'mago', 'explorador']);
    expect(options.races.map((entry) => entry.id)).toEqual(['humano', 'elfo']);
    expect(options.attributes).toMatchObject({ method: 'pointBuy', points: 12 });
  });

  it('monta a ficha com itens, pericias e recursos iniciais da classe', () => {
    const character = createCharacter(
      compiled,
      { name: 'Ysolde', classId: 'mago', raceId: 'elfo', attributes: BALANCED, appearance: { 'cor-da-pele': 'clara' } },
      rng,
    );

    expect(character.skillIds).toContain('levitacao');
    expect(character.inventory.find((entry) => entry.itemId === 'pocao-de-cura')?.quantity).toBe(2);
    expect(character.equipment.maoPrincipal).toBe('cajado-de-carvalho');
    expect(character.gold).toBe(40);
    expect(character.level).toBe(1);

    // Mana = base 0 + INT efetiva * 2 + modificador de classe (+8) + cajado (+4).
    const attributes = effectiveAttributes(compiled, character);
    expect(attributes.inteligencia).toBe(11 + 2 + 1);
    expect(character.resources.mana?.max).toBe(resourceMaximum(compiled, character, 'mana'));
    expect(character.resources.mana?.max).toBe(14 * 2 + 8 + 4);
    expect(character.resources.mana?.current).toBe(character.resources.mana?.max);
  });

  it('aplica modificadores de raca e classe sobre os atributos base', () => {
    const warrior = createCharacter(
      compiled,
      { name: 'Karvan', classId: 'guerreiro', raceId: 'humano', attributes: BALANCED, appearance: { 'cor-da-pele': 'morena' } },
      rng,
    );
    const attributes = effectiveAttributes(compiled, warrior);
    expect(attributes.forca).toBe(11 + 2);
    expect(attributes.constituicao).toBe(11 + 1);
  });

  it('recusa distribuicao de pontos fora do permitido', () => {
    expect(() =>
      createCharacter(
        compiled,
        { name: 'Erro', classId: 'mago', raceId: 'humano', attributes: { forca: 8, destreza: 8, inteligencia: 8, constituicao: 8 }, appearance: { 'cor-da-pele': 'clara' } },
        rng,
      ),
    ).toThrowError(/Distribua exatamente 12/);

    expect(() =>
      createCharacter(
        compiled,
        { name: 'Erro', classId: 'mago', raceId: 'humano', attributes: { forca: 20, destreza: 8, inteligencia: 8, constituicao: 8 }, appearance: { 'cor-da-pele': 'clara' } },
        rng,
      ),
    ).toThrowError(/deve ficar entre/);
  });

  it('recusa nome fora dos limites e campos de aparencia obrigatorios ausentes', () => {
    expect(() =>
      createCharacter(compiled, { name: 'A', classId: 'mago', raceId: 'humano', attributes: BALANCED }, rng),
    ).toThrowError(/nome deve ter entre/);

    expect(() =>
      createCharacter(compiled, { name: 'Nimue', classId: 'mago', raceId: 'humano', attributes: BALANCED }, rng),
    ).toThrowError(/Cor da pele/);
  });

  it('respeita as restricoes de aparencia por raca', () => {
    expect(() =>
      createCharacter(
        compiled,
        {
          name: 'Nimue',
          classId: 'mago',
          raceId: 'elfo',
          attributes: BALANCED,
          appearance: { 'cor-da-pele': 'clara', porte: 'robusto' },
        },
        rng,
      ),
    ).toThrowError(/Opcao invalida/);

    expect(() =>
      createCharacter(
        compiled,
        {
          name: 'Nimue',
          classId: 'mago',
          raceId: 'humano',
          attributes: BALANCED,
          appearance: { 'cor-da-pele': 'clara', porte: 'robusto' },
        },
        rng,
      ),
    ).not.toThrow();
  });

  it('recusa classe ou raca fora da lista permitida', () => {
    const restricted = structuredClone(doc);
    restricted.characterCreation.allowedClassIds = ['mago'];
    restricted.characterCreation.allowedRaceIds = ['humano'];
    const only = compileAdventure(restricted);

    expect(() =>
      createCharacter(
        only,
        { name: 'Karvan', classId: 'guerreiro', raceId: 'humano', attributes: BALANCED, appearance: { 'cor-da-pele': 'clara' } },
        rng,
      ),
    ).toThrowError(EngineError);

    // Com uma unica combinacao possivel, nao e preciso escolher nada.
    const forced = createCharacter(only, { name: 'Nimue', attributes: BALANCED, appearance: { 'cor-da-pele': 'clara' } }, rng);
    expect(forced.classId).toBe('mago');
    expect(forced.raceId).toBe('humano');
  });

  it('respeita rolagem de atributos quando a aventura usa o metodo "roll"', () => {
    const rolled = structuredClone(doc);
    rolled.characterCreation.attributes = { method: 'roll', rollDice: '2d6+4' };
    const compiledRolled = compileAdventure(rolled);

    const character = createCharacter(
      compiledRolled,
      { name: 'Dorec', classId: 'explorador', raceId: 'humano', appearance: { 'cor-da-pele': 'escura' } },
      new SeededRng('rolagem'),
    );

    for (const attribute of compiledRolled.doc.attributes) {
      const value = character.attributes[attribute.id] as number;
      expect(value).toBeGreaterThanOrEqual(6);
      expect(value).toBeLessThanOrEqual(16);
    }
  });
});
