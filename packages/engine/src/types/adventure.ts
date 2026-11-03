import type { Condition, QuestStatusValue, UnavailableBehavior } from './conditions';
import type { EffectEntry } from './effects';
import type { Id, JsonObject, JsonPrimitive } from './json';

/** Versao do contrato implementada por este motor. */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Metadados
// ---------------------------------------------------------------------------

export interface AdventureMetadata {
  id: Id;
  title: string;
  /** Versao de conteudo da aventura (semver). Publicacoes sao imutaveis. */
  version: string;
  summary?: string;
  description?: string;
  author?: string;
  language?: string;
  genre?: string[];
  world?: string;
  tags?: string[];
  coverImage?: Id;
  bannerImage?: Id;
  estimatedMinutes?: number;
  difficulty?: 'easy' | 'normal' | 'hard' | 'brutal';
  contentWarnings?: string[];
  /** Faixa etaria recomendada. */
  ageRating?: string;
}

// ---------------------------------------------------------------------------
// Ruleset configuravel
// ---------------------------------------------------------------------------

export type DiceExpression = string;

export interface SkillCheckRules {
  /**
   * `diceVsDifficulty`: rolagem + modificadores >= dificuldade.
   * `attributeVsDifficulty`: sem dados, compara atributo direto (narrativo puro).
   */
  mode: 'diceVsDifficulty' | 'attributeVsDifficulty';
  defaultDice: DiceExpression;
  /** modificador = floor((atributo - offset) / divisor) */
  attributeModifier?: { divisor: number; offset: number };
  /** Rolagem natural >= este valor e sucesso critico. */
  criticalSuccessOn?: number;
  /** Rolagem natural <= este valor e falha critica. */
  criticalFailureOn?: number;
  /** Bonus somado quando o personagem possui a pericia exigida. */
  skillBonus?: number;
}

export interface CombatRules {
  enabled: boolean;
  initiative: 'playerFirst' | 'enemyFirst' | 'roll';
  initiativeDice?: DiceExpression;
  fleeAllowed: boolean;
  fleeCheck?: { attributeId?: Id; dice?: DiceExpression; difficulty: number };
  /** `subtract`: dano - armadura; `ignore`: armadura nao reduz dano. */
  armorMode: 'subtract' | 'ignore';
  minimumDamage?: number;
  attackRules?: {
    mode: 'rollToHit' | 'alwaysHit';
    hitDice?: DiceExpression;
    attackAttributeId?: Id;
    damageAttributeId?: Id;
    /** Dificuldade base para acertar o personagem (ex.: 10 em sistemas d20). */
    playerDefenseBase?: number;
    /** Atributo que soma a defesa do personagem. */
    defenseAttributeId?: Id;
    /** Dano usado quando o personagem esta desarmado. */
    unarmedDamageDice?: DiceExpression;
  };
  maxRounds?: number;
}

export interface ProgressionRules {
  enabled: boolean;
  /** XP acumulado necessario para alcancar cada nivel, a partir do nivel 2. */
  xpThresholds: number[];
  onLevelUp?: {
    attributePoints?: number;
    resourceGains?: Array<{ resourceId: Id; maxDelta: number; restore?: boolean }>;
    skillChoices?: number;
  };
  maxLevel?: number;
}

export interface DeathRules {
  /** O que acontece quando o recurso vital chega a zero. */
  onVitalDepleted: 'ending' | 'restartCheckpoint' | 'goto';
  endingId?: Id;
  nodeId?: Id;
  /** Recurso considerado vital. Padrao: primeiro recurso com `vital: true`. */
  vitalResourceId?: Id;
}

export interface Ruleset {
  id: Id;
  name: string;
  description?: string;
  /** Expressoes de dados permitidas no conteudo (ex.: 1d6, 1d20, 2d6). */
  allowedDice?: DiceExpression[];
  skillCheck: SkillCheckRules;
  combat: CombatRules;
  progression: ProgressionRules;
  death: DeathRules;
  economy?: {
    currencyName: string;
    currencyAbbreviation?: string;
    merchantBuybackRate?: number;
  };
  inventory?: {
    maxSlots?: number;
    maxWeight?: number;
    equipmentSlots: string[];
  };
}

// ---------------------------------------------------------------------------
// Definicoes de conteudo
// ---------------------------------------------------------------------------

