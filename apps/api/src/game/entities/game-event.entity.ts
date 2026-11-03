import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';

/**
 * Log autoritativo do que aconteceu em uma partida.
 *
 * Serve a tres propositos:
 * 1. auditoria e reproducao (com a semente, a partida inteira se reconstroi);
 * 2. idempotencia -- `idempotencyKey` tem indice unico por partida, de modo que
 *    recarregar a pagina, reenviar a requisicao ou reconectar nunca aplica a
 *    mesma acao (e a mesma recompensa) duas vezes;
 * 3. telemetria narrativa para o Studio (onde os jogadores morrem, o que
 *    ninguem escolhe).
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'GameEvents' })
@Index('IX_GameEvents_Session_Sequence', ['gameSessionId', 'sequence'])
@Index('IX_GameEvents_Session_Idempotency', ['gameSessionId', 'idempotencyKey'], {
  unique: true,
  where: '[idempotencyKey] IS NOT NULL',
})
@Index('IX_GameEvents_Kind', ['kind'])
export class GameEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  gameSessionId: string;

  /** Sequencia da partida em que a acao foi aplicada. */
  @Column({ type: 'int' })
  sequence: number;

  /** Ordem do evento dentro do passo. */
  @Column({ type: 'int', default: 0 })
  ordinal: number;

  /** Tipo do evento emitido pelo motor (ex.: choiceTaken, combatAttack). */
  @Column({ type: 'nvarchar', length: 40 })
  kind: string;

  @Column({ type: 'nvarchar', length: 80, nullable: true })
  nodeId: string | null;

  /** Acao do jogador que originou o passo (ex.: choose, combatAttack). */
  @Column({ type: 'nvarchar', length: 40, nullable: true })
  actionType: string | null;

  @Column({ type: 'nvarchar', length: 'MAX' })
  payload: string;

  @Column({ type: 'nvarchar', length: 100, nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;
}
