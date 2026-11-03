import { Controller, Get, Header, Injectable, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@micsys-crm/database';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../common/acceso.service';
import { CurrentUser } from '../common/auth';
import type { AuthUser } from '../common/auth';

const num = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0);
const DIA = 86_400_000;

/**
 * Una venta REABIERTA es una nota a crédito que se abrió para editarla: el ERP ya le descontó el cargo
 * al cliente y aún no se lo vuelve a cobrar, así que NO cuenta como saldo por cobrar hasta que se cierre.
 */
export const SIN_COBRO = ['REABIERTA'];

export interface FiltrosTickets {
  ubicacion_id?: string;
  empresa_id?: string;
  cliente_id?: string;
  estado?: string; // abiertos | vencidos | liquidados | todos
  q?: string;
  page?: string;
  limit?: string;
}

@Injectable()
export class CreditosService {
  constructor(
    private prisma: PrismaService,
    private acceso: AccesoService,
  ) {}

  /** Alcance (organización, ubicaciones, cliente, búsqueda) sin el estado. */
  private async base(u: AuthUser, f: FiltrosTickets): Promise<Prisma.ErpTicketWhereInput> {
    const ub = await this.acceso.filtro(u, f.ubicacion_id, f.empresa_id);
    const w: Prisma.ErpTicketWhereInput = {
      cliente: { organizacion_id: u.organizacion_id, ...(ub ? { ubicacion_id: ub } : {}) },
      ...(f.cliente_id ? { cliente_id: f.cliente_id } : {}),
    };
    if (f.q?.trim()) {
      const s = f.q.trim();
      w.OR = [
        { cliente: { nombre: { contains: s, mode: 'insensitive' } } },
        { cliente: { razon_social: { contains: s, mode: 'insensitive' } } },
        ...(/^\d+$/.test(s) ? [{ folio: Number(s) }] : []),
      ];
    }
    return w;
  }

  /**
   * estado: abiertos (crédito con saldo, sin reabiertas) · reabiertas · vencidos · liquidados (pagadas) · todos.
   * El estatus de cada venta es el que trae el ERP; no se reinterpreta.
   */
  private async where(u: AuthUser, f: FiltrosTickets): Promise<Prisma.ErpTicketWhereInput> {
    const w = await this.base(u, f);
    const estado = f.estado ?? 'abiertos';
    if (estado === 'abiertos') {
      w.abierto = true;
      w.estatus = { notIn: SIN_COBRO };
    }
    if (estado === 'reabiertas') w.estatus = { in: SIN_COBRO };
    if (estado === 'vencidos') {
      w.abierto = true;
      w.estatus = { notIn: SIN_COBRO };
      w.vence = { lt: new Date() };
    }
    if (estado === 'liquidados') w.abierto = false;
    return w;
  }

  async tickets(u: AuthUser, f: FiltrosTickets) {
    const page = Math.max(1, Number(f.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(f.limit) || 25));
    const where = await this.where(u, f);
    const ahora = new Date();
    const [total, items, sumas, vencido, reabiertas] = await Promise.all([
      this.prisma.erpTicket.count({ where }),
      this.prisma.erpTicket.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true, apellidos: true, razon_social: true, ubicacion: { select: { id: true, nombre: true, empresa: { select: { nombre: true } } } } } },
        },
        orderBy: f.estado === 'vencidos' || (f.estado ?? 'abiertos') === 'abiertos' ? [{ vence: { sort: 'asc', nulls: 'last' } }, { folio: 'asc' }] : [{ fecha: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.erpTicket.aggregate({ where, _sum: { total: true, pagado: true, saldo: true } }),
      this.prisma.erpTicket.aggregate({
        where: { ...(await this.base(u, f)), abierto: true, estatus: { notIn: SIN_COBRO }, vence: { lt: ahora } },
        _sum: { saldo: true },
        _count: true,
      }),
      // Reabiertas del mismo alcance: se muestran aparte porque todavía no se cobran
      this.prisma.erpTicket.aggregate({
        where: { ...(await this.base(u, f)), estatus: { in: SIN_COBRO }, abierto: true },
        _sum: { saldo: true },
        _count: true,
      }),
    ]);

