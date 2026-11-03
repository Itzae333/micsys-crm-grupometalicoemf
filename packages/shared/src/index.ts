import { z } from 'zod';

export const APP_NAME = 'Cauce';
export const APP_TAGLINE = 'Cada peso, en su cauce.';
export const MONEDA_BASE = 'MXN';

// ── Enums (espejo de Prisma, sin depender del cliente generado) ──────────────
export const TIPOS_MOVIMIENTO = [
  'CARGO',
  'SINCRONIZACION',
  'COBRO',
  'ABONO',
  'DEPOSITO',
  'TRANSFERENCIA',
  'RETIRO',
  'AJUSTE',
] as const;
export const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'OTRO'] as const;
export const ESTATUS = ['PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'CANCELADO'] as const;
export const MOTIVOS = ['VENTA', 'OTRO'] as const;
export const TIPOS_CUENTA_DESTINO = ['EMPRESA', 'EJECUTIVO'] as const;

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];
export type MetodoMovimiento = (typeof METODOS)[number];
export type EstatusMovimiento = (typeof ESTATUS)[number];
export type TipoCuentaDestino = (typeof TIPOS_CUENTA_DESTINO)[number];

/** Movimientos que son dinero recibido: exigen cuenta destino. */
export const TIPOS_INGRESO: readonly TipoMovimiento[] = ['COBRO', 'ABONO', 'DEPOSITO', 'TRANSFERENCIA'];

export const TIPO_LABEL: Record<TipoMovimiento, string> = {
  CARGO: 'Cargo',
  SINCRONIZACION: 'Sincronización con el ERP',
  COBRO: 'Cobro',
  ABONO: 'Abono',
  DEPOSITO: 'Depósito',
  TRANSFERENCIA: 'Transferencia',
  RETIRO: 'Retiro / devolución',
  AJUSTE: 'Ajuste',
};

/**
 * Efecto sobre el saldo del cliente (positivo = el cliente debe).
 * AJUSTE y SINCRONIZACION traen su propio signo (+1 / -1); el resto lo define el tipo.
 */
export function signoSaldo(tipo: TipoMovimiento, signo = 0): 1 | -1 {
  if (tipo === 'AJUSTE' || tipo === 'SINCRONIZACION') return signo < 0 ? -1 : 1;
  return TIPOS_INGRESO.includes(tipo) ? -1 : 1;
}

// ── Helpers de dinero ────────────────────────────────────────────────────────
const SIMBOLOS: Record<string, string> = { MXN: '$', USD: 'US$', EUR: '€' };
export function simboloMoneda(codigo: string) {
  return SIMBOLOS[codigo] ?? codigo + ' ';
}
export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );
}

// ── Schemas ──────────────────────────────────────────────────────────────────
const dec = z.coerce.number().positive('El monto debe ser mayor a cero').max(999_999_999_999);
const opt = z.string().trim().optional().nullable().transform((v) => (v ? v : null));

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

export const clienteSchema = z.object({
  ubicacion_id: z.string().min(1, 'Elige la ubicación del cliente'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  apellidos: opt,
  razon_social: opt,
  rfc: opt,
  telefono: opt,
  email: z.string().trim().email('Correo inválido').optional().nullable().or(z.literal('')).transform((v) => v || null),
  direccion: opt,
  notas: opt,
  etiquetas: z.array(z.string().trim().min(1)).default([]),
});

export const cuentaClienteSchema = z.object({
  banco: z.string().trim().min(1, 'Indica el banco'),
  clabe: opt,
  numero: opt,
  titular: opt,
  alias: opt,
});

export const ejecutivoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  telefono: opt,
});

export const cuentaDestinoSchema = z
  .object({
    tipo: z.enum(TIPOS_CUENTA_DESTINO),
    ejecutivo_id: z.string().optional().nullable(),
    alias: z.string().trim().min(1, 'Ponle un alias a la cuenta'),
    banco: z.string().trim().min(1, 'Indica el banco'),
    clabe: opt,
    numero: opt,
    titular: opt,
    moneda: z.string().trim().toUpperCase().length(3).default('MXN'),
    notas: opt,
  })
  .refine((v) => v.tipo !== 'EJECUTIVO' || !!v.ejecutivo_id, {
    message: 'Elige el ejecutivo dueño de la cuenta',
    path: ['ejecutivo_id'],
  });

export const tipoCambioSchema = z.object({
  moneda: z.string().trim().toUpperCase().length(3),
  valor: z.coerce.number().positive(),
  fecha: z.string().optional(),
});

