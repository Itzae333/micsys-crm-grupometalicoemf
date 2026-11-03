import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@micsys-crm/database';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from '../common/acceso.service';
import type { AuthUser } from '../common/auth';
import { chunk, ErpClient } from './erp.client';
import type { ErpCliente, ErpSaldo, ErpTicketDto, ErpVentaDetalle, ErpVentasFiltro } from './erp.client';

const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const MAX_IMPORTAR = 100;
const MAX_ACTUALIZAR = 300;

export interface ResultadoActualizar {
  clientes: number;
  tickets: number;
  tickets_abiertos: number;
  no_encontrados: string[];
}

@Injectable()
export class ErpService {
  constructor(
    private prisma: PrismaService,
    private acceso: AccesoService,
    private erp: ErpClient,
  ) {}

  estado() {
    return { habilitado: this.erp.habilitado };
  }

  // ── Ubicaciones ────────────────────────────────────────────────────────
  /** Ubicaciones del ERP (EMFIMIFAR) y cuál tiene ya su equivalente en el CRM. */
  async ubicacionesErp(u: AuthUser) {
    const [erp, locales, permitidas] = await Promise.all([
      this.erp.ubicaciones(),
      this.prisma.ubicacion.findMany({ where: { organizacion_id: u.organizacion_id } }),
      this.acceso.ids(u),
    ]);
    const todas = erp.map((e) => ({ ...e, local: locales.find((l) => l.erp_ubicacion_id === e.id) ?? null }));
    // Quien no es super usuario solo ve las ubicaciones del ERP que ya le asignaron
    return permitidas === null ? todas : todas.filter((e) => e.local && permitidas.includes(e.local.id));
  }

  /** Crea en el CRM las ubicaciones del ERP que aún no existen (o liga una existente por nombre). */
  async importarUbicaciones(u: AuthUser) {
    const erp = await this.erp.ubicaciones();
    const locales = await this.prisma.ubicacion.findMany({ where: { organizacion_id: u.organizacion_id } });
    const creadas: string[] = [];
    const ligadas: string[] = [];
    for (const e of erp) {
      if (locales.some((l) => l.erp_ubicacion_id === e.id)) continue;
      const porNombre = locales.find((l) => !l.erp_ubicacion_id && l.nombre.toLowerCase() === e.nombre.toLowerCase());
      if (porNombre) {
        await this.prisma.ubicacion.update({ where: { id: porNombre.id }, data: { erp_ubicacion_id: e.id } });
        ligadas.push(e.nombre);
      } else {
        await this.prisma.ubicacion.create({
          data: { organizacion_id: u.organizacion_id, nombre: e.nombre, tipo: e.tipo ?? null, erp_ubicacion_id: e.id },
        });
        creadas.push(e.nombre);
      }
    }
    return { creadas, ligadas };
  }

  // ── Clientes del ERP (para elegir cuáles guardar) ──────────────────────
  async clientesErp(u: AuthUser, q: { ubicacion_id?: string; search?: string; page?: string; con_saldo?: string }) {
    const page = Number(q.page) || 1;
    const permitidas = await this.acceso.ids(u);
    let r: { total: number; page: number; limit: number; items: ErpCliente[] };

    if (permitidas === null) {
      r = await this.erp.clientes({ ubicacion_id: q.ubicacion_id, search: q.search, page, limit: 50, con_saldo: q.con_saldo === 'true' });
    } else {
      // Solo clientes de las ubicaciones del ERP a las que este usuario tiene acceso
      const locales = await this.prisma.ubicacion.findMany({
        where: { organizacion_id: u.organizacion_id, id: { in: permitidas }, erp_ubicacion_id: { not: null } },
        select: { erp_ubicacion_id: true },
      });
      const erpIds = locales.map((l) => l.erp_ubicacion_id!);
      if (q.ubicacion_id && !erpIds.includes(q.ubicacion_id)) throw new ForbiddenException('No tienes acceso a esa ubicación.');
      const objetivo = q.ubicacion_id ? [q.ubicacion_id] : erpIds;
      if (objetivo.length === 0) return { total: 0, page, limit: 50, items: [] };
      const partes = await Promise.all(
        objetivo.map((id) => this.erp.clientes({ ubicacion_id: id, search: q.search, page, limit: 50, con_saldo: q.con_saldo === 'true' })),
      );
      r = {
        total: partes.reduce((a, x) => a + x.total, 0),
        page,
        limit: 50 * objetivo.length,
        items: partes.flatMap((x) => x.items).sort((x, y) => x.nombre.localeCompare(y.nombre)),
      };
    }
    const ya = await this.prisma.erpLink.findMany({
      where: { erp_cliente_id: { in: r.items.map((c) => c.id) } },
      select: { erp_cliente_id: true, cliente_id: true },
    });
    const mapa = new Map(ya.map((l) => [l.erp_cliente_id, l.cliente_id]));
    return { ...r, items: r.items.map((c) => ({ ...c, cliente_crm_id: mapa.get(c.id) ?? null })) };
  }