export interface AttributeDefinition {
  id: Id;
  name: string;
  abbreviation?: string;
  description?: string;
  min: number;
  max: number;
  default: number;
  /** Mostrado na ficha do personagem. */
  visible?: boolean;
}

export interface ResourceDefinition {
  id: Id;
  name: string;
  abbreviation?: string;
  description?: string;
  base: number;
  /** max = base + (atributo * multiplier) + (nivel * perLevel) */
  derivedFrom?: { attributeId: Id; multiplier: number };
  perLevel?: number;
  /** Zerar este recurso aplica as regras de morte. */
  vital?: boolean;
  regenPerNode?: number;
  color?: string;
}

export interface ModifierSet {
  attributes?: Record<Id, number>;
  resources?: Record<Id, number>;
}

export interface StartingItem {
  itemId: Id;
  quantity?: number;
  equip?: boolean;
  slot?: string;
}

export interface ClassDefinition {
  id: Id;
  name: string;
  description?: string;
  modifiers?: ModifierSet;
  startingSkillIds?: Id[];
  startingItems?: StartingItem[];
  allowedRaceIds?: Id[];
  portrait?: Id;
  tags?: string[];
}

export interface AppearanceOption {
  id: Id;
  label: string;
  value?: JsonPrimitive;
  /** Cor em hexadecimal, quando o campo e do tipo `color`. */
  color?: string;
}

export interface RaceDefinition {
  id: Id;
  name: string;
  description?: string;
  modifiers?: ModifierSet;
  traitIds?: Id[];
  allowedClassIds?: Id[];
  portrait?: Id;
  /** Restringe os valores possiveis de campos de aparencia para esta especie. */
  appearanceRestrictions?: Record<Id, Id[]>;
}

export interface SkillDefinition {
  id: Id;
  name: string;
  description?: string;
  kind: 'passive' | 'active' | 'proficiency';
  cost?: { resourceId: Id; amount: number };
  /** Requisitos para desbloquear/usar. */
  requirements?: Condition;
  /** Efeitos aplicados ao usar fora de combate. */
  effects?: EffectEntry[];
  combat?: {
    damageDice?: DiceExpression;
    flatDamage?: number;
    scalingAttributeId?: Id;
    healing?: number;
    targets?: 'single' | 'all';
    cooldownRounds?: number;
  };
  icon?: Id;
  tags?: string[];
}

export type ItemKind = 'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable' | 'quest' | 'misc';

export interface ItemDefinition {
  id: Id;
  name: string;
  description?: string;
  kind: ItemKind;
  slot?: string;
  stackable?: boolean;
  maxStack?: number;
  value?: number;
  weight?: number;
  stats?: {
    damageDice?: DiceExpression;
    flatDamage?: number;
    armor?: number;
    attributeModifiers?: Record<Id, number>;
    resourceMaxModifiers?: Record<Id, number>;
  };
  /** Efeitos ao usar (consumiveis). */
  useEffects?: EffectEntry[];
  consumedOnUse?: boolean;
  requirements?: Condition;
  /** Itens de missao nao podem ser vendidos nem descartados. */
  bound?: boolean;
  image?: Id;
  icon?: Id;
  tags?: string[];
}

export interface EnemyAbility {
  id: Id;
  name: string;
  description?: string;
  /** Chance de uso por rodada (0..1). */
  chance?: number;
  damageDice?: DiceExpression;
  flatDamage?: number;
  healing?: number;
  applyEffects?: EffectEntry[];
  cooldownRounds?: number;
}

export interface LootEntry {
  itemId: Id;
  quantity?: number;
  /** Probabilidade de 0 a 1. */
  chance?: number;
}

export interface EnemyDefinition {
  id: Id;
  name: string;
  description?: string;
  attributes?: Record<Id, number>;
  hp: number;
  armor?: number;
  attack?: {
    dice?: DiceExpression;
    flatDamage?: number;
    hitBonus?: number;
  };
  defense?: number;
  initiative?: number;
  abilities?: EnemyAbility[];
  loot?: LootEntry[];
  experience?: number;
  gold?: { min: number; max: number };
  image?: Id;
  tags?: string[];
  /** Criatura unica: nao reaparece apos derrotada. */
  unique?: boolean;
}

export interface NpcDefinition {
  id: Id;
  name: string;
  description?: string;
  role?: string;
  portrait?: Id;
  initialRelation?: number;
  relationLabels?: Array<{ atLeast: number; label: string }>;
  tags?: string[];
}

