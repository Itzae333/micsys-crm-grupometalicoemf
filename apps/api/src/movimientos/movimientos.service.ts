import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@micsys-crm/database';
import type { MovimientoInput, TipoMovimiento } from '@micsys-crm/shared';
import { signoSaldo, TIPOS_INGRESO } from '@micsys-crm/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth';
import { parseFecha, sumarDias } from '../common/fechas';
import { AccesoService } from '../common/acceso.service';

type Tx = Prisma.TransactionClient;
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);

export const MOV_INCLUDE = {
  cliente: { select: { id: true, nombre: true, apellidos: true, razon_social: true } },
  cuenta_destino: {
    select: { id: true, alias: true, banco: true, tipo: true, moneda: true, ejecutivo: { select: { id: true, nombre: true } } },
  },
  cuenta_cliente: { select: { id: true, banco: true, alias: true } },
  ubicacion: { select: { id: true, nombre: true } },
  ventas: true,
  comprobantes: { select: { id: true, nombre: true, mime: true, tamano: true } },
  conciliacion: true,
} satisfies Prisma.MovimientoInclude;

export interface FiltrosMov {
  cliente_id?: string;
  cuenta_destino_id?: string;
  ubicacion_id?: string;
  estatus?: string;
  tipo?: string;
  metodo?: string;
  moneda?: string;
  desde?: string;
  hasta?: string;
  q?: string;
  page?: string;
  limit?: string;
}

@Injectable()
export class MovimientosService {
  constructor(
    private prisma: PrismaService,
    private acceso: AccesoService,
  ) {}

  // ── Consulta ───────────────────────────────────────────────────────────
  private async where(u: AuthUser, f: FiltrosMov): Promise<Prisma.MovimientoWhereInput> {
    const w: Prisma.MovimientoWhereInput = { organizacion_id: u.organizacion_id };
    const ub = await this.acceso.filtro(u, f.ubicacion_id);
    if (ub) w.ubicacion_id = ub;
    if (f.cliente_id) w.cliente_id = f.cliente_id;
    if (f.cuenta_destino_id) w.cuenta_destino_id = f.cuenta_destino_id;
    if (f.estatus) w.estatus = f.estatus as never;
    if (f.tipo) w.tipo = f.tipo as never;
    if (f.metodo) w.metodo = f.metodo as never;
    if (f.moneda) w.moneda = f.moneda;
    if (f.desde || f.hasta) {
      // parseFecha devuelve el mediodía de México; -12 h = inicio de ese día.
      const inicioDia = (s: string) => new Date(parseFecha(s.slice(0, 10)).getTime() - 12 * 3600_000);
      w.fecha_movimiento = {
        ...(f.desde ? { gte: inicioDia(f.desde) } : {}),
        // "hasta" es inclusivo: llega hasta el final de ese día
        ...(f.hasta ? { lt: sumarDias(inicioDia(f.hasta), 1) } : {}),
      };
    }
    if (f.q?.trim()) {
      const s = f.q.trim();
      const folio = /^\d+$/.test(s) ? Number(s) : undefined;
      w.OR = [
        { referencia: { contains: s, mode: 'insensitive' } },
        { concepto: { contains: s, mode: 'insensitive' } },
        { cliente: { nombre: { contains: s, mode: 'insensitive' } } },
        { cliente: { razon_social: { contains: s, mode: 'insensitive' } } },
        { ventas: { some: { folio: { contains: s, mode: 'insensitive' } } } },
        ...(folio !== undefined ? [{ folio }] : []),
      ];
    }
    return w;
  }

