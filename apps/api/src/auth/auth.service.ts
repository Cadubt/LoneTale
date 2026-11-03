import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { UsersService } from '../users/users.service';
import type { User } from '../users/entities/user.entity';
import type {
  AuthenticatedUserDto,
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  SessionResponseDto,
} from './dto/auth.dto';
import { GoogleAuthService } from './google.service';
import { PasswordService } from './password.service';
import { TokenService, type TokenClientInfo } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly google: GoogleAuthService,
  ) {}

  static toPublicUser(user: User): AuthenticatedUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      locale: user.locale,
    };
  }

  private async buildSession(user: User, client: TokenClientInfo): Promise<SessionResponseDto> {
    const issued = await this.tokens.issue(user, client);
    await this.users.registerLogin(user.id);
    return { ...issued, user: AuthService.toPublicUser(user) };
  }

  async register(dto: RegisterDto, client: TokenClientInfo): Promise<SessionResponseDto> {
    const user = await this.users.createLocal({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
    });
    this.logger.log(`Conta criada: ${user.id}`);
    return this.buildSession(user, client);
  }

  /**
   * Login local.
   *
   * A mensagem de erro e deliberadamente a mesma para e-mail inexistente e
   * senha errada, para nao revelar quais e-mails tem conta. O trabalho de
   * derivacao tambem e feito em ambos os casos, evitando distinguir pelo tempo
   * de resposta.
   */
  async login(dto: LoginDto, client: TokenClientInfo): Promise<SessionResponseDto> {
    const genericFailure = new UnauthorizedException('E-mail ou senha incorretos.');
    const user = await this.users.findByEmail(dto.email);

    if (!user) {
      await this.passwords.hash(dto.password);
      throw genericFailure;
    }

    const credential = await this.users.getCredential(user.id);
    if (!credential) {
      await this.passwords.hash(dto.password);
      throw new UnauthorizedException(
        'Esta conta usa login do Google. Entre com o Google para continuar.',
      );
    }

    if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((credential.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(
        `Muitas tentativas. Tente novamente em ${minutes} minuto(s).`,
      );
    }

    const valid = await this.passwords.verify(dto.password, credential.passwordHash);
    if (!valid) {
      await this.users.registerFailedAttempt(user.id);
      throw genericFailure;
    }

    if (!user.isActive) {
      throw new ForbiddenException('Esta conta esta desativada.');
    }

    await this.users.clearFailedAttempts(user.id);

    // Re-deriva com os parametros atuais quando o hash esta defasado.
    if (this.passwords.needsRehash(credential.passwordHash)) {
      await this.users.updatePasswordHash(user.id, await this.passwords.hash(dto.password));
    }

    return this.buildSession(user, client);
  }

  async refresh(refreshToken: string, client: TokenClientInfo): Promise<SessionResponseDto> {
    const { tokens, user } = await this.tokens.rotate(
      refreshToken,
      (userId) => this.users.findById(userId),
      client,
    );
    return { ...tokens, user: AuthService.toPublicUser(user) };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  getGoogleAuthorization() {
    return this.google.createAuthorizationRequest();
  }

  async loginWithGoogle(
    code: string,
    state: string,
    flowToken: string,
    client: TokenClientInfo,
  ): Promise<SessionResponseDto> {
    const identity = await this.google.exchange(code, state, flowToken);
    const user = await this.users.upsertFromExternal({
      provider: 'google',
      subject: identity.subject,
      email: identity.email,
      displayName: identity.displayName,
      emailVerified: identity.emailVerified,
    });

    if (!user.isActive) {
      throw new ForbiddenException('Esta conta esta desativada.');
    }

    return this.buildSession(user, client);
  }

  /** Troca de senha: invalida todas as sessoes, inclusive as de outros aparelhos. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const credential = await this.users.getCredential(userId);
    if (!credential) {
      throw new ForbiddenException('Esta conta nao usa senha.');
    }
    const valid = await this.passwords.verify(dto.currentPassword, credential.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    await this.users.updatePasswordHash(userId, await this.passwords.hash(dto.newPassword));
    await this.tokens.revokeAllForUser(userId, 'password-changed');
  }
}