export interface QuestStage {
  stage: number;
  title?: string;
  description?: string;
}

export interface QuestDefinition {
  id: Id;
  name: string;
  description?: string;
  initialStatus?: QuestStatusValue;
  stages?: QuestStage[];
  rewards?: EffectEntry[];
  hidden?: boolean;
}

export interface VariableDefinition {
  id: Id;
  label?: string;
  type: 'number' | 'boolean' | 'string';
  initial: JsonPrimitive;
  /** Exibida no diario/HUD do jogador. */
  visible?: boolean;
  description?: string;
}

export type AssetKind = 'image' | 'audio' | 'video' | 'model';

export interface AssetDefinition {
  id: Id;
  kind: AssetKind;
  /** URL publica ou caminho relativo resolvido pelo servico de midia. */
  src: string;
  alt?: string;
  credit?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Criacao de personagem
// ---------------------------------------------------------------------------

export interface AppearanceFieldDefinition {
  id: Id;
  label: string;
  kind: 'select' | 'color' | 'text' | 'number';
  options?: AppearanceOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  required?: boolean;
  default?: JsonPrimitive;
  maxLength?: number;
}

export interface AttributeAllocationRules {
  /** `pointBuy`: distribui `points`; `fixed`: usa classe/raca; `roll`: rola dados. */
  method: 'pointBuy' | 'fixed' | 'roll';
  points?: number;
  minPerAttribute?: number;
  maxPerAttribute?: number;
  rollDice?: DiceExpression;
}

export interface CharacterCreationConfig {
  startNodeId: Id;
  name?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    suggestions?: string[];
  };
  allowedClassIds?: Id[];
  allowedRaceIds?: Id[];
  attributes: AttributeAllocationRules;
  startingGold?: number;
  startingItems?: StartingItem[];
  startingSkillIds?: Id[];
  appearanceFields?: AppearanceFieldDefinition[];
  allowDescription?: boolean;
  descriptionMaxLength?: number;
  /** Texto exibido na tela de criacao. */
  intro?: string;
}

// ---------------------------------------------------------------------------
// Nos narrativos
// ---------------------------------------------------------------------------

export type NodeType =
  | 'story'
  | 'dialogue'
  | 'combat'
  | 'merchant'
  | 'discovery'
  | 'event'
  | 'skillCheck'
  | 'checkpoint'
  | 'ending';

export interface NodeMedia {
  assetId: Id;
  caption?: string;
  position?: 'inline' | 'background' | 'gallery';
}

export interface NodeAudio {
  musicAssetId?: Id;
  ambienceAssetId?: Id;
  sfxAssetId?: Id;
  loop?: boolean;
  volume?: number;
  fadeMs?: number;
}

export interface NodeVisual {
  /** Posicao no editor visual (React Flow). */
  position?: { x: number; y: number };
  color?: string;
  theme?: string;
  icon?: string;
  group?: string;
  collapsed?: boolean;
}

export type ChoiceTarget =
  | { kind: 'node'; nodeId: Id }
  | { kind: 'ending'; endingId: Id }
  | { kind: 'back' }
  | { kind: 'stay' }
  | { kind: 'random'; options: Array<{ nodeId: Id; weight: number }> }
  | {
      kind: 'conditional';
      branches: Array<{ when: Condition; nodeId: Id }>;
      otherwiseNodeId?: Id;
    };

export interface Choice {
  id: Id;
  label: string;
  description?: string;
  /** Condicao composta que habilita a escolha. Ausente = sempre disponivel. */
  conditions?: Condition;
  /** Apresentacao quando as condicoes falham. Padrao: `disable`. */
  unavailableBehavior?: UnavailableBehavior;
  /** Texto exibido quando visivel mas bloqueada. */
  unavailableLabel?: string;
  /** Custos debitados atomicamente ao escolher (ouro, mana, itens). */
  cost?: EffectEntry[];
  effects?: EffectEntry[];
  target?: ChoiceTarget;
  /** Selecionavel apenas uma vez por partida. */
  once?: boolean;
  order?: number;
  icon?: string;
  tags?: string[];
}

