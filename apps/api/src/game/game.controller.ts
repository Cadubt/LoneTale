import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/guards';
import type { RequestUser } from '../auth/jwt.strategy';
import { PlayerActionDto, SessionSummaryDto, StartSessionDto } from './dto/game.dto';
import { GameService } from './game.service';

/**
 * LoneTale Player.
 *
 * O cliente nunca avalia regras: envia acoes e recebe a projecao do estado, com
 * as escolhas ja marcadas como disponiveis ou bloqueadas pelo motor no servidor.
 */
@ApiTags('Partidas')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(RolesGuard)
export class GameController {
  constructor(private readonly game: GameService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as partidas do jogador.' })
  @ApiResponse({ status: 200, type: [SessionSummaryDto] })
  list(@CurrentUser('id') userId: string) {
    return this.game.listSessions(userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria o personagem e inicia uma partida.',
    description:
      'A partida fica presa a versao publicada em vigor: publicar uma versao nova depois nao altera partidas em andamento.',
  })
  start(@CurrentUser() user: RequestUser, @Body() dto: StartSessionDto) {
    return this.game.startSession(user, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Estado atual da partida, pronto para renderizar.',
    description:
      'Inclui o no, as escolhas com disponibilidade e motivo do bloqueio, a ficha, o inventario e as acoes aceitas agora.',
  })
  state(@CurrentUser('id') userId: string, @Param('id') sessionId: string) {
    return this.game.getState(userId, sessionId);
  }

  @Post(':id/actions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Aplica uma acao do jogador.',
    description:
      'Autoritativo e transacional. Envie `expectedSequence` e, de preferencia, `idempotencyKey`: recarregar a pagina ou reenviar a requisicao nao duplica recompensas.',
  })
  act(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
    @Body() dto: PlayerActionDto,
  ) {
    return this.game.applyAction(user, sessionId, dto);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Historico de eventos da partida (diario de aventura).' })
  events(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.game.listEvents(
      userId,
      sessionId,
      Number.isFinite(parsed) ? (parsed as number) : undefined,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Abandona a partida, preservando o historico.' })
  async abandon(@CurrentUser('id') userId: string, @Param('id') sessionId: string): Promise<void> {
    await this.game.abandon(userId, sessionId);
  }

  @Get('analytics/:adventureId')
  @Roles('author', 'admin')
  @ApiOperation({
    summary: 'Telemetria narrativa de uma aventura.',
    description: 'Onde os jogadores morrem, quais finais saem e quantas partidas ficam pela metade.',
  })
  analytics(@CurrentUser() user: RequestUser, @Param('adventureId') adventureId: string) {
    return this.game.adventureAnalytics(user, adventureId);
  }
}
