import type { CompiledAdventure } from '../compile/compiled-adventure';
import type { ItemDefinition, Ruleset } from '../types/adventure';
import type { Id } from '../types/json';
import type { CharacterState } from '../types/state';

/** Itens efetivamente equipados, ignorando slots vazios ou invalidos. */
export function equippedItems(
  compiled: CompiledAdventure,
  character: CharacterState,
): ItemDefinition[] {
  const items: ItemDefinition[] = [];
  for (const itemId of Object.values(character.equipment)) {
    if (!itemId) {
      continue;
    }
    const item = compiled.items.get(itemId);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

/**
 * Atributos efetivos: base escolhida na criacao + modificadores de classe,
 * raca e equipamento, limitados ao intervalo declarado para o atributo.
 */
export function effectiveAttributes(
  compiled: CompiledAdventure,
  character: CharacterState,
): Record<Id, number> {
  const result: Record<Id, number> = {};
  const classDef = character.classId ? compiled.classes.get(character.classId) : undefined;
  const raceDef = character.raceId ? compiled.races.get(character.raceId) : undefined;
  const equipment = equippedItems(compiled, character);

  for (const attribute of compiled.doc.attributes) {
    let value = character.attributes[attribute.id] ?? attribute.default;
    value += classDef?.modifiers?.attributes?.[attribute.id] ?? 0;
    value += raceDef?.modifiers?.attributes?.[attribute.id] ?? 0;
    for (const item of equipment) {
      value += item.stats?.attributeModifiers?.[attribute.id] ?? 0;
    }
    result[attribute.id] = Math.max(attribute.min, Math.min(attribute.max, value));
  }
  return result;
}

export function effectiveAttribute(
  compiled: CompiledAdventure,
  character: CharacterState,
  attributeId: Id,
): number {
  return effectiveAttributes(compiled, character)[attributeId] ?? 0;
}

/** Modificador derivado de um atributo, conforme o ruleset: floor((v - offset) / divisor). */
export function attributeModifier(ruleset: Ruleset, value: number): number {
  const config = ruleset.skillCheck.attributeModifier;
  if (!config) {
    return value;
  }
  return Math.floor((value - config.offset) / config.divisor);
}

/**
 * Maximo de um recurso: base + (atributo * multiplicador) + (nivel-1) * perLevel
 * + modificadores de classe, raca e equipamento. Nunca menor que 1.
 */
export function resourceMaximum(
  compiled: CompiledAdventure,
  character: CharacterState,
  resourceId: Id,
): number {
  const resource = compiled.resources.get(resourceId);
  if (!resource) {
    return 0;
  }
  const attributes = effectiveAttributes(compiled, character);
  const classDef = character.classId ? compiled.classes.get(character.classId) : undefined;
  const raceDef = character.raceId ? compiled.races.get(character.raceId) : undefined;

  let max = resource.base;
  if (resource.derivedFrom) {
    max += (attributes[resource.derivedFrom.attributeId] ?? 0) * resource.derivedFrom.multiplier;
  }
  if (resource.perLevel) {
    max += resource.perLevel * Math.max(0, character.level - 1);
  }
  max += classDef?.modifiers?.resources?.[resourceId] ?? 0;
  max += raceDef?.modifiers?.resources?.[resourceId] ?? 0;
  for (const item of equippedItems(compiled, character)) {
    max += item.stats?.resourceMaxModifiers?.[resourceId] ?? 0;
  }
  return Math.max(1, Math.floor(max));
}

/**
 * Recalcula os maximos de todos os recursos e reajusta os valores atuais.
 * Chamado sempre que algo que alimenta os maximos muda (nivel, equipamento,
 * atributos permanentes).
 */
export function recomputeResourceMaxima(
  compiled: CompiledAdventure,
  character: CharacterState,
): void {
  for (const resource of compiled.doc.resources) {
    const max = resourceMaximum(compiled, character, resource.id);
    const pool = character.resources[resource.id];
    if (!pool) {
      character.resources[resource.id] = { current: max, max };
      continue;
    }
    const wasFull = pool.current >= pool.max;
    pool.max = max;
    pool.current = wasFull ? max : Math.max(0, Math.min(max, pool.current));
  }
}

/** Armadura total concedida pelos itens equipados. */
export function totalArmor(compiled: CompiledAdventure, character: CharacterState): number {
  return equippedItems(compiled, character).reduce(
    (total, item) => total + (item.stats?.armor ?? 0),
    0,
  );
}

/** Arma equipada com maior dano declarado, usada nos ataques. */
export function equippedWeapon(
  compiled: CompiledAdventure,
  character: CharacterState,
): ItemDefinition | null {
  const weapons = equippedItems(compiled, character).filter(
    (item) => item.kind === 'weapon' && (item.stats?.damageDice || item.stats?.flatDamage),
  );
  return weapons[0] ?? null;
}

export function experienceToNextLevel(
  compiled: CompiledAdventure,
  character: CharacterState,
): number | null {
  const progression = compiled.doc.ruleset.progression;
  if (!progression.enabled) {
    return null;
  }
  const maxLevel = progression.maxLevel ?? progression.xpThresholds.length + 1;
  if (character.level >= maxLevel) {
    return null;
  }
  const threshold = progression.xpThresholds[character.level - 1];
  return threshold === undefined ? null : Math.max(0, threshold - character.experience);
}

/** Quantidade total de um item no inventario. */
export function itemQuantity(character: CharacterState, itemId: Id): number {
  return character.inventory
    .filter((entry) => entry.itemId === itemId)
    .reduce((total, entry) => total + entry.quantity, 0);
}

export function isEquipped(character: CharacterState, itemId: Id): boolean {
  return Object.values(character.equipment).some((equipped) => equipped === itemId);
}
