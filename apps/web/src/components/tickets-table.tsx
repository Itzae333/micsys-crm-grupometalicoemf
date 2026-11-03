'use client';

import { CircleCheck, CircleDashed, Flag, HandCoins, PenLine, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { fmtFecha, formatMoney, nombreCliente, num } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Estatus de la venta tal como lo maneja el ERP. No se reinterpreta: se muestra el mismo. */
const ESTATUS: Record<string, { label: string; Icon: typeof HandCoins; cls: string; ayuda: string }> = {
  CREDITO: { label: 'Crédito', Icon: HandCoins, cls: 'bg-warning-soft text-warning-text', ayuda: 'Venta a crédito con saldo por cobrar.' },
  PENDIENTE: { label: 'Pendiente', Icon: HandCoins, cls: 'bg-warning-soft text-warning-text', ayuda: 'Venta guardada, pendiente de cobro.' },
  PAGADA: { label: 'Pagada', Icon: CircleCheck, cls: 'bg-success-soft text-success-text', ayuda: 'Venta liquidada.' },
  REABIERTA: {
    label: 'Reabierta',
    Icon: PenLine,
    cls: 'bg-info-soft text-info-text',
    ayuda: 'Se abrió para editarla. El ERP ya descontó su cargo del saldo del cliente y no se le cobra hasta que se cierre de nuevo.',
  },
  FINALIZADA: { label: 'Finalizada', Icon: Flag, cls: 'bg-canceled-soft text-canceled-text', ayuda: 'Estatus del ERP: finalizada.' },
  INCOMPLETA: { label: 'Incompleta', Icon: CircleDashed, cls: 'bg-canceled-soft text-canceled-text', ayuda: 'Estatus del ERP: incompleta.' },
  CANCELADA: { label: 'Cancelada', Icon: CircleDashed, cls: 'bg-canceled-soft text-canceled-text', ayuda: 'Venta cancelada.' },
};

export function estatusLabel(e: string) {
  return ESTATUS[e]?.label ?? e.charAt(0) + e.slice(1).toLowerCase();
}

/** Siempre icono + texto + color. */
export function EstatusErpBadge({ estatus, className }: { estatus: string; className?: string }) {
  const m = ESTATUS[estatus] ?? { label: estatusLabel(estatus), Icon: CircleDashed, cls: 'bg-canceled-soft text-canceled-text', ayuda: `Estatus del ERP: ${estatus}` };
  return (
    <span title={m.ayuda} className={cn('inline-flex h-[22px] items-center gap-1.5 rounded-sm pl-1.5 pr-2 text-xs font-medium', m.cls, className)}>
      <m.Icon className="size-3.5" strokeWidth={1.75} />
      {m.label}
    </span>
  );
}

/** Fecha de vencimiento. Si el ERP no la tiene no se inventa un estado: simplemente va vacía. */
export function Vence({ t }: { t: Pick<Ticket, 'vence' | 'vencido' | 'dias_vencido'> }) {
  if (t.vencido) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-text">
        <TriangleAlert className="size-3.5" strokeWidth={1.75} />
        Vencido {t.dias_vencido} {t.dias_vencido === 1 ? 'día' : 'días'}
      </span>
    );
  }
  return <span className="num text-muted-foreground">{t.vence ? fmtFecha(t.vence) : '—'}</span>;
}

/** Cuánto se ha pagado del ticket: barra + porcentaje. */
export function Avance({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)} role="img" aria-label={`${pct}% pagado`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-company')} style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

/** Saldo del ticket; en una reabierta se muestra atenuado porque todavía no se cobra. */
function Saldo({ t }: { t: Ticket }) {
  const noCuenta = t.abierto && !t.cuenta_en_saldo;
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn('num', t.abierto && t.cuenta_en_saldo ? 'font-semibold' : 'font-normal text-muted-foreground')}>${formatMoney(num(t.saldo))}</span>
      {noCuenta && <span className="text-[11px] text-info-text">aún no se cobra</span>}
    </span>
  );
}

export function TicketsTable({ items, showCliente = true }: { items: Ticket[]; showCliente?: boolean }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-table">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {showCliente && <th className="h-10 px-4 font-medium">Cliente</th>}
              <th className={cn('whitespace-nowrap px-2 font-medium', !showCliente && 'px-4')}>Ticket</th>
              <th className="px-2 font-medium">Fecha</th>
              <th className="px-2 font-medium">Estatus en el ERP</th>
              <th className="px-2 font-medium">Vence</th>
              <th className="px-2 text-right font-medium">Total</th>
              <th className="px-2 font-medium">Avance</th>
              <th className="px-2 text-right font-medium">Pagado</th>
              <th className="px-2 text-right font-medium">Abonos</th>
              <th className="px-4 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="h-[52px] border-b last:border-0 hover:bg-accent">
                {showCliente && (
                  <td className="max-w-[220px] px-4">
                    <Link href={`/clientes/${t.cliente.id}`} className="block truncate font-medium hover:underline">
                      {nombreCliente(t.cliente)}
                    </Link>
                    <span className="text-xs text-muted-foreground">{t.cliente.ubicacion.nombre}</span>
                  </td>
                )}
                <td className={cn('num px-2 font-medium', !showCliente && 'px-4')}>
                  <Link href={`/ventas/${t.erp_nota_id}`} className="text-primary hover:underline">
                    #{t.folio}
                  </Link>
                </td>
                <td className="num px-2">{fmtFecha(t.fecha)}</td>
                <td className="px-2"><EstatusErpBadge estatus={t.estatus} /></td>
                <td className="px-2"><Vence t={t} /></td>
                <td className="num px-2 text-right">${formatMoney(num(t.total))}</td>
                <td className="px-2"><Avance pct={t.avance_pct} /></td>
                <td className="num px-2 text-right">${formatMoney(num(t.pagado))}</td>
                <td className="num px-2 text-right text-muted-foreground">{t.abonos_count}</td>
                <td className="px-4 text-right"><Saldo t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y md:hidden">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/ventas/${t.erp_nota_id}`} className="block px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{showCliente ? nombreCliente(t.cliente) : `Ticket #${t.folio}`}</div>
                  <div className="num text-xs text-muted-foreground">
                    {showCliente ? `#${t.folio} · ` : ''}
                    {fmtFecha(t.fecha)} · {t.cliente.ubicacion.nombre}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Saldo t={t} />
                  <div className="num text-xs text-muted-foreground">de ${formatMoney(num(t.total))}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <EstatusErpBadge estatus={t.estatus} />
                  {(t.vencido || t.vence) && <Vence t={t} />}
                </div>
                <Avance pct={t.avance_pct} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
