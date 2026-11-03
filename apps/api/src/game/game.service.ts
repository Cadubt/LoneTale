import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AdventureEngine,
  EngineError,
  SequenceMismatchError,
  type CharacterDraft,
  type GameEvent as EngineGameEvent,
  type GameState,
  type NodeView,
  type PlayerAction,
  type StepResult,
} from '@lonetale/engine';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, Repository } from 'typeorm';

import { AdventuresService } from '../adventures/adventures.service';
import { Adventure } from '../adventures/entities/adventure.entity';
import { AppConfigService } from '../config/app-config.service';
import type { RequestUser } from '../auth/jwt.strategy';
import { CharacterInventoryRow } from './entities/character-inventory.entity';
import { Character } from './entities/character.entity';
import { GameEvent } from './entities/game-event.entity';
import { GameSession } from './entities/game-session.entity';
import type { PlayerActionDto, StartSessionDto } from './dto/game.dto';

export interface SessionSummary {
  id: string;
  adventureId: string;
  adventureTitle: string;
  adventureSlug: string;
  adventureVersion: string;
  characterName: string;
  characterLevel: number;
  status: string;
  currentNodeId: string;
  sequence: number;
  endingId: string | null;
  playtimeSeconds: number;
  startedAt: Date;
  updatedAt: Date;
}

export interface SessionStateResponse {
  sessionId: string;
  view: NodeView;
  events: EngineGameEvent[];
  /** `true` quando a resposta veio da chave de idempotencia, sem reaplicar. */
  replayed?: boolean;
}

