'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Equal, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtFecha, fmtMonto, formatMoney, haceCuanto, num } from '@/lib/format';
import type { ClienteDetalle, ErpMovimiento, TicketsPage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
import { Button, EmptyState, ErrorNote, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useState } from 'react';
import { TicketsTable } from './tickets-table';

export function useRefrescarCliente() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['cliente', 'clientes', 'movimientos', 'creditos', 'reportes', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
  };
}

/**
 * Saldo en el ERP vs saldo en el CRM. El ERP manda sobre lo que el cliente debe allá;
 * el CRM lleva su propio saldo y el usuario decide cuándo igualarlo.
 */
export function ErpPanel({ c }: { c: ClienteDetalle }) {
  const toast = useToast();
  const refrescar = useRefrescarCliente();
  const [confirmar, setConfirmar] = useState(false);
  const link = c.erp_link!;
  const crm = num(c.saldos.find((s) => s.moneda === 'MXN')?.saldo);
  const erp = num(link.saldo_erp);
  const dif = Math.round((erp - crm) * 100) / 100;
  const igual = Math.abs(dif) < 0.01;
  // De lo que el ERP dice que debe: cuánto lo respaldan ventas a crédito abiertas y cuánto no tiene ticket
  const enTickets = num(c.resumen.tickets_saldo);
  const sinTicket = Math.round((erp - enTickets) * 100) / 100;
  const reabiertas = c.resumen.tickets_reabiertos;

  const actualizar = useMutation({
    mutationFn: () => api<{ clientes: number; tickets: number }>(`/erp/clientes/${c.id}/actualizar`, { method: 'POST' }),
    onSuccess: (r) => {
      toast.ok(`Leído del ERP: saldo y ${r.tickets} tickets. El saldo del CRM no cambió.`);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sincronizar = useMutation({
    mutationFn: () => api<{ movimiento: { folio: number } | null; delta: number }>(`/erp/clientes/${c.id}/sincronizar-saldo`, { method: 'POST' }),
    onSuccess: (r) => {
      setConfirmar(false);
      toast.ok(r.movimiento ? `Saldo sincronizado. Se registró el movimiento ${r.movimiento.folio}.` : 'El saldo ya coincidía con el ERP.');
      refrescar();
    },
  });

  return (
    <>
      <Panel className="mb-5" title="Saldo en el ERP" action={<span className="text-xs text-muted-foreground">Leído {haceCuanto(link.saldo_erp_at)}</span>}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <div className="text-[13px] text-muted-foreground">En el ERP</div>
            <div className="num text-[26px] font-semibold leading-tight">{fmtMonto(erp)}</div>
          </div>
          <div>
            <div className="text-[13px] text-muted-foreground">En el CRM</div>
            <div className="num text-[26px] font-semibold leading-tight">{fmtMonto(crm)}</div>
          </div>
          <div className="min-w-[160px]">
            <div className="text-[13px] text-muted-foreground">Diferencia</div>
            {igual ? (
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-success-text">
                <Equal className="size-4" strokeWidth={1.75} />
                Sincronizado
              </div>
            ) : (
              <div className="num text-[26px] font-semibold leading-tight text-warning-text">
                {dif > 0 ? '+' : '−'}${formatMoney(Math.abs(dif))}
              </div>
            )}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" loading={actualizar.isPending} onClick={() => actualizar.mutate()}>
              <RefreshCw className="size-4" strokeWidth={1.75} />
              Actualizar del ERP
            </Button>
            <Button disabled={igual} onClick={() => setConfirmar(true)}>
              Sincronizar saldo
            </Button>
          </div>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-md bg-muted/50 px-4 py-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Respaldado por ventas a crédito</dt>
            <dd className="num font-medium">{fmtMonto(enTickets)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sin venta que lo respalde</dt>
            <dd className={cn('num font-medium', Math.abs(sinTicket) >= 0.01 && 'text-warning-text')}>{fmtMonto(sinTicket)}</dd>
            <dd className="text-[11px] text-muted-foreground">Saldos iniciales o ajustes del ERP</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ventas reabiertas</dt>
            <dd className="num font-medium">{reabiertas === 0 ? '—' : `${reabiertas} · ${fmtMonto(num(c.resumen.tickets_reabiertos_saldo))}`}</dd>
            {reabiertas > 0 && <dd className="text-[11px] text-info-text">Aún no se le cobran: no suman al saldo</dd>}
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          En el ERP el saldo es lo que el cliente debe y nunca baja de $0: no maneja saldo a favor. {link.saldo_sincronizado_at ? `Última sincronización: ${haceCuanto(link.saldo_sincronizado_at)}. ` : 'Este saldo nunca se ha sincronizado. '}
          “Actualizar” solo lee del ERP; “Sincronizar” iguala el saldo del CRM al del ERP y lo deja registrado como movimiento.
        </p>
      </Panel>

      <Dialog
        open={confirmar}
        onOpenChange={(o) => {
          setConfirmar(o);
          if (!o) sincronizar.reset();
        }}
        title="¿Sincronizar el saldo con el ERP?"
        description="Se vuelve a leer el saldo actual del ERP y el del CRM se iguala a ese valor."
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-md border px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">Saldo en el CRM</div>
              <div className="num text-lg font-semibold">{fmtMonto(crm)}</div>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Quedará en (ERP)</div>
              <div className="num text-lg font-semibold">{fmtMonto(erp)}</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Queda un movimiento de “Sincronización” en el historial del cliente. Si fue un error, se puede cancelar y el saldo regresa.
          </p>
          <ErrorNote error={sincronizar.error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmar(false)}>Volver</Button>
            <Button loading={sincronizar.isPending} onClick={() => sincronizar.mutate()}>Sincronizar saldo</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** Tickets a crédito del cliente (foto del ERP) y cómo va cada monto. */
export function TabTickets({ id }: { id: string }) {
  const toast = useToast();
  const refrescar = useRefrescarCliente();
  const [estado, setEstado] = useState<'abiertos' | 'reabiertas' | 'todos'>('abiertos');
  const { data, isLoading, error } = useQuery({
    queryKey: ['creditos', 'cliente', id, estado],
    queryFn: () => api<TicketsPage>('/creditos/tickets', { params: { cliente_id: id, estado, limit: 100 } }),
  });
  const actualizar = useMutation({
    mutationFn: () => api(`/erp/clientes/${id}/actualizar`, { method: 'POST' }),
    onSuccess: () => {
      toast.ok('Tickets actualizados desde el ERP.');
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel
      flush
      title="Tickets a crédito"
      action={
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Estado">
            {(['abiertos', 'reabiertas', 'todos'] as const).map((e) => (
              <button
                key={e}
                aria-pressed={estado === e}
                onClick={() => setEstado(e)}
                className={cn('h-7 rounded-[4px] px-2.5 text-xs', estado === e ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {e === 'abiertos' ? 'Crédito con saldo' : e === 'reabiertas' ? 'Reabiertas' : 'Todas'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" loading={actualizar.isPending} onClick={() => actualizar.mutate()}>
            <RefreshCw className="size-3.5" />
            Actualizar
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="p-4"><Skeleton className="h-32" /></div>
      ) : error ? (
        <div className="p-4"><ErrorNote error={error} /></div>
      ) : data!.items.length === 0 ? (
        <EmptyState title={estado === 'abiertos' ? 'Sin ventas a crédito con saldo.' : estado === 'reabiertas' ? 'Sin ventas reabiertas.' : 'Sin ventas a crédito.'}>
          Si acabas de guardar al cliente, usa “Actualizar” para leer sus tickets del ERP.
        </EmptyState>
      ) : (
        <>
          <TicketsTable items={data!.items} showCliente={false} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
            <span className="num">{data!.total} {data!.total === 1 ? 'venta' : 'ventas'}</span>
            <span>Total <span className="num font-medium text-foreground">${formatMoney(data!.totales.total)}</span></span>
            <span>Pagado <span className="num font-medium text-foreground">${formatMoney(data!.totales.pagado)}</span></span>
            <span>Saldo <span className="num font-semibold text-foreground">${formatMoney(data!.totales.saldo)}</span></span>
            {estado === 'todos' && data!.totales.reabiertas > 0 && (
              <span className="text-info-text">
                {data!.totales.reabiertas} {data!.totales.reabiertas === 1 ? 'reabierta' : 'reabiertas'} · aún no se cobran
              </span>
            )}
            {data!.totales.vencidos > 0 && (
              <span className="text-danger-text">
                {data!.totales.vencidos} {data!.totales.vencidos === 1 ? 'vencida' : 'vencidas'} · <span className="num">${formatMoney(data!.totales.saldo_vencido)}</span>
              </span>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

/** Cargos, abonos y ajustes de la cuenta del cliente en el ERP, en vivo. */
export function TabCuentaErp({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cliente', id, 'cuenta-erp'],
    queryFn: () => api<ErpMovimiento[]>(`/erp/clientes/${id}/movimientos`),
    retry: false,
  });
  return (
    <Panel flush title="Cuenta del cliente en el ERP" action={<span className="text-xs text-muted-foreground">En vivo · solo lectura</span>}>
      {isLoading ? (
        <div className="p-4"><Skeleton className="h-32" /></div>
      ) : error ? (
        <div className="p-4"><ErrorNote error={error} /></div>
      ) : data!.length === 0 ? (
        <EmptyState title="El ERP no tiene movimientos en la cuenta de este cliente." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="h-10 px-4 font-medium">Fecha</th>
                <th className="px-2 font-medium">Tipo</th>
                <th className="px-2 font-medium">Concepto</th>
                <th className="px-2 text-right font-medium">Monto</th>
                <th className="px-4 text-right font-medium">Saldo después</th>
              </tr>
            </thead>
            <tbody>
              {data!.map((m) => (
                <tr key={m.id} className="h-11 border-b last:border-0">
                  <td className="num px-4">{fmtFecha(m.fecha)}</td>
                  <td className="px-2">{m.tipo === 'CARGO' ? 'Cargo' : m.tipo === 'ABONO' ? 'Abono' : 'Ajuste'}</td>
                  <td className="max-w-[320px] truncate px-2 text-muted-foreground">{m.concepto}</td>
                  <td className={cn('num px-2 text-right font-medium', m.tipo === 'ABONO' && 'text-income')}>
                    {m.tipo === 'ABONO' ? '−' : m.tipo === 'CARGO' ? '+' : ''}${formatMoney(m.monto)}
                  </td>
                  <td className="num px-4 text-right">${formatMoney(m.saldo_despues)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
