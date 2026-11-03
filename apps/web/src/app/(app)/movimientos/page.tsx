'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ESTATUS, TIPOS_MOVIMIENTO, TIPO_LABEL } from '@micsys-crm/shared';
import { api, descargar } from '@/lib/api';
import { formatMoney, num, simboloMoneda } from '@/lib/format';
import { useCuentasDestino, useDebounced, useUbicaciones } from '@/lib/hooks';
import type { MovimientosPage } from '@/lib/types';
import { MovimientosTable } from '@/components/movimientos-table';
import { CurrencyChip } from '@/components/ui/badges';
import { Button, EmptyState, ErrorNote, FilterChip, Input, PageHeader, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const ESTATUS_LABEL: Record<string, string> = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', RECHAZADO: 'Rechazado', CANCELADO: 'Cancelado' };
const sel = 'bg-transparent pr-1 text-[13px] font-medium text-foreground focus:outline-none';

function Contenido() {
  const sp = useSearchParams();
  const toast = useToast();
  const [f, setF] = useState({
    estatus: sp.get('estatus') ?? '',
    tipo: '',
    cuenta_destino_id: sp.get('cuenta_destino_id') ?? '',
    ubicacion_id: '',
    desde: '',
    hasta: '',
    cliente_id: sp.get('cliente_id') ?? '',
  });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const busqueda = useDebounced(q.trim(), 300);
  const cuentas = useCuentasDestino();
  const ubicaciones = useUbicaciones();

  const params = { ...f, q: busqueda, page, limit: 25 };
  const { data, isLoading, error } = useQuery({
    queryKey: ['movimientos', params],
    queryFn: () => api<MovimientosPage>('/movimientos', { params }),
    placeholderData: (prev) => prev,
  });

  const cambiar = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setPage(1);
  };
  const hayFiltros = Object.values(f).some(Boolean) || !!busqueda;
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title="Movimientos"
        subtitle={data ? `${data.total} ${data.total === 1 ? 'movimiento' : 'movimientos'}` : undefined}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => descargar('/movimientos/export.csv', { ...f, q: busqueda }, 'movimientos.csv').catch((e: Error) => toast.error(e.message))}
            >
              <Download className="size-4" strokeWidth={1.75} />
              Exportar CSV
            </Button>
            <Link
              href="/movimientos/nuevo"
              className="inline-flex h-[34px] items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 max-md:hidden"
            >
              <Plus className="size-4" strokeWidth={2} />
              Registrar movimiento
            </Link>
          </>
        }
      />

      {/* Filtros: una sola fila sobre la tabla */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 pl-9 text-[13px] max-md:h-10" placeholder="Cliente, folio, referencia…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Buscar movimientos" />
        </div>
        <FilterChip label="Estado" active={!!f.estatus}>
          <select className={sel} value={f.estatus} onChange={cambiar('estatus')}>
            <option value="">todos</option>
            {ESTATUS.map((e) => <option key={e} value={e}>{ESTATUS_LABEL[e]}</option>)}
          </select>
        </FilterChip>
        <FilterChip label="Tipo" active={!!f.tipo}>
          <select className={sel} value={f.tipo} onChange={cambiar('tipo')}>
            <option value="">todos</option>
            {TIPOS_MOVIMIENTO.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </FilterChip>
        <FilterChip label="Cayó en" active={!!f.cuenta_destino_id}>
          <select className={`${sel} max-w-[160px]`} value={f.cuenta_destino_id} onChange={cambiar('cuenta_destino_id')}>
            <option value="">todas</option>
            {cuentas.data?.map((c) => <option key={c.id} value={c.id}>{c.alias}</option>)}
          </select>
        </FilterChip>
        <FilterChip label="Ubicación" active={!!f.ubicacion_id}>
          <select className={sel} value={f.ubicacion_id} onChange={cambiar('ubicacion_id')}>
            <option value="">todas</option>
            {ubicaciones.data?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </FilterChip>
        <FilterChip label="Desde" active={!!f.desde}>
          <input type="date" className={sel} value={f.desde} onChange={cambiar('desde')} />
        </FilterChip>
        <FilterChip label="Hasta" active={!!f.hasta}>
          <input type="date" className={sel} value={f.hasta} onChange={cambiar('hasta')} />
        </FilterChip>
        {hayFiltros && (
          <Button size="sm" variant="ghost" onClick={() => { setF({ estatus: '', tipo: '', cuenta_destino_id: '', ubicacion_id: '', desde: '', hasta: '', cliente_id: '' }); setQ(''); setPage(1); }}>
            <X className="size-3.5" />
            Limpiar
          </Button>
        )}
      </div>

      <ErrorNote error={error} />

      <Panel flush>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <>
            <MovimientosTable
              items={data!.items}
              vacio={
                <EmptyState title={hayFiltros ? 'Ningún movimiento coincide con los filtros.' : 'Aún no hay movimientos.'}>
                  {!hayFiltros && (
                    <Link href="/movimientos/nuevo" className="font-medium text-primary hover:underline">
                      Registra el primero.
                    </Link>
                  )}
                </EmptyState>
              }
            />
            {data!.items.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span>Confirmado en el filtro:</span>
                  {data!.totales.length === 0 ? (
                    <span>$0.00</span>
                  ) : (
                    data!.totales.map((t) => (
                      <span key={t.moneda} className="inline-flex items-center gap-1.5">
                        <span className="num font-semibold text-foreground">
                          {simboloMoneda(t.moneda)}
                          {formatMoney(num(t.monto))}
                        </span>
                        <CurrencyChip code={t.moneda} />
                      </span>
                    ))
                  )}
                </div>
                {paginas > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="num">Página {page} de {paginas}</span>
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  );
}

export default function MovimientosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Contenido />
    </Suspense>
  );
}
