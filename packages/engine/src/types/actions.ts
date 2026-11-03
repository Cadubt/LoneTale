import type { Id, JsonPrimitive } from './json';

/**
 * Acoes que o jogador pode enviar.
 * `expectedSequence` implementa concorrencia otimista + idempotencia:
 * o motor rejeita qualquer acao que nao corresponda a sequencia atual,
 * impedindo que recarregar a pagina ou reenviar a requisicao duplique recompensas.
 */
export interface ActionEnvelope {
  expectedSequence: number;
  /** Chave de idempotencia gerada pelo cliente (UUID). */
  idempotencyKey?: string;
}

export type PlayerAction = ActionEnvelope &
  (
    | { type: 'choose'; nodeId: Id; choiceId: Id }
    | { type: 'continue' }
    | { type: 'rollSkillCheck' }
    | { type: 'combatAttack'; targetInstanceId?: string }
    | { type: 'combatSkill'; skillId: Id; targetInstanceId?: string }
    | { type: 'combatItem'; itemId: Id }
    | { type: 'combatFlee' }
    | { type: 'buyItem'; itemId: Id; quantity?: number }
    | { type: 'sellItem'; itemId: Id; quantity?: number }
    | { type: 'useItem'; itemId: Id }
    | { type: 'equipItem'; itemId: Id; slot?: string }
    | { type: 'unequipItem'; slot: string }
    | { type: 'allocateAttribute'; attributeId: Id; points: number }
    | { type: 'restoreCheckpoint' }
  );

export interface CharacterDraft {
  name: string;
  classId?: Id;
  raceId?: Id;
  /** Valores escolhidos na distribuicao de pontos. */
  attributes?: Record<Id, number>;
  appearance?: Record<Id, JsonPrimitive>;
  description?: string;
}
