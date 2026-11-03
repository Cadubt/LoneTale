import { EngineError } from '../errors';
import type {
  AdventureDocument,
  AdventureNode,
  AttributeDefinition,
  ClassDefinition,
  EndingDefinition,
  EnemyDefinition,
  ItemDefinition,
  NpcDefinition,
  QuestDefinition,
  RaceDefinition,
  ResourceDefinition,
  SkillDefinition,
  VariableDefinition,
  AssetDefinition,
} from '../types/adventure';
import type { Id } from '../types/json';

function indexById<T extends { id: Id }>(list: readonly T[] | undefined): Map<Id, T> {
  const map = new Map<Id, T>();
  for (const entry of list ?? []) {
    map.set(entry.id, entry);
  }
  return map;
}

/**
 * Aventura com indices prontos para consulta em O(1).
 *
 * E criada uma vez por versao publicada e pode ser cacheada em memoria:
 * o documento e tratado como imutavel (uma partida iniciada na versao 1.0
 * continua lendo a 1.0 mesmo depois de a 1.1 ser publicada).
 */
export class CompiledAdventure {
  readonly doc: AdventureDocument;
  readonly nodes: Map<Id, AdventureNode>;
  readonly attributes: Map<Id, AttributeDefinition>;
  readonly resources: Map<Id, ResourceDefinition>;
  readonly classes: Map<Id, ClassDefinition>;
  readonly races: Map<Id, RaceDefinition>;
  readonly skills: Map<Id, SkillDefinition>;
  readonly items: Map<Id, ItemDefinition>;
  readonly enemies: Map<Id, EnemyDefinition>;
  readonly npcs: Map<Id, NpcDefinition>;
  readonly quests: Map<Id, QuestDefinition>;
  readonly variables: Map<Id, VariableDefinition>;
  readonly endings: Map<Id, EndingDefinition>;
  readonly assets: Map<Id, AssetDefinition>;
  readonly equipmentSlots: readonly string[];
  readonly vitalResourceId: Id;

  constructor(doc: AdventureDocument) {
    this.doc = doc;
    this.nodes = indexById(doc.nodes);
    this.attributes = indexById(doc.attributes);
    this.resources = indexById(doc.resources);
    this.classes = indexById(doc.classes);
    this.races = indexById(doc.races);
    this.skills = indexById(doc.skills);
    this.items = indexById(doc.items);
    this.enemies = indexById(doc.enemies);
    this.npcs = indexById(doc.npcs);
    this.quests = indexById(doc.quests);
    this.variables = indexById(doc.variables);
    this.endings = indexById(doc.endings);
    this.assets = indexById(doc.assets);
    this.equipmentSlots = doc.ruleset.inventory?.equipmentSlots ?? [];

    const explicitVital = doc.ruleset.death.vitalResourceId;
    const flaggedVital = doc.resources.find((resource) => resource.vital)?.id;
    const firstResource = doc.resources[0]?.id;
    const vital = explicitVital ?? flaggedVital ?? firstResource;
    if (!vital) {
      throw new EngineError(
        'ADVENTURE_INVALID',
        'A aventura precisa declarar ao menos um recurso (ex.: pontos de vida).',
      );
    }
    this.vitalResourceId = vital;
  }

  get id(): Id {
    return this.doc.metadata.id;
  }

  get version(): string {
    return this.doc.metadata.version;
  }

  node(nodeId: Id): AdventureNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new EngineError('NODE_NOT_FOUND', `No "${nodeId}" nao existe nesta aventura.`, {
        nodeId,
      });
    }
    return node;
  }

  item(itemId: Id): ItemDefinition {
    const item = this.items.get(itemId);
    if (!item) {
      throw new EngineError('ITEM_NOT_FOUND', `Item "${itemId}" nao existe nesta aventura.`, {
        itemId,
      });
    }
    return item;
  }

  enemy(enemyId: Id): EnemyDefinition {
    const enemy = this.enemies.get(enemyId);
    if (!enemy) {
      throw new EngineError('ENEMY_NOT_FOUND', `Criatura "${enemyId}" nao existe.`, { enemyId });
    }
    return enemy;
  }

  ending(endingId: Id): EndingDefinition {
    const ending = this.endings.get(endingId);
    if (!ending) {
      throw new EngineError('ADVENTURE_INVALID', `Final "${endingId}" nao existe.`, { endingId });
    }
    return ending;
  }

  /** Nome legivel de um item/criatura/pericia, para logs e eventos. */
  label(kind: 'item' | 'enemy' | 'skill' | 'npc' | 'quest' | 'attribute' | 'resource', id: Id): string {
    switch (kind) {
      case 'item':
        return this.items.get(id)?.name ?? id;
      case 'enemy':
        return this.enemies.get(id)?.name ?? id;
      case 'skill':
        return this.skills.get(id)?.name ?? id;
      case 'npc':
        return this.npcs.get(id)?.name ?? id;
      case 'quest':
        return this.quests.get(id)?.name ?? id;
      case 'attribute':
        return this.attributes.get(id)?.name ?? id;
      case 'resource':
        return this.resources.get(id)?.name ?? id;
      default:
        return id;
    }
  }
}

export function compileAdventure(doc: AdventureDocument): CompiledAdventure {
  return new CompiledAdventure(doc);
}
