import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EngineError, SequenceMismatchError, type EngineErrorCode } from '@lonetale/engine';
import type { Response } from 'express';

/**
 * Traduz erros do motor de aventuras em respostas HTTP.
 *
 * Mantem os codigos estaveis do motor no corpo da resposta, para que o cliente
 * possa reagir (por exemplo, ressincronizar o estado em `SEQUENCE_MISMATCH`)
 * sem depender da mensagem, que e texto para o jogador.
 */
const STATUS_BY_CODE: Record<EngineErrorCode, HttpStatus> = {
  ADVENTURE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  NODE_NOT_FOUND: HttpStatus.NOT_FOUND,
  CHOICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  CHOICE_UNAVAILABLE: HttpStatus.CONFLICT,
  CHOICE_ALREADY_TAKEN: HttpStatus.CONFLICT,
  ACTION_NOT_ALLOWED: HttpStatus.CONFLICT,
  SEQUENCE_MISMATCH: HttpStatus.CONFLICT,
  INSUFFICIENT_GOLD: HttpStatus.CONFLICT,
  INSUFFICIENT_RESOURCE: HttpStatus.CONFLICT,
  ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  ITEM_NOT_OWNED: HttpStatus.CONFLICT,
  ITEM_REQUIREMENTS_NOT_MET: HttpStatus.CONFLICT,
  SLOT_INVALID: HttpStatus.BAD_REQUEST,
  COMBAT_NOT_ACTIVE: HttpStatus.CONFLICT,
  COMBAT_NOT_PLAYER_TURN: HttpStatus.CONFLICT,
  ENEMY_NOT_FOUND: HttpStatus.NOT_FOUND,
  SKILL_NOT_AVAILABLE: HttpStatus.CONFLICT,
  SKILL_ON_COOLDOWN: HttpStatus.CONFLICT,
  FLEE_NOT_ALLOWED: HttpStatus.CONFLICT,
  GAME_FINISHED: HttpStatus.CONFLICT,
  CHARACTER_INVALID: HttpStatus.BAD_REQUEST,
  CHECKPOINT_NOT_FOUND: HttpStatus.NOT_FOUND,
  DICE_EXPRESSION_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
};

@Catch(EngineError)
export class EngineExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EngineExceptionFilter.name);

  catch(exception: EngineError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;

    if (status >= 500) {
      this.logger.error(`${exception.code}: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
      ...(exception.details ? { details: exception.details } : {}),
      ...(exception instanceof SequenceMismatchError
        ? { currentSequence: exception.currentSequence }
        : {}),
    });
  }
}

/** Converte um `EngineError` em `HttpException`, para uso fora do filtro. */
export function toHttpException(error: EngineError): HttpException {
  const status = STATUS_BY_CODE[error.code] ?? HttpStatus.BAD_REQUEST;
  return new HttpException(
    {
      statusCode: status,
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    status,
  );
}