export interface BaseNode {
  id: Id;
  type: NodeType;
  title?: string;
  text?: string;
  image?: Id;
  media?: NodeMedia[];
  audio?: NodeAudio;
  /** Condicoes de entrada; se falharem, redireciona para `fallbackNodeId`. */
  entryConditions?: Condition;
  fallbackNodeId?: Id;
  onEnter?: EffectEntry[];
  onExit?: EffectEntry[];
  choices?: Choice[];
  /** Marca ponto de retomada automatico. */
  checkpoint?: boolean;
  visual?: NodeVisual;
  tags?: string[];
  metadata?: JsonObject;
}

export interface StoryNode extends BaseNode {
  type: 'story';
}

export interface DialogueLine {
  id?: Id;
  speakerNpcId?: Id;
  speakerName?: string;
  text: string;
  portrait?: Id;
  when?: Condition;
}

export interface DialogueNode extends BaseNode {
  type: 'dialogue';
  npcId?: Id;
  lines: DialogueLine[];
}

export interface CombatNode extends BaseNode {
  type: 'combat';
  encounter: {
    enemies: Array<{ enemyId: Id; count?: number }>;
    fleeAllowed?: boolean;
    onVictoryNodeId: Id;
    onDefeatNodeId?: Id;
    onFleeNodeId?: Id;
    onVictoryEffects?: EffectEntry[];
    onDefeatEffects?: EffectEntry[];
    surpriseRound?: 'player' | 'enemy' | 'none';
    backgroundAssetId?: Id;
  };
}

export interface MerchantStockEntry {
  itemId: Id;
  price?: number;
  /** -1 ou ausente = estoque ilimitado. */
  quantity?: number;
  when?: Condition;
}

export interface MerchantNode extends BaseNode {
  type: 'merchant';
  npcId?: Id;
  stock: MerchantStockEntry[];
  buysFromPlayer?: boolean;
  buybackRate?: number;
  leaveNodeId?: Id;
}

export interface DiscoveryNode extends BaseNode {
  type: 'discovery';
  rewards?: EffectEntry[];
  /** Avanca automaticamente para este no apos a descoberta. */
  continueNodeId?: Id;
}

export interface EventNode extends BaseNode {
  type: 'event';
  /** Resolucao automatica por tabela ponderada. */
  outcomes?: Array<{
    weight: number;
    label?: string;
    text?: string;
    effects?: EffectEntry[];
    nodeId?: Id;
  }>;
  continueNodeId?: Id;
}

export interface SkillCheckNode extends BaseNode {
  type: 'skillCheck';
  check: {
    attributeId?: Id;
    skillId?: Id;
    dice?: DiceExpression;
    difficulty: number;
    bonus?: number;
    /** Itens que concedem bonus ao teste. */
    itemBonuses?: Array<{ itemId: Id; bonus: number }>;
    onSuccessNodeId: Id;
    onFailureNodeId: Id;
    onCriticalSuccessNodeId?: Id;
    onCriticalFailureNodeId?: Id;
    onSuccessEffects?: EffectEntry[];
    onFailureEffects?: EffectEntry[];
    /** Permite repetir o teste apos falhar. */
    retryAllowed?: boolean;
  };
}

export interface CheckpointNode extends BaseNode {
  type: 'checkpoint';
  label?: string;
  continueNodeId: Id;
}

export interface EndingNode extends BaseNode {
  type: 'ending';
  endingId: Id;
}

export type AdventureNode =
  | StoryNode
  | DialogueNode
  | CombatNode
  | MerchantNode
  | DiscoveryNode
  | EventNode
  | SkillCheckNode
  | CheckpointNode
  | EndingNode;

export interface EndingDefinition {
  id: Id;
  title: string;
  text?: string;
  kind?: 'victory' | 'defeat' | 'neutral' | 'secret';
  image?: Id;
  effects?: EffectEntry[];
  /** Conquista desbloqueada ao alcancar este final. */
  achievementId?: Id;
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export interface AdventureDocument {
  schemaVersion: string;
  metadata: AdventureMetadata;
  ruleset: Ruleset;
  characterCreation: CharacterCreationConfig;
  attributes: AttributeDefinition[];
  resources: ResourceDefinition[];
  classes: ClassDefinition[];
  races: RaceDefinition[];
  skills?: SkillDefinition[];
  items?: ItemDefinition[];
  enemies?: EnemyDefinition[];
  npcs?: NpcDefinition[];
  quests?: QuestDefinition[];
  variables?: VariableDefinition[];
  nodes: AdventureNode[];
  endings: EndingDefinition[];
  assets?: AssetDefinition[];
}
