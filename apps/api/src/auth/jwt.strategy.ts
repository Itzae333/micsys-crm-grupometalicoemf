import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET ?? '',
    });
  }

  async validate(payload: { sub: string; tv: number }): Promise<AuthUser> {
    const u = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!u || !u.activo || u.token_version !== payload.tv) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return { id: u.id, organizacion_id: u.organizacion_id, rol: u.rol, nombre: u.nombre, email: u.email };
  }
}