    // Lo aplicado desde el CRM (abonos/cobros ligados al ticket) — informativo: el ERP manda en el saldo
    const aplicados = await this.prisma.movimientoVentaRef.groupBy({
      by: ['erp_venta_id'],
      where: { erp_venta_id: { in: items.map((t) => t.erp_nota_id) }, movimiento: { estatus: { in: ['CONFIRMADO', 'PENDIENTE'] } } },
      _sum: { monto_aplicado: true },
    });
    const mapa = new Map(aplicados.map((a) => [a.erp_venta_id, num(a._sum.monto_aplicado)]));

    return {
      total,
      page,
      limit,
      items: items.map((t) => {
        const cuenta = t.abierto && !SIN_COBRO.includes(t.estatus);
        const vencido_ = cuenta && !!t.vence && t.vence < ahora;
        return {
          ...t,
          cuenta_en_saldo: cuenta, // false en las reabiertas: aún no se le cobran al cliente
          vencido: vencido_,
          dias_vencido: vencido_ ? Math.floor((ahora.getTime() - t.vence!.getTime()) / DIA) : 0,
          aplicado_crm: mapa.get(t.erp_nota_id) ?? 0,
          avance_pct: num(t.total) > 0 ? Math.min(100, Math.round((num(t.pagado) / num(t.total)) * 100)) : 0,
        };
      }),
      totales: {
        total: num(sumas._sum.total),
        pagado: num(sumas._sum.pagado),
        saldo: num(sumas._sum.saldo),
        vencidos: vencido._count,
        saldo_vencido: num(vencido._sum.saldo),
        reabiertas: reabiertas._count,
        saldo_reabiertas: num(reabiertas._sum.saldo),
      },
    };
  }

  async csv(u: AuthUser, f: FiltrosTickets) {
    const where = await this.where(u, f);
    const ahora = new Date();
    const rows = await this.prisma.erpTicket.findMany({
      where,
      include: { cliente: { select: { nombre: true, razon_social: true, ubicacion: { select: { nombre: true } } } } },
      orderBy: [{ vence: { sort: 'asc', nulls: 'last' } }, { folio: 'asc' }],
      take: 20000,
    });
    const esc = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['Ubicación', 'Cliente', 'Folio', 'Fecha', 'Estatus en el ERP', 'Vence', 'Total', 'Pagado', 'Saldo', 'Cuenta como saldo por cobrar', 'Avance %', 'Abonos', 'Días vencido'];
    const lines = rows.map((t) => {
      const cuenta = t.abierto && !SIN_COBRO.includes(t.estatus);
      const venc = cuenta && !!t.vence && t.vence < ahora;
      return [
        t.cliente.ubicacion.nombre,
        t.cliente.razon_social ?? t.cliente.nombre,
        t.folio,
        t.fecha.toISOString().slice(0, 10),
        t.estatus,
        t.vence?.toISOString().slice(0, 10) ?? '',
        num(t.total).toFixed(2),
        num(t.pagado).toFixed(2),
        num(t.saldo).toFixed(2),
        cuenta ? 'Sí' : 'No',
        num(t.total) > 0 ? Math.round((num(t.pagado) / num(t.total)) * 100) : 0,
        t.abonos_count,
        venc ? Math.floor((ahora.getTime() - t.vence!.getTime()) / DIA) : 0,
      ];
    });
    return '﻿' + [head, ...lines].map((r) => r.map(esc).join(',')).join('\r\n');
  }
}

@Controller('creditos')
export class CreditosController {
  constructor(private svc: CreditosService) {}

  @Get('tickets')
  tickets(@CurrentUser() u: AuthUser, @Query() q: FiltrosTickets) {
    return this.svc.tickets(u, q);
  }

  @Get('tickets.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(@CurrentUser() u: AuthUser, @Query() q: FiltrosTickets, @Res() res: Response) {
    const csv = await this.svc.csv(u, q);
    res.setHeader('Content-Disposition', `attachment; filename="creditos-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
