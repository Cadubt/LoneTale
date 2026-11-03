import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';
import { ExternalLogin } from './external-login.entity';
import { UserCredential } from './user-credential.entity';

export type UserRole = 'player' | 'author' | 'admin';

@Entity({ schema: LONETALE_SCHEMA, name: 'Users' })
@Index('IX_Users_Email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Normalizado em minusculas antes de persistir. */
  @Column({ type: 'nvarchar', length: 320 })
  email: string;

  @Column({ type: 'nvarchar', length: 80 })
  displayName: string;

  @Column({ type: 'nvarchar', length: 16, default: 'player' })
  role: UserRole;

  @Column({ type: 'bit', default: true })
  isActive: boolean;

  @Column({ type: 'bit', default: false })
  emailVerified: boolean;

  @Column({ type: 'nvarchar', length: 10, default: 'pt-BR' })
  locale: string;

  @Column({ type: 'datetime2', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime2' })
  updatedAt: Date;

  @OneToOne(() => UserCredential, (credential) => credential.user)
  credential?: UserCredential;

  @OneToMany(() => ExternalLogin, (login) => login.user)
  externalLogins?: ExternalLogin[];
}
