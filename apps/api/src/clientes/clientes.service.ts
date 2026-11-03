import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@micsys-crm/database';
import type { ClienteInput, CuentaClienteInput } from '@micsys-crm/shared';
import { TIPOS_INGRESO } from '@micsys-crm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../common/acceso.service';
import type { AuthUser } from '../common/auth';

@Injectable()
export class ClientesService {
  constructor(
    private prisma: PrismaService,
    private acceso: AccesoService,
  ) {}

  async listar(
    u: AuthUser,
    q: { q?: string; activo?: string; page?: string; limit?: string; con_saldo?: string; ubicacion_id?: string; empresa_id?: string; origen?: string },
  ) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
    const ubicacion_id = await this.acceso.filtro(u, q.ubicacion_id, q.empresa_id);
    const where: Record<string, unknown> = { organizacion_id: u.organizacion_id, ...(ubicacion_id ? { ubicacion_id } : {}) };
    if (q.activo === 'true') where.activo = true;
    if (q.activo === 'false') where.activo = false;
    if (q.origen === 'ERP' || q.origen === 'MANUAL') where.origen = q.origen;
    if (q.con_saldo === 'true') where.saldos = { some: { saldo: { gt: 0 } } };
    if (q.q?.trim()) {
      const s = q.q.trim();
      where.OR = [
        { nombre: { contains: s, mode: 'insensitive' } },
        { apellidos: { contains: s, mode: 'insensitive' } },
        { razon_social: { contains: s, mode: 'insensitive' } },
        { rfc: { contains: s, mode: 'insensitive' } },
        { telefono: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.cliente.count({ where }),
      this.prisma.cliente.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          saldos: true,
          ubicacion: { select: { id: true, nombre: true, empresa: { select: { id: true, nombre: true } } } },
          erp_link: { select: { erp_cliente_id: true, saldo_erp: true, saldo_erp_at: true, saldo_sincronizado_at: true } },
          _count: { select: { movimientos: true } },
        },
      }),
    ]);
    return { total, page, limit, items };
  }

  async detalle(u: AuthUser, id: string) {
    const c = await this.cargar(u, id, {
      cuentas: { orderBy: { created_at: 'desc' as const } },
      saldos: true,
      erp_link: true,
      ubicacion: { select: { id: true, nombre: true, empresa: { select: { id: true, nombre: true } } } },
    });

    const base = { cliente_id: id, estatus: 'CONFIRMADO' as const, tipo: { in: [...TIPOS_INGRESO] } };
    const [cobrado, ultimo, pendientes, total_movs, abiertos, reabiertos] = await Promise.all([
      this.prisma.movimiento.aggregate({ where: base as never, _sum: { monto_mxn: true } }),
      this.prisma.movimiento.findFirst({
        where: { cliente_id: id, estatus: { in: ['CONFIRMADO', 'PENDIENTE'] } },
        orderBy: { fecha_movimiento: 'desc' },
        select: { fecha_movimiento: true },
      }),
      this.prisma.movimiento.aggregate({
        where: { cliente_id: id, estatus: 'PENDIENTE' },
        _count: true,
        _sum: { monto_mxn: true },
      }),
      this.prisma.movimiento.count({ where: { cliente_id: id } }),
      this.prisma.erpTicket.aggregate({ where: { cliente_id: id, abierto: true, estatus: { notIn: ['REABIERTA'] } }, _count: true, _sum: { saldo: true } }),
      this.prisma.erpTicket.aggregate({ where: { cliente_id: id, abierto: true, estatus: 'REABIERTA' }, _count: true, _sum: { saldo: true } }),
    ]);
    return {
      ...c,
      resumen: {
        cobrado_mxn: cobrado._sum.monto_mxn ?? 0,
        ultimo_movimiento: ultimo?.fecha_movimiento ?? null,
        pendientes: pendientes._count,
        pendientes_mxn: pendientes._sum.monto_mxn ?? 0,
        movimientos: total_movs,
        tickets_abiertos: abiertos._count,
        tickets_saldo: abiertos._sum.saldo ?? 0,
        tickets_reabiertos: reabiertos._count,
        tickets_reabiertos_saldo: reabiertos._sum.saldo ?? 0,
      },
    };
  }

  async crear(u: AuthUser, dto: ClienteInput) {
    await this.acceso.asegurar(u, dto.ubicacion_id);
    const c = await this.prisma.cliente.create({ data: { ...dto, organizacion_id: u.organizacion_id } });
    await this.audit(u, 'Cliente', c.id, 'CREATE', null, c);
    return c;
  }

  async actualizar(u: AuthUser, id: string, dto: ClienteInput) {
    const antes = await this.cargar(u, id, { erp_link: true });
    // Un cliente ligado al ERP pertenece a la ubicación de su registro en el ERP: no se mueve.
    if (antes.erp_link && dto.ubicacion_id !== antes.ubicacion_id) {
      throw new BadRequestException('Un cliente importado del ERP no cambia de ubicación.');
    }
    if (dto.ubicacion_id !== antes.ubicacion_id) {
      await this.acceso.asegurar(u, dto.ubicacion_id);
      const movs = await this.prisma.movimiento.count({ where: { cliente_id: id } });
      if (movs > 0) throw new BadRequestException('El cliente ya tiene movimientos; no se puede cambiar de ubicación.');
    }
    const { erp_link: _enlace, ...previo } = antes;
    const c = await this.prisma.cliente.update({ where: { id }, data: dto });
    await this.audit(u, 'Cliente', id, 'UPDATE', previo, c);
    return c;
  }

  async activar(u: AuthUser, id: string, activo: boolean) {
    await this.cargar(u, id);
    const c = await this.prisma.cliente.update({ where: { id }, data: { activo } });
    await this.audit(u, 'Cliente', id, activo ? 'ACTIVATE' : 'DEACTIVATE', null, { activo });
    return c;
  }

  // ── Cuentas bancarias del cliente ───────────────────────────────────────
  async crearCuenta(u: AuthUser, clienteId: string, dto: CuentaClienteInput) {
    await this.cargar(u, clienteId);
    const c = await this.prisma.cuentaCliente.create({ data: { ...dto, cliente_id: clienteId } });
    await this.audit(u, 'CuentaCliente', c.id, 'CREATE', null, c);
    return c;
  }

  async actualizarCuenta(u: AuthUser, clienteId: string, cuentaId: string, dto: CuentaClienteInput) {
    await this.cargar(u, clienteId);
    const cuenta = await this.prisma.cuentaCliente.findFirst({ where: { id: cuentaId, cliente_id: clienteId } });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return this.prisma.cuentaCliente.update({ where: { id: cuentaId }, data: dto });
  }

  async activarCuenta(u: AuthUser, clienteId: string, cuentaId: string, activa: boolean) {
    await this.cargar(u, clienteId);
    const cuenta = await this.prisma.cuentaCliente.findFirst({ where: { id: cuentaId, cliente_id: clienteId } });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return this.prisma.cuentaCliente.update({ where: { id: cuentaId }, data: { activa } });
  }

  /** Cliente de la organización y dentro del alcance de ubicaciones del usuario. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async cargar(u: AuthUser, id: string, include?: Prisma.ClienteInclude): Promise<any> {
    const ubicacion_id = await this.acceso.filtro(u);
    const c = await this.prisma.cliente.findFirst({
      where: { id, organizacion_id: u.organizacion_id, ...(ubicacion_id ? { ubicacion_id } : {}) },
      include,
    });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  private audit(u: AuthUser, entidad: string, entidad_id: string, accion: string, antes: unknown, despues: unknown) {
    return this.prisma.auditLog.create({
      data: { usuario_id: u.id, entidad, entidad_id, accion, antes: antes as never, despues: despues as never },
    });
  }
}
