import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { Prisma } from '@micsys-crm/database';
import { TIPOS_INGRESO } from '@micsys-crm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/auth';
import type { AuthUser } from '../common/auth';
import { inicioDiaMx, inicioMesMx, sumarDias, TZ } from '../common/fechas';
import { MOV_INCLUDE } from '../movimientos/movimientos.service';
import { AccesoService } from '../common/acceso.service';

const num = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0);
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private acceso: AccesoService,
  ) {}

  async resumen(u: AuthUser, q: { ubicacion_id?: string; empresa_id?: string; dias?: string }) {
    const org = u.organizacion_id;
    const dias = Math.min(90, Math.max(7, Number(q.dias) || 14));
    const ahora = new Date();
    const hoy = inicioDiaMx(ahora);
    const mes = inicioMesMx(ahora);
    const mesPrevInicio = inicioMesMx(sumarDias(mes, -1));
    const mesPrevMismoPunto = new Date(mesPrevInicio.getTime() + (ahora.getTime() - mes.getTime()));
    const desdeSerie = sumarDias(hoy, -(dias - 1));

    const ubFiltro = await this.acceso.filtro(u, q.ubicacion_id, q.empresa_id);
    const base: Prisma.MovimientoWhereInput = {
      organizacion_id: org,
      ...(ubFiltro ? { ubicacion_id: ubFiltro } : {}),
    };
    const cobrado: Prisma.MovimientoWhereInput = { ...base, estatus: 'CONFIRMADO', tipo: { in: [...TIPOS_INGRESO] } };

    const [hoyAgg, mesAgg, prevAgg, pendAgg, serieRaw, porCuenta, porDivisa, porMetodo, porCliente, pendientes, recientes, saldos, monedas, clientesActivos] =
      await Promise.all([
        this.prisma.movimiento.aggregate({ where: { ...cobrado, fecha_movimiento: { gte: hoy } }, _sum: { monto_mxn: true }, _count: true }),
        this.prisma.movimiento.aggregate({ where: { ...cobrado, fecha_movimiento: { gte: mes } }, _sum: { monto_mxn: true }, _count: true }),
        this.prisma.movimiento.aggregate({
          where: { ...cobrado, fecha_movimiento: { gte: mesPrevInicio, lt: mesPrevMismoPunto } },
          _sum: { monto_mxn: true },
        }),
        this.prisma.movimiento.aggregate({
          where: { ...base, estatus: 'PENDIENTE', tipo: { in: [...TIPOS_INGRESO] } },
          _sum: { monto_mxn: true },
          _count: true,
        }),
        this.serieDiaria(org, desdeSerie, typeof ubFiltro === 'string' ? ubFiltro : ubFiltro?.in),
        this.prisma.movimiento.groupBy({
          by: ['cuenta_destino_id'],
          where: { ...cobrado, fecha_movimiento: { gte: mes }, cuenta_destino_id: { not: null } },
          _sum: { monto_mxn: true },
          _count: true,
        }),
        this.prisma.movimiento.groupBy({
          by: ['moneda'],
          where: { ...cobrado, fecha_movimiento: { gte: mes } },
          _sum: { monto: true, monto_mxn: true },
          _count: true,
        }),
        this.prisma.movimiento.groupBy({
          by: ['metodo'],
          where: { ...cobrado, fecha_movimiento: { gte: mes } },
          _sum: { monto_mxn: true },
          _count: true,
        }),
        this.prisma.movimiento.groupBy({
          by: ['cliente_id'],
          where: { ...cobrado, fecha_movimiento: { gte: mes } },
          _sum: { monto_mxn: true },
          _count: true,
          orderBy: { _sum: { monto_mxn: 'desc' } },
          take: 6,
        }),
        this.prisma.movimiento.findMany({
          where: { ...base, estatus: 'PENDIENTE' },
          include: MOV_INCLUDE,
          orderBy: { fecha_movimiento: 'asc' },
          take: 8,
        }),
        this.prisma.movimiento.findMany({
          where: base,
          include: MOV_INCLUDE,
          orderBy: [{ created_at: 'desc' }],
          take: 8,
        }),
        this.prisma.saldoCliente.groupBy({
          by: ['moneda'],
          where: { saldo: { gt: 0 }, cliente: { organizacion_id: org } },
          _sum: { saldo: true },
          _count: true,
        }),
        this.prisma.moneda.findMany({
          where: { organizacion_id: org },
          include: { tipos_cambio: { orderBy: { fecha: 'desc' }, take: 1 } },
        }),
        this.prisma.cliente.count({ where: { organizacion_id: org, activo: true } }),
      ]);

    // ── Serie diaria completa (días sin movimiento = 0) ───────────────────
    const mapa = new Map(serieRaw.map((r) => [r.dia, r]));
    const hoyKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ahora);
    const serie = Array.from({ length: dias }, (_, i) => {
      const dia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(sumarDias(desdeSerie, i + 0.5));
      const r = mapa.get(dia);
      return { fecha: dia, monto_mxn: num(r?.monto), movimientos: Number(r?.n ?? 0), es_hoy: dia === hoyKey };
    });

    // ── ¿A dónde cayó el dinero? (mes en curso) ───────────────────────────
    const cuentas = await this.prisma.cuentaDestino.findMany({
      where: { id: { in: porCuenta.map((c) => c.cuenta_destino_id as string) } },
      include: { ejecutivo: { select: { nombre: true } } },
    });
    const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));
    const totalCuentas = porCuenta.reduce((a, c) => a + num(c._sum.monto_mxn), 0);
    const detalleCuentas = porCuenta
      .map((c) => {
        const cu = cuentaMap.get(c.cuenta_destino_id as string);
        const monto = num(c._sum.monto_mxn);
        return {
          cuenta_id: c.cuenta_destino_id,
          alias: cu?.alias ?? '—',
          banco: cu?.banco ?? '',
          tipo: cu?.tipo ?? 'EMPRESA',
          ejecutivo: cu?.ejecutivo?.nombre ?? null,
          monto_mxn: monto,
          movimientos: c._count,
          pct: pct(monto, totalCuentas),
        };
      })
      .sort((a, b) => b.monto_mxn - a.monto_mxn);
    const sumaTipo = (t: string) => detalleCuentas.filter((c) => c.tipo === t).reduce((a, c) => a + c.monto_mxn, 0);

    // ── Cobranza pendiente (saldos de clientes, a MXN con el último tipo de cambio) ──
    const tc = new Map(monedas.map((m) => [m.codigo, m.codigo === 'MXN' ? 1 : num(m.tipos_cambio[0]?.valor)]));
    const porCobrar = saldos.map((s) => ({
      moneda: s.moneda,
      saldo: num(s._sum.saldo),
      clientes: s._count,
      saldo_mxn: num(s._sum.saldo) * (tc.get(s.moneda) ?? 0),
      sin_tipo_cambio: !tc.get(s.moneda),
    }));

    // ── Top clientes ──────────────────────────────────────────────────────
    const clientes = await this.prisma.cliente.findMany({
      where: { id: { in: porCliente.map((c) => c.cliente_id) } },
      select: { id: true, nombre: true, razon_social: true },
    });
    const cliMap = new Map(clientes.map((c) => [c.id, c]));

    const mesTotal = num(mesAgg._sum.monto_mxn);
    const prevTotal = num(prevAgg._sum.monto_mxn);

    return {
      generado: ahora.toISOString(),
      kpis: {
        hoy: { monto_mxn: num(hoyAgg._sum.monto_mxn), movimientos: hoyAgg._count },
        mes: {
          monto_mxn: mesTotal,
          movimientos: mesAgg._count,
          mes_anterior_mxn: prevTotal,
          variacion_pct: prevTotal > 0 ? Math.round(((mesTotal - prevTotal) / prevTotal) * 1000) / 10 : null,
        },
        por_confirmar: { monto_mxn: num(pendAgg._sum.monto_mxn), movimientos: pendAgg._count },
        por_cobrar: {
          monto_mxn: porCobrar.reduce((a, s) => a + s.saldo_mxn, 0),
          por_moneda: porCobrar,
        },
        clientes_activos: clientesActivos,
        promedio_por_movimiento_mxn: mesAgg._count ? mesTotal / mesAgg._count : 0,
      },
      serie,
      destino: {
        total_mxn: totalCuentas,
        empresa: { monto_mxn: sumaTipo('EMPRESA'), pct: pct(sumaTipo('EMPRESA'), totalCuentas) },
        ejecutivo: { monto_mxn: sumaTipo('EJECUTIVO'), pct: pct(sumaTipo('EJECUTIVO'), totalCuentas) },
        cuentas: detalleCuentas,
      },
      divisas: porDivisa.map((d) => ({
        moneda: d.moneda,
        monto: num(d._sum.monto),
        monto_mxn: num(d._sum.monto_mxn),
        movimientos: d._count,
        pct: pct(num(d._sum.monto_mxn), mesTotal),
      })),
      metodos: porMetodo
        .map((m) => ({
          metodo: m.metodo ?? 'OTRO',
          monto_mxn: num(m._sum.monto_mxn),
          movimientos: m._count,
          pct: pct(num(m._sum.monto_mxn), mesTotal),
        }))
        .sort((a, b) => b.monto_mxn - a.monto_mxn),
      top_clientes: porCliente.map((c) => ({
        cliente_id: c.cliente_id,
        nombre: cliMap.get(c.cliente_id)?.razon_social ?? cliMap.get(c.cliente_id)?.nombre ?? '—',
        monto_mxn: num(c._sum.monto_mxn),
        movimientos: c._count,
        pct: pct(num(c._sum.monto_mxn), mesTotal),
      })),
      por_confirmar: pendientes,
      recientes,
    };
  }

  private serieDiaria(org: string, desde: Date, ubicaciones?: string | string[]) {
    const lista = ubicaciones === undefined ? undefined : Array.isArray(ubicaciones) ? ubicaciones : [ubicaciones];
    return this.prisma.$queryRaw<{ dia: string; monto: Prisma.Decimal; n: bigint }[]>`
      SELECT to_char((fecha_movimiento AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS dia,
             SUM(monto_mxn) AS monto, COUNT(*) AS n
      FROM movimientos
      WHERE organizacion_id = ${org}
        AND estatus = 'CONFIRMADO'
        AND tipo::text IN (${Prisma.join([...TIPOS_INGRESO])})
        AND fecha_movimiento >= ${desde}
        ${lista ? (lista.length ? Prisma.sql`AND ubicacion_id IN (${Prisma.join(lista)})` : Prisma.sql`AND FALSE`) : Prisma.empty}
      GROUP BY 1 ORDER BY 1`;
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}

  @Get()
  resumen(@CurrentUser() u: AuthUser, @Query() q: { ubicacion_id?: string; empresa_id?: string; dias?: string }) {
    return this.svc.resumen(u, q);
  }
}
