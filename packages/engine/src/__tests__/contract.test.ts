import { describe, expect, it } from 'vitest';

import { CONDITION_TYPES, EFFECT_TYPES, NODE_TYPES } from '../registry';
import { ADVENTURE_JSON_SCHEMA } from '../schema';
import { validateAdventure } from '../validation/validate-adventure';
import { BRIDGE_ADVENTURE_FILE, loadExampleAdventure } from './helpers/load-example';

/** Extrai os valores de `type.const` de uma lista `oneOf` do schema. */
function constTypesFromOneOf(definition: unknown): string[] {
  const variants = (definition as { oneOf?: Array<{ properties?: { type?: { const?: string } } }> })
    .oneOf;
  if (!variants) {
    throw new Error('Definicao sem "oneOf".');
  }
  return variants
    .map((variant) => variant.properties?.type?.const)
    .filter((value): value is string => typeof value === 'string')
    .sort();
}

function defs(): Record<string, unknown> {
  return (ADVENTURE_JSON_SCHEMA as { $defs: Record<string, unknown> }).$defs;
}

describe('contrato: schema x tipos TypeScript', () => {
  it('cobre no schema exatamente as condicoes declaradas no motor', () => {
    expect(constTypesFromOneOf(defs().condition)).toEqual([...CONDITION_TYPES].sort());
  });

  it('cobre no schema exatamente os efeitos declarados no motor', () => {
    expect(constTypesFromOneOf(defs().effect)).toEqual([...EFFECT_TYPES].sort());
  });

  it('cobre no schema exatamente os tipos de no declarados no motor', () => {
    const nodeDefinition = defs().node as {
      allOf: Array<{ properties?: { type?: { enum?: string[] } }; oneOf?: unknown[] }>;
    };
    const enumerated = [...(nodeDefinition.allOf[0]?.properties?.type?.enum ?? [])].sort();
    expect(enumerated).toEqual([...NODE_TYPES].sort());

    const variants = constTypesFromOneOf(nodeDefinition.allOf[1]);
    expect(variants).toEqual([...NODE_TYPES].sort());
  });
});

describe('validacao da aventura de exemplo', () => {
  const adventure = loadExampleAdventure(BRIDGE_ADVENTURE_FILE);

  it('passa sem nenhum erro', () => {
    const result = validateAdventure(adventure);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('nao produz nenhum aviso: serve de referencia de autoria limpa', () => {
    const result = validateAdventure(adventure);
    expect(result.warnings).toEqual([]);
  });
});

describe('validacao: documentos invalidos', () => {
  const base = loadExampleAdventure(BRIDGE_ADVENTURE_FILE);

  it('rejeita estrutura fora do contrato', () => {
    const result = validateAdventure({ schemaVersion: '1.0.0' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejeita propriedade desconhecida em um no', () => {
    const broken = structuredClone(base);
    (broken.nodes[0] as unknown as Record<string, unknown>).textoNarrativo = 'typo';
    const result = validateAdventure(broken);
    expect(result.valid).toBe(false);
  });

  it('aponta referencia a item inexistente', () => {
    const broken = structuredClone(base);
    const bridge = broken.nodes.find((node) => node.id === 'ponte-de-pedra');
    const choice = bridge?.choices?.find((candidate) => candidate.id === 'usar-corda');
    if (!choice) {
      throw new Error('Escolha de referencia nao encontrada no exemplo.');
    }
    choice.conditions = { type: 'hasItem', itemId: 'corda-magica-inexistente' };

    const result = validateAdventure(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'ref.missing')).toBe(true);
  });

  it('exige id em efeitos com mode "once"', () => {
    const broken = structuredClone(base);
    const discovery = broken.nodes.find((node) => node.id === 'descoberta-corda');
    if (!discovery || discovery.type !== 'discovery' || !discovery.rewards?.[0]) {
      throw new Error('No de descoberta nao encontrado no exemplo.');
    }
    delete discovery.rewards[0].id;

    const result = validateAdventure(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'effect.onceRequiresId')).toBe(true);
  });

  it('exige fallbackNodeId quando o no tem condicoes de entrada', () => {
    const broken = structuredClone(base);
    const node = broken.nodes.find((candidate) => candidate.id === 'travessia-com-corda');
    if (!node) {
      throw new Error('No de travessia nao encontrado no exemplo.');
    }
    delete node.fallbackNodeId;

    const result = validateAdventure(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'node.fallbackRequired')).toBe(true);
  });

  it('avisa sobre nos inalcancaveis', () => {
    const broken = structuredClone(base);
    broken.nodes.push({
      id: 'sala-esquecida',
      type: 'story',
      title: 'Sala esquecida',
      text: 'Ninguem chega aqui.',
      choices: [{ id: 'sair', label: 'Sair', target: { kind: 'node', nodeId: 'floresta-antiga' } }],
    });

    const result = validateAdventure(broken);
    expect(result.valid).toBe(true);
    expect(
      result.warnings.some(
        (warning) => warning.code === 'node.unreachable' && warning.message.includes('sala-esquecida'),
      ),
    ).toBe(true);
  });
});
