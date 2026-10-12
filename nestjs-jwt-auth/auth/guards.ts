import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { JwtUser } from './jwt.strategy';

/** Giriş zorunlu: @UseGuards(JwtAuthGuard) */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/** Rol zorunlu: @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN') */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user as JwtUser | undefined;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Bu işlem için yetkiniz yok');
    return true;
  }
}

/** Denetleyicide giriş yapan kullanıcı: me(@CurrentUser() u: JwtUser) */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtUser => ctx.switchToHttp().getRequest().user);