export const ventaRefSchema = z.object({
  erp_venta_id: z.string().min(1),
  erp_empresa: z.string().optional().nullable(),
  folio: z.string().optional().nullable(),
  monto_aplicado: dec,
});

export const movimientoSchema = z
  .object({
    cliente_id: z.string().min(1, 'Elige el cliente'),
    tipo: z.enum(TIPOS_MOVIMIENTO),
    metodo: z.enum(METODOS).optional().nullable(),
    motivo: z.enum(MOTIVOS).default('OTRO'),
    categoria_otro: opt,
    concepto: z.string().trim().min(1, 'Escribe el concepto'),
    referencia: opt,
    cuenta_destino_id: z.string().optional().nullable(),
    cuenta_cliente_id: z.string().optional().nullable(),
    monto: dec,
    moneda: z.string().trim().toUpperCase().length(3).optional(),
    tipo_cambio: z.coerce.number().positive().optional(),
    fecha_movimiento: z.string().min(1, 'Indica la fecha'),
    confirmar: z.boolean().default(false),
    ventas: z.array(ventaRefSchema).default([]),
  })
  .superRefine((v, ctx) => {
    if (TIPOS_INGRESO.includes(v.tipo) && !v.cuenta_destino_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['cuenta_destino_id'],
        message: '¿En qué cuenta se recibió el dinero?',
      });
    }
    if (v.motivo === 'VENTA' && v.ventas.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['ventas'], message: 'Elige al menos una venta del ERP' });
    }
    const aplicado = v.ventas.reduce((a, x) => a + x.monto_aplicado, 0);
    if (aplicado > v.monto + 0.001) {
      ctx.addIssue({
        code: 'custom',
        path: ['ventas'],
        message: `El monto aplicado (${formatMoney(aplicado)}) supera el monto recibido (${formatMoney(v.monto)}).`,
      });
    }
  });

export const empresaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre de la empresa es obligatorio'),
});

export const ubicacionSchema = z.object({
  empresa_id: z.string({ required_error: 'Elige la empresa' }).min(1, 'Elige la empresa'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  tipo: z.enum(['MATRIZ', 'FABRICA', 'PUNTO_VENTA']).optional().nullable(),
});

// ── Usuarios y roles ─────────────────────────────────────────────────────────
export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'CONSULTA'] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<Rol, string> = {
  SUPER_ADMIN: 'Super usuario',
  ADMIN: 'Administrador',
  OPERADOR: 'Operador',
  CONSULTA: 'Solo consulta',
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  SUPER_ADMIN: 'Ve todas las ubicaciones, da de alta usuarios y decide a qué ubicaciones entra cada uno.',
  ADMIN: 'Opera todo (cuentas, cancelar y conciliar movimientos) dentro de las ubicaciones asignadas.',
  OPERADOR: 'Registra clientes, cobros y abonos, y sincroniza saldos en las ubicaciones asignadas.',
  CONSULTA: 'Solo ve información de las ubicaciones asignadas. No cambia nada.',
};

const passwordCampo = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128, 'La contraseña es demasiado larga');

const ubicacionesCampo = z.array(z.string()).default([]);

export const usuarioCrearSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    apellidos: opt,
    email: z.string().trim().toLowerCase().email('Correo inválido'),
    password: passwordCampo,
    rol: z.enum(ROLES),
    ubicacion_ids: ubicacionesCampo,
  })
  .refine((v) => v.rol === 'SUPER_ADMIN' || v.ubicacion_ids.length > 0, {
    message: 'Asigna al menos una ubicación',
    path: ['ubicacion_ids'],
  });

export const usuarioEditarSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    apellidos: opt,
    rol: z.enum(ROLES),
    activo: z.boolean().optional(),
    ubicacion_ids: ubicacionesCampo,
  })
  .refine((v) => v.rol === 'SUPER_ADMIN' || v.ubicacion_ids.length > 0, {
    message: 'Asigna al menos una ubicación',
    path: ['ubicacion_ids'],
  });

export const passwordSchema = z.object({ password: passwordCampo });

export const motivoSchema = z.object({ motivo: z.string().trim().min(3, 'Indica el motivo') });

export type UsuarioCrearInput = z.infer<typeof usuarioCrearSchema>;
export type UsuarioEditarInput = z.infer<typeof usuarioEditarSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ClienteInput = z.infer<typeof clienteSchema>;
export type CuentaClienteInput = z.infer<typeof cuentaClienteSchema>;
export type EjecutivoInput = z.infer<typeof ejecutivoSchema>;
export type CuentaDestinoInput = z.infer<typeof cuentaDestinoSchema>;
export type MovimientoInput = z.input<typeof movimientoSchema>;
