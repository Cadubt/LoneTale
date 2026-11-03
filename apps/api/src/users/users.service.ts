import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PasswordService } from '../auth/password.service';
import { ExternalLogin, type IdentityProvider } from './entities/external-login.entity';
import { UserCredential } from './entities/user-credential.entity';
import { User, type UserRole } from './entities/user.entity';

export interface CreateLocalUserInput {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}

export interface UpsertExternalUserInput {
  provider: IdentityProvider;
  subject: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserCredential) private readonly credentials: Repository<UserCredential>,
    @InjectRepository(ExternalLogin) private readonly externalLogins: Repository<ExternalLogin>,
    private readonly passwords: PasswordService,
    private readonly dataSource: DataSource,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  async requireById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return user;
  }

  getCredential(userId: string): Promise<UserCredential | null> {
    return this.credentials.findOne({ where: { userId } });
  }

  /** Cria conta local. Usuario e credencial nascem na mesma transacao. */
  async createLocal(input: CreateLocalUserInput): Promise<User> {
    const email = normalizeEmail(input.email);
    if (await this.findByEmail(email)) {
      throw new ConflictException('Ja existe uma conta com este e-mail.');
    }

    const passwordHash = await this.passwords.hash(input.password);

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, {
          email,
          displayName: input.displayName.trim(),
          role: input.role ?? 'player',
          isActive: true,
          emailVerified: false,
          locale: 'pt-BR',
          lastLoginAt: null,
        }),
      );

      await manager.save(
        manager.create(UserCredential, {
          userId: user.id,
          algorithm: 'scrypt',
          passwordHash,
          passwordChangedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null,
        }),
      );

      return user;
    });
  }

  /**
   * Resolve o usuario de um login externo.
   *
   * Se o e-mail verificado do provedor coincidir com uma conta existente, o
   * vinculo e adicionado aquela conta -- evita contas duplicadas para a mesma
   * pessoa. E-mail nao verificado nunca e usado para unir contas.
   */
  async upsertFromExternal(input: UpsertExternalUserInput): Promise<User> {
    const existingLink = await this.externalLogins.findOne({
      where: { provider: input.provider, subject: input.subject },
    });

    if (existingLink) {
      await this.externalLogins.update(existingLink.id, { lastLoginAt: new Date() });
      return this.requireById(existingLink.userId);
    }

    const email = normalizeEmail(input.email);

    return this.dataSource.transaction(async (manager) => {
      let user = input.emailVerified ? await manager.findOne(User, { where: { email } }) : null;

      if (!user) {
        user = await manager.save(
          manager.create(User, {
            email,
            displayName: input.displayName.trim() || email.split('@')[0] || 'Jogador',
            role: 'player',
            isActive: true,
            emailVerified: input.emailVerified,
            locale: 'pt-BR',
            lastLoginAt: null,
          }),
        );
      }

      await manager.save(
        manager.create(ExternalLogin, {
          userId: user.id,
          provider: input.provider,
          subject: input.subject,
          email,
          lastLoginAt: new Date(),
        }),
      );

      return user;
    });
  }

  async registerLogin(userId: string): Promise<void> {
    await this.users.update(userId, { lastLoginAt: new Date() });
  }

  async registerFailedAttempt(userId: string): Promise<void> {
    const credential = await this.getCredential(userId);
    if (!credential) {
      return;
    }
    const failedAttempts = credential.failedAttempts + 1;
    // Bloqueio progressivo: a partir da quinta tentativa, 15 minutos.
    const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
    await this.credentials.update(userId, { failedAttempts, lockedUntil });
  }

  async clearFailedAttempts(userId: string): Promise<void> {
    await this.credentials.update(userId, { failedAttempts: 0, lockedUntil: null });
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.credentials.update(userId, {
      passwordHash,
      algorithm: 'scrypt',
      passwordChangedAt: new Date(),
    });
  }

  async setRole(userId: string, role: UserRole): Promise<User> {
    await this.users.update(userId, { role });
    return this.requireById(userId);
  }
}
