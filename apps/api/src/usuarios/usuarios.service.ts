import { BadRequestException, ConflictException, Controller, Body, Get, Injectable, NotFoundException, Param, Post, Put } from '@nestjs/common';
import * as argon2 from 'argon2';
import { passwordSchema, usuarioCrearSchema, usuarioEditarSchema } from '@micsys-crm/shared';
import type { UsuarioCrearInput, UsuarioEditarInput } from '@micsys-crm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, Roles, ZodPipe } from '../common/auth';
import type { AuthUser } from '../common/auth';

const SELECT = {
  id: true,
  nombre: true,
  apellidos: true,
  email: true,
  rol: true,
  activo: true,
  ultimo_acceso: true,
  created_at: true,
  ubicaciones: { select: { ubicacion: { select: { id: true, nombre: true } } } },
} as const;

type Fila = {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  rol: string;
  activo: boolean;
  ultimo_acceso: Date | null;
  created_at: Date;
  ubicaciones: { ubicacion: { id: string; nombre: string } }[];
};

/** Alta y administración de usuarios. Solo el super usuario. */
@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  private presentar(f: Fila) {
    const { ubicaciones, ...resto } = f;
    return { ...resto, ubicaciones: ubicaciones.map((x) => x.ubicacion).sort((a, b) => a.nombre.localeCompare(b.nombre)) };
  }

  async listar(u: AuthUser) {
    const rows = await this.prisma.usuario.findMany({
      where: { organizacion_id: u.organizacion_id },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: SELECT,
    });
    return rows.map((r) => this.presentar(r as Fila));
  }

  async crear(u: AuthUser, dto: UsuarioCrearInput) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }
    const ubicaciones = await this.validarUbicaciones(u, dto.rol, dto.ubicacion_ids);
    const password_hash = await argon2.hash(dto.password);
    const creado = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.usuario.create({
        data: {
          organizacion_id: u.organizacion_id,
          nombre: dto.nombre,
          apellidos: dto.apellidos,
          email,
          password_hash,
          rol: dto.rol,
          ubicaciones: { create: ubicaciones.map((ubicacion_id) => ({ ubicacion_id })) },
        },
        select: SELECT,
      });
      await tx.auditLog.create({
        data: { usuario_id: u.id, entidad: 'Usuario', entidad_id: nuevo.id, accion: 'CREATE', despues: { email, rol: dto.rol, ubicaciones } as never },
      });
      return nuevo;
    });
    return this.presentar(creado as Fila);
  }

  async actualizar(u: AuthUser, id: string, dto: UsuarioEditarInput) {
    const objetivo = await this.cargar(u, id);
    const cambiaRol = dto.rol !== objetivo.rol;
    const desactiva = dto.activo === false && objetivo.activo;

    if (id === u.id && (cambiaRol || desactiva)) {
      throw new BadRequestException('No puedes cambiar tu propio rol ni desactivar tu propio usuario.');
    }
    // Siempre debe quedar al menos un super usuario activo
    if (objetivo.rol === 'SUPER_ADMIN' && objetivo.activo && (cambiaRol || desactiva)) {
      const otros = await this.prisma.usuario.count({
        where: { organizacion_id: u.organizacion_id, rol: 'SUPER_ADMIN', activo: true, id: { not: id } },
      });
      if (otros === 0) throw new BadRequestException('Debe quedar al menos un super usuario activo.');
    }

    const ubicaciones = await this.validarUbicaciones(u, dto.rol, dto.ubicacion_ids);
    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.usuarioUbicacion.deleteMany({ where: { usuario_id: id } });
      const r = await tx.usuario.update({
        where: { id },
        data: {
          nombre: dto.nombre,
          apellidos: dto.apellidos,
          rol: dto.rol,
          ...(dto.activo === undefined ? {} : { activo: dto.activo }),
          // Si se desactiva, sus sesiones abiertas dejan de servir al instante
          ...(desactiva ? { token_version: { increment: 1 } } : {}),
          ubicaciones: { create: ubicaciones.map((ubicacion_id) => ({ ubicacion_id })) },
        },
        select: SELECT,
      });
      await tx.auditLog.create({
        data: {
          usuario_id: u.id,
          entidad: 'Usuario',
          entidad_id: id,
          accion: 'UPDATE',
          antes: { rol: objetivo.rol, activo: objetivo.activo } as never,
          despues: { rol: dto.rol, activo: dto.activo ?? objetivo.activo, ubicaciones } as never,
        },
      });
      return r;
    });
    return this.presentar(actualizado as Fila);
  }

  /** El super usuario define una contraseña nueva; las sesiones abiertas de esa persona se cierran. */
  async cambiarPassword(u: AuthUser, id: string, password: string) {
    await this.cargar(u, id);
    await this.prisma.usuario.update({
      where: { id },
      data: { password_hash: await argon2.hash(password), token_version: { increment: 1 } },
    });
    await this.prisma.auditLog.create({ data: { usuario_id: u.id, entidad: 'Usuario', entidad_id: id, accion: 'RESET_PASSWORD' } });
    return { ok: true };
  }

  async cerrarSesiones(u: AuthUser, id: string) {
    await this.cargar(u, id);
    await this.prisma.usuario.update({ where: { id }, data: { token_version: { increment: 1 } } });
    await this.prisma.auditLog.create({ data: { usuario_id: u.id, entidad: 'Usuario', entidad_id: id, accion: 'CLOSE_SESSIONS' } });
    return { ok: true };
  }

  private async cargar(u: AuthUser, id: string) {
    const x = await this.prisma.usuario.findFirst({ where: { id, organizacion_id: u.organizacion_id } });
    if (!x) throw new NotFoundException('Usuario no encontrado');
    return x;
  }

  /** El super usuario ve todo y no necesita ubicaciones; los demás roles sí. */
  private async validarUbicaciones(u: AuthUser, rol: string, ids: string[]) {
    if (rol === 'SUPER_ADMIN') return [];
    const unicas = [...new Set(ids)];
    const validas = await this.prisma.ubicacion.findMany({
      where: { id: { in: unicas }, organizacion_id: u.organizacion_id },
      select: { id: true },
    });
    if (validas.length !== unicas.length) throw new BadRequestException('Alguna ubicación elegida no existe.');
    return validas.map((v) => v.id);
  }
}

@Controller('usuarios')
@Roles('SUPER_ADMIN')
export class UsuariosController {
  constructor(private svc: UsuariosService) {}

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.svc.listar(u);
  }

  @Post()
  crear(@CurrentUser() u: AuthUser, @Body(new ZodPipe(usuarioCrearSchema)) dto: UsuarioCrearInput) {
    return this.svc.crear(u, dto);
  }

  @Put(':id')
  actualizar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(usuarioEditarSchema)) dto: UsuarioEditarInput) {
    return this.svc.actualizar(u, id, dto);
  }

  @Post(':id/password')
  password(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(passwordSchema)) b: { password: string }) {
    return this.svc.cambiarPassword(u, id, b.password);
  }

  @Post(':id/cerrar-sesiones')
  cerrar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.cerrarSesiones(u, id);
  }
}
