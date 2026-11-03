import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { Prisma } from '@micsys-crm/database';
import { TIPOS_INGRESO } from '@micsys-crm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../common/acceso.service';
import { CurrentUser } from '../common/auth';
import type { AuthUser } from '../common/auth';
import { inicioDiaMx, inicioMesMx, parseFecha, sumarDias, TZ } from '../common/fechas';

const num = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0);
const r2 = (x: number) => Math.round(x * 100) / 100;
const DIA = 86_400_000;
const ANTIGUEDAD_LECTURA_DIAS = 3;

@Injectable()
export class ReportesService {
  constructor(
    private prisma: PrismaService,
    private acceso: AccesoService,
  ) {}

  // ── Crédito: cuántos clientes deben, cuánto, desde cuándo ─────────────
  async credito(u: AuthUser, q: { ubicacion_id?: string; empresa_id?: string }) {
    const ub = await this.acceso.filtro(u, q.ubicacion_id, q.empresa_id);
    const clienteWhere = { organizacion_id: u.organizacion_id, activo: true, ...(ub ? { ubicacion_id: ub } : {}) };
    const ahora = new Date();

    const [links, abiertos, conTickets, reabiertos] = await Promise.all([
      this.prisma.erpLink.findMany({
        where: { cliente: clienteWhere },
        select: {
          cliente_id: true,
          saldo_erp: true,
          saldo_erp_at: true,
          saldo_sincronizado_at: true,
          tickets_at: true,
          cliente: {
            select: {
              id: true,
              nombre: true,
              razon_social: true,
              ubicacion: { select: { id: true, nombre: true, empresa: { select: { nombre: true } } } },
              saldos: { where: { moneda: 'MXN' }, select: { saldo: true } },
            },
          },
        },
      }),
      // Solo lo que de verdad se debe: las reabiertas (en edición) no se cobran hasta cerrarse de nuevo
      this.prisma.erpTicket.findMany({
        where: { abierto: true, estatus: { notIn: ['REABIERTA'] }, cliente: clienteWhere },
        select: { cliente_id: true, saldo: true, total: true, vence: true, cliente: { select: { ubicacion_id: true } } },
      }),
      this.prisma.erpTicket.groupBy({ by: ['cliente_id'], where: { cliente: clienteWhere }, _count: true }),
      this.prisma.erpTicket.aggregate({ where: { abierto: true, estatus: 'REABIERTA', cliente: clienteWhere }, _count: true, _sum: { saldo: true } }),
    ]);

    // Antigüedad de saldos (días de vencido)
    const buckets = [
      { key: 'sin_vencimiento', label: 'Crédito sin fecha de vencimiento', saldo: 0, tickets: 0 },
      { key: 'por_vencer', label: 'Por vencer', saldo: 0, tickets: 0 },
      { key: 'd1_30', label: 'Vencido 1–30 días', saldo: 0, tickets: 0 },
      { key: 'd31_60', label: 'Vencido 31–60 días', saldo: 0, tickets: 0 },
      { key: 'd61_90', label: 'Vencido 61–90 días', saldo: 0, tickets: 0 },
      { key: 'd90_mas', label: 'Vencido más de 90 días', saldo: 0, tickets: 0 },
    ];
    let vencidos = 0;
    let saldoVencido = 0;
    for (const t of abiertos) {
      const s = num(t.saldo);
      let b = buckets[0];
      if (t.vence) {
        const dias = Math.floor((ahora.getTime() - t.vence.getTime()) / DIA);
        if (dias <= 0) b = buckets[1];
        else {
          vencidos++;
          saldoVencido += s;
          b = dias <= 30 ? buckets[2] : dias <= 60 ? buckets[3] : dias <= 90 ? buckets[4] : buckets[5];
        }
      }
      b.saldo += s;
      b.tickets++;
    }

    // Por ubicación
    const ubicaciones = new Map<string, { id: string; nombre: string; empresa: string; vinculados: number; con_credito: Set<string>; tickets: number; saldo: number; saldo_erp: number; saldo_crm: number }>();
    const lugar = (id: string, nombre: string, empresa = '') => {
      if (!ubicaciones.has(id)) ubicaciones.set(id, { id, nombre, empresa, vinculados: 0, con_credito: new Set(), tickets: 0, saldo: 0, saldo_erp: 0, saldo_crm: 0 });
      return ubicaciones.get(id)!;
    };
    const nombreUb = new Map<string, string>();
    for (const l of links) {
      nombreUb.set(l.cliente.ubicacion.id, l.cliente.ubicacion.nombre);
      const x = lugar(l.cliente.ubicacion.id, l.cliente.ubicacion.nombre, l.cliente.ubicacion.empresa.nombre);
      x.vinculados++;
      x.saldo_erp += num(l.saldo_erp);
      x.saldo_crm += num(l.cliente.saldos[0]?.saldo);
    }
    for (const t of abiertos) {
      const x = lugar(t.cliente.ubicacion_id, nombreUb.get(t.cliente.ubicacion_id) ?? '—');
      x.con_credito.add(t.cliente_id);
      x.tickets++;
      x.saldo += num(t.saldo);
    }

    // Saldos ERP vs CRM
    const respaldo = new Map<string, number>();
    for (const t of abiertos) respaldo.set(t.cliente_id, (respaldo.get(t.cliente_id) ?? 0) + num(t.saldo));
    const filas = links.map((l) => {
      const crm = num(l.cliente.saldos[0]?.saldo);
      const erp = num(l.saldo_erp);
      return {
        saldo_tickets: r2(respaldo.get(l.cliente.id) ?? 0),
        cliente_id: l.cliente.id,
        nombre: l.cliente.razon_social ?? l.cliente.nombre,
        ubicacion: l.cliente.ubicacion.nombre,
        saldo_erp: r2(erp),
        saldo_crm: r2(crm),
        diferencia: r2(erp - crm),
        saldo_erp_at: l.saldo_erp_at,
        saldo_sincronizado_at: l.saldo_sincronizado_at,
      };
    });
    // Saldo del ERP que no está respaldado por ningún ticket abierto (saldos iniciales, ajustes, migración)
    const sinTicket = filas
      .map((f) => ({ ...f, sin_ticket: r2(f.saldo_erp - f.saldo_tickets) }))
      .filter((f) => f.sin_ticket >= 0.01)
      .sort((a, b) => b.sin_ticket - a.sin_ticket);
    const desincronizados = filas.filter((f) => Math.abs(f.diferencia) >= 0.01).sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
    const limiteLectura = ahora.getTime() - ANTIGUEDAD_LECTURA_DIAS * DIA;
    const desactualizados = links.filter((l) => !l.tickets_at || l.tickets_at.getTime() < limiteLectura).length;

    const clientesConCredito = new Set(abiertos.map((t) => t.cliente_id)).size;
    const saldoErpTotal = filas.reduce((a, f) => a + f.saldo_erp, 0);
    const saldoCrmTotal = filas.reduce((a, f) => a + f.saldo_crm, 0);

    return {
      generado: ahora.toISOString(),
      kpis: {
        clientes_vinculados: links.length,
        clientes_con_tickets: conTickets.length,
        clientes_con_credito_abierto: clientesConCredito,
        clientes_sin_credito: links.length - clientesConCredito,
        tickets_abiertos: abiertos.length,
        tickets_vencidos: vencidos,
        saldo_tickets_abiertos: r2(abiertos.reduce((a, t) => a + num(t.saldo), 0)),
        saldo_vencido: r2(saldoVencido),
        saldo_erp_total: r2(saldoErpTotal),
        saldo_crm_total: r2(saldoCrmTotal),
        diferencia_total: r2(saldoErpTotal - saldoCrmTotal),
        clientes_desincronizados: desincronizados.length,
        clientes_desactualizados: desactualizados,
        tickets_reabiertos: reabiertos._count,
        saldo_reabiertos: r2(num(reabiertos._sum.saldo)),
        clientes_saldo_sin_ticket: sinTicket.length,
        saldo_sin_ticket: r2(sinTicket.reduce((a, f) => a + f.sin_ticket, 0)),
      },
      antiguedad: buckets.map((b) => ({ ...b, saldo: r2(b.saldo) })),
      por_ubicacion: [...ubicaciones.values()]
        .map((x) => ({
          id: x.id,
          nombre: x.nombre,
          empresa: x.empresa,
          vinculados: x.vinculados,
          con_credito: x.con_credito.size,
          tickets: x.tickets,
          saldo: r2(x.saldo),
          saldo_erp: r2(x.saldo_erp),
          saldo_crm: r2(x.saldo_crm),
        }))
        .sort((a, b) => b.saldo - a.saldo),
      top_deudores: [...filas].sort((a, b) => b.saldo_erp - a.saldo_erp).filter((f) => f.saldo_erp > 0).slice(0, 10),
      desincronizados: desincronizados.slice(0, 25),
      sin_ticket: sinTicket.slice(0, 25),
    };
  }

