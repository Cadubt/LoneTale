import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';
import { User } from './user.entity';

export type IdentityProvider = 'google';

/** Vinculo com um provedor externo de identidade (OpenID Connect). */
@Entity({ schema: LONETALE_SCHEMA, name: 'ExternalLogins' })
@Index('IX_ExternalLogins_Provider_Subject', ['provider', 'subject'], { unique: true })
@Index('IX_ExternalLogins_UserId', ['userId'])
export class ExternalLogin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uniqueidentifier' })
  userId: string;

  @Column({ type: 'nvarchar', length: 32 })
  provider: IdentityProvider;

  /** Identificador estavel do usuario no provedor (claim `sub`). */
  @Column({ type: 'nvarchar', length: 255 })
  subject: string;

  @Column({ type: 'nvarchar', length: 320, nullable: true })
  email: string | null;

  @Column({ type: 'datetime2', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.externalLogins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;
}
