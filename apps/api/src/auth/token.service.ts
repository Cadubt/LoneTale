import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { IsNull, LessThan, Repository } from 'typeorm';

import { AppConfigService } from '../config/app-config.service';
import type { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenClientInfo {
  ip?: string;
  userAgent?: string;
}

const REFRESH_TOKEN_BYTES = 48;

/**
 * Emissao e renovacao de sessoes.
 *
 * O token de acesso e um JWT curto (minutos). O de renovacao e um segredo
 * opaco, guardado apenas como SHA-256 e rotacionado a cada uso: reapresentar um
 * token ja usado indica roubo, e revoga toda a familia de tokens daquele login.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private accessTtlSeconds(): number {
    const ttl = this.config.jwt.accessTtl;
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) {
      return 900;
    }
    const value = Number.parseInt(match[1] as string, 10);
    const unit = match[2];
    const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return value * multiplier;
  }

  async issue(user: User, client: TokenClientInfo = {}, familyId?: string): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.displayName,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessTtl,
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
    });

    const refreshToken = await this.createRefreshToken(user.id, familyId ?? randomUUID(), client);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds(),
      tokenType: 'Bearer',
    };
  }

  private async createRefreshToken(
    userId: string,
    familyId: string,
    client: TokenClientInfo,
  ): Promise<string> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.jwt.refreshTtlDays * 86400_000);

    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId,
        familyId,
        tokenHash: this.hashToken(raw),
        expiresAt,
        createdByIp: client.ip ?? null,
        userAgent: client.userAgent?.slice(0, 256) ?? null,
        revokedAt: null,
        revokedReason: null,
        replacedByTokenId: null,
      }),
    );

    return raw;
  }

  /**
   * Rotaciona um token de renovacao.
   *
   * Reuso de um token revogado e tratado como comprometimento: toda a familia
   * e revogada, obrigando um novo login.
   */
  async rotate(
    rawToken: string,
    loadUser: (userId: string) => Promise<User | null>,
    client: TokenClientInfo = {},
  ): Promise<{ tokens: IssuedTokens; user: User }> {
    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: this.hashToken(rawToken) },
    });

    if (!stored) {
      throw new UnauthorizedException('Sessao invalida. Faca login novamente.');
    }

    if (stored.revokedAt) {
      this.logger.warn(
        `Reuso de token de renovacao detectado (familia ${stored.familyId}). Revogando a familia inteira.`,
      );
      await this.revokeFamily(stored.familyId, 'reuse-detected');
      throw new UnauthorizedException('Sessao invalidada por seguranca. Faca login novamente.');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.refreshTokens.update(stored.id, { revokedAt: new Date(), revokedReason: 'expired' });
      throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
    }

    const user = await loadUser(stored.userId);
    if (!user || !user.isActive) {
      await this.revokeFamily(stored.familyId, 'user-inactive');
      throw new UnauthorizedException('Conta indisponivel.');
    }

    const tokens = await this.issue(user, client, stored.familyId);
    const successor = await this.refreshTokens.findOne({
      where: { tokenHash: this.hashToken(tokens.refreshToken) },
    });

    await this.refreshTokens.update(stored.id, {
      revokedAt: new Date(),
      revokedReason: 'rotated',
      replacedByTokenId: successor?.id ?? null,
    });

    return { tokens, user };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.refreshTokens.update(
      { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'logout' },
    );
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.refreshTokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  async revokeAllForUser(userId: string, reason = 'logout-all'): Promise<void> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  /** Remove tokens expirados; chamada por rotina de manutencao. */
  async purgeExpired(): Promise<number> {
    const result = await this.refreshTokens.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }
}