  // ── Cobranza: cuántos abonos, de quiénes, a dónde cayeron ─────────────
  async cobranza(u: AuthUser, q: { ubicacion_id?: string; empresa_id?: string; desde?: string; hasta?: string }) {
    const ub = await this.acceso.filtro(u, q.ubicacion_id, q.empresa_id);
    const desde = q.desde ? inicioDiaMx(parseFecha(q.desde.slice(0, 10))) : inicioMesMx();
    const hastaExcl = q.hasta ? sumarDias(inicioDiaMx(parseFecha(q.hasta.slice(0, 10))), 1) : sumarDias(inicioDiaMx(), 1);
    const base: Prisma.MovimientoWhereInput = {
      organizacion_id: u.organizacion_id,
      ...(ub ? { ubicacion_id: ub } : {}),
      fecha_movimiento: { gte: desde, lt: hastaExcl },
    };
    const ingresos: Prisma.MovimientoWhereInput = { ...base, estatus: 'CONFIRMADO', tipo: { in: [...TIPOS_INGRESO] } };

    const [porTipo, porCuenta, porUbicacion, clientes, sync, ligadas, serie, abiertos, pendientes] = await Promise.all([
      this.prisma.movimiento.groupBy({ by: ['tipo'], where: ingresos, _sum: { monto_mxn: true }, _count: true }),
      this.prisma.movimiento.groupBy({ by: ['cuenta_destino_id'], where: { ...ingresos, cuenta_destino_id: { not: null } }, _sum: { monto_mxn: true }, _count: true }),
      this.prisma.movimiento.groupBy({ by: ['ubicacion_id'], where: ingresos, _sum: { monto_mxn: true }, _count: true }),
      this.prisma.movimiento.groupBy({ by: ['cliente_id'], where: ingresos, _count: true }),
      this.prisma.movimiento.findMany({ where: { ...base, estatus: 'CONFIRMADO', tipo: 'SINCRONIZACION' }, select: { monto_mxn: true, signo: true } }),
      this.prisma.movimientoVentaRef.aggregate({ where: { movimiento: ingresos }, _sum: { monto_aplicado: true }, _count: true }),
      this.serie(u.organizacion_id, desde, hastaExcl, ub),
      this.prisma.erpTicket.groupBy({
        by: ['cliente_id'],
        where: { abierto: true, estatus: { notIn: ['REABIERTA'] }, cliente: { organizacion_id: u.organizacion_id, activo: true, ...(ub ? { ubicacion_id: ub } : {}) } },
        _sum: { saldo: true },
        _count: true,
      }),
      this.prisma.movimiento.aggregate({ where: { ...base, estatus: 'PENDIENTE', tipo: { in: [...TIPOS_INGRESO] } }, _sum: { monto_mxn: true }, _count: true }),
    ]);

    const cuentas = await this.prisma.cuentaDestino.findMany({
      where: { id: { in: porCuenta.map((c) => c.cuenta_destino_id as string) } },
      include: { ejecutivo: { select: { nombre: true } } },
    });
    const cMap = new Map(cuentas.map((c) => [c.id, c]));
    const ubs = await this.prisma.ubicacion.findMany({ where: { id: { in: porUbicacion.map((x) => x.ubicacion_id) } }, select: { id: true, nombre: true } });
    const uMap = new Map(ubs.map((x) => [x.id, x.nombre]));

    const total = porTipo.reduce((a, t) => a + num(t._sum.monto_mxn), 0);
    const movs = porTipo.reduce((a, t) => a + t._count, 0);

    // Clientes con crédito abierto que NO han pagado nada en el periodo
    const pagaron = new Set(clientes.map((c) => c.cliente_id));
    const sinPago = abiertos.filter((a) => !pagaron.has(a.cliente_id));
    const sinPagoClientes = await this.prisma.cliente.findMany({
      where: { id: { in: sinPago.map((s) => s.cliente_id) } },
      select: { id: true, nombre: true, razon_social: true, ubicacion: { select: { nombre: true } } },
    });
    const nMap = new Map(sinPagoClientes.map((c) => [c.id, c]));

    return {
      periodo: { desde: desde.toISOString(), hasta: new Date(hastaExcl.getTime() - 1).toISOString() },
      kpis: {
        cobrado_mxn: r2(total),
        movimientos: movs,
        clientes_que_pagaron: clientes.length,
        promedio_mxn: movs ? r2(total / movs) : 0,
        pendientes: pendientes._count,
        pendientes_mxn: r2(num(pendientes._sum.monto_mxn)),
        aplicado_a_tickets_mxn: r2(num(ligadas._sum.monto_aplicado)),
        movimientos_ligados_a_tickets: ligadas._count,
        clientes_con_credito_abierto: abiertos.length,
        clientes_con_credito_sin_pago: sinPago.length,
        sincronizaciones: sync.length,
        sincronizacion_neta_mxn: r2(sync.reduce((a, s) => a + num(s.monto_mxn) * (s.signo < 0 ? -1 : 1), 0)),
      },
      por_tipo: porTipo.map((t) => ({ tipo: t.tipo, monto_mxn: r2(num(t._sum.monto_mxn)), movimientos: t._count, pct: total ? Math.round((num(t._sum.monto_mxn) / total) * 1000) / 10 : 0 })).sort((a, b) => b.monto_mxn - a.monto_mxn),
      por_cuenta: porCuenta
        .map((c) => {
          const cu = cMap.get(c.cuenta_destino_id as string);
          return {
            cuenta_id: c.cuenta_destino_id,
            alias: cu?.alias ?? '—',
            tipo: cu?.tipo ?? 'EMPRESA',
            ejecutivo: cu?.ejecutivo?.nombre ?? null,
            monto_mxn: r2(num(c._sum.monto_mxn)),
            movimientos: c._count,
            pct: total ? Math.round((num(c._sum.monto_mxn) / total) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => b.monto_mxn - a.monto_mxn),
      por_ubicacion: porUbicacion.map((x) => ({ id: x.ubicacion_id, nombre: uMap.get(x.ubicacion_id) ?? '—', monto_mxn: r2(num(x._sum.monto_mxn)), movimientos: x._count })).sort((a, b) => b.monto_mxn - a.monto_mxn),
      serie,
      sin_pago: sinPago
        .map((s) => ({
          cliente_id: s.cliente_id,
          nombre: nMap.get(s.cliente_id)?.razon_social ?? nMap.get(s.cliente_id)?.nombre ?? '—',
          ubicacion: nMap.get(s.cliente_id)?.ubicacion.nombre ?? '—',
          tickets: s._count,
          saldo: r2(num(s._sum.saldo)),
        }))
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 25),
    };
  }

  private async serie(org: string, desde: Date, hastaExcl: Date, ub?: string | { in: string[] }) {
    const lista = ub === undefined ? undefined : typeof ub === 'string' ? [ub] : ub.in;
    const rows = await this.prisma.$queryRaw<{ dia: string; monto: Prisma.Decimal; n: bigint }[]>`
      SELECT to_char((fecha_movimiento AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS dia, SUM(monto_mxn) AS monto, COUNT(*) AS n
      FROM movimientos
      WHERE organizacion_id = ${org} AND estatus = 'CONFIRMADO'
        AND tipo::text IN (${Prisma.join([...TIPOS_INGRESO])})
        AND fecha_movimiento >= ${desde} AND fecha_movimiento < ${hastaExcl}
        ${lista ? (lista.length ? Prisma.sql`AND ubicacion_id IN (${Prisma.join(lista)})` : Prisma.sql`AND FALSE`) : Prisma.empty}
      GROUP BY 1 ORDER BY 1`;
    const mapa = new Map(rows.map((r) => [r.dia, r]));
    const out: { fecha: string; monto_mxn: number; movimientos: number }[] = [];
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
    const dias = Math.min(366, Math.round((hastaExcl.getTime() - desde.getTime()) / DIA));
    for (let i = 0; i < dias; i++) {
      const d = fmt.format(sumarDias(desde, i + 0.5));
      const r = mapa.get(d);
      out.push({ fecha: d, monto_mxn: r2(num(r?.monto)), movimientos: Number(r?.n ?? 0) });
    }
    return out;
  }
}

@Controller('reportes')
export class ReportesController {
  constructor(private svc: ReportesService) {}

  @Get('credito')
  credito(@CurrentUser() u: AuthUser, @Query() q: { ubicacion_id?: string; empresa_id?: string }) {
    return this.svc.credito(u, q);
  }

  @Get('cobranza')
  cobranza(@CurrentUser() u: AuthUser, @Query() q: { ubicacion_id?: string; empresa_id?: string; desde?: string; hasta?: string }) {
    return this.svc.cobranza(u, q);
  }
}
