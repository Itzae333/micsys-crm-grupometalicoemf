'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudDownload, Plus, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtMonto, haceCuanto, nombreCliente, num } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { FiltroUbicacionChips, useFiltroUbicacion } from '@/components/filtro-ubicacion';
import type { Cliente } from '@/lib/types';
import { ClienteDialog } from '@/components/cliente-form';
import { ErpImportDialog, useErpEstado } from '@/components/erp-import';
import { Button, EmptyState, ErrorNote, FilterChip, Input, PageHeader, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const sel = 'bg-transparent pr-1 text-[13px] font-medium text-foreground focus:outline-none';

export default function ClientesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [soloSaldo, setSoloSaldo] = useState(false);
  const [origen, setOrigen] = useState('');
  const [page, setPage] = useState(1);
  const [nuevo, setNuevo] = useState(false);
  const [erp, setErp] = useState(false);
  const busqueda = useDebounced(q, 300);
  const erpEstado = useErpEstado();
  const f = useFiltroUbicacion();

  const { data, isLoading, error } = useQuery({
    queryKey: ['clientes', busqueda, soloSaldo, f.empresa, f.ubicacion, origen, page],
    queryFn: () =>
      api<{ total: number; items: Cliente[]; limit: number }>('/clientes', {
        params: { q: busqueda, con_saldo: soloSaldo, ...f.params, origen, page, limit: 25, activo: true },
      }),
  });
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const actualizar = useMutation({
    mutationFn: () => api<{ clientes: number; tickets: number; tickets_abiertos: number; no_encontrados: string[] }>('/erp/clientes/actualizar', { body: { ubicacion_id: f.ubicacion || undefined } }),
    onSuccess: (r) => {
      if (r.clientes === 0) toast.ok('Aún no hay clientes ligados con el ERP en este filtro.');
      else toast.ok(`Leído del ERP: ${r.clientes} clientes y ${r.tickets} tickets (${r.tickets_abiertos} abiertos). El saldo del CRM no cambió.`);
      for (const k of ['clientes', 'cliente', 'creditos', 'reportes']) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hayErp = erpEstado.data?.habilitado;
  const reset = () => setPage(1);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={data ? `${data.total} ${data.total === 1 ? 'cliente' : 'clientes'}` : undefined}
        actions={
          <>
            {hayErp && (
              <>
                <Button variant="outline" loading={actualizar.isPending} onClick={() => actualizar.mutate()}>
                  <RefreshCw className="size-4" strokeWidth={1.75} />
                  Actualizar desde el ERP
                </Button>
                <Button variant="outline" onClick={() => setErp(true)}>
                  <CloudDownload className="size-4" strokeWidth={1.75} />
                  Guardar clientes del ERP
                </Button>
              </>
            )}
            <Button onClick={() => setNuevo(true)}>
              <Plus className="size-4" strokeWidth={2} />
              Nuevo cliente
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, RFC, teléfono…" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} aria-label="Buscar clientes" />
        </div>
        <FiltroUbicacionChips f={f} onChange={reset} />
        {hayErp && (
          <FilterChip label="Origen" active={!!origen}>
            <select className={sel} value={origen} onChange={(e) => { setOrigen(e.target.value); reset(); }}>
              <option value="">todos</option>
              <option value="ERP">Del ERP</option>
              <option value="MANUAL">Captura manual</option>
            </select>
          </FilterChip>
        )}
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-2.5 text-[13px] text-muted-foreground has-[:checked]:border-solid has-[:checked]:border-primary/30 has-[:checked]:bg-accent has-[:checked]:text-accent-foreground max-md:h-10">
          <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={soloSaldo} onChange={(e) => { setSoloSaldo(e.target.checked); reset(); }} />
          Solo con saldo en el CRM
        </label>
      </div>

      <ErrorNote error={error} />

      <Panel flush>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState title={busqueda || f.ubicacion || f.empresa || origen ? 'Ningún cliente coincide con los filtros.' : 'Aún no hay clientes.'}>
            {!busqueda && (hayErp ? 'Guarda clientes desde el ERP o registra uno nuevo.' : 'Registra el primero con “Nuevo cliente”.')}
          </EmptyState>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-table">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="h-10 px-4 font-medium">Cliente</th>
                    <th className="px-2 font-medium">Ubicación</th>
                    <th className="px-2 font-medium">RFC</th>
                    <th className="px-2 text-right font-medium">Saldo en el CRM</th>
                    {hayErp && <th className="px-4 text-right font-medium">Saldo en el ERP</th>}
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((c) => {
                    const crm = num(c.saldos.find((s) => s.moneda === 'MXN')?.saldo);
                    const erpSaldo = c.erp_link ? num(c.erp_link.saldo_erp) : null;
                    const difiere = erpSaldo !== null && Math.abs(erpSaldo - crm) >= 0.01;
                    return (
                      <tr key={c.id} onClick={() => router.push(`/clientes/${c.id}`)} className="h-[52px] cursor-pointer border-b last:border-0 hover:bg-accent">
                        <td className="px-4">
                          <Link href={`/clientes/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                            {nombreCliente(c)}
                          </Link>
                          {c.origen === 'ERP' && <span className="ml-2 rounded-sm bg-info-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-info-text">ERP</span>}
                        </td>
                        <td className="px-2 text-muted-foreground">{c.ubicacion ? (f.variasEmpresas && c.ubicacion.empresa ? `${c.ubicacion.empresa.nombre} · ${c.ubicacion.nombre}` : c.ubicacion.nombre) : '—'}</td>
                        <td className="num px-2 text-muted-foreground">{c.rfc ?? '—'}</td>
                        <td className="num px-2 text-right font-medium">{fmtMonto(crm)}</td>
                        {hayErp && (
                          <td className="px-4 text-right">
                            {erpSaldo === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="num">{fmtMonto(erpSaldo)}</span>
                                <span className={difiere ? 'text-xs text-warning-text' : 'text-xs text-muted-foreground'}>
                                  {difiere ? 'Difiere del CRM · ' : ''}leído {haceCuanto(c.erp_link!.saldo_erp_at)}
                                </span>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y md:hidden">
              {data!.items.map((c) => {
                const crm = num(c.saldos.find((s) => s.moneda === 'MXN')?.saldo);
                const erpSaldo = c.erp_link ? num(c.erp_link.saldo_erp) : null;
                return (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{nombreCliente(c)}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.ubicacion?.empresa && f.variasEmpresas ? `${c.ubicacion.empresa.nombre} · ` : ''}{c.ubicacion?.nombre} · {c.rfc ?? c.telefono ?? 'Sin datos'}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num text-sm font-medium">{fmtMonto(crm)}</div>
                        {erpSaldo !== null && <div className="num text-xs text-muted-foreground">ERP {fmtMonto(erpSaldo)}</div>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
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

      {nuevo && <ClienteDialog open onOpenChange={setNuevo} onSaved={(c) => router.push(`/clientes/${c.id}`)} />}
      <ErpImportDialog open={erp} onOpenChange={setErp} />
    </>
  );
}
