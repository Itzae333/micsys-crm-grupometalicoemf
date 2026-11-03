'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, descargar } from '@/lib/api';
import { fmtFecha, formatMoney, METODO_LABEL } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import type { VentasPage, VentaFila } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EstatusErpBadge } from '@/components/tickets-table';
import { Button, EmptyState, ErrorNote, FilterChip, Input, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const ESTATUS_FILTROS = [
  { v: '', l: 'Todas' },
  { v: 'PAGADA', l: 'Pagadas' },
  { v: 'CREDITO', l: 'Crédito' },
  { v: 'REABIERTA', l: 'Reabiertas' },
  { v: 'CANCELADA', l: 'Canceladas' },
] as const;
const sel = 'bg-transparent pr-1 text-[13px] font-medium text-foreground focus:outline-none';

function TipoChip({ tipo }: { tipo: VentaFila['tipo'] }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-sm px-1.5 text-[11.5px] font-medium', tipo === 'CREDITO' ? 'bg-company-soft text-company-text' : 'bg-secondary text-secondary-foreground')}>
      {tipo === 'CREDITO' ? 'Crédito' : 'Contado'}
    </span>
  );
}

function Metodos({ m }: { m: string[] }) {
  if (m.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {m.map((x) => (
        <span key={x} className="inline-flex h-5 items-center rounded-sm bg-muted px-1.5 text-[11.5px] text-muted-foreground">
          {METODO_LABEL[x] ?? x.charAt(0) + x.slice(1).toLowerCase()}
        </span>
      ))}
    </div>
  );
}

