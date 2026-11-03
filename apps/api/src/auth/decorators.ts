import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { UserRole } from '../users/entities/user.entity';
import type { RequestUser } from './jwt.strategy';

export const IS_PUBLIC_KEY = 'lonetale:isPublic';
export const ROLES_KEY = 'lonetale:roles';

/**
 * Marca uma rota como aberta.
 *
 * O guard de autenticacao e global: uma rota so fica publica se for
 * explicitamente marcada, de modo que esquecer o guard nunca expoe dados.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Exige um dos papeis informados. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injeta o usuario autenticado (ou uma de suas propriedades). */
export const CurrentUser = createParamDecorator(
  (property: keyof RequestUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return property ? user[property] : user;
  },
);
