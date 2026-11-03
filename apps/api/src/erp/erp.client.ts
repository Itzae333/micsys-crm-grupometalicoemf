import { BadGatewayException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export interface ErpUbicacion {
  id: string;
  nombre: string;
  tipo?: string | null;
  empresa_id: string;
  empresa: string;
}

export interface ErpCliente {
  id: string;
  ubicacion_id: string;
  ubicacion: string;
  empresa_id: string;
  empresa: string;
  nombre: string;
  apellidos: string | null;
  razon_social: string | null;
  rfc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  limite_credito: number;
  saldo_pendiente: number;
}

export interface ErpSaldo {
  id: string;
  saldo_pendiente: number;
  limite_credito: number;
}

export interface ErpTicketDto {
  id: string;
  cliente_id: string;
  ubicacion_id: string;
  ubicacion: string;
  folio: number;
  fecha: string;
  vence: string | null;
  total: number;
  pagado: number;
  saldo: number;
  abierto: boolean;
  vencido: boolean;
  estatus: string;
  abonos_count: number;
  abonos_monto: number;
  ultimo_pago_at: string | null;
}

export interface ErpMovimientoDto {
  id: string;
  tipo: string;
  monto: number;
  saldo_antes: number;
  saldo_despues: number;
  concepto: string;
  fecha: string;
}

export interface ErpVentaDetalle {
  id: string;
  folio: number;
  ubicacion: string;
  ubicacion_id: string;
  estatus: string;
  es_credito: boolean;
  fecha: string;
  vence: string | null;
  cerrada_at: string | null;
  observaciones: string | null;
  cliente: { id: string; nombre: string; apellidos: string | null; razon_social: string | null; rfc: string | null; telefono: string | null } | null;
  vendedor: string | null;
  subtotal: number;
  descuento: number;
  aplica_iva: boolean;
  iva: number;
  total: number;
  pagado: number;
  saldo: number;
  lineas: { clave: string; descripcion: string; cantidad: number; precio_unitario: number; descuento: number; subtotal: number }[];
  pagos: { id: string; fecha: string; metodo: string; monto: number; referencia: string | null; registrado_por: string | null; tipo: 'ABONO' | 'AL_CIERRE' }[];
  movimientos_cuenta: ErpMovimientoDto[];
  evidencias: {
    id: string;
    tipo: string;
    descripcion: string | null;
    fecha: string;
    tiene_archivo: boolean;
    mime: string | null;
    tamano_aprox: number | null;
    archivo_url: string | null;
  }[];
}

export interface ErpVentaFila {
  id: string;
  folio: number;
  ubicacion: string;
  ubicacion_id: string;
  fecha: string;
  cerrada_at: string | null;
  estatus: string;
  tipo: 'CREDITO' | 'CONTADO';
  total: number;
  pagado: number;
  saldo: number;
  vence: string | null;
  productos: number;
  metodos: string[];
  pagos_count: number;
  abonos_count: number;
  primer_pago_at: string | null;
  ultimo_pago_at: string | null;
  liquidada_at: string | null;
  dias_a_liquidar: number | null;
  cancelada_at: string | null;
  motivo_cancelacion: string | null;
  vendedor: string | null;
}

export interface ErpVentasPage {
  cliente: { id: string; nombre: string; apellidos: string | null; razon_social: string | null };
  total: number;
  page: number;
  limit: number;
  items: ErpVentaFila[];
  por_estatus: Record<string, number>;
  resumen: {
    ventas: number;
    vendido: number;
    pagado: number;
    por_cobrar: number;
    ticket_promedio: number;
    primera_venta: string | null;
    ultima_venta: string | null;
  };
}

export interface ErpVentasFiltro {
  page?: number;
  limit?: number;
  estatus?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  q?: string;
}

/** Cliente HTTP del ERP. Solo GET: el CRM nunca escribe en el ERP. */
@Injectable()
export class ErpClient {
  get habilitado() {
    return process.env.ERP_INTEGRATION_ENABLED === 'true' && !!process.env.ERP_API_URL && !!process.env.ERP_API_KEY;
  }

  private async pedir(ruta: string, params: Record<string, string | number | undefined> = {}): Promise<Response> {
    if (!this.habilitado) throw new ServiceUnavailableException('La integración con el ERP no está activada.');
    const url = new URL(`${process.env.ERP_API_URL!.replace(/\/$/, '')}/integracion/${ruta}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'x-api-key': process.env.ERP_API_KEY!, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con el ERP. El CRM sigue funcionando; intenta de nuevo en un momento.');
    }
    if (res.status === 401) throw new BadGatewayException('El ERP rechazó la API key del CRM. Revisa ERP_API_KEY.');
    if (res.status === 503) throw new BadGatewayException('La integración no está activada en el ERP.');
    if (res.status === 404) {
      const msg = await res.json().then((j) => String((j as { message?: unknown }).message ?? '')).catch(() => '');
      // Ruta que el ERP desplegado todavía no tiene (ERP desactualizado) vs. registro inexistente
      if (/^Cannot GET/i.test(msg)) {
        throw new BadGatewayException('Tu ERP aún no tiene esta consulta. Despliega la última versión del ERP e inténtalo de nuevo.');
      }
      throw new NotFoundException('El ERP no encontró ese registro.');
    }
    if (!res.ok) throw new BadGatewayException(`El ERP respondió ${res.status}.`);
    return res;
  }

  private async get<T>(ruta: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    return (await (await this.pedir(ruta, params)).json()) as T;
  }

  ubicaciones() {
    return this.get<ErpUbicacion[]>('ubicaciones');
  }

  clientes(q: { ubicacion_id?: string; empresa_id?: string; search?: string; page?: number; limit?: number; ids?: string[]; con_saldo?: boolean }) {
    return this.get<{ total: number; page: number; limit: number; items: ErpCliente[] }>('clientes', {
      ubicacion_id: q.ubicacion_id,
      empresa_id: q.empresa_id,
      search: q.search,
      page: q.page,
      limit: q.limit,
      ids: q.ids?.join(','),
      con_saldo: q.con_saldo ? 'true' : undefined,
    });
  }

  saldos(ids: string[]) {
    return this.get<ErpSaldo[]>('clientes/saldos', { ids: ids.join(',') });
  }

  tickets(clienteIds: string[], estatus: 'abiertos' | 'todos' = 'todos') {
    return this.get<ErpTicketDto[]>('tickets', { cliente_ids: clienteIds.join(','), estatus });
  }

  ventasCliente(erpClienteId: string, f: ErpVentasFiltro) {
    return this.get<ErpVentasPage>(`clientes/${encodeURIComponent(erpClienteId)}/ventas`, { ...f });
  }

  ventaDetalle(notaId: string) {
    return this.get<ErpVentaDetalle>(`tickets/${encodeURIComponent(notaId)}`);
  }

  /** Archivo de una evidencia (imagen o PDF). */
  async evidencia(notaId: string, evidenciaId: string) {
    const res = await this.pedir(`tickets/${encodeURIComponent(notaId)}/evidencias/${encodeURIComponent(evidenciaId)}`);
    return { mime: res.headers.get('content-type') ?? 'application/octet-stream', buffer: Buffer.from(await res.arrayBuffer()) };
  }

  movimientos(clienteId: string, limit = 100) {
    return this.get<ErpMovimientoDto[]>(`clientes/${encodeURIComponent(clienteId)}/movimientos`, { limit });
  }
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
