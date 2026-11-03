import type { EstatusMovimiento, MetodoMovimiento, TipoCuentaDestino, TipoMovimiento } from '@micsys-crm/shared';

export type EstatusMovimientoLike = EstatusMovimiento;

// Prisma serializa Decimal como string
export type Dec = string | number;

export interface UsuarioFila {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  rol: 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR' | 'CONSULTA';
  activo: boolean;
  ultimo_acceso: string | null;
  created_at: string;
  ubicaciones: { id: string; nombre: string }[];
}

export interface Me {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  rol: 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR' | 'CONSULTA';
  organizacion: { id: string; nombre: string; moneda_base: string };
  acceso_total: boolean;
  ubicaciones: { id: string; nombre: string }[];
}

export interface Saldo {
  moneda: string;
  saldo: Dec;
}

export interface Ubicacion {
  id: string;
  nombre: string;
  tipo?: string | null;
  erp_ubicacion_id?: string | null;
  activa?: boolean;
  _count?: { clientes: number };
}

export interface ErpLinkInfo {
  erp_cliente_id: string;
  saldo_erp: Dec;
  limite_credito_erp?: Dec;
  saldo_erp_at: string | null;
  saldo_sincronizado_at: string | null;
  tickets_at?: string | null;
}

export interface Cliente {
  id: string;
  ubicacion_id: string;
  ubicacion?: { id: string; nombre: string };
  nombre: string;
  apellidos: string | null;
  razon_social: string | null;
  rfc: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  etiquetas: string[];
  origen: 'MANUAL' | 'ERP';
  activo: boolean;
  saldos: Saldo[];
  erp_link?: ErpLinkInfo | null;
  _count?: { movimientos: number };
}

export interface CuentaCliente {
  id: string;
  banco: string;
  clabe: string | null;
  numero: string | null;
  titular: string | null;
  alias: string | null;
  activa: boolean;
}

export interface ClienteDetalle extends Cliente {
  cuentas: CuentaCliente[];
  resumen: {
    cobrado_mxn: Dec;
    ultimo_movimiento: string | null;
    pendientes: number;
    pendientes_mxn: Dec;
    movimientos: number;
    tickets_abiertos: number;
    tickets_saldo: Dec;
    tickets_reabiertos: number;
    tickets_reabiertos_saldo: Dec;
  };
}

export interface Ejecutivo {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  _count?: { cuentas: number };
}

export interface CuentaDestino {
  id: string;
  tipo: TipoCuentaDestino;
  alias: string;
  banco: string;
  clabe: string | null;
  numero: string | null;
  titular: string | null;
  moneda: string;
  activa: boolean;
  notas: string | null;
  ejecutivo_id: string | null;
  ejecutivo: { id: string; nombre: string } | null;
  _count?: { movimientos: number };
}

export interface Moneda {
  id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  tipo_cambio: { valor: Dec; fecha: string | null } | null;
}

export interface EmpresaGrupo {
  id: string;
  nombre: string;
}

export interface VentaRef {
  id?: string;
  erp_venta_id: string;
  erp_empresa?: string | null;
  folio?: string | null;
  monto_aplicado: Dec;
  moneda?: string;
}

export interface Movimiento {
  id: string;
  folio: number;
  tipo: TipoMovimiento;
  metodo: MetodoMovimiento | null;
  motivo: 'VENTA' | 'OTRO';
  categoria_otro: string | null;
  concepto: string;
  referencia: string | null;
  moneda: string;
  monto: Dec;
  tipo_cambio: Dec;
  monto_mxn: Dec;
  saldo_antes: Dec;
  saldo_despues: Dec;
  fecha_movimiento: string;
  estatus: EstatusMovimiento;
  motivo_cancelacion: string | null;
  created_at: string;
  cliente: { id: string; nombre: string; apellidos: string | null; razon_social: string | null };
  cuenta_destino: {
    id: string;
    alias: string;
    banco: string;
    tipo: TipoCuentaDestino;
    moneda: string;
    ejecutivo: { id: string; nombre: string } | null;
  } | null;
  cuenta_cliente: { id: string; banco: string; alias: string | null } | null;
  empresa_grupo: { id: string; nombre: string } | null;
  ventas: VentaRef[];
  comprobantes: { id: string; nombre: string; mime: string; tamano: number }[];
  conciliacion: { conciliado: boolean } | null;
  signo: number;
  ubicacion: { id: string; nombre: string };
}

export interface MovimientosPage {
  total: number;
  page: number;
  limit: number;
  items: Movimiento[];
  totales: { moneda: string; monto: Dec; monto_mxn: Dec; movimientos: number }[];
}

