import { ForbiddenException, Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth';

/**
 * Alcance por ubicación: solo el SUPER_ADMIN ve todas las ubicaciones de la organización;
 * cualquier otro rol (incluido ADMIN) ve únicamente las que el super usuario le asignó.
 * Todo servicio que lea clientes/movimientos pasa por aquí.
 */
@Injectable()
export class AccesoService {
  constructor(private prisma: PrismaService) {}

  /** null = sin restricción dentro de la organización. */
  async ids(u: AuthUser): Promise<string[] | null> {
    if (u.rol === 'SUPER_ADMIN') return null;
    const rows = await this.prisma.usuarioUbicacion.findMany({
      where: { usuario_id: u.id, ubicacion: { organizacion_id: u.organizacion_id, activa: true } },
      select: { ubicacion_id: true },
    });
    return rows.map((r) => r.ubicacion_id);
  }

  /**
   * Filtro Prisma para `ubicacion_id`: combina la ubicación y/o empresa que pidió el usuario con su alcance.
   * Pedir una ubicación o empresa fuera de su alcance es un error de permiso.
   */
  async filtro(u: AuthUser, pedida?: string, empresaId?: string): Promise<string | { in: string[] } | undefined> {
    const ids = await this.ids(u);
    let candidatos: string[] | null = ids;
    if (empresaId) {
      const delGrupo = await this.prisma.ubicacion.findMany({
        where: { organizacion_id: u.organizacion_id, empresa_id: empresaId },
        select: { id: true },
      });
      const deLaEmpresa = delGrupo.map((x) => x.id);
      candidatos = ids === null ? deLaEmpresa : ids.filter((i) => deLaEmpresa.includes(i));
    }
    if (candidatos === null) return pedida || undefined;
    if (pedida) {
      if (!candidatos.includes(pedida)) throw new ForbiddenException('No tienes acceso a esa ubicación.');
      return pedida;
    }
    return { in: candidatos };
  }

  /** Empresas visibles: el super usuario ve todas; el resto, las de las ubicaciones que tiene asignadas. */
  async empresas(u: AuthUser) {
    const ids = await this.ids(u);
    return this.prisma.empresa.findMany({
      where: {
        organizacion_id: u.organizacion_id,
        activa: true,
        ...(ids === null ? {} : { ubicaciones: { some: { id: { in: ids }, activa: true } } }),
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async asegurar(u: AuthUser, ubicacionId: string) {
    const ids = await this.ids(u);
    if (ids !== null && !ids.includes(ubicacionId)) throw new ForbiddenException('No tienes acceso a esa ubicación.');
    const ub = await this.prisma.ubicacion.findFirst({
      where: { id: ubicacionId, organizacion_id: u.organizacion_id },
    });
    if (!ub) throw new ForbiddenException('La ubicación no existe.');
    return ub;
  }
}

@Global()
@Module({ providers: [AccesoService], exports: [AccesoService] })
export class AccesoModule {}