  // ── Guardar clientes del ERP en el CRM (saldo del CRM en cero) ─────────
  async importarClientes(u: AuthUser, ids: string[]) {
    const unicos = [...new Set(ids.filter(Boolean))];
    if (unicos.length === 0) throw new BadRequestException('Elige al menos un cliente.');
    if (unicos.length > MAX_IMPORTAR) throw new BadRequestException(`Elige máximo ${MAX_IMPORTAR} clientes por vez.`);

    const { items } = await this.erp.clientes({ ids: unicos, limit: MAX_IMPORTAR });
    const encontrados = new Set(items.map((c) => c.id));
    const faltan = unicos.filter((x) => !encontrados.has(x));

    const yaLigados = new Set(
      (await this.prisma.erpLink.findMany({ where: { erp_cliente_id: { in: unicos } }, select: { erp_cliente_id: true } })).map(
        (l) => l.erp_cliente_id,
      ),
    );
    const ubicaciones = await this.prisma.ubicacion.findMany({ where: { organizacion_id: u.organizacion_id } });
    const ahora = new Date();

    const importados: string[] = [];
    const vinculados: string[] = [];
    const omitidos: string[] = [];
    const sinAcceso: string[] = [];
    const permitidas = await this.acceso.ids(u);

    for (const c of items) {
      if (yaLigados.has(c.id)) {
        omitidos.push(c.id);
        continue;
      }
      // La ubicación del cliente en el ERP se refleja en el CRM; si no existe aún, se crea.
      let ub = ubicaciones.find((x) => x.erp_ubicacion_id === c.ubicacion_id);
      // Crear ubicaciones nuevas es cosa del super usuario; los demás solo guardan en las que ya tienen
      if (!ub && permitidas !== null) {
        sinAcceso.push(c.id);
        continue;
      }
      if (ub && permitidas !== null && !permitidas.includes(ub.id)) {
        sinAcceso.push(c.id);
        continue;
      }
      if (!ub) {
        ub = await this.prisma.ubicacion.create({
          data: { organizacion_id: u.organizacion_id, nombre: c.ubicacion, erp_ubicacion_id: c.ubicacion_id },
        });
        ubicaciones.push(ub);
      }
      await this.acceso.asegurar(u, ub.id);

      const link = {
        erp_cliente_id: c.id,
        erp_ubicacion_id: c.ubicacion_id,
        saldo_erp: c.saldo_pendiente,
        limite_credito_erp: c.limite_credito,
        saldo_erp_at: ahora,
      };

      // Si ya hay un cliente manual con el mismo RFC en la misma ubicación, se liga en vez de duplicar.
      const dup = c.rfc
        ? await this.prisma.cliente.findFirst({
            where: {
              organizacion_id: u.organizacion_id,
              ubicacion_id: ub.id,
              rfc: { equals: c.rfc, mode: 'insensitive' },
              erp_link: null,
            },
          })
        : null;

      if (dup) {
        await this.prisma.erpLink.create({ data: { cliente_id: dup.id, ...link } });
        vinculados.push(c.id);
      } else {
        const cliente = await this.prisma.cliente.create({
          data: {
            organizacion_id: u.organizacion_id,
            ubicacion_id: ub.id,
            nombre: c.nombre,
            apellidos: c.apellidos,
            razon_social: c.razon_social,
            rfc: c.rfc,
            telefono: c.telefono,
            email: c.email,
            direccion: c.direccion,
            origen: 'ERP',
            erp_link: { create: link }, // el saldo del CRM arranca en cero: no se crea SaldoCliente
          },
        });
        await this.prisma.auditLog.create({
          data: { usuario_id: u.id, entidad: 'Cliente', entidad_id: cliente.id, accion: 'IMPORT_ERP', despues: { erp_cliente_id: c.id } as never },
        });
        importados.push(c.id);
      }
    }

    // Trae los tickets a crédito de lo recién guardado
    const nuevos = await this.prisma.erpLink.findMany({
      where: { erp_cliente_id: { in: [...importados, ...vinculados] } },
      select: { cliente_id: true },
    });
    let tickets: ResultadoActualizar | null = null;
    if (nuevos.length) {
      try {
        tickets = await this.actualizar(u, { cliente_ids: nuevos.map((n) => n.cliente_id), saldos: false });
      } catch {
        tickets = null; // los clientes ya quedaron guardados; los tickets se pueden actualizar después
      }
    }
    return {
      importados: importados.length,
      vinculados: vinculados.length,
      ya_existian: omitidos.length,
      no_encontrados: faltan,
      sin_acceso: sinAcceso.length,
      tickets_actualizados: tickets?.tickets ?? null,
    };
  }

