/** Codigos estaveis de erro do motor, mapeados para HTTP pela camada de API. */
export type EngineErrorCode =
  | 'ADVENTURE_INVALID'
  | 'NODE_NOT_FOUND'
  | 'CHOICE_NOT_FOUND'
  | 'CHOICE_UNAVAILABLE'
  | 'CHOICE_ALREADY_TAKEN'
  | 'ACTION_NOT_ALLOWED'
  | 'SEQUENCE_MISMATCH'
  | 'INSUFFICIENT_GOLD'
  | 'INSUFFICIENT_RESOURCE'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_NOT_OWNED'
  | 'ITEM_REQUIREMENTS_NOT_MET'
  | 'SLOT_INVALID'
  | 'COMBAT_NOT_ACTIVE'
  | 'COMBAT_NOT_PLAYER_TURN'
  | 'ENEMY_NOT_FOUND'
  | 'SKILL_NOT_AVAILABLE'
  | 'SKILL_ON_COOLDOWN'
  | 'FLEE_NOT_ALLOWED'
  | 'GAME_FINISHED'
  | 'CHARACTER_INVALID'
  | 'CHECKPOINT_NOT_FOUND'
  | 'DICE_EXPRESSION_INVALID';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: EngineErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

/**
 * Erro de concorrencia: a acao chegou com uma sequencia diferente da atual.
 * Carrega o estado atual para que o cliente possa se ressincronizar.
 */
export class SequenceMismatchError extends EngineError {
  readonly currentSequence: number;

  constructor(expected: number, current: number) {
    super(
      'SEQUENCE_MISMATCH',
      `Acao fora de ordem: esperado ${expected}, atual ${current}. Recarregue o estado da partida.`,
      { expected, current },
    );
    this.name = 'SequenceMismatchError';
    this.currentSequence = current;
  }
}

export function isEngineError(error: unknown): error is EngineError {
  return error instanceof EngineError;
}
