import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const u = await this.prisma.usuario.findUnique({ where: { email } });
    const ok = !!u && u.activo && (await argon2.verify(u.password_hash, password));
    if (!u || !ok) throw new UnauthorizedException('Correo o contraseña incorrectos');
    await this.prisma.usuario.update({ where: { id: u.id }, data: { ultimo_acceso: new Date() } });
    const access_token = await this.jwt.signAsync({ sub: u.id, tv: u.token_version });
    return { access_token, user: this.publico(u) };
  }

  async me(id: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({
      where: { id },
      include: { organizacion: true, ubicaciones: { select: { ubicacion: { select: { id: true, nombre: true, empresa: { select: { id: true, nombre: true } } } } } } },
    });
    const total = u.rol === 'SUPER_ADMIN';
    return {
      ...this.publico(u),
      // El super usuario ve todo; los demás solo lo asignado
      acceso_total: total,
      ubicaciones: total ? [] : u.ubicaciones.map((x) => x.ubicacion),
      organizacion: {
        id: u.organizacion.id,
        nombre: u.organizacion.nombre,
        moneda_base: u.organizacion.moneda_base,
      },
    };
  }

  /** Invalida todos los tokens emitidos. */
  async cerrarSesiones(id: string) {
    await this.prisma.usuario.update({ where: { id }, data: { token_version: { increment: 1 } } });
    return { ok: true };
  }

  private publico(u: { id: string; nombre: string; apellidos: string | null; email: string; rol: string }) {
    return { id: u.id, nombre: u.nombre, apellidos: u.apellidos, email: u.email, rol: u.rol };
  }
}