/** Cuándo se pagó: fecha de liquidación y cuánto tardó; si no, en qué punto va. */
function Liquidada({ v }: { v: VentaFila }) {
  if (v.estatus === 'CANCELADA') {
    return (
      <div title={v.motivo_cancelacion ?? undefined}>
        <div className="text-muted-foreground">Cancelada {v.cancelada_at ? fmtFecha(v.cancelada_at) : ''}</div>
        {v.motivo_cancelacion && <div className="max-w-[170px] truncate text-xs text-muted-foreground">{v.motivo_cancelacion}</div>}
      </div>
    );
  }
  if (v.liquidada_at) {
    return (
      <div>
        <div className="num">{fmtFecha(v.liquidada_at)}</div>
        <div className="text-xs text-muted-foreground">{v.dias_a_liquidar === 0 ? 'el mismo día' : `a los ${v.dias_a_liquidar} ${v.dias_a_liquidar === 1 ? 'día' : 'días'}`}</div>
      </div>
    );
  }
  if (v.estatus === 'REABIERTA') return <span className="text-info-text">En edición</span>;
  if (v.estatus === 'PENDIENTE') return <span className="text-warning-text">Pendiente de cobro</span>;
  return (
    <div>
      <div className="text-warning-text">Sin liquidar</div>
      <div className="text-xs text-muted-foreground">
        {v.abonos_count > 0 ? `${v.abonos_count} ${v.abonos_count === 1 ? 'abono' : 'abonos'}` : 'sin abonos'}
        {v.ultimo_pago_at ? ` · último ${fmtFecha(v.ultimo_pago_at)}` : ''}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-[24px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Todas las ventas del cliente en el ERP (contado y crédito), solo lectura. */
export function TabVentas({ id }: { id: string }) {
  const toast = useToast();
  const [estatus, setEstatus] = useState('');
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const folio = useDebounced(q.trim(), 300);

  const params = { estatus, tipo, desde, hasta, q: folio, page, limit: 25 };
  const { data, isLoading, error } = useQuery({
    queryKey: ['cliente', id, 'ventas', params],
    queryFn: () => api<VentasPage>(`/erp/clientes/${id}/ventas`, { params }),
    placeholderData: (prev) => prev,
    retry: false,
  });
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const totalTodas = data ? Object.values(data.por_estatus).reduce((a, b) => a + b, 0) : 0;
  const hayFiltros = !!(estatus || tipo || desde || hasta || folio);
  const reset = () => setPage(1);

  return (
    <div className="flex flex-col gap-4">
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Total vendido" value={`$${formatMoney(data.resumen.vendido)}`} sub={`${data.resumen.ventas} ${data.resumen.ventas === 1 ? 'venta' : 'ventas'} · promedio $${formatMoney(data.resumen.ticket_promedio)}`} />
          <Kpi label="Pagado" value={`$${formatMoney(data.resumen.pagado)}`} sub="Sin contar canceladas" />
          <Kpi label="Por cobrar (crédito)" value={`$${formatMoney(data.resumen.por_cobrar)}`} sub="Ventas con estatus Crédito" />
          <Kpi label="Cliente desde" value={data.resumen.primera_venta ? fmtFecha(data.resumen.primera_venta) : '—'} sub={data.resumen.ultima_venta ? `Última compra ${fmtFecha(data.resumen.ultima_venta)}` : undefined} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-md border p-0.5" role="tablist" aria-label="Estatus de la venta">
          {ESTATUS_FILTROS.map((e) => {
            const n = e.v ? (data?.por_estatus[e.v] ?? 0) : totalTodas;
            return (
              <button
                key={e.v || 'todas'}
                role="tab"
                aria-selected={estatus === e.v}
                onClick={() => { setEstatus(e.v); reset(); }}
                className={cn('h-8 rounded-[4px] px-3 text-[13px] max-md:h-9', estatus === e.v ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
              >
                {e.l}
                {data && <span className={cn('num ml-1.5 text-xs', estatus === e.v ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{n}</span>}
              </button>
            );
          })}
        </div>
        <FilterChip label="Tipo" active={!!tipo}>
          <select className={sel} value={tipo} onChange={(e) => { setTipo(e.target.value); reset(); }}>
            <option value="">todas</option>
            <option value="contado">Contado</option>
            <option value="credito">Crédito</option>
          </select>
        </FilterChip>
        <FilterChip label="Desde" active={!!desde}>
          <input type="date" className={sel} value={desde} onChange={(e) => { setDesde(e.target.value); reset(); }} />
        </FilterChip>
        <FilterChip label="Hasta" active={!!hasta}>
          <input type="date" className={sel} value={hasta} onChange={(e) => { setHasta(e.target.value); reset(); }} />
        </FilterChip>
        <div className="relative min-w-[150px] flex-1 sm:max-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-9 text-[13px] max-md:h-10" inputMode="numeric" placeholder="Folio…" value={q} onChange={(e) => { setQ(e.target.value.replace(/\D/g, '')); reset(); }} aria-label="Buscar por folio" />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => descargar(`/erp/clientes/${id}/ventas.csv`, { estatus, tipo, desde, hasta, q: folio }, 'ventas-del-cliente.csv').catch((e: Error) => toast.error(e.message))}
        >
          <Download className="size-3.5" />
          Exportar CSV
        </Button>
      </div>

      <ErrorNote error={error} />

      <Panel flush>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title={hayFiltros ? 'Ninguna venta coincide con los filtros.' : 'Este cliente aún no tiene ventas en el ERP.'} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-table">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="h-10 px-4 font-medium">Venta</th>
                    <th className="px-2 font-medium">Fecha</th>
                    <th className="px-2 font-medium">Estatus en el ERP</th>
                    <th className="px-2 font-medium">Formas de pago</th>
                    <th className="px-2 font-medium">Liquidada</th>
                    <th className="px-2 text-right font-medium">Total</th>
                    <th className="px-2 text-right font-medium">Pagado</th>
                    <th className="px-4 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((v) => (
                    <tr key={v.id} className={cn('border-b last:border-0 hover:bg-accent', v.estatus === 'CANCELADA' && 'text-muted-foreground')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Link href={`/ventas/${v.id}`} className="num font-medium text-primary hover:underline">#{v.folio}</Link>
                          <TipoChip tipo={v.tipo} />
                        </div>
                        <div className="text-xs text-muted-foreground">{v.ubicacion} · {v.productos} {v.productos === 1 ? 'producto' : 'productos'}</div>
                      </td>
                      <td className="num whitespace-nowrap px-2">{fmtFecha(v.fecha)}</td>
                      <td className="px-2"><EstatusErpBadge estatus={v.estatus} /></td>
                      <td className="max-w-[170px] px-2"><Metodos m={v.metodos} /></td>
                      <td className="px-2"><Liquidada v={v} /></td>
                      <td className={cn('num px-2 text-right', v.estatus === 'CANCELADA' && 'line-through')}>${formatMoney(v.total)}</td>
                      <td className="num px-2 text-right">${formatMoney(v.pagado)}</td>
                      <td className={cn('num px-4 text-right', v.estatus === 'CREDITO' && v.saldo > 0 ? 'font-semibold' : 'text-muted-foreground')}>
                        {v.estatus === 'CANCELADA' ? '—' : `$${formatMoney(v.saldo)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil: una tarjeta por venta */}
            <ul className="divide-y md:hidden">
              {data.items.map((v) => (
                <li key={v.id}>
                  <Link href={`/ventas/${v.id}`} className="block px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="num text-sm font-medium">#{v.folio}</span>
                          <TipoChip tipo={v.tipo} />
                        </div>
                        <div className="num text-xs text-muted-foreground">{fmtFecha(v.fecha)} · {v.ubicacion}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn('num text-sm font-semibold', v.estatus === 'CANCELADA' && 'font-normal text-muted-foreground line-through')}>${formatMoney(v.total)}</div>
                        {v.estatus === 'CREDITO' && v.saldo > 0 && <div className="num text-xs text-warning-text">Saldo ${formatMoney(v.saldo)}</div>}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <EstatusErpBadge estatus={v.estatus} />
                      <Metodos m={v.metodos} />
                    </div>
                    <div className="mt-1.5 text-xs"><Liquidada v={v} /></div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="num">{data.total} {data.total === 1 ? 'venta' : 'ventas'}{hayFiltros ? ' con este filtro' : ''}</span>
              {paginas > 1 && (
                <div className="flex items-center gap-2">
                  <span className="num">Página {page} de {paginas}</span>
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                </div>
              )}
            </div>
          </>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">Leído en vivo del ERP · solo lectura. “Liquidada” es la fecha del pago con el que se completó el total de la venta.</p>
    </div>
  );
}
