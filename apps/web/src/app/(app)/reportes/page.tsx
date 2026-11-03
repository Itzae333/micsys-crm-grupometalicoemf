'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { TIPO_LABEL } from '@micsys-crm/shared';
import type { TipoMovimiento } from '@micsys-crm/shared';
import { api } from '@/lib/api';
import { fmtDiaCorto, fmtFecha, fmtMonto, formatMoney, haceCuanto } from '@/lib/format';
import { FiltroUbicacionChips, useFiltroUbicacion } from '@/components/filtro-ubicacion';
import type { ReporteCobranza, ReporteCredito } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarSeries, HBarList } from '@/components/charts/charts';
import { AccountTag } from '@/components/ui/badges';
import { Button, EmptyState, ErrorNote, FilterChip, Input, PageHeader, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const sel = 'bg-transparent pr-1 text-[13px] font-medium text-foreground focus:outline-none';
const COLOR_ANTIGUEDAD: Record<string, string> = {
  por_vencer: 'bg-company',
  sin_vencimiento: 'bg-canceled',
  d1_30: 'bg-warning',
  d31_60: 'bg-warning',
  d61_90: 'bg-danger',
  d90_mas: 'bg-danger',
};

export default function ReportesPage() {
  const [tab, setTab] = useState<'credito' | 'cobranza'>('credito');
  const f = useFiltroUbicacion();

  return (
    <>
      <PageHeader title="Reportes" subtitle="Cuántos clientes tienen crédito, cuánto deben y cómo va la cobranza." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border p-0.5" role="tablist">
          {([['credito', 'Crédito'], ['cobranza', 'Cobranza']] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn('h-9 rounded-[4px] px-4 text-sm', tab === v ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroUbicacionChips f={f} />
        </div>
      </div>
      {tab === 'credito' ? <Credito ubicacion={f.ubicacion} empresa={f.empresa} /> : <Cobranza ubicacion={f.ubicacion} empresa={f.empresa} />}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: 'warning' | 'danger' }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', tone === 'warning' && 'border-warning/40 bg-warning-soft/60', tone === 'danger' && 'border-danger/30 bg-danger-soft/50')}>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-[26px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── Crédito ─────────────────────────────────────────────────────────────────
function Credito({ ubicacion, empresa }: { ubicacion: string; empresa: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const { data, isLoading, error } = useQuery({
    queryKey: ['reportes', 'credito', empresa, ubicacion],
    queryFn: () => api<ReporteCredito>('/reportes/credito', { params: { ubicacion_id: ubicacion, empresa_id: empresa } }),
  });

  const refrescar = () => {
    for (const k of ['reportes', 'clientes', 'cliente', 'creditos', 'movimientos', 'dashboard']) qc.invalidateQueries({ queryKey: [k] });
  };
  const actualizar = useMutation({
    mutationFn: () => api<{ clientes: number; tickets: number }>('/erp/clientes/actualizar', { body: { ubicacion_id: ubicacion || undefined } }),
    onSuccess: (r) => { toast.ok(`Leído del ERP: ${r.clientes} clientes y ${r.tickets} tickets.`); refrescar(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sincronizar = useMutation({
    mutationFn: (ids: string[]) => api<{ sincronizados: number; sin_cambio: number; con_error: number }>('/erp/clientes/sincronizar-saldos', { body: { cliente_ids: ids } }),
    onSuccess: (r) => {
      toast.ok(`${r.sincronizados} sincronizados${r.sin_cambio ? ` · ${r.sin_cambio} ya coincidían` : ''}${r.con_error ? ` · ${r.con_error} con error` : ''}.`);
      setMarcados(new Set());
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error) return <ErrorNote error={error} />;
  const k = data!.kpis;

  if (k.clientes_vinculados === 0) {
    return (
      <Panel>
        <EmptyState title="Aún no hay clientes ligados con el ERP.">
          Guarda clientes del ERP desde <Link href="/clientes" className="font-medium text-primary hover:underline">Clientes</Link> para ver aquí su crédito.
        </EmptyState>
      </Panel>
    );
  }

  const maxAnt = data!.antiguedad.reduce((a, b) => a + b.saldo, 0);
  const todos = data!.desincronizados.length > 0 && data!.desincronizados.every((d) => marcados.has(d.cliente_id));

  return (
    <div className="flex flex-col gap-5">
      {k.clientes_desactualizados > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft/60 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 text-warning-text">
            <TriangleAlert className="size-4" strokeWidth={1.75} />
            {k.clientes_desactualizados} {k.clientes_desactualizados === 1 ? 'cliente no se ha leído' : 'clientes no se han leído'} del ERP en los últimos 3 días: los números pueden estar atrasados.
          </span>
          <Button size="sm" variant="outline" loading={actualizar.isPending} onClick={() => actualizar.mutate()}>Actualizar desde el ERP</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Clientes con crédito abierto" value={String(k.clientes_con_credito_abierto)} sub={`de ${k.clientes_vinculados} guardados del ERP · ${k.clientes_sin_credito} sin saldo`} />
        <Kpi
          label="Ventas a crédito con saldo"
          value={String(k.tickets_abiertos)}
          sub={`${k.tickets_vencidos} vencidas${k.tickets_reabiertos > 0 ? ` · ${k.tickets_reabiertos} reabiertas aparte` : ''}`}
          tone={k.tickets_vencidos > 0 ? 'danger' : undefined}
        />
        <Kpi label="Saldo de esos tickets" value={`$${formatMoney(k.saldo_tickets_abiertos)}`} sub={`$${formatMoney(k.saldo_vencido)} vencido`} />
        <Kpi
          label="Saldo ERP vs CRM"
          value={`$${formatMoney(Math.abs(k.diferencia_total))}`}
          tone={k.clientes_desincronizados > 0 ? 'warning' : undefined}
          sub={k.clientes_desincronizados > 0 ? `${k.clientes_desincronizados} clientes sin sincronizar · ERP ${fmtMonto(k.saldo_erp_total)} · CRM ${fmtMonto(k.saldo_crm_total)}` : 'Todo sincronizado'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Antigüedad del saldo" action={<span className="text-xs text-muted-foreground">Tickets con saldo</span>}>
          {maxAnt === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay saldo abierto.</p>
          ) : (
            <HBarList
              empty=""
              rows={data!.antiguedad.map((b) => ({
                key: b.key,
                label: b.label,
                sub: `${b.tickets} ${b.tickets === 1 ? 'ticket' : 'tickets'}`,
                value: b.saldo,
                pct: maxAnt ? Math.round((b.saldo / maxAnt) * 1000) / 10 : 0,
                className: COLOR_ANTIGUEDAD[b.key],
              }))}
            />
          )}
        </Panel>

        <Panel title="Quién debe más" action={<span className="text-xs text-muted-foreground">Saldo en el ERP</span>}>
          <HBarList
            empty="Ningún cliente con saldo en el ERP."
            rows={data!.top_deudores.map((d) => ({
              key: d.cliente_id,
              label: <Link href={`/clientes/${d.cliente_id}`} className="hover:underline">{d.nombre}</Link>,
              sub: d.ubicacion,
              value: d.saldo_erp,
              pct: k.saldo_erp_total ? Math.round((d.saldo_erp / k.saldo_erp_total) * 1000) / 10 : 0,
            }))}
          />
        </Panel>
      </div>

      {k.clientes_saldo_sin_ticket > 0 && (
        <Panel
          title="Saldo del ERP sin venta que lo respalde"
          action={<span className="num text-xs text-muted-foreground">{k.clientes_saldo_sin_ticket} clientes · ${formatMoney(k.saldo_sin_ticket)}</span>}
          flush
        >
          <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">
            El ERP tiene este saldo en la cuenta del cliente, pero no viene de ninguna venta a crédito abierta (por ejemplo saldos iniciales o ajustes). No es un error del CRM.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-table">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="h-10 px-4 font-medium">Cliente</th>
                  <th className="px-2 text-right font-medium">Saldo en el ERP</th>
                  <th className="px-2 text-right font-medium">En ventas abiertas</th>
                  <th className="px-4 text-right font-medium">Sin venta</th>
                </tr>
              </thead>
              <tbody>
                {data!.sin_ticket.map((d) => (
                  <tr key={d.cliente_id} className="h-11 border-b last:border-0 hover:bg-accent">
                    <td className="max-w-[260px] px-4">
                      <Link href={`/clientes/${d.cliente_id}`} className="block truncate font-medium hover:underline">{d.nombre}</Link>
                      <span className="text-xs text-muted-foreground">{d.ubicacion}</span>
                    </td>
                    <td className="num px-2 text-right">{fmtMonto(d.saldo_erp)}</td>
                    <td className="num px-2 text-right">{fmtMonto(d.saldo_tickets)}</td>
                    <td className="num px-4 text-right font-semibold text-warning-text">{fmtMonto(d.sin_ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Por ubicación" flush>
        <div className="overflow-x-auto">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="h-10 px-4 font-medium">Ubicación</th>
                <th className="px-2 text-right font-medium">Clientes guardados</th>
                <th className="px-2 text-right font-medium">Con crédito</th>
                <th className="px-2 text-right font-medium">Tickets</th>
                <th className="px-2 text-right font-medium">Saldo tickets</th>
                <th className="px-2 text-right font-medium">Saldo ERP</th>
                <th className="px-4 text-right font-medium">Saldo CRM</th>
              </tr>
            </thead>
            <tbody>
              {data!.por_ubicacion.map((u) => (
                <tr key={u.id} className="h-11 border-b last:border-0">
                  <td className="px-4"><div className="font-medium">{u.nombre}</div>{u.empresa && <div className="text-xs text-muted-foreground">{u.empresa}</div>}</td>
                  <td className="num px-2 text-right">{u.vinculados}</td>
                  <td className="num px-2 text-right">{u.con_credito}</td>
                  <td className="num px-2 text-right">{u.tickets}</td>
                  <td className="num px-2 text-right font-medium">${formatMoney(u.saldo)}</td>
                  <td className="num px-2 text-right">{fmtMonto(u.saldo_erp)}</td>
                  <td className="num px-4 text-right">{fmtMonto(u.saldo_crm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Clientes con el saldo sin sincronizar"
        action={
          data!.desincronizados.length > 0 && (
            <Button size="sm" disabled={marcados.size === 0} loading={sincronizar.isPending} onClick={() => sincronizar.mutate([...marcados])}>
              Sincronizar {marcados.size > 0 ? marcados.size : ''} {marcados.size === 1 ? 'seleccionado' : 'seleccionados'}
            </Button>
          )
        }
        flush
      >
        {data!.desincronizados.length === 0 ? (
          <EmptyState title="Todos los saldos del CRM coinciden con los del ERP." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-table">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="h-10 w-10 px-4">
                    <input type="checkbox" aria-label="Elegir todos" className="accent-[hsl(var(--primary))]" checked={todos} onChange={() => setMarcados(todos ? new Set() : new Set(data!.desincronizados.map((d) => d.cliente_id)))} />
                  </th>
                  <th className="px-2 font-medium">Cliente</th>
                  <th className="px-2 text-right font-medium">ERP</th>
                  <th className="px-2 text-right font-medium">CRM</th>
                  <th className="px-2 text-right font-medium">Diferencia</th>
                  <th className="px-4 font-medium max-md:hidden">Leído</th>
                </tr>
              </thead>
              <tbody>
                {data!.desincronizados.map((d) => (
                  <tr key={d.cliente_id} className="h-11 border-b last:border-0">
                    <td className="px-4">
                      <input type="checkbox" aria-label={`Elegir ${d.nombre}`} className="accent-[hsl(var(--primary))]" checked={marcados.has(d.cliente_id)} onChange={() => setMarcados((s) => { const n = new Set(s); if (n.has(d.cliente_id)) n.delete(d.cliente_id); else n.add(d.cliente_id); return n; })} />
                    </td>
                    <td className="max-w-[240px] px-2">
                      <Link href={`/clientes/${d.cliente_id}`} className="block truncate font-medium hover:underline">{d.nombre}</Link>
                      <span className="text-xs text-muted-foreground">{d.ubicacion}</span>
                    </td>
                    <td className="num px-2 text-right">{fmtMonto(d.saldo_erp)}</td>
                    <td className="num px-2 text-right">{fmtMonto(d.saldo_crm)}</td>
                    <td className="num px-2 text-right font-medium text-warning-text">{d.diferencia > 0 ? '+' : '−'}${formatMoney(Math.abs(d.diferencia))}</td>
                    <td className="px-4 text-muted-foreground max-md:hidden">{haceCuanto(d.saldo_erp_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ── Cobranza ────────────────────────────────────────────────────────────────
function inicioMes() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(d).slice(0, 7) + '-01';
}
function hoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

function Cobranza({ ubicacion, empresa }: { ubicacion: string; empresa: string }) {
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const { data, isLoading, error } = useQuery({
    queryKey: ['reportes', 'cobranza', empresa, ubicacion, desde, hasta],
    queryFn: () => api<ReporteCobranza>('/reportes/cobranza', { params: { ubicacion_id: ubicacion, empresa_id: empresa, desde, hasta } }),
    placeholderData: (prev) => prev,
  });
  const k = data?.kpis;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="Desde" active>
          <input type="date" className={sel} value={desde} max={hasta} onChange={(e) => e.target.value && setDesde(e.target.value)} />
        </FilterChip>
        <FilterChip label="Hasta" active>
          <input type="date" className={sel} value={hasta} min={desde} max={hoy()} onChange={(e) => e.target.value && setHasta(e.target.value)} />
        </FilterChip>
        <Button size="sm" variant="ghost" onClick={() => { setDesde(inicioMes()); setHasta(hoy()); }}>Este mes</Button>
      </div>
      <ErrorNote error={error} />

      {isLoading || !k ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Cobrado (confirmado)" value={`$${formatMoney(k.cobrado_mxn)}`} sub={`${k.movimientos} movimientos · promedio $${formatMoney(k.promedio_mxn)}`} />
            <Kpi label="Clientes que pagaron" value={String(k.clientes_que_pagaron)} sub={`${k.clientes_con_credito_abierto} tienen crédito abierto`} />
            <Kpi label="Con crédito y sin pagos" value={String(k.clientes_con_credito_sin_pago)} sub="en este periodo" tone={k.clientes_con_credito_sin_pago > 0 ? 'warning' : undefined} />
            <Kpi label="Aplicado a tickets" value={`$${formatMoney(k.aplicado_a_tickets_mxn)}`} sub={`${k.movimientos_ligados_a_tickets} ${k.movimientos_ligados_a_tickets === 1 ? 'movimiento ligado' : 'movimientos ligados'} a tickets`} />
          </div>

          <Panel title="Cobranza por día">
            <BarSeries
              height={220}
              data={data!.serie.map((s) => ({
                key: s.fecha,
                label: fmtDiaCorto(s.fecha),
                value: s.monto_mxn,
                highlight: s.fecha === hoy(),
                tooltipTitle: fmtDiaCorto(s.fecha),
                tooltipSub: `${s.movimientos} ${s.movimientos === 1 ? 'movimiento' : 'movimientos'}`,
              }))}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Por tipo de movimiento">
              <HBarList empty="Sin cobranza en el periodo." rows={data!.por_tipo.map((t) => ({ key: t.tipo, label: TIPO_LABEL[t.tipo as TipoMovimiento] ?? t.tipo, sub: `${t.movimientos} mov.`, value: t.monto_mxn, pct: t.pct }))} />
            </Panel>
            <Panel title="¿A dónde cayó?">
              <HBarList empty="Sin cobranza en el periodo." rows={data!.por_cuenta.map((c) => ({ key: c.cuenta_id, label: <AccountTag type={c.tipo} name={c.alias} />, sub: c.ejecutivo ?? undefined, value: c.monto_mxn, pct: c.pct, className: c.tipo === 'EMPRESA' ? 'bg-company' : 'bg-executive' }))} />
            </Panel>
            <Panel title="Por ubicación">
              <HBarList empty="Sin cobranza en el periodo." rows={data!.por_ubicacion.map((u) => ({ key: u.id, label: u.nombre, sub: `${u.movimientos} mov.`, value: u.monto_mxn, pct: k.cobrado_mxn ? Math.round((u.monto_mxn / k.cobrado_mxn) * 1000) / 10 : 0 }))} />
            </Panel>
          </div>

          <Panel title="Con crédito abierto y sin pagos en el periodo" flush>
            {data!.sin_pago.length === 0 ? (
              <EmptyState title="Todos los clientes con crédito abierto pagaron algo en este periodo." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-table">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="h-10 px-4 font-medium">Cliente</th>
                      <th className="px-2 font-medium max-md:hidden">Ubicación</th>
                      <th className="px-2 text-right font-medium">Tickets</th>
                      <th className="px-4 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.sin_pago.map((s) => (
                      <tr key={s.cliente_id} className="h-11 border-b last:border-0 hover:bg-accent">
                        <td className="px-4"><Link href={`/clientes/${s.cliente_id}`} className="font-medium hover:underline">{s.nombre}</Link></td>
                        <td className="px-2 text-muted-foreground max-md:hidden">{s.ubicacion}</td>
                        <td className="num px-2 text-right">{s.tickets}</td>
                        <td className="num px-4 text-right font-semibold">${formatMoney(s.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <p className="text-xs text-muted-foreground">
            Periodo del {fmtFecha(data!.periodo.desde)} al {fmtFecha(data!.periodo.hasta)}. {k.sincronizaciones > 0 && `Hubo ${k.sincronizaciones} sincronizaciones de saldo con el ERP (cambio neto ${k.sincronizacion_neta_mxn >= 0 ? '+' : '−'}$${formatMoney(Math.abs(k.sincronizacion_neta_mxn))}); no cuentan como cobranza.`}
          </p>
        </>
      )}
    </div>
  );
}
