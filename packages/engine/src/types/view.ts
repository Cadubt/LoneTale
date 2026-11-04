import type {
  AdventureMetadata,
  AssetDefinition,
  NodeAudio,
  NodeChapter,
  NodeType,
} from './adventure';
import type { Id, JsonPrimitive } from './json';
import type { GameStatus, ResourcePool } from './state';

/**
 * Projecao do estado para o cliente.
 * O frontend renderiza exclusivamente a partir desta estrutura:
 * nenhuma regra da aventura e reavaliada no navegador.
 */
export interface ChoiceView {
  id: Id;
  label: string;
  description?: string;
  available: boolean;
  /** Motivo do bloqueio, quando `available` e falso. */
  blockedReason?: string;
  /** `true` quando a escolha declara condicoes (liberada ou nao). */
  conditional: boolean;
  /**
   * Resumo do que o personagem cumpre para ter esta opcao, quando ela esta
   * liberada por condicoes -- ex.: "Corda (1)". Permite destacar na interface
   * a escolha que foi conquistada, e nao a que sempre esteve ali.
   */
  satisfiedLabel?: string;
  icon?: string;
  order?: number;
  /** Custos anunciados ao jogador antes de confirmar. */
  costs?: Array<{ kind: string; label: string }>;
}

export interface DialogueLineView {
  speakerName?: string;
  portrait?: AssetView | null;
  text: string;
}

export interface AssetView {
  id: Id;
  kind: string;
  src: string;
  alt?: string;
}

export interface EnemyView {
  instanceId: string;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  image?: AssetView | null;
}

export interface CombatView {
  round: number;
  turn: 'player' | 'enemies';
  fleeAllowed: boolean;
  enemies: EnemyView[];
  /** Pericias ativas utilizaveis nesta rodada. */
  usableSkills: Array<{
    skillId: Id;
    name: string;
    available: boolean;
    blockedReason?: string;
    cost?: { resourceId: Id; amount: number };
  }>;
  usableItems: Array<{ itemId: Id; name: string; quantity: number }>;
}

export interface MerchantItemView {
  itemId: Id;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  affordable: boolean;
  image?: AssetView | null;
}

export interface MerchantView {
  npcName?: string;
  buysFromPlayer: boolean;
  buybackRate: number;
  stock: MerchantItemView[];
  sellable: Array<{ itemId: Id; name: string; quantity: number; price: number }>;
}

export interface SkillCheckView {
  attributeName?: string;
  skillName?: string;
  dice: string;
  difficulty: number;
  bonus: number;
  attempts: number;
  retryAllowed: boolean;
}

export interface InventoryItemView {
  itemId: Id;
  name: string;
  description?: string;
  kind: string;
  quantity: number;
  equipped: boolean;
  slot?: string;
  usable: boolean;
  value?: number;
  icon?: AssetView | null;
}

export interface CharacterSheetView {
  name: string;
  className?: string;
  raceName?: string;
  level: number;
  experience: number;
  experienceToNextLevel: number | null;
  gold: number;
  /** Atributos com modificadores de classe, raca e equipamento aplicados. */
  attributes: Array<{
    id: Id;
    name: string;
    abbreviation?: string;
    base: number;
    total: number;
    modifier: number;
  }>;
  resources: Array<{
    id: Id;
    name: string;
    abbreviation?: string;
    current: number;
    max: number;
    vital: boolean;
    color?: string;
  }>;
  armor: number;
  skills: Array<{ id: Id; name: string; kind: string; description?: string }>;
  appearance: Record<Id, JsonPrimitive>;
  /**
   * Cores declaradas pelo autor para as opcoes de aparencia escolhidas
   * (`cor-da-pele` -> `#c08a5c`). Permite ao cliente desenhar um retrato
   * coerente com a ficha sem precisar carregar o documento da aventura.
   */
  appearanceColors: Record<Id, string>;
  description?: string;
  pendingAttributePoints: number;
}

export interface QuestView {
  id: Id;
  name: string;
  description?: string;
  status: string;
  stage: number;
  stageTitle?: string;
}

export interface NodeView {
  adventure: Pick<AdventureMetadata, 'id' | 'title' | 'version'>;
  status: GameStatus;
  sequence: number;
  node: {
    id: Id;
    type: NodeType;
    title?: string;
    chapter?: NodeChapter;
    text?: string;
    image?: AssetView | null;
    media?: Array<AssetView & { caption?: string; position?: string }>;
    audio?: NodeAudio;
    checkpoint: boolean;
    tags?: string[];
  };
  choices: ChoiceView[];
  dialogue?: DialogueLineView[];
  combat?: CombatView;
  merchant?: MerchantView;
  skillCheck?: SkillCheckView;
  ending?: { id: Id; title: string; text?: string; kind?: string; image?: AssetView | null };
  character: CharacterSheetView;
  inventory: InventoryItemView[];
  quests: QuestView[];
  /** Variaveis marcadas como visiveis. */
  variables: Array<{ id: Id; label: string; value: JsonPrimitive }>;
  /** Acoes que o motor aceita neste momento. */
  availableActions: PlayerActionType[];
}

export type PlayerActionType =
  | 'choose'
  | 'continue'
  | 'rollSkillCheck'
  | 'combatAttack'
  | 'combatSkill'
  | 'combatItem'
  | 'combatFlee'
  | 'buyItem'
  | 'sellItem'
  | 'useItem'
  | 'equipItem'
  | 'unequipItem'
  | 'allocateAttribute'
  | 'restoreCheckpoint';

export interface ResourceSummary {
  resourceId: Id;
  pool: ResourcePool;
}
