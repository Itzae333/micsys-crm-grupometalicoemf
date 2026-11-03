import { Ban, Building2, CircleCheck, CircleX, Clock, UserRound } from 'lucide-react';
import type { EstatusMovimiento, TipoCuentaDestino } from '@micsys-crm/shared';
import { formatMoney, simboloMoneda } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS = {
  PENDIENTE: { label: 'Pendiente', Icon: Clock, cls: 'bg-warning-soft text-warning-text' },
  CONFIRMADO: { label: 'Confirmado', Icon: CircleCheck, cls: 'bg-success-soft text-success-text' },
  RECHAZADO: { label: 'Rechazado', Icon: CircleX, cls: 'bg-danger-soft text-danger-text' },
  CANCELADO: { label: 'Cancelado', Icon: Ban, cls: 'bg-canceled-soft text-canceled-text' },
} as const;

/** Siempre icono + texto + color. Nunca solo un punto de color. */
export function StatusBadge({ status }: { status: EstatusMovimiento }) {
  const { label, Icon, cls } = STATUS[status];
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1.5 rounded-sm pl-1.5 pr-2 text-xs font-medium', cls)}>
      <Icon className="size-3.5" strokeWidth={1.75} />
      {label}
    </span>
  );
}

/** Empresa: esquinas rectas · Ejecutivo: píldora. Distinguibles incluso en blanco y negro. */
export function AccountTag({
  type,
  name,
  compact,
}: {
  type: TipoCuentaDestino;
  name?: string;
  compact?: boolean;
}) {
  const empresa = type === 'EMPRESA';
  const Icon = empresa ? Building2 : UserRound;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={cn(
          'inline-flex h-5 shrink-0 items-center gap-1 pl-1.5 pr-2 text-[11.5px] font-medium',
          empresa ? 'rounded-[3px] bg-company-soft text-company-text' : 'rounded-full bg-executive-soft text-executive-text',
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.75} />
        {!compact && (empresa ? 'Empresa' : 'Ejecutivo')}
      </span>
      {name && <span className="truncate">{name}</span>}
    </span>
  );
}

/** Loseta del icono: cuadrada (empresa) vs círculo (ejecutivo). */
export function AccountGlyph({ type, className }: { type: TipoCuentaDestino; className?: string }) {
  const empresa = type === 'EMPRESA';
  const Icon = empresa ? Building2 : UserRound;
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center',
        empresa ? 'rounded-[4px] bg-company-soft text-company-text' : 'rounded-full bg-executive-soft text-executive-text',
        className,
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </span>
  );
}

export function CurrencyChip({ code, className }: { code: string; className?: string }) {
  const base = code === 'MXN';
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded-sm px-1.5 text-[10.5px] font-semibold tracking-wide',
        base ? 'bg-currency-base text-currency-base-text' : 'bg-currency-fx text-currency-fx-text',
        className,
      )}
    >
      {code}
    </span>
  );
}

/**
 * Monto con signo explícito y reglas del sistema de diseño:
 * la base (MXN) no se anuncia en tablas; lo extranjero sí (chip + equivalencia).
 */
export function Money({
  value,
  currency = 'MXN',
  mxn,
  sign,
  status,
  showChip,
  className,
  align = 'right',
}: {
  value: number;
  currency?: string;
  mxn?: number;
  sign?: '+' | '−' | '';
  status?: EstatusMovimiento;
  showChip?: boolean;
  className?: string;
  align?: 'left' | 'right';
}) {
  const muerto = status === 'RECHAZADO' || status === 'CANCELADO';
  const fx = currency !== 'MXN';
  const color = muerto ? 'text-canceled-text line-through font-normal' : sign === '+' ? 'text-income font-medium' : 'text-expense font-medium';
  return (
    <span className={cn('inline-flex flex-col', align === 'right' ? 'items-end' : 'items-start', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className={cn('num', color)}>
          {sign}
          {simboloMoneda(currency)}
          {formatMoney(value)}
        </span>
        {(fx || showChip) && <CurrencyChip code={currency} />}
      </span>
      {fx && mxn !== undefined && (
        <span className="num text-xs text-muted-foreground">≈ ${formatMoney(mxn)} MXN</span>
      )}
    </span>
  );
}
