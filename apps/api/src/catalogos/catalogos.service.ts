import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CuentaDestinoInput, EjecutivoInput } from '@micsys-crm/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth';
import { parseFecha } from '../common/fechas';
import { AccesoService } from '../common/acceso.service';

@Injectable()
export class CatalogosService {
  constructor(
    private prisma: PrismaService,
    private acceso: AccesoService,
  ) {}

  // ── Ubicaciones ────────────────────────────────────────────────────────
  async ubicaciones(u: AuthUser, todas = false) {
    const ids = await this.acceso.ids(u);
    return this.prisma.ubicacion.findMany({
      where: {
        organizacion_id: u.organizacion_id,
        ...(todas ? {} : { activa: true }),
        ...(ids ? { id: { in: ids } } : {}),
      },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { clientes: true } } },
    });
  }

  async crearUbicacion(u: AuthUser, dto: { nombre: string; tipo?: string | null }) {
    const existe = await this.prisma.ubicacion.findFirst({
      where: { organizacion_id: u.organizacion_id, nombre: { equals: dto.nombre, mode: 'insensitive' } },
    });
    if (existe) throw new BadRequestException(`Ya existe una ubicación llamada "${existe.nombre}".`);
    const ub = await this.prisma.ubicacion.create({
      data: { organizacion_id: u.organizacion_id, nombre: dto.nombre, tipo: dto.tipo ?? null },
    });
    await this.audit(u, 'Ubicacion', ub.id, 'CREATE', null, ub);
    return ub;
  }

  async actualizarUbicacion(u: AuthUser, id: string, dto: { nombre?: string; tipo?: string | null; activa?: boolean }) {
    const antes = await this.prisma.ubicacion.findFirst({ where: { id, organizacion_id: u.organizacion_id } });
    if (!antes) throw new NotFoundException('Ubicación no encontrada');
    const ub = await this.prisma.ubicacion.update({
      where: { id },
      data: {
        ...(dto.nombre ? { nombre: dto.nombre } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.activa !== undefined ? { activa: dto.activa } : {}),
      },
    });
    await this.audit(u, 'Ubicacion', id, 'UPDATE', antes, ub);
    return ub;
  }

  // ── Ejecutivos ─────────────────────────────────────────────────────────
  ejecutivos(u: AuthUser) {
    return this.prisma.ejecutivo.findMany({
      where: { organizacion_id: u.organizacion_id },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: { _count: { select: { cuentas: true } } },
    });
  }

  async crearEjecutivo(u: AuthUser, dto: EjecutivoInput) {
    const e = await this.prisma.ejecutivo.create({ data: { ...dto, organizacion_id: u.organizacion_id } });
    await this.audit(u, 'Ejecutivo', e.id, 'CREATE', null, e);
    return e;
  }

  async actualizarEjecutivo(u: AuthUser, id: string, dto: EjecutivoInput & { activo?: boolean }) {
    const antes = await this.prisma.ejecutivo.findFirst({ where: { id, organizacion_id: u.organizacion_id } });
    if (!antes) throw new NotFoundException('Ejecutivo no encontrado');
    const e = await this.prisma.ejecutivo.update({
      where: { id },
      data: { nombre: dto.nombre, telefono: dto.telefono, ...(dto.activo === undefined ? {} : { activo: dto.activo }) },
    });
    await this.audit(u, 'Ejecutivo', id, 'UPDATE', antes, e);
    return e;
  }

  // ── Cuentas destino ────────────────────────────────────────────────────
  cuentasDestino(u: AuthUser, soloActivas = false) {
    return this.prisma.cuentaDestino.findMany({
      where: { organizacion_id: u.organizacion_id, ...(soloActivas ? { activa: true } : {}) },
      orderBy: [{ activa: 'desc' }, { tipo: 'asc' }, { alias: 'asc' }],
      include: { ejecutivo: { select: { id: true, nombre: true } }, _count: { select: { movimientos: true } } },
    });
  }

  async crearCuentaDestino(u: AuthUser, dto: CuentaDestinoInput) {
    await this.validarEjecutivo(u, dto);
    const c = await this.prisma.cuentaDestino.create({
      data: {
        ...dto,
        ejecutivo_id: dto.tipo === 'EJECUTIVO' ? dto.ejecutivo_id : null,
        organizacion_id: u.organizacion_id,
      },
    });
    await this.audit(u, 'CuentaDestino', c.id, 'CREATE', null, c);
    return c;
  }

  async actualizarCuentaDestino(u: AuthUser, id: string, dto: CuentaDestinoInput) {
    const antes = await this.cuenta(u, id);
    await this.validarEjecutivo(u, dto);
    if (dto.moneda !== antes.moneda) {
      const usos = await this.prisma.movimiento.count({ where: { cuenta_destino_id: id } });
      if (usos > 0) {
        throw new BadRequestException(
          `La cuenta ya tiene ${usos} movimientos en ${antes.moneda}; no se puede cambiar su divisa. Da de alta una cuenta nueva.`,
        );
      }
    }
    const c = await this.prisma.cuentaDestino.update({
      where: { id },
      data: { ...dto, ejecutivo_id: dto.tipo === 'EJECUTIVO' ? dto.ejecutivo_id : null },
    });
    await this.audit(u, 'CuentaDestino', id, 'UPDATE', antes, c);
    return c;
  }

  /** Las cuentas no se borran: se dan de baja y conservan su historial. */
  async activarCuentaDestino(u: AuthUser, id: string, activa: boolean) {
    const antes = await this.cuenta(u, id);
    const c = await this.prisma.cuentaDestino.update({
      where: { id },
      data: { activa, fecha_baja: activa ? null : new Date() },
    });
    await this.audit(u, 'CuentaDestino', id, activa ? 'ACTIVATE' : 'DEACTIVATE', antes, c);
    return c;
  }

  // ── Divisas ────────────────────────────────────────────────────────────
  async monedas(u: AuthUser) {
    const monedas = await this.prisma.moneda.findMany({
      where: { organizacion_id: u.organizacion_id, activa: true },
      orderBy: { codigo: 'asc' },
      include: { tipos_cambio: { orderBy: { fecha: 'desc' }, take: 1 } },
    });
    return monedas.map(({ tipos_cambio, ...m }) => ({
      ...m,
      tipo_cambio: m.codigo === 'MXN' ? { valor: '1', fecha: null } : (tipos_cambio[0] ?? null),
    }));
  }

  async crearMoneda(u: AuthUser, dto: { codigo: string; nombre: string; simbolo: string }) {
    const codigo = dto.codigo?.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(codigo ?? '')) throw new BadRequestException('El código de moneda son 3 letras (ISO), por ejemplo USD.');
    return this.prisma.moneda.upsert({
      where: { organizacion_id_codigo: { organizacion_id: u.organizacion_id, codigo } },
      update: { activa: true, nombre: dto.nombre, simbolo: dto.simbolo },
      create: { organizacion_id: u.organizacion_id, codigo, nombre: dto.nombre, simbolo: dto.simbolo },
    });
  }

  async registrarTipoCambio(u: AuthUser, dto: { moneda: string; valor: number; fecha?: string }) {
    const m = await this.prisma.moneda.findUnique({
      where: { organizacion_id_codigo: { organizacion_id: u.organizacion_id, codigo: dto.moneda } },
    });
    if (!m) throw new NotFoundException(`La moneda ${dto.moneda} no está dada de alta.`);
    if (m.codigo === 'MXN') throw new BadRequestException('MXN es la moneda base; no lleva tipo de cambio.');
    const fecha = dto.fecha ? parseFecha(dto.fecha) : parseFecha(new Date().toISOString().slice(0, 10));
    return this.prisma.tipoCambio.upsert({
      where: { moneda_id_fecha: { moneda_id: m.id, fecha } },
      update: { valor: dto.valor, fuente: 'manual' },
      create: { moneda_id: m.id, fecha, valor: dto.valor, fuente: 'manual' },
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────
  private async cuenta(u: AuthUser, id: string) {
    const c = await this.prisma.cuentaDestino.findFirst({ where: { id, organizacion_id: u.organizacion_id } });
    if (!c) throw new NotFoundException('Cuenta no encontrada');
    return c;
  }

  private async validarEjecutivo(u: AuthUser, dto: CuentaDestinoInput) {
    if (dto.tipo !== 'EJECUTIVO') return;
    const e = await this.prisma.ejecutivo.findFirst({
      where: { id: dto.ejecutivo_id ?? '', organizacion_id: u.organizacion_id, activo: true },
    });
    if (!e) throw new BadRequestException('El ejecutivo elegido no existe o está inactivo.');
  }

  private audit(u: AuthUser, entidad: string, entidad_id: string, accion: string, antes: unknown, despues: unknown) {
    return this.prisma.auditLog.create({
      data: { usuario_id: u.id, entidad, entidad_id, accion, antes: antes as never, despues: despues as never },
    });
  }
}
