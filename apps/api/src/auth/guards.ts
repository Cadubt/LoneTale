import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import type { UserRole } from '../users/entities/user.entity';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';
import type { RequestUser } from './jwt.strategy';

/** Guard global de autenticacao; respeita `@Public()`. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

/** Autorizacao por papel; `admin` acessa tudo. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const role = request.user?.role as UserRole | undefined;

    if (!role) {
      throw new ForbiddenException('Autenticacao necessaria.');
    }
    if (role === 'admin' || required.includes(role)) {
      return true;
    }
    throw new ForbiddenException('Voce nao tem permissao para esta operacao.');
  }
}