export interface Dashboard {
  kpis: {
    hoy: { monto_mxn: number; movimientos: number };
    mes: { monto_mxn: number; movimientos: number; mes_anterior_mxn: number; variacion_pct: number | null };
    por_confirmar: { monto_mxn: number; movimientos: number };
    por_cobrar: {
      monto_mxn: number;
      por_moneda: { moneda: string; saldo: number; clientes: number; saldo_mxn: number; sin_tipo_cambio: boolean }[];
    };
    clientes_activos: number;
    promedio_por_movimiento_mxn: number;
  };
  serie: { fecha: string; monto_mxn: number; movimientos: number; es_hoy: boolean }[];
  destino: {
    total_mxn: number;
    empresa: { monto_mxn: number; pct: number };
    ejecutivo: { monto_mxn: number; pct: number };
    cuentas: {
      cuenta_id: string;
      alias: string;
      banco: string;
      tipo: TipoCuentaDestino;
      ejecutivo: string | null;
      monto_mxn: number;
      movimientos: number;
      pct: number;
    }[];
  };
  divisas: { moneda: string; monto: number; monto_mxn: number; movimientos: number; pct: number }[];
  metodos: { metodo: string; monto_mxn: number; movimientos: number; pct: number }[];
  top_clientes: { cliente_id: string; nombre: string; monto_mxn: number; movimientos: number; pct: number }[];
  por_confirmar: Movimiento[];
  recientes: Movimiento[];
}

export interface Ticket {
  id: string;
  erp_nota_id: string;
  cliente_id: string;
  folio: number;
  fecha: string;
  vence: string | null;
  total: Dec;
  pagado: Dec;
  saldo: Dec;
  abierto: boolean;
  vencido: boolean;
  dias_vencido: number;
  estatus: string;
  abonos_count: number;
  abonos_monto: Dec;
  ultimo_pago_at: string | null;
  actualizado_at: string;
  aplicado_crm: number;
  avance_pct: number;
  /** false en las ventas reabiertas: el ERP aún no se las cobra al cliente */
  cuenta_en_saldo: boolean;
  cliente: { id: string; nombre: string; apellidos: string | null; razon_social: string | null; ubicacion: { id: string; nombre: string } };
}

export interface TicketsPage {
  total: number;
  page: number;
  limit: number;
  items: Ticket[];
  totales: { total: number; pagado: number; saldo: number; vencidos: number; saldo_vencido: number; reabiertas: number; saldo_reabiertas: number };
}

export interface ErpClienteItem {
  id: string;
  ubicacion_id: string;
  ubicacion: string;
  nombre: string;
  apellidos: string | null;
  razon_social: string | null;
  rfc: string | null;
  telefono: string | null;
  limite_credito: number;
  saldo_pendiente: number;
  cliente_crm_id: string | null;
}

export interface ErpMovimiento {
  id: string;
  tipo: string;
  monto: number;
  saldo_antes: number;
  saldo_despues: number;
  concepto: string;
  fecha: string;
}

export interface ReporteCredito {
  generado: string;
  kpis: {
    clientes_vinculados: number;
    clientes_con_tickets: number;
    clientes_con_credito_abierto: number;
    clientes_sin_credito: number;
    tickets_abiertos: number;
    tickets_vencidos: number;
    saldo_tickets_abiertos: number;
    saldo_vencido: number;
    saldo_erp_total: number;
    saldo_crm_total: number;
    diferencia_total: number;
    clientes_desincronizados: number;
    clientes_desactualizados: number;
    tickets_reabiertos: number;
    saldo_reabiertos: number;
    clientes_saldo_sin_ticket: number;
    saldo_sin_ticket: number;
  };
  antiguedad: { key: string; label: string; saldo: number; tickets: number }[];
  por_ubicacion: { id: string; nombre: string; vinculados: number; con_credito: number; tickets: number; saldo: number; saldo_erp: number; saldo_crm: number }[];
  top_deudores: FilaSaldo[];
  desincronizados: FilaSaldo[];
  sin_ticket: (FilaSaldo & { sin_ticket: number })[];
}

export interface FilaSaldo {
  cliente_id: string;
  nombre: string;
  ubicacion: string;
  saldo_erp: number;
  saldo_crm: number;
  saldo_tickets: number;
  diferencia: number;
  saldo_erp_at: string | null;
  saldo_sincronizado_at: string | null;
}

export interface ReporteCobranza {
  periodo: { desde: string; hasta: string };
  kpis: {
    cobrado_mxn: number;
    movimientos: number;
    clientes_que_pagaron: number;
    promedio_mxn: number;
    pendientes: number;
    pendientes_mxn: number;
    aplicado_a_tickets_mxn: number;
    movimientos_ligados_a_tickets: number;
    clientes_con_credito_abierto: number;
    clientes_con_credito_sin_pago: number;
    sincronizaciones: number;
    sincronizacion_neta_mxn: number;
  };
  por_tipo: { tipo: string; monto_mxn: number; movimientos: number; pct: number }[];
  por_cuenta: { cuenta_id: string; alias: string; tipo: 'EMPRESA' | 'EJECUTIVO'; ejecutivo: string | null; monto_mxn: number; movimientos: number; pct: number }[];
  por_ubicacion: { id: string; nombre: string; monto_mxn: number; movimientos: number }[];
  serie: { fecha: string; monto_mxn: number; movimientos: number }[];
  sin_pago: { cliente_id: string; nombre: string; ubicacion: string; tickets: number; saldo: number }[];
}

export interface VentaFila {
  id: string;
  folio: number;
  ubicacion: string;
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

export interface VentasPage {
  total: number;
  page: number;
  limit: number;
  items: VentaFila[];
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
