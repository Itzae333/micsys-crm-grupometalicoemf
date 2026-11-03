'use client';

import { Link2, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { TIPOS_INGRESO } from '@micsys-crm/shared';
import { cuentaCorta, fmtFecha, formatMoney, METODO_LABEL, nombreCliente, num } from '@/lib/format';
import type { Movimiento } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AccionesMov } from './movimiento-acciones';
import { AccountTag, Money, StatusBadge } from './ui/badges';

/**
 * Signo visual del monto: + si es dinero que entró, − si salió.
 * Sincronización y ajuste: afectan el saldo, no son dinero recibido, así que van sin color de ingreso.
 */
export function signoMov(tipo: Movimiento['tipo']): '+' | '−' | '' {
  if (TIPOS_INGRESO.includes(tipo)) return '+';
  if (tipo === 'RETIRO') return '−';
  return '';
}

function esSync(m: Movimiento) {
  return m.tipo === 'SINCRONIZACION';
}

function ventasTexto(m: Movimiento) {
  if (m.ventas.length === 0) return null;
  const f = m.ventas.map((v) => v.folio ?? v.erp_venta_id);
  return f.length > 2 ? `${f.slice(0, 2).join(', ')} +${f.length - 2}` : f.join(', ');
}

function MontoMov({ m }: { m: Movimiento }) {
  if (esSync(m)) {
    // El monto de una sincronización es cuánto cambió el saldo del CRM: + subió (debe más) · − bajó
    return (
      <span className="num font-medium text-muted-foreground" title="Cambio en el saldo del CRM">
        {m.signo < 0 ? '−' : '+'}${formatMoney(num(m.monto))}
      </span>
    );
  }
  return <Money value={num(m.monto)} currency={m.moneda} mxn={num(m.monto_mxn)} sign={signoMov(m.tipo)} status={m.estatus} />;
}

export function MovimientosTable({
  items,
  showCliente = true,
  acciones = true,
  compacto = false,
  vacio,
}: {
  items: Movimiento[];
  showCliente?: boolean;
  acciones?: boolean;
  /** Oculta Referencia y Venta ERP bajo 1536 px (paneles del dashboard). */
  compacto?: boolean;
  vacio?: React.ReactNode;
}) {
  if (items.length === 0) return <>{vacio}</>;
  const extra = compacto ? 'max-2xl:hidden' : '';
  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-table">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="h-10 whitespace-nowrap px-4 font-medium">Fecha</th>
              <th className="whitespace-nowrap px-2 font-medium">Folio</th>
              {showCliente && <th className="px-2 font-medium">Cliente</th>}
              <th className="whitespace-nowrap px-2 font-medium">Forma de pago</th>
              <th className="px-2 font-medium">Cuenta destino</th>
              <th className={cn('px-2 font-medium', extra)}>Referencia</th>
              <th className={cn('whitespace-nowrap px-2 font-medium', extra)}>Venta ERP</th>
              <th className="px-2 text-right font-medium">Monto</th>
              <th className="px-2 font-medium">Estado</th>
              {acciones && <th className="w-px px-4" />}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="h-[52px] border-b last:border-0 hover:bg-accent">
                <td className="num whitespace-nowrap px-4">{fmtFecha(m.fecha_movimiento)}</td>
                <td className="num whitespace-nowrap px-2">
                  <Link href={`/movimientos/${m.id}`} className="font-medium text-primary hover:underline">
                    {m.folio}
                  </Link>
                </td>
                {showCliente && (
                  <td className="max-w-[200px] px-2">
                    <Link href={`/clientes/${m.cliente.id}`} className="block truncate hover:underline">
                      {nombreCliente(m.cliente)}
                    </Link>
                  </td>
                )}
                <td className="whitespace-nowrap px-2">{esSync(m) ? 'Sincronización' : m.metodo ? METODO_LABEL[m.metodo] : '—'}</td>
                <td className="max-w-[220px] px-2">
                  {m.cuenta_destino ? (
                    <div className="flex flex-col gap-0.5">
                      <AccountTag type={m.cuenta_destino.tipo} name={m.cuenta_destino.alias} />
                      {m.cuenta_destino.ejecutivo && (
                        <span className="truncate text-xs text-muted-foreground">{m.cuenta_destino.ejecutivo.nombre}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={cn('px-2', extra)}>
                  <div className="flex items-center gap-1.5">
                    <span className="num max-w-[140px] truncate">{m.referencia ?? '—'}</span>
                    {m.comprobantes.length > 0 && (
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-label="Tiene comprobante" />
                    )}
                  </div>
                </td>
                <td className={cn('whitespace-nowrap px-2', extra)}>
                  {ventasTexto(m) ? (
                    <span className="inline-flex items-center gap-1 text-company-text">
                      <Link2 className="size-3.5" strokeWidth={1.75} />
                      <span className="num">{ventasTexto(m)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{m.motivo === 'OTRO' ? (m.categoria_otro ?? 'Otro') : '—'}</span>
                  )}
                </td>
                <td className="px-2 text-right">
                  <MontoMov m={m} />
                </td>
                <td className="px-2">
                  <StatusBadge status={m.estatus} />
                  {m.motivo_cancelacion && (
                    <div className="mt-0.5 max-w-[160px] truncate text-xs text-muted-foreground" title={m.motivo_cancelacion}>
                      {m.motivo_cancelacion}
                    </div>
                  )}
                </td>
                {acciones && (
                  <td className="whitespace-nowrap px-4 text-right">
                    <AccionesMov mov={m} puedeCancelar={false} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: cada fila es una tarjeta de dos columnas */}
      <ul className="divide-y md:hidden">
        {items.map((m) => (
          <li key={m.id} className="px-4 py-3">
            <Link href={`/movimientos/${m.id}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={cn('truncate text-sm font-medium', !showCliente && 'num')}>
                  {showCliente ? nombreCliente(m.cliente) : `Folio ${m.folio}`}
                </div>
                <div className="num text-xs text-muted-foreground">
                  {fmtFecha(m.fecha_movimiento)} · {esSync(m) ? 'Sincronización con el ERP' : m.metodo ? METODO_LABEL[m.metodo] : m.tipo}
                </div>
                {m.cuenta_destino && (
                  <div className="mt-1.5 text-xs">
                    <AccountTag type={m.cuenta_destino.tipo} name={cuentaCorta(m.cuenta_destino.alias)} compact />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <MontoMov m={m} />
                <StatusBadge status={m.estatus} />
              </div>
            </Link>
            {acciones && m.estatus === 'PENDIENTE' && (
              <div className="mt-2.5 flex justify-end">
                <AccionesMov mov={m} puedeCancelar={false} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
