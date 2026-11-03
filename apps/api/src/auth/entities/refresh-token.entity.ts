import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';

/**
 * Token de renovacao de sessao, com rotacao.
 *
 * Guardamos apenas o hash SHA-256 do token: um vazamento da tabela nao permite
 * emitir sessoes. Cada uso rotaciona o token e aponta para o sucessor, de modo
 * que o reuso de um token antigo e detectavel e revoga a familia inteira.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'RefreshTokens' })
@Index('IX_RefreshTokens_TokenHash', ['tokenHash'], { unique: true })
@Index('IX_RefreshTokens_UserId_ExpiresAt', ['userId', 'expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  userId: string;

  @Column({ type: 'nvarchar', length: 64 })
  tokenHash: string;

  /** Agrupa a cadeia de rotacoes originada de um mesmo login. */
  @Column({ type: 'uniqueidentifier' })
  familyId: string;

  @Column({ type: 'datetime2' })
  expiresAt: Date;

  @Column({ type: 'datetime2', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'nvarchar', length: 64, nullable: true })
  revokedReason: string | null;

  @Column({ type: 'uniqueidentifier', nullable: true })
  replacedByTokenId: string | null;

  @Column({ type: 'nvarchar', length: 45, nullable: true })
  createdByIp: string | null;

  @Column({ type: 'nvarchar', length: 256, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;
}