  // ── Actualizar (leer) saldos y tickets del ERP ─────────────────────────
  /**
   * Lee del ERP el saldo y los tickets a crédito de los clientes vinculados y los guarda como foto.
   * NO toca el saldo del CRM: igualarlo es una acción aparte (sincronizarSaldo).
   */
  async actualizar(
    u: AuthUser,
    opts: { cliente_ids?: string[]; ubicacion_id?: string; saldos?: boolean; tickets?: boolean },
  ): Promise<ResultadoActualizar> {
    const ubFiltro = await this.acceso.filtro(u, opts.ubicacion_id);
    const links = await this.prisma.erpLink.findMany({
      where: {
        cliente: {
          organizacion_id: u.organizacion_id,
          activo: true,
          ...(ubFiltro ? { ubicacion_id: ubFiltro } : {}),
          ...(opts.cliente_ids ? { id: { in: opts.cliente_ids } } : {}),
        },
      },
      select: { cliente_id: true, erp_cliente_id: true },
      take: MAX_ACTUALIZAR + 1,
    });
    if (links.length > MAX_ACTUALIZAR) {
      throw new BadRequestException(`Son más de ${MAX_ACTUALIZAR} clientes; filtra por ubicación para actualizarlos por partes.`);
    }
    if (links.length === 0) return { clientes: 0, tickets: 0, tickets_abiertos: 0, no_encontrados: [] };

    const porErp = new Map(links.map((l) => [l.erp_cliente_id, l.cliente_id]));
    const ahora = new Date();
    const noEncontrados: string[] = [];

    if (opts.saldos !== false) {
      for (const ids of chunk([...porErp.keys()], 100)) {
        const saldos = await this.erp.saldos(ids);
        const vistos = new Set(saldos.map((s) => s.id));
        for (const id of ids) if (!vistos.has(id)) noEncontrados.push(porErp.get(id)!);
        await this.prisma.$transaction(
          saldos.map((s) =>
            this.prisma.erpLink.update({
              where: { erp_cliente_id: s.id },
              data: { saldo_erp: s.saldo_pendiente, limite_credito_erp: s.limite_credito, saldo_erp_at: ahora },
            }),
          ),
        );
      }
    }

    let totalTickets = 0;
    let abiertos = 0;
    if (opts.tickets !== false) {
      for (const ids of chunk([...porErp.keys()], 50)) {
        const tickets = await this.erp.tickets(ids, 'todos');
        await this.guardarTickets(ids.map((i) => porErp.get(i)!), porErp, tickets, ahora);
        totalTickets += tickets.length;
        abiertos += tickets.filter((t) => t.abierto && t.estatus !== 'REABIERTA').length;
      }
    }
    return { clientes: links.length, tickets: totalTickets, tickets_abiertos: abiertos, no_encontrados: noEncontrados };
  }