/** Limite por acao, para que tempo ocioso nao conte como tempo de jogo. */
const MAX_PLAYTIME_INCREMENT_SECONDS = 300;

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    @InjectRepository(GameSession) private readonly sessions: Repository<GameSession>,
    @InjectRepository(Character) private readonly characters: Repository<Character>,
    @InjectRepository(GameEvent) private readonly events: Repository<GameEvent>,
    @InjectRepository(Adventure) private readonly adventures: Repository<Adventure>,
    private readonly adventuresService: AdventuresService,
    private readonly config: AppConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // --------------------------------------------------------------- consultas
  /**
   * Partidas do jogador, com o titulo da aventura e o nome do personagem.
   *
   * Feito como uma consulta unica com junções: a alternativa seria abrir cada
   * snapshot JSON para descobrir o nome do personagem.
   */
  async listSessions(userId: string): Promise<SessionSummary[]> {
    const rows = await this.sessions
      .createQueryBuilder('session')
      .innerJoin(Adventure, 'adventure', 'adventure.id = session.adventureId')
      .innerJoin(Character, 'character', 'character.id = session.characterId')
      .select([
        'session.id AS id',
        'session.adventureId AS adventureId',
        'adventure.title AS adventureTitle',
        'adventure.slug AS adventureSlug',
        'session.adventureVersion AS adventureVersion',
        'character.name AS characterName',
        'character.level AS characterLevel',
        'session.status AS status',
        'session.currentNodeId AS currentNodeId',
        'session.sequence AS sequence',
        'session.endingId AS endingId',
        'session.playtimeSeconds AS playtimeSeconds',
        'session.startedAt AS startedAt',
        'session.updatedAt AS updatedAt',
      ])
      .where('session.userId = :userId', { userId })
      .orderBy('session.updatedAt', 'DESC')
      .limit(50)
      .getRawMany<SessionSummary>();

    return rows;
  }

  private async requireSession(userId: string, sessionId: string): Promise<GameSession> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Partida nao encontrada.');
    }
    if (session.userId !== userId) {
      // Mesma resposta de "nao existe": nao revela ids de outras pessoas.
      throw new NotFoundException('Partida nao encontrada.');
    }
    return session;
  }

  /** Reconstroi o motor preso a versao de conteudo da partida. */
  private async engineFor(session: GameSession): Promise<AdventureEngine> {
    const resolved = await this.adventuresService.resolveVersion(
      session.adventureId,
      session.adventureVersionId,
    );
    return new AdventureEngine(resolved.compiled);
  }

  async getState(userId: string, sessionId: string): Promise<SessionStateResponse> {
    const session = await this.requireSession(userId, sessionId);
    const engine = await this.engineFor(session);
    const state = JSON.parse(session.stateSnapshot) as GameState;
    return { sessionId: session.id, view: engine.view(state), events: [] };
  }

  async listEvents(userId: string, sessionId: string, limit = 100): Promise<GameEvent[]> {
    await this.requireSession(userId, sessionId);
    return this.events.find({
      where: { gameSessionId: sessionId },
      order: { sequence: 'DESC', ordinal: 'ASC' },
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  // ------------------------------------------------------------- nova partida
  /**
   * Cria personagem e partida.
   *
   * A partida nasce presa a versao publicada em vigor: publicar a 1.1 depois
   * nao altera o que esta pessoa esta jogando.
   */
  async startSession(user: RequestUser, dto: StartSessionDto): Promise<SessionStateResponse> {
    const adventure = await this.findPlayableAdventure(dto.adventure);
    const resolved = await this.adventuresService.resolveVersion(adventure.id);

    if (adventure.status !== 'published' || !adventure.currentVersionId) {
      throw new ConflictException('Esta aventura ainda nao esta publicada.');
    }

    const engine = new AdventureEngine(resolved.compiled);
    const draft: CharacterDraft = {
      name: dto.character.name,
      ...(dto.character.classId !== undefined ? { classId: dto.character.classId } : {}),
      ...(dto.character.raceId !== undefined ? { raceId: dto.character.raceId } : {}),
      ...(dto.character.attributes !== undefined ? { attributes: dto.character.attributes } : {}),
      ...(dto.character.appearance !== undefined ? { appearance: dto.character.appearance } : {}),
      ...(dto.character.description !== undefined ? { description: dto.character.description } : {}),
    };

    const seed = this.config.deterministicSeed ?? `lt-${randomUUID()}`;
    const step = engine.startGame(draft, { seed });

    return this.dataSource.transaction(async (manager) => {
      const character = await manager.save(
        manager.create(Character, {
          userId: user.id,
          adventureId: adventure.id,
          adventureVersionId: resolved.version.id,
          name: step.state.character.name,
          classId: step.state.character.classId,
          raceId: step.state.character.raceId,
          level: step.state.character.level,
          experience: step.state.character.experience,
          appearance: JSON.stringify(step.state.character.appearance ?? {}),
          description: step.state.character.description ?? null,
        }),
      );

      const session = await manager.save(
        manager.create(GameSession, {
          userId: user.id,
          characterId: character.id,
          adventureId: adventure.id,
          adventureVersionId: resolved.version.id,
          adventureVersion: resolved.version.version,
          status: step.state.status,
          currentNodeId: step.state.currentNodeId,
          sequence: step.state.sequence,
          stateSnapshot: JSON.stringify(step.state),
          endingId: step.state.endingId,
          playtimeSeconds: 0,
          rngSeed: seed,
          completedAt: null,
          lastActionAt: new Date(),
        }),
      );

      await this.persistEvents(manager, session.id, step, 'startGame', undefined);
      await this.projectInventory(manager, session.id, character.id, step.state, resolved.compiled);

      this.logger.log(
        `Partida iniciada: ${session.id} (${adventure.slug} v${resolved.version.version}).`,
      );

      return { sessionId: session.id, view: step.view, events: step.events };
    });
  }

  private async findPlayableAdventure(identifier: string): Promise<Adventure> {
    const bySlug = await this.adventures.findOne({ where: { slug: identifier } });
    if (bySlug) {
      return bySlug;
    }
    // Aceita tambem o id da aventura, mas sem deixar um id malformado virar
    // erro de driver.
    if (/^[0-9a-fA-F-]{36}$/.test(identifier)) {
      const byId = await this.adventures.findOne({ where: { id: identifier } });
      if (byId) {
        return byId;
      }
    }
    throw new NotFoundException('Aventura nao encontrada.');
  }

  // ----------------------------------------------------------------- acoes
  /**
   * Aplica uma acao do jogador.
   *
   * Tudo acontece em uma unica transacao, com tres camadas de protecao contra
   * aplicacao duplicada -- recarregar a pagina, reenviar a requisicao ou
   * reconectar nunca concede a mesma recompensa duas vezes:
   *
   * 1. `idempotencyKey`: se a chave ja foi usada nesta partida, devolvemos o
   *    estado atual sem reaplicar nada;
   * 2. `expectedSequence`: o motor recusa acoes fora de ordem;
   * 3. `UPDATE ... WHERE sequence = <anterior>`: se outra requisicao avancou a
   *    partida nesse meio-tempo, zero linhas sao afetadas e a transacao e
   *    desfeita.
   */
  async applyAction(
    user: RequestUser,
    sessionId: string,
    dto: PlayerActionDto,
  ): Promise<SessionStateResponse> {
    const existing = await this.requireSession(user.id, sessionId);

    if (dto.idempotencyKey) {
      const replay = await this.events.findOne({
        where: { gameSessionId: sessionId, idempotencyKey: dto.idempotencyKey },
      });
      if (replay) {
        const current = await this.getState(user.id, sessionId);
        return { ...current, replayed: true };
      }
    }

    const engine = await this.engineFor(existing);
    const action = this.toPlayerAction(dto);

    return this.dataSource.transaction(async (manager) => {
      // Bloqueia a linha da partida para o restante da transacao: duas acoes
      // simultaneas da mesma pessoa sao serializadas em vez de disputarem.
      const locked = await manager
        .createQueryBuilder(GameSession, 'session')
        .setLock('pessimistic_write')
        .where('session.id = :id', { id: sessionId })
        .getOne();

      if (!locked) {
        throw new NotFoundException('Partida nao encontrada.');
      }

      const previousSequence = locked.sequence;
      const state = JSON.parse(locked.stateSnapshot) as GameState;
      const step = engine.apply(state, action);

      const now = new Date();
      const elapsedSeconds = locked.lastActionAt
        ? Math.min(
            MAX_PLAYTIME_INCREMENT_SECONDS,
            Math.max(0, Math.round((now.getTime() - locked.lastActionAt.getTime()) / 1000)),
          )
        : 0;

      const isFinished = step.state.status === 'completed' || step.state.status === 'defeated';

      const result = await manager
        .createQueryBuilder()
        .update(GameSession)
        .set({
          status: step.state.status,
          currentNodeId: step.state.currentNodeId,
          sequence: step.state.sequence,
          stateSnapshot: JSON.stringify(step.state),
          endingId: step.state.endingId,
          playtimeSeconds: locked.playtimeSeconds + elapsedSeconds,
          lastActionAt: now,
          completedAt: isFinished ? (locked.completedAt ?? now) : null,
        })
        .where('id = :id AND sequence = :sequence', { id: sessionId, sequence: previousSequence })
        .execute();

      if (!result.affected) {
        // Outra requisicao avancou a partida entre a leitura e a gravacao.
        throw new SequenceMismatchError(previousSequence, previousSequence + 1);
      }

      await this.persistEvents(manager, sessionId, step, dto.type, dto.idempotencyKey);

      await manager.update(Character, locked.characterId, {
        level: step.state.character.level,
        experience: step.state.character.experience,
        name: step.state.character.name,
      });

      const resolved = await this.adventuresService.resolveVersion(
        locked.adventureId,
        locked.adventureVersionId,
      );
      await this.projectInventory(
        manager,
        sessionId,
        locked.characterId,
        step.state,
        resolved.compiled,
      );

      return { sessionId, view: step.view, events: step.events };
    });
  }

  /** Converte o DTO plano na acao discriminada que o motor espera. */
  private toPlayerAction(dto: PlayerActionDto): PlayerAction {
    const envelope = {
      expectedSequence: dto.expectedSequence,
      ...(dto.idempotencyKey !== undefined ? { idempotencyKey: dto.idempotencyKey } : {}),
    };

    const requireField = <T>(value: T | undefined, field: string): T => {
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(`A acao "${dto.type}" exige o campo "${field}".`);
      }
      return value;
    };

    switch (dto.type) {
      case 'choose':
        return {
          ...envelope,
          type: 'choose',
          nodeId: requireField(dto.nodeId, 'nodeId'),
          choiceId: requireField(dto.choiceId, 'choiceId'),
        };
      case 'continue':
        return { ...envelope, type: 'continue' };
      case 'rollSkillCheck':
        return { ...envelope, type: 'rollSkillCheck' };
      case 'combatAttack':
        return {
          ...envelope,
          type: 'combatAttack',
          ...(dto.targetInstanceId !== undefined
            ? { targetInstanceId: dto.targetInstanceId }
            : {}),
        };
      case 'combatSkill':
        return {
          ...envelope,
          type: 'combatSkill',
          skillId: requireField(dto.skillId, 'skillId'),
          ...(dto.targetInstanceId !== undefined
            ? { targetInstanceId: dto.targetInstanceId }
            : {}),
        };
      case 'combatItem':
        return { ...envelope, type: 'combatItem', itemId: requireField(dto.itemId, 'itemId') };
      case 'combatFlee':
        return { ...envelope, type: 'combatFlee' };
      case 'buyItem':
        return {
          ...envelope,
          type: 'buyItem',
          itemId: requireField(dto.itemId, 'itemId'),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        };
      case 'sellItem':
        return {
          ...envelope,
          type: 'sellItem',
          itemId: requireField(dto.itemId, 'itemId'),
          ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        };
      case 'useItem':
        return { ...envelope, type: 'useItem', itemId: requireField(dto.itemId, 'itemId') };
      case 'equipItem':
        return {
          ...envelope,
          type: 'equipItem',
          itemId: requireField(dto.itemId, 'itemId'),
          ...(dto.slot !== undefined ? { slot: dto.slot } : {}),
        };
      case 'unequipItem':
        return { ...envelope, type: 'unequipItem', slot: requireField(dto.slot, 'slot') };
      case 'allocateAttribute':
        return {
          ...envelope,
          type: 'allocateAttribute',
          attributeId: requireField(dto.attributeId, 'attributeId'),
          points: dto.points ?? 1,
        };
      case 'restoreCheckpoint':
        return { ...envelope, type: 'restoreCheckpoint' };
      default:
        throw new BadRequestException(`Acao desconhecida: "${String(dto.type)}".`);
    }
  }

  /**
   * Grava o passo no log da partida.
   *
   * O primeiro registro e um marcador da acao: ele carrega a chave de
   * idempotencia, de modo que o indice unico `(gameSessionId, idempotencyKey)`
   * rejeite no banco qualquer tentativa de aplicar a mesma acao duas vezes --
   * mesmo que duas requisicoes cheguem ao mesmo tempo.
   */
  private async persistEvents(
    manager: EntityManager,
    sessionId: string,
    step: StepResult,
    actionType: string,
    idempotencyKey?: string,
  ): Promise<void> {
    const rows: GameEvent[] = [];

    rows.push(
      manager.create(GameEvent, {
        gameSessionId: sessionId,
        sequence: step.state.sequence,
        ordinal: 0,
        kind: 'action',
        nodeId: step.state.currentNodeId,
        actionType,
        payload: JSON.stringify({ actionType, sequence: step.state.sequence }),
        idempotencyKey: idempotencyKey ?? null,
      }),
    );

    step.events.forEach((event, index) => {
      rows.push(
        manager.create(GameEvent, {
          gameSessionId: sessionId,
          sequence: step.state.sequence,
          ordinal: index + 1,
          kind: event.type,
          nodeId: 'nodeId' in event ? (event.nodeId as string) : null,
          actionType,
          payload: JSON.stringify(event),
          idempotencyKey: null,
        }),
      );
    });

    await manager.save(GameEvent, rows);
  }

  /**
   * Reescreve a projecao relacional do inventario.
   *
   * Dentro da mesma transacao do snapshot: as duas representacoes nunca
   * divergem. Sao poucas linhas por partida, e e o que permite consultar o
   * inventario em SQL sem abrir cada JSON.
   */
  private async projectInventory(
    manager: EntityManager,
    sessionId: string,
    characterId: string,
    state: GameState,
    compiled: { items: Map<string, { slot?: string }> },
  ): Promise<void> {
    await manager.delete(CharacterInventoryRow, { gameSessionId: sessionId });

    const grouped = new Map<string, number>();
    for (const entry of state.character.inventory) {
      grouped.set(entry.itemId, (grouped.get(entry.itemId) ?? 0) + entry.quantity);
    }
    if (grouped.size === 0) {
      return;
    }

    const equippedSlotByItem = new Map<string, string>();
    for (const [slot, itemId] of Object.entries(state.character.equipment)) {
      if (itemId) {
        equippedSlotByItem.set(itemId, slot);
      }
    }

    const rows = [...grouped.entries()].map(([itemId, quantity]) =>
      manager.create(CharacterInventoryRow, {
        gameSessionId: sessionId,
        characterId,
        itemId,
        quantity,
        equipped: equippedSlotByItem.has(itemId),
        slot: equippedSlotByItem.get(itemId) ?? compiled.items.get(itemId)?.slot ?? null,
      }),
    );

    await manager.save(CharacterInventoryRow, rows);
  }

  /** Abandona a partida. O historico e preservado. */
  async abandon(userId: string, sessionId: string): Promise<void> {
    const session = await this.requireSession(userId, sessionId);
    if (session.status !== 'active') {
      throw new ConflictException('Esta partida nao esta em andamento.');
    }

    const state = JSON.parse(session.stateSnapshot) as GameState;
    state.status = 'abandoned';

    await this.sessions.update(
      { id: sessionId, sequence: session.sequence },
      {
        status: 'abandoned',
        stateSnapshot: JSON.stringify(state),
        completedAt: new Date(),
      },
    );
  }

  /** Dados de telemetria do Studio: onde a historia prende ou mata. */
  async adventureAnalytics(actor: RequestUser, adventureId: string) {
    const adventure = await this.adventuresService.requireAdventure(adventureId);
    if (actor.role !== 'admin' && adventure.ownerId !== actor.id) {
      throw new ForbiddenException('Esta aventura pertence a outro autor.');
    }

    const totals: Array<{ status: string; total: number }> = await this.sessions
      .createQueryBuilder('session')
      .select('session.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('session.adventureId = :adventureId', { adventureId })
      .groupBy('session.status')
      .getRawMany();

    const endings: Array<{ endingId: string; total: number }> = await this.sessions
      .createQueryBuilder('session')
      .select('session.endingId', 'endingId')
      .addSelect('COUNT(*)', 'total')
      .where('session.adventureId = :adventureId AND session.endingId IS NOT NULL', { adventureId })
      .groupBy('session.endingId')
      .getRawMany();

    const deaths: Array<{ nodeId: string; total: number }> = await this.events
      .createQueryBuilder('event')
      .innerJoin(GameSession, 'session', 'session.id = event.gameSessionId')
      .select('event.nodeId', 'nodeId')
      .addSelect('COUNT(*)', 'total')
      .where('session.adventureId = :adventureId AND event.kind = :kind', {
        adventureId,
        kind: 'characterDied',
      })
      .groupBy('event.nodeId')
      .orderBy('COUNT(*)', 'DESC')
      .limit(20)
      .getRawMany();

    return {
      adventureId,
      slug: adventure.slug,
      sessionsByStatus: totals,
      endings,
      deadliestNodes: deaths,
    };
  }
}

/** Mantem o `EngineError` visivel para o filtro de excecoes. */
export { EngineError };
