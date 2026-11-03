import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../config/app-config.service';
import { UsersService } from '../users/users.service';
import type { AccessTokenPayload } from './token.service';

export interface RequestUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  }

  /**
   * Revalida contra o banco em vez de confiar apenas no conteudo do token:
   * uma conta desativada perde acesso imediatamente, sem esperar o token expirar.
   */
  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sessao invalida.');
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }
}