  async listar(u: AuthUser, f: FiltrosMov) {
    const page = Math.max(1, Number(f.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(f.limit) || 25));
    const where = await this.where(u, f);
    const [total, items, sumas] = await Promise.all([
      this.prisma.movimiento.count({ where }),
      this.prisma.movimiento.findMany({
        where,
        include: MOV_INCLUDE,
        orderBy: [{ fecha_movimiento: 'desc' }, { folio: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      // Pie de tabla: suma de lo CONFIRMADO del filtro, separado por divisa
      this.prisma.movimiento.groupBy({
        by: ['moneda'],
        where: { ...where, estatus: 'CONFIRMADO', tipo: { in: [...TIPOS_INGRESO] } },
        _sum: { monto: true, monto_mxn: true },
        _count: true,
      }),
    ]);
    return {
      total,
      page,
      limit,
      items,
      totales: sumas.map((s) => ({
        moneda: s.moneda,
        monto: s._sum.monto ?? 0,
        monto_mxn: s._sum.monto_mxn ?? 0,
        movimientos: s._count,
      })),
    };
  }

  async detalle(u: AuthUser, id: string) {
    const ub = await this.acceso.filtro(u);
    const m = await this.prisma.movimiento.findFirst({
      where: { id, organizacion_id: u.organizacion_id, ...(ub ? { ubicacion_id: ub } : {}) },
      include: MOV_INCLUDE,
    });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    return m;
  }

  // ── Alta ───────────────────────────────────────────────────────────────
  async crear(u: AuthUser, dto: ReturnType<typeof normalizar>) {
    return this.prisma.$transaction(async (tx) => {
      const alcance = await this.acceso.filtro(u);
      const cliente = await tx.cliente.findFirst({
        where: { id: dto.cliente_id, organizacion_id: u.organizacion_id, ...(alcance ? { ubicacion_id: alcance } : {}) },
      });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');
      if (!cliente.activo) throw new BadRequestException('El cliente está inactivo.');

      let moneda = dto.moneda ?? 'MXN';
      if (dto.cuenta_destino_id) {
        const cuenta = await tx.cuentaDestino.findFirst({
          where: { id: dto.cuenta_destino_id, organizacion_id: u.organizacion_id },
        });
        if (!cuenta) throw new NotFoundException('La cuenta destino no existe.');
        if (!cuenta.activa) throw new BadRequestException(`La cuenta "${cuenta.alias}" está dada de baja.`);
        moneda = cuenta.moneda; // la divisa la define la cuenta destino
      }
      if (dto.cuenta_cliente_id) {
        const cc = await tx.cuentaCliente.findFirst({ where: { id: dto.cuenta_cliente_id, cliente_id: dto.cliente_id } });
        if (!cc) throw new BadRequestException('La cuenta de origen no pertenece a este cliente.');
      }
      const tipo_cambio = await this.tipoCambio(tx, u, moneda, dto.tipo_cambio);
      const monto = D(dto.monto);
      const monto_mxn = monto.mul(tipo_cambio).toDecimalPlaces(2);
      const confirmar = dto.confirmar;

      const saldo = await this.saldoBloqueado(tx, dto.cliente_id, moneda);
      const delta = monto.mul(signoSaldo(dto.tipo as TipoMovimiento));
      const saldo_despues = confirmar ? saldo.add(delta) : saldo;
      if (confirmar) await tx.saldoCliente.update({ where: { cliente_id_moneda: { cliente_id: dto.cliente_id, moneda } }, data: { saldo: saldo_despues } });

      const mov = await tx.movimiento.create({
        data: {
          organizacion_id: u.organizacion_id,
          ubicacion_id: cliente.ubicacion_id, // el movimiento hereda la ubicación del cliente
          cliente_id: dto.cliente_id,
          tipo: dto.tipo,
          metodo: dto.metodo ?? null,
          motivo: dto.motivo,
          categoria_otro: dto.motivo === 'OTRO' ? dto.categoria_otro : null,
          concepto: dto.concepto,
          referencia: dto.referencia,
          cuenta_destino_id: dto.cuenta_destino_id ?? null,
          cuenta_cliente_id: dto.cuenta_cliente_id ?? null,
          moneda,
          monto,
          tipo_cambio,
          monto_mxn,
          saldo_antes: saldo,
          saldo_despues,
          fecha_movimiento: parseFecha(dto.fecha_movimiento),
          estatus: confirmar ? 'CONFIRMADO' : 'PENDIENTE',
          confirmado_at: confirmar ? new Date() : null,
          confirmado_por_id: confirmar ? u.id : null,
          usuario_id: u.id,
          ventas: dto.motivo === 'VENTA' ? { create: dto.ventas.map((v) => ({ ...v, moneda })) } : undefined,
        },
        include: MOV_INCLUDE,
      });
      await this.audit(tx, u, mov.id, 'CREATE', null, { folio: mov.folio, monto: mov.monto, moneda, estatus: mov.estatus });
      return mov;
    });
  }

  // ── Cambios de estado ──────────────────────────────────────────────────
  confirmar(u: AuthUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const m = await this.cargar(tx, u, id);
      if (m.estatus !== 'PENDIENTE') throw new ConflictException(`El movimiento ya está ${m.estatus.toLowerCase()}.`);
      const saldo = await this.saldoBloqueado(tx, m.cliente_id, m.moneda);
      const despues = saldo.add(m.monto.mul(signoSaldo(m.tipo as TipoMovimiento, m.signo)));
      await tx.saldoCliente.update({ where: { cliente_id_moneda: { cliente_id: m.cliente_id, moneda: m.moneda } }, data: { saldo: despues } });
      const r = await tx.movimiento.update({
        where: { id },
        data: { estatus: 'CONFIRMADO', saldo_antes: saldo, saldo_despues: despues, confirmado_at: new Date(), confirmado_por_id: u.id },
        include: MOV_INCLUDE,
      });
      await this.audit(tx, u, id, 'CONFIRM', { estatus: m.estatus }, { estatus: 'CONFIRMADO' });
      return r;
    });
  }

  rechazar(u: AuthUser, id: string, motivo: string) {
    return this.prisma.$transaction(async (tx) => {
      const m = await this.cargar(tx, u, id);
      if (m.estatus !== 'PENDIENTE') throw new ConflictException('Solo se puede rechazar un movimiento Pendiente.');
      const r = await tx.movimiento.update({
        where: { id },
        data: { estatus: 'RECHAZADO', motivo_cancelacion: motivo, cancelado_at: new Date(), cancelado_por_id: u.id },
        include: MOV_INCLUDE,
      });
      await this.audit(tx, u, id, 'REJECT', { estatus: m.estatus }, { estatus: 'RECHAZADO', motivo });
      return r;
    });
  }

  /** Anula por error de captura. Si ya estaba Confirmado, revierte el saldo. */
  cancelar(u: AuthUser, id: string, motivo: string) {
    return this.prisma.$transaction(async (tx) => {
      const m = await this.cargar(tx, u, id);
      if (m.estatus === 'CANCELADO' || m.estatus === 'RECHAZADO') throw new ConflictException(`El movimiento ya está ${m.estatus.toLowerCase()}.`);
      if (m.estatus === 'CONFIRMADO') {
        const saldo = await this.saldoBloqueado(tx, m.cliente_id, m.moneda);
        await tx.saldoCliente.update({
          where: { cliente_id_moneda: { cliente_id: m.cliente_id, moneda: m.moneda } },
          data: { saldo: saldo.sub(m.monto.mul(signoSaldo(m.tipo as TipoMovimiento, m.signo))) },
        });
      }
      const r = await tx.movimiento.update({
        where: { id },
        data: { estatus: 'CANCELADO', motivo_cancelacion: motivo, cancelado_at: new Date(), cancelado_por_id: u.id },
        include: MOV_INCLUDE,
      });
      await this.audit(tx, u, id, 'CANCEL', { estatus: m.estatus }, { estatus: 'CANCELADO', motivo });
      return r;
    });
  }

  async conciliar(u: AuthUser, id: string, b: { referencia_estado_cuenta?: string; notas?: string }) {
    const m = await this.cargar(this.prisma, u, id);
    if (m.estatus !== 'CONFIRMADO') throw new BadRequestException('Solo se concilian movimientos Confirmados.');
    return this.prisma.conciliacion.upsert({
      where: { movimiento_id: id },
      update: { ...b, conciliado_por_id: u.id, conciliado_at: new Date() },
      create: { movimiento_id: id, ...b, conciliado_por_id: u.id },
    });
  }

  // ── Exportar ───────────────────────────────────────────────────────────
  async csv(u: AuthUser, f: FiltrosMov) {
    const items = await this.prisma.movimiento.findMany({
      where: await this.where(u, f),
      include: MOV_INCLUDE,
      orderBy: [{ fecha_movimiento: 'desc' }, { folio: 'desc' }],
      take: 20000,
    });
    const esc = (v: unknown) => {
      let s = String(v ?? '');
      // Evita inyección de fórmulas al abrir en Excel
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['Folio', 'Fecha', 'Ubicación', 'Cliente', 'Tipo', 'Forma de pago', 'Cuenta destino', 'Tipo de cuenta', 'Ejecutivo', 'Referencia', 'Ventas ERP', 'Moneda', 'Monto', 'Tipo de cambio', 'Monto MXN', 'Estado', 'Concepto'];
    const rows = items.map((m) => [
      m.folio,
      m.fecha_movimiento.toISOString().slice(0, 10),
      m.ubicacion.nombre,
      m.cliente.razon_social ?? m.cliente.nombre,
      m.tipo,
      m.metodo ?? '',
      m.cuenta_destino?.alias ?? '',
      m.cuenta_destino?.tipo ?? '',
      m.cuenta_destino?.ejecutivo?.nombre ?? '',
      m.referencia ?? '',
      m.ventas.map((v) => v.folio ?? v.erp_venta_id).join(' '),
      m.moneda,
      m.monto.toFixed(2),
      m.tipo_cambio.toString(),
      m.monto_mxn.toFixed(2),
      m.estatus,
      m.concepto,
    ]);
    return '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  }

  // ── helpers ────────────────────────────────────────────────────────────
  private async cargar(tx: Tx, u: AuthUser, id: string) {
    const ub = await this.acceso.filtro(u);
    const m = await tx.movimiento.findFirst({
      where: { id, organizacion_id: u.organizacion_id, ...(ub ? { ubicacion_id: ub } : {}) },
    });
    if (!m) throw new NotFoundException('Movimiento no encontrado');
    return m;
  }

  /** Crea la fila de saldo si no existe y la bloquea (FOR UPDATE) para serializar movimientos del mismo cliente. */
  private async saldoBloqueado(tx: Tx, cliente_id: string, moneda: string) {
    await tx.saldoCliente.upsert({
      where: { cliente_id_moneda: { cliente_id, moneda } },
      update: {},
      create: { cliente_id, moneda, saldo: 0 },
    });
    const rows = await tx.$queryRaw<{ saldo: Prisma.Decimal }[]>`
      SELECT saldo FROM saldos_cliente WHERE cliente_id = ${cliente_id} AND moneda = ${moneda} FOR UPDATE`;
    return D(rows[0].saldo);
  }

  private async tipoCambio(tx: Tx, u: AuthUser, moneda: string, manual?: number) {
    if (moneda === 'MXN') return D(1);
    if (manual) return D(manual);
    const m = await tx.moneda.findUnique({
      where: { organizacion_id_codigo: { organizacion_id: u.organizacion_id, codigo: moneda } },
      include: { tipos_cambio: { orderBy: { fecha: 'desc' }, take: 1 } },
    });
    if (!m) throw new BadRequestException(`La moneda ${moneda} no está dada de alta.`);
    const tc = m.tipos_cambio[0];
    if (!tc) throw new BadRequestException(`Registra el tipo de cambio de ${moneda} antes de capturar el movimiento.`);
    return tc.valor;
  }

  private audit(tx: Tx, u: AuthUser, id: string, accion: string, antes: unknown, despues: unknown) {
    return tx.auditLog.create({
      data: { usuario_id: u.id, entidad: 'Movimiento', entidad_id: id, accion, antes: antes as never, despues: despues as never },
    });
  }
}

/** Solo para tipar el DTO ya validado por Zod. */
export function normalizar(dto: unknown) {
  return dto as Required<Pick<MovimientoInput, 'cliente_id' | 'tipo' | 'concepto' | 'monto' | 'fecha_movimiento'>> & {
    metodo?: MovimientoInput['metodo'];
    motivo: 'VENTA' | 'OTRO';
    categoria_otro: string | null;
    referencia: string | null;
    cuenta_destino_id?: string | null;
    cuenta_cliente_id?: string | null;
    moneda?: string;
    tipo_cambio?: number;
    confirmar: boolean;
    ventas: { erp_venta_id: string; erp_empresa?: string | null; folio?: string | null; monto_aplicado: number }[];
  };
}
