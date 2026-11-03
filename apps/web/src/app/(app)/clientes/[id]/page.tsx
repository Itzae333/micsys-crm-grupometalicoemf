'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Landmark, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { cuentaClienteSchema } from '@micsys-crm/shared';
import { api, descargar } from '@/lib/api';
import { cuentaCorta, fmtFecha, formatMoney, nombreCliente, num, simboloMoneda } from '@/lib/format';
import type { ClienteDetalle, MovimientosPage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ClienteDialog } from '@/components/cliente-form';
import { ErpPanel, TabCuentaErp, TabTickets } from '@/components/cliente-erp';
import { TabVentas } from '@/components/cliente-ventas';
import { MovimientosTable } from '@/components/movimientos-table';
import { CurrencyChip } from '@/components/ui/badges';
import { Dialog } from '@/components/ui/dialog';
import { Button, EmptyState, ErrorNote, Field, Input, PageHeader, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const TABS = ['Movimientos', 'Ventas', 'Tickets a crédito', 'Cuenta del ERP', 'Cuentas del cliente', 'Notas'] as const;

export default function ClienteFicha() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Movimientos');
  const [editar, setEditar] = useState(false);
  const toast = useToast();

  const { data: c, isLoading, error } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => api<ClienteDetalle>(`/clientes/${id}`),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error || !c) return <ErrorNote error={error ?? new Error('No se encontró el cliente.')} />;

  const conSaldo = c.saldos.filter((s) => num(s.saldo) !== 0);

  return (
    <>
      <PageHeader
        title={nombreCliente(c)}
        subtitle={
          <span className="not-italic">
            {[c.ubicacion?.nombre, c.rfc, c.telefono, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                descargar('/movimientos/export.csv', { cliente_id: id }, `estado-de-cuenta-${nombreCliente(c).slice(0, 30)}.csv`).catch((e: Error) =>
                  toast.error(e.message),
                )
              }
            >
              <Download className="size-4" strokeWidth={1.75} />
              Estado de cuenta
            </Button>
            <Button variant="outline" onClick={() => setEditar(true)}>
              <Pencil className="size-4" strokeWidth={1.75} />
              Editar
            </Button>
            <Link
              href={`/movimientos/nuevo?cliente_id=${id}`}
              className="inline-flex h-[34px] items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 max-md:h-[42px]"
            >
              <Plus className="size-4" strokeWidth={2} />
              Registrar movimiento
            </Link>
          </>
        }
      />

      {(c.etiquetas.length > 0 || !c.activo || c.origen === 'ERP') && (
        <div className="-mt-3 mb-4 flex flex-wrap gap-1.5">
          {!c.activo && <span className="rounded-sm bg-canceled-soft px-2 py-0.5 text-xs text-canceled-text">Inactivo</span>}
          {c.origen === 'ERP' && <span className="rounded-sm bg-info-soft px-2 py-0.5 text-xs text-info-text">Importado del ERP</span>}
          {c.etiquetas.map((t) => (
            <span key={t} className="rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {t}
            </span>
          ))}
        </div>
      )}

      {c.erp_link && <ErpPanel c={c} />}

      {/* Resumen */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-[13px] text-muted-foreground">Saldo en el CRM</div>
          {conSaldo.length === 0 ? (
            <div className="num mt-1 text-[26px] font-semibold">$0.00</div>
          ) : (
            conSaldo.map((s) => (
              <div key={s.moneda} className="mt-1 flex items-center gap-2">
                <span className={cn('num text-[26px] font-semibold leading-tight', num(s.saldo) < 0 && 'text-income')}>
                  {num(s.saldo) < 0 && '−'}
                  {simboloMoneda(s.moneda)}
                  {formatMoney(Math.abs(num(s.saldo)))}
                </span>
                {s.moneda !== 'MXN' && <CurrencyChip code={s.moneda} />}
              </div>
            ))
          )}
          {conSaldo.some((s) => num(s.saldo) < 0) && <div className="mt-1 text-xs text-muted-foreground">Saldo a favor del cliente</div>}
        </div>
        <Stat label="Cobrado confirmado" value={`$${formatMoney(num(c.resumen.cobrado_mxn))}`} sub="Equivalente en MXN, histórico" />
        <Stat
          label="Pendiente de confirmar"
          value={`$${formatMoney(num(c.resumen.pendientes_mxn))}`}
          sub={`${c.resumen.pendientes} ${c.resumen.pendientes === 1 ? 'movimiento' : 'movimientos'}`}
          warn={c.resumen.pendientes > 0}
        />
        <Stat label="Último movimiento" value={fmtFecha(c.resumen.ultimo_movimiento)} sub={`${c.resumen.movimientos} en total`} />
      </div>

      {/* Pestañas */}
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {TABS.filter((t) => c.erp_link || (t !== 'Ventas' && t !== 'Tickets a crédito' && t !== 'Cuenta del ERP')).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px h-10 shrink-0 border-b-2 px-3.5 text-sm',
              tab === t ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
            {t === 'Movimientos' && <span className="num ml-1.5 text-xs text-muted-foreground">{c.resumen.movimientos}</span>}
            {t === 'Tickets a crédito' && <span className="num ml-1.5 text-xs text-muted-foreground">{c.resumen.tickets_abiertos}</span>}
            {t === 'Cuentas del cliente' && <span className="num ml-1.5 text-xs text-muted-foreground">{c.cuentas.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'Movimientos' && <TabMovimientos id={id} />}
      {tab === 'Ventas' && <TabVentas id={id} />}
      {tab === 'Tickets a crédito' && <TabTickets id={id} />}
      {tab === 'Cuenta del ERP' && <TabCuentaErp id={id} />}
      {tab === 'Cuentas del cliente' && <TabCuentas c={c} />}
      {tab === 'Notas' && (
        <Panel>
          {c.notas ? <p className="whitespace-pre-wrap text-sm">{c.notas}</p> : <p className="text-sm text-muted-foreground">Sin notas. Agrégalas desde “Editar”.</p>}
          {c.direccion && (
            <p className="mt-4 text-sm">
              <span className="text-muted-foreground">Dirección: </span>
              {c.direccion}
            </p>
          )}
        </Panel>
      )}

      {editar && <ClienteDialog open onOpenChange={setEditar} cliente={c} />}
    </>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', warn && 'border-warning/40 bg-warning-soft/60')}>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-[26px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TabMovimientos({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['movimientos', 'cliente', id],
    queryFn: () => api<MovimientosPage>('/movimientos', { params: { cliente_id: id, limit: 100 } }),
  });
  return (
    <Panel flush>
      {isLoading ? (
        <div className="p-4"><Skeleton className="h-40" /></div>
      ) : error ? (
        <div className="p-4"><ErrorNote error={error} /></div>
      ) : (
        <>
          <MovimientosTable
            items={data!.items}
            showCliente={false}
            vacio={<EmptyState title="Aún no hay movimientos de este cliente.">Registra el primero con “Registrar movimiento”.</EmptyState>}
          />
          {data!.totales.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="num">{data!.total} movimientos · Confirmado:</span>
              {data!.totales.map((t) => (
                <span key={t.moneda} className="inline-flex items-center gap-1.5">
                  <span className="num font-medium text-foreground">
                    {simboloMoneda(t.moneda)}
                    {formatMoney(num(t.monto))}
                  </span>
                  {t.moneda !== 'MXN' && <CurrencyChip code={t.moneda} />}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function TabCuentas({ c }: { c: ClienteDetalle }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [abrir, setAbrir] = useState(false);
  const [f, setF] = useState({ banco: '', clabe: '', numero: '', titular: '', alias: '' });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const crear = useMutation({
    mutationFn: (body: unknown) => api(`/clientes/${c.id}/cuentas`, { body }),
    onSuccess: () => {
      toast.ok('Cuenta agregada.');
      qc.invalidateQueries({ queryKey: ['cliente', c.id] });
      setAbrir(false);
      setF({ banco: '', clabe: '', numero: '', titular: '', alias: '' });
    },
  });
  const estado = useMutation({
    mutationFn: (v: { id: string; activa: boolean }) => api(`/clientes/${c.id}/cuentas/${v.id}/activa`, { method: 'PATCH', body: { activa: v.activa } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cliente', c.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel
      flush
      title="Cuentas del cliente"
      action={
        <Button size="sm" variant="outline" onClick={() => setAbrir(true)}>
          <Plus className="size-3.5" />
          Agregar cuenta
        </Button>
      }
    >
      {c.cuentas.length === 0 ? (
        <EmptyState title="Sin cuentas registradas.">Guarda las cuentas desde las que paga el cliente para ligarlas a sus movimientos.</EmptyState>
      ) : (
        <ul className="divide-y">
          {c.cuentas.map((a) => (
            <li key={a.id} className={cn('flex items-center justify-between gap-3 px-4 py-3', !a.activa && 'opacity-60')}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <Landmark className="size-[18px]" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 text-sm">
                  <div className="num truncate font-medium">{a.alias || cuentaCorta(a.banco, a.clabe, a.numero)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[a.alias ? cuentaCorta(a.banco, a.clabe, a.numero) : null, a.titular].filter(Boolean).join(' · ') || a.banco}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => estado.mutate({ id: a.id, activa: !a.activa })}>
                {a.activa ? 'Dar de baja' : 'Reactivar'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={abrir} onOpenChange={setAbrir} title="Agregar cuenta del cliente" description="La CLABE completa no se muestra en listas, solo los últimos 4 dígitos.">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const p = cuentaClienteSchema.safeParse(f);
            if (!p.success) return setErr(p.error.issues[0].message);
            setErr('');
            crear.mutate(p.data);
          }}
        >
          <Field label="Banco" error={err}>
            <Input value={f.banco} onChange={set('banco')} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CLABE">
              <Input value={f.clabe} onChange={set('clabe')} inputMode="numeric" className="num" />
            </Field>
            <Field label="Número de cuenta">
              <Input value={f.numero} onChange={set('numero')} inputMode="numeric" className="num" />
            </Field>
          </div>
          <Field label="Titular">
            <Input value={f.titular} onChange={set('titular')} />
          </Field>
          <Field label="Alias" hint="Cómo la reconoces: “Nómina BBVA”.">
            <Input value={f.alias} onChange={set('alias')} />
          </Field>
          <ErrorNote error={crear.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAbrir(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={crear.isPending}>
              Guardar cuenta
            </Button>
          </div>
        </form>
      </Dialog>
    </Panel>
  );
}
