import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import type { GameStatus } from '@lonetale/engine';

import { LONETALE_SCHEMA } from '../../config/configuration';

/**
 * Partida de um jogador em uma versao especifica de uma aventura.
 *
 * `stateSnapshot` guarda o `GameState` do motor em NVARCHAR(MAX). As colunas ao
 * lado nao duplicam o estado por capricho: sao a chave da concorrencia
 * (`sequence`), dos indices de listagem (`status`, `updatedAt`) e dos relatorios
 * (`endingId`, `playtimeSeconds`).
 *
 * Controle de concorrencia em duas camadas:
 * - `sequence`: avanca a cada acao aceita; o UPDATE condiciona nela, de modo que
 *   duas requisicoes simultaneas nunca aplicam a mesma acao duas vezes;
 * - `version`: trava otimista do TypeORM, como rede de seguranca.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'GameSessions' })
@Index('IX_GameSessions_User_Status', ['userId', 'status'])
@Index('IX_GameSessions_User_Updated', ['userId', 'updatedAt'])
@Index('IX_GameSessions_Adventure', ['adventureId', 'status'])
@Index('IX_GameSessions_Character', ['characterId'])
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  userId: string;

  @Column({ type: 'uniqueidentifier' })
  characterId: string;

  @Column({ type: 'uniqueidentifier' })
  adventureId: string;

  @Column({ type: 'uniqueidentifier' })
  adventureVersionId: string;

  /** Versao de conteudo congelada para esta partida. */
  @Column({ type: 'nvarchar', length: 20 })
  adventureVersion: string;

  @Column({ type: 'nvarchar', length: 16, default: 'active' })
  status: GameStatus;

  @Column({ type: 'nvarchar', length: 80 })
  currentNodeId: string;

  /** Numero da proxima acao esperada; base da idempotencia. */
  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ type: 'nvarchar', length: 'MAX' })
  stateSnapshot: string;

  @Column({ type: 'nvarchar', length: 80, nullable: true })
  endingId: string | null;

  @Column({ type: 'int', default: 0 })
  playtimeSeconds: number;

  /** Semente das rolagens: permite reproduzir a partida inteira. */
  @Column({ type: 'nvarchar', length: 64 })
  rngSeed: string;

  @Column({ type: 'datetime2', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'datetime2', nullable: true })
  lastActionAt: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  startedAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
