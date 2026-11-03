import { formatMoney, simboloMoneda } from '@micsys-crm/shared';
import type { Cliente, Dec } from './types';

export { formatMoney, simboloMoneda };

export const num = (v: Dec | null | undefined) => Number(v ?? 0);

const TZ = 'America/Mexico_City';

/** 03/11/2026 */
export function fmtFecha(iso: string | Date | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  );
}

/** martes 3 de noviembre */
export function fmtFechaLarga(d: Date | string = new Date()) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(d),
  );
}

/** 'YYYY-MM-DD' -> día corto para ejes (3 nov) */
export function fmtDiaCorto(ymd: string) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: 'numeric', month: 'short' })
    .format(new Date(`${ymd}T12:00:00-06:00`))
    .replace('.', '');
}

export function hoyYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function fmtHora(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
}

export function nombreCliente(c: Pick<Cliente, 'nombre' | 'apellidos' | 'razon_social'>) {
  return c.razon_social || [c.nombre, c.apellidos].filter(Boolean).join(' ');
}

/** Monto en pesos con signo correcto: $1,200.00 · −$1,200.00 (nunca "$-1,200.00"). */
export function fmtMonto(n: number) {
  const neg = n < 0 && Math.abs(n) >= 0.005;
  return `${neg ? '−' : ''}$${formatMoney(Math.abs(n))}`;
}

/** Compacto para ejes y KPIs grandes: $1.2 M */
export function compacto(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)} M`;
  if (a >= 1_000) return `$${(n / 1_000).toFixed(a >= 10_000 ? 0 : 1)} k`;
  return `$${n.toFixed(0)}`;
}

/** Hace cuánto se leyó algo: "hoy", "ayer", "hace 3 días". */
export function haceCuanto(iso: string | null | undefined) {
  if (!iso) return 'nunca';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h <= 0 ? 'hace unos minutos' : `hace ${h} h`;
  }
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

export const METODO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
  CHEQUE: 'Cheque',
  TARJETA: 'Tarjeta',
  ADMINISTRATIVO: 'Administrativo',
  OTRO: 'Otro',
};

/** Banco + últimos 4 dígitos. Nunca la CLABE completa en listas. */
export function cuentaCorta(banco: string, clabe?: string | null, numero?: string | null) {
  const src = (clabe || numero || '').replace(/\D/g, '');
  return src ? `${banco} •• ${src.slice(-4)}` : banco;
}
