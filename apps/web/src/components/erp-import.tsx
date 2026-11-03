'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudDownload, Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatMoney, nombreCliente, num } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import type { ErpClienteItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
import { Button, EmptyState, ErrorNote, Input, Select, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const MAX = 100;

export function useErpEstado() {
  return useQuery({ queryKey: ['erp-estado'], queryFn: () => api<{ habilitado: boolean }>('/erp/estado'), staleTime: 300_000 });
}

interface PaginaErp {
  total: number;
  page: number;
  limit: number;
  items: ErpClienteItem[];
}

/**
 * Elegir varios clientes del ERP y guardarlos en el CRM.
 * Quedan con saldo en cero en el CRM; el saldo del ERP se guarda solo como referencia
 * hasta que el usuario decida sincronizarlo.
 */
export function ErpImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [ubicacion, setUbicacion] = useState('');
  const [q, setQ] = useState('');
  const [soloSaldo, setSoloSaldo] = useState(false);
  const [page, setPage] = useState(1);
  const [elegidos, setElegidos] = useState<Map<string, ErpClienteItem>>(new Map());
  const search = useDebounced(q.trim(), 350);
  const qc = useQueryClient();
  const toast = useToast();

  const ubicaciones = useQuery({
    queryKey: ['erp-ubicaciones'],
    queryFn: () => api<{ id: string; nombre: string }[]>('/erp/ubicaciones'),
    enabled: open,
  });
  const lista = useQuery({
    queryKey: ['erp-clientes', ubicacion, search, soloSaldo, page],
    queryFn: () => api<PaginaErp>('/erp/clientes', { params: { ubicacion_id: ubicacion, search, page, con_saldo: soloSaldo } }),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const importar = useMutation({
    mutationFn: () => api<{ importados: number; vinculados: number; ya_existian: number; no_encontrados: string[]; tickets_actualizados: number | null }>('/erp/clientes/importar', { body: { erp_cliente_ids: [...elegidos.keys()] } }),
    onSuccess: (r) => {
      const partes = [`${r.importados} ${r.importados === 1 ? 'cliente guardado' : 'clientes guardados'}`];
      if (r.vinculados) partes.push(`${r.vinculados} ligado(s) a un cliente que ya tenías`);
      if (r.ya_existian) partes.push(`${r.ya_existian} ya estaban`);
      if (r.tickets_actualizados !== null) partes.push(`${r.tickets_actualizados} tickets a crédito leídos`);
      toast.ok(partes.join(' · ') + '. Su saldo en el CRM empieza en $0.00.');
      setElegidos(new Map());
      for (const k of ['clientes', 'erp-clientes', 'creditos', 'reportes', 'ubicaciones']) qc.invalidateQueries({ queryKey: [k] });
      onOpenChange(false);
    },
  });

  const items = lista.data?.items ?? [];
  const seleccionables = items.filter((c) => !c.cliente_crm_id);
  const todosPagina = seleccionables.length > 0 && seleccionables.every((c) => elegidos.has(c.id));
  const paginas = lista.data ? Math.max(1, Math.ceil(lista.data.total / lista.data.limit)) : 1;

  function alternar(c: ErpClienteItem) {
    setElegidos((m) => {
      const n = new Map(m);
      if (n.has(c.id)) n.delete(c.id);
      else if (n.size < MAX) n.set(c.id, c);
      return n;
    });
  }
  function alternarPagina() {
    setElegidos((m) => {
      const n = new Map(m);
      if (todosPagina) seleccionables.forEach((c) => n.delete(c.id));
      else for (const c of seleccionables) if (n.size < MAX) n.set(c.id, c);
      return n;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Guardar clientes del ERP en el CRM"
      description="Elige los clientes que quieres llevar. Se guardan con saldo $0.00 en el CRM; el saldo del ERP queda como referencia hasta que tú lo sincronices."
      className="max-w-4xl"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="w-auto min-w-[180px]" value={ubicacion} onChange={(e) => { setUbicacion(e.target.value); setPage(1); }} aria-label="Ubicación del ERP">
          <option value="">Todas las ubicaciones</option>
          {ubicaciones.data?.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </Select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Nombre, razón social, RFC o teléfono…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Buscar en el ERP" />
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-2.5 text-[13px] text-muted-foreground has-[:checked]:border-solid has-[:checked]:border-primary/30 has-[:checked]:bg-accent has-[:checked]:text-accent-foreground">
          <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={soloSaldo} onChange={(e) => { setSoloSaldo(e.target.checked); setPage(1); }} />
          Solo con saldo
        </label>
      </div>

      <ErrorNote error={lista.error} />

      <div className="max-h-[46vh] overflow-auto rounded-md border">
        {lista.isLoading ? (
          <Skeleton className="h-40 border-0" />
        ) : items.length === 0 ? (
          <EmptyState title="No hay clientes con ese filtro en el ERP." />
        ) : (
          <table className="w-full text-table">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="h-10 w-10 px-3">
                  <input type="checkbox" aria-label="Elegir todos los de esta página" checked={todosPagina} onChange={alternarPagina} disabled={seleccionables.length === 0} className="accent-[hsl(var(--primary))]" />
                </th>
                <th className="px-2 font-medium">Cliente</th>
                <th className="px-2 font-medium max-md:hidden">Ubicación</th>
                <th className="px-2 font-medium max-md:hidden">RFC</th>
                <th className="px-3 text-right font-medium">Saldo en el ERP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const ya = !!c.cliente_crm_id;
                const on = elegidos.has(c.id);
                return (
                  <tr key={c.id} className={cn('h-11 border-b last:border-0', ya ? 'opacity-55' : 'cursor-pointer hover:bg-accent', on && 'bg-accent')} onClick={() => !ya && alternar(c)}>
                    <td className="px-3">
                      <input type="checkbox" aria-label={`Elegir ${nombreCliente(c)}`} checked={on || ya} disabled={ya} onChange={() => alternar(c)} onClick={(e) => e.stopPropagation()} className="accent-[hsl(var(--primary))]" />
                    </td>
                    <td className="max-w-[260px] px-2">
                      <div className="truncate font-medium">{nombreCliente(c)}</div>
                      {ya && <span className="text-xs text-success-text">Ya está en el CRM</span>}
                    </td>
                    <td className="px-2 text-muted-foreground max-md:hidden">{c.ubicacion}</td>
                    <td className="num px-2 text-muted-foreground max-md:hidden">{c.rfc ?? '—'}</td>
                    <td className={cn('num px-3 text-right', num(c.saldo_pendiente) > 0 && 'font-medium')}>${formatMoney(num(c.saldo_pendiente))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {paginas > 1 && (
            <>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <span className="num">{page} / {paginas}</span>
              <Button size="sm" variant="outline" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
            </>
          )}
          {elegidos.size >= MAX && <span className="text-warning-text">Máximo {MAX} por vez.</span>}
        </div>
        <div className="flex items-center gap-3">
          {elegidos.size > 0 && (
            <button type="button" className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setElegidos(new Map())}>
              Quitar selección
            </button>
          )}
          <Button disabled={elegidos.size === 0} loading={importar.isPending} onClick={() => importar.mutate()}>
            <CloudDownload className="size-4" strokeWidth={1.75} />
            {elegidos.size === 0 ? 'Elige clientes' : `Guardar ${elegidos.size} ${elegidos.size === 1 ? 'cliente' : 'clientes'} en el CRM`}
          </Button>
        </div>
      </div>
      <div className="mt-3"><ErrorNote error={importar.error} /></div>
    </Dialog>
  );
}