  private async guardarTickets(clienteIds: string[], porErp: Map<string, string>, tickets: ErpTicketDto[], ahora: Date) {
    await this.prisma.$transaction(async (tx) => {
      for (const t of tickets) {
        const cliente_id = porErp.get(t.cliente_id);
        if (!cliente_id) continue;
        const data = {
          cliente_id,
          erp_ubicacion_id: t.ubicacion_id,
          folio: t.folio,
          fecha: new Date(t.fecha),
          vence: t.vence ? new Date(t.vence) : null,
          total: t.total,
          pagado: t.pagado,
          saldo: t.saldo,
          abierto: t.abierto,
          estatus: t.estatus,
          abonos_count: t.abonos_count,
          abonos_monto: t.abonos_monto,
          ultimo_pago_at: t.ultimo_pago_at ? new Date(t.ultimo_pago_at) : null,
          actualizado_at: ahora,
        };
        await tx.erpTicket.upsert({ where: { erp_nota_id: t.id }, update: data, create: { erp_nota_id: t.id, ...data } });
      }
      // Tickets que ya no vienen del ERP (cancelados, reabiertos…) salen de la foto
      await tx.erpTicket.deleteMany({
        where: { cliente_id: { in: clienteIds }, erp_nota_id: { notIn: tickets.map((t) => t.id) } },
      });
      await tx.erpLink.updateMany({ where: { cliente_id: { in: clienteIds } }, data: { tickets_at: ahora } });
    });
  }

  // ── Sincronizar saldo: igualar el saldo del CRM al del ERP ─────────────
  async sincronizarSaldo(u: AuthUser, clienteId: string) {
    const link = await this.linkDe(u, clienteId);
    const [saldo] = await this.erp.saldos([link.erp_cliente_id]); // fuera de la transacción: no se retiene el candado durante la llamada
    if (!saldo) throw new NotFoundException('El cliente ya no existe en el ERP.');
    return this.aplicarSync(u, link.cliente_id, saldo);
  }

  async sincronizarSaldos(u: AuthUser, clienteIds: string[]) {
    const unicos = [...new Set(clienteIds)];
    if (unicos.length === 0) throw new BadRequestException('Elige al menos un cliente.');
    if (unicos.length > 100) throw new BadRequestException('Máximo 100 clientes por vez.');
    const links = await Promise.all(unicos.map((id) => this.linkDe(u, id)));
    const saldos = await this.erp.saldos(links.map((l) => l.erp_cliente_id));
    const porErp = new Map(saldos.map((s) => [s.id, s]));
    const resultados: { cliente_id: string; ok: boolean; movimiento_id?: string; delta?: number; error?: string }[] = [];
    for (const l of links) {
      const s = porErp.get(l.erp_cliente_id);
      if (!s) {
        resultados.push({ cliente_id: l.cliente_id, ok: false, error: 'No existe en el ERP' });
        continue;
      }
      try {
        const r = await this.aplicarSync(u, l.cliente_id, s);
        resultados.push({ cliente_id: l.cliente_id, ok: true, movimiento_id: r.movimiento?.id, delta: r.delta });
      } catch (e) {
        resultados.push({ cliente_id: l.cliente_id, ok: false, error: (e as Error).message });
      }
    }
    return {
      sincronizados: resultados.filter((r) => r.ok && r.movimiento_id).length,
      sin_cambio: resultados.filter((r) => r.ok && !r.movimiento_id).length,
      con_error: resultados.filter((r) => !r.ok).length,
      resultados,
    };
  }

