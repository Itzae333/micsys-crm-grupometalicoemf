'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { api, descargar } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useDebounced, useUbicaciones } from '@/lib/hooks';
import type { TicketsPage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useErpEstado } from '@/components/erp-import';
import { TicketsTable } from '@/components/tickets-table';
import { Button, EmptyState, ErrorNote, FilterChip, Input, PageHeader, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const ESTADOS = [
  { v: 'abiertos', l: 'Crédito con saldo' },
  { v: 'reabiertas', l: 'Reabiertas' },
  { v: 'vencidos', l: 'Vencidos' },
  { v: 'liquidados', l: 'Pagadas' },
  { v: 'todos', l: 'Todas' },
] as const;
const sel = 'bg-transparent pr-1 text-[13px] font-medium text-foreground focus:outline-none';

export default function CreditosPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]['v']>('abiertos');
  const [ubicacion, setUbicacion] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const busqueda = useDebounced(q.trim(), 300);
  const ubicaciones = useUbicaciones();
  const erp = useErpEstado();

  const { data, isLoading, error } = useQuery({
    queryKey: ['creditos', estado, ubicacion, busqueda, page],
    queryFn: () => api<TicketsPage>('/creditos/tickets', { params: { estado, ubicacion_id: ubicacion, q: busqueda, page, limit: 25 } }),
    placeholderData: (prev) => prev,
  });
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const actualizar = useMutation({
    mutationFn: () => api<{ clientes: number; tickets: number; tickets_abiertos: number }>('/erp/clientes/actualizar', { body: { ubicacion_id: ubicacion || undefined } }),
    onSuccess: (r) => {
      toast.ok(r.clientes === 0 ? 'No hay clientes ligados con el ERP en este filtro.' : `Leído del ERP: ${r.clientes} clientes y ${r.tickets} tickets (${r.tickets_abiertos} con saldo).`);
      for (const k of ['creditos', 'clientes', 'cliente', 'reportes']) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const t = data?.totales;

  return (
    <>
      <PageHeader
        title="Crédito"
        subtitle="Tickets a crédito de los clientes que guardaste del ERP, y cómo va cada monto."
        actions={
          <>
            <Button variant="outline" onClick={() => descargar('/creditos/tickets.csv', { estado, ubicacion_id: ubicacion, q: busqueda }, 'creditos.csv').catch((e: Error) => toast.error(e.message))}>
              <Download className="size-4" strokeWidth={1.75} />
              Exportar CSV
            </Button>
            {erp.data?.habilitado && (
              <Button loading={actualizar.isPending} onClick={() => actualizar.mutate()}>
                <RefreshCw className="size-4" strokeWidth={1.75} />
                Actualizar desde el ERP
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading || !t ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)
        ) : (
          <>
            <Resumen label="Ventas en la lista" value={String(data!.total)} />
            <Resumen
              label="Saldo por cobrar"
              value={`$${formatMoney(estado === 'reabiertas' ? 0 : t.saldo)}`}
              sub={t.vencidos > 0 ? `$${formatMoney(t.saldo_vencido)} vencido en ${t.vencidos} ${t.vencidos === 1 ? 'venta' : 'ventas'}` : 'Crédito con saldo, sin contar reabiertas'}
              tone={t.vencidos > 0 ? 'danger' : undefined}
            />
            <Resumen
              label="Reabiertas"
              value={String(t.reabiertas)}
              sub={t.reabiertas > 0 ? `$${formatMoney(t.saldo_reabiertas)} que aún no se cobra` : 'Ninguna en edición'}
              tone={t.reabiertas > 0 ? 'info' : undefined}
            />
            <Resumen label="Ya pagado" value={`$${formatMoney(t.pagado)}`} sub={`de $${formatMoney(t.total)}`} />
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="tablist" aria-label="Estado de los tickets">
          {ESTADOS.map((e) => (
            <button
              key={e.v}
              role="tab"
              aria-selected={estado === e.v}
              onClick={() => { setEstado(e.v); setPage(1); }}
              className={cn('h-8 rounded-[4px] px-3 text-[13px] max-md:h-9', estado === e.v ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
            >
              {e.l}
            </button>
          ))}
        </div>
        <FilterChip label="Ubicación" active={!!ubicacion}>
          <select className={sel} value={ubicacion} onChange={(e) => { setUbicacion(e.target.value); setPage(1); }}>
            <option value="">todas</option>
            {ubicaciones.data?.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </FilterChip>
        <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-9 text-[13px] max-md:h-10" placeholder="Cliente o folio…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Buscar tickets" />
        </div>
      </div>

      <ErrorNote error={error} />

      <Panel flush>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : data!.items.length === 0 ? (
          <EmptyState title={busqueda || ubicacion ? 'Ningún ticket coincide con los filtros.' : estado === 'abiertos' ? 'No hay ventas a crédito con saldo.' : estado === 'reabiertas' ? 'No hay ventas reabiertas.' : 'No hay ventas con este estatus.'}>
            {!busqueda && 'Guarda clientes del ERP desde Clientes y usa “Actualizar desde el ERP” para leer sus tickets.'}
          </EmptyState>
        ) : (
          <>
            <TicketsTable items={data!.items} />
            {paginas > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2.5 text-[13px] text-muted-foreground">
                <span className="num">Página {page} de {paginas}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Panel>
      <p className="mt-3 text-xs text-muted-foreground">
        El estatus de cada venta es el del ERP. Las ventas reabiertas (en edición) no cuentan como saldo por cobrar hasta que se cierren de nuevo. Los datos son una lectura del ERP; el ERP manda. “Actualizar desde el ERP” trae saldos y tickets nuevos sin cambiar el saldo del CRM.
      </p>
    </>
  );
}

function Resumen({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'danger' | 'info' }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', tone === 'danger' && 'border-danger/30 bg-danger-soft/50', tone === 'info' && 'border-info/30 bg-info-soft/50')}>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-[24px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
