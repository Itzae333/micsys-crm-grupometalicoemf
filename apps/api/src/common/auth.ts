import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  PipeTransform,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { ZodSchema } from 'zod';

export interface AuthUser {
  id: string;
  organizacion_id: string;
  rol: 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR' | 'CONSULTA';
  nombre: string;
  email: string;
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AuthUser['rol'][]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    return super.canActivate(ctx) as boolean | Promise<boolean>;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<AuthUser['rol'][]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = req.user;
    if (!user) return true; // ruta pública
    if (user.rol === 'CONSULTA' && req.method !== 'GET') {
      throw new ForbiddenException('Tu usuario es de solo consulta.');
    }
    if (roles?.length && !roles.includes(user.rol)) {
      throw new ForbiddenException('No tienes permiso para esto.');
    }
    return true;
  }
}

/** Valida body/query con un schema Zod y devuelve el valor ya parseado. */
export class ZodPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  transform(value: unknown) {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      throw new BadRequestException(r.error.issues.map((i) => i.message).join(' · '));
    }
    return r.data;
  }
}