  /** Deja el saldo MXN del cliente igual al del ERP y registra el movimiento SINCRONIZACION. */
  private async aplicarSync(u: AuthUser, clienteId: string, erp: ErpSaldo) {
    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } });
      await tx.saldoCliente.upsert({
        where: { cliente_id_moneda: { cliente_id: clienteId, moneda: 'MXN' } },
        update: {},
        create: { cliente_id: clienteId, moneda: 'MXN', saldo: 0 },
      });
      const rows = await tx.$queryRaw<{ saldo: Prisma.Decimal }[]>`
        SELECT saldo FROM saldos_cliente WHERE cliente_id = ${clienteId} AND moneda = 'MXN' FOR UPDATE`;
      const antes = D(rows[0].saldo);
      const objetivo = D(erp.saldo_pendiente).toDecimalPlaces(2);
      const delta = objetivo.sub(antes);

      await tx.erpLink.update({
        where: { cliente_id: clienteId },
        data: {
          saldo_erp: objetivo,
          limite_credito_erp: erp.limite_credito,
          saldo_erp_at: ahora,
          saldo_sincronizado_at: ahora,
        },
      });

      if (delta.abs().lt('0.005')) return { movimiento: null, delta: 0, saldo_antes: Number(antes), saldo_despues: Number(antes) };

      await tx.saldoCliente.update({ where: { cliente_id_moneda: { cliente_id: clienteId, moneda: 'MXN' } }, data: { saldo: objetivo } });
      const mov = await tx.movimiento.create({
        data: {
          organizacion_id: u.organizacion_id,
          ubicacion_id: cliente.ubicacion_id,
          cliente_id: clienteId,
          tipo: 'SINCRONIZACION',
          motivo: 'OTRO',
          categoria_otro: 'Sincronización',
          concepto: `Sincronización de saldo con el ERP (${antes.toFixed(2)} → ${objetivo.toFixed(2)})`,
          moneda: 'MXN',
          monto: delta.abs(),
          tipo_cambio: 1,
          monto_mxn: delta.abs(),
          signo: delta.gt(0) ? 1 : -1,
          saldo_antes: antes,
          saldo_despues: objetivo,
          saldo_erp: objetivo,
          fecha_movimiento: ahora,
          estatus: 'CONFIRMADO',
          confirmado_at: ahora,
          confirmado_por_id: u.id,
          usuario_id: u.id,
        },
      });
      await tx.auditLog.create({
        data: {
          usuario_id: u.id,
          entidad: 'Movimiento',
          entidad_id: mov.id,
          accion: 'SYNC_ERP',
          antes: { saldo: antes.toString() } as never,
          despues: { saldo: objetivo.toString() } as never,
        },
      });
      return { movimiento: mov, delta: Number(delta), saldo_antes: Number(antes), saldo_despues: Number(objetivo) };
    });
  }

  // ── Ventas del cliente y detalle de una venta (solo lectura) ───────────
  /** Todas las ventas del cliente, leídas en vivo del ERP. */
  async ventasDeCliente(u: AuthUser, clienteId: string, q: Record<string, string | undefined>) {
    const link = await this.linkDe(u, clienteId);
    return this.erp.ventasCliente(link.erp_cliente_id, this.filtroVentas(q));
  }

  private filtroVentas(q: Record<string, string | undefined>): ErpVentasFiltro {
    return {
      page: Number(q.page) || 1,
      limit: Math.min(100, Number(q.limit) || 25),
      estatus: q.estatus,
      tipo: q.tipo,
      desde: q.desde,
      hasta: q.hasta,
      q: q.q,
    };
  }

  /** CSV con todas las ventas del filtro (hasta 5,000). */
  async ventasCsv(u: AuthUser, clienteId: string, q: Record<string, string | undefined>) {
    const link = await this.linkDe(u, clienteId);
    const filas: Awaited<ReturnType<ErpClient['ventasCliente']>>['items'] = [];
    for (let page = 1; page <= 50; page++) {
      const r = await this.erp.ventasCliente(link.erp_cliente_id, { ...this.filtroVentas(q), page, limit: 100 });
      filas.push(...r.items);
      if (page * 100 >= r.total) break;
    }
    const esc = (v: unknown) => {
      let t = String(v ?? '');
      if (/^[=+\-@]/.test(t)) t = `'${t}`;
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const f = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
    const head = ['Ubicación', 'Folio', 'Fecha', 'Tipo', 'Estatus en el ERP', 'Total', 'Pagado', 'Saldo', 'Formas de pago', 'Pagos', 'Liquidada el', 'Días para liquidar', 'Vence', 'Cancelada el', 'Motivo de cancelación', 'Vendedor'];
    const rows = filas.map((v) => [
      v.ubicacion, v.folio, f(v.fecha), v.tipo === 'CREDITO' ? 'Crédito' : 'Contado', v.estatus, v.total.toFixed(2), v.pagado.toFixed(2), v.saldo.toFixed(2),
      v.metodos.join(' + '), v.pagos_count, f(v.liquidada_at), v.dias_a_liquidar ?? '', f(v.vence), f(v.cancelada_at), v.motivo_cancelacion ?? '', v.vendedor ?? '',
    ]);
    return '\uFEFF' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  }

  /**
   * La venta debe ser de un cliente ligado al CRM y dentro del alcance del usuario. Si el ticket está en la
   * foto de crédito se usa; si no (venta de contado, pagada, cancelada…) se confirma por el cliente del ERP.
   */
  private async autorizarVenta(u: AuthUser, erpNotaId: string, detalle?: ErpVentaDetalle) {
    const ub = await this.acceso.filtro(u);
    const clienteSel = { id: true, nombre: true, apellidos: true, razon_social: true, ubicacion: { select: { id: true, nombre: true } } };
    const cache = await this.prisma.erpTicket.findFirst({
      where: { erp_nota_id: erpNotaId, cliente: { organizacion_id: u.organizacion_id, ...(ub ? { ubicacion_id: ub } : {}) } },
      include: { cliente: { select: clienteSel } },
    });
    if (cache) return { ticket: cache as { cliente: typeof cache.cliente }, cliente: cache.cliente, detalle };

    const det = detalle ?? (await this.erp.ventaDetalle(erpNotaId));
    const erpClienteId = det.cliente?.id;
    const link = erpClienteId
      ? await this.prisma.erpLink.findFirst({
          where: { erp_cliente_id: erpClienteId, cliente: { organizacion_id: u.organizacion_id, ...(ub ? { ubicacion_id: ub } : {}) } },
          include: { cliente: { select: clienteSel } },
        })
      : null;
    if (!link) throw new NotFoundException('Venta no encontrada');
    return { ticket: { cliente: link.cliente }, cliente: link.cliente, detalle: det };
  }

  /**
   * Información completa de la venta: lo leído en vivo del ERP (productos, pagos, comprobantes)
   * más lo que el CRM tiene registrado contra ella. Solo lectura.
   */
  async ventaDetalle(u: AuthUser, erpNotaId: string) {
    const auth = await this.autorizarVenta(u, erpNotaId);
    const [erp, refs] = await Promise.all([
      auth.detalle ?? this.erp.ventaDetalle(erpNotaId),
      this.prisma.movimientoVentaRef.findMany({
        where: { erp_venta_id: erpNotaId, movimiento: { organizacion_id: u.organizacion_id } },
        include: {
          movimiento: {
            select: {
              id: true,
              folio: true,
              tipo: true,
              metodo: true,
              estatus: true,
              moneda: true,
              monto: true,
              referencia: true,
              fecha_movimiento: true,
              cuenta_destino: { select: { alias: true, tipo: true } },
              comprobantes: { select: { id: true } },
            },
          },
        },
        orderBy: { movimiento: { fecha_movimiento: 'desc' } },
      }),
    ]);
    return {
      ticket: auth.ticket,
      erp,
      crm: refs.map((r) => ({ ...r.movimiento, monto_aplicado: r.monto_aplicado })),
    };
  }

  /** Comprobante guardado en el ERP, entregado a través del CRM (el navegador nunca ve la API key). */
  async evidencia(u: AuthUser, erpNotaId: string, evidenciaId: string) {
    await this.autorizarVenta(u, erpNotaId);
    return this.erp.evidencia(erpNotaId, evidenciaId);
  }

  /** Movimientos de la cuenta del cliente en el ERP (cargos, abonos y ajustes), en vivo. */
  async movimientosErp(u: AuthUser, clienteId: string) {
    const link = await this.linkDe(u, clienteId);
    return this.erp.movimientos(link.erp_cliente_id);
  }

  private async linkDe(u: AuthUser, clienteId: string) {
    const ub = await this.acceso.filtro(u);
    const link = await this.prisma.erpLink.findFirst({
      where: { cliente_id: clienteId, cliente: { organizacion_id: u.organizacion_id, ...(ub ? { ubicacion_id: ub } : {}) } },
    });
    if (!link) throw new NotFoundException('Este cliente no está ligado con el ERP.');
    return link;
  }
}
