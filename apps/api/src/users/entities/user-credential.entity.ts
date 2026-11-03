import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';
import { User } from './user.entity';

/**
 * Credencial local (e-mail + senha).
 *
 * Separada de `Users` para que consultas de perfil nunca tragam material
 * sensivel por acidente. A senha e guardada apenas como derivacao scrypt.
 */
@Entity({ schema: LONETALE_SCHEMA, name: 'UserCredentials' })
export class UserCredential {
  @PrimaryColumn({ type: 'uniqueidentifier' })
  userId: string;

  @Column({ type: 'nvarchar', length: 32, default: 'scrypt' })
  algorithm: string;

  /** Parametros + sal + hash, no formato `scrypt$N$r$p$salt$hash`. */
  @Column({ type: 'nvarchar', length: 512 })
  passwordHash: string;

  @Column({ type: 'datetime2', nullable: true })
  passwordChangedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  failedAttempts: number;

  @Column({ type: 'datetime2', nullable: true })
  lockedUntil: Date | null;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.credential, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;
}
