'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Clock, Plus, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { compacto, fmtDiaCorto, fmtFecha, fmtFechaLarga, formatMoney, METODO_LABEL, nombreCliente } from '@/lib/format';
import { FiltroUbicacionChips, useFiltroUbicacion } from '@/components/filtro-ubicacion';
import type { Dashboard } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarSeries, HBarList, ShareBar, Sparkline } from '@/components/charts/charts';
import { AccountGlyph, AccountTag, CurrencyChip } from '@/components/ui/badges';
import { ErrorNote, EmptyState, Panel, PageHeader, Skeleton } from '@/components/ui/primitives';
import { MovimientosTable } from '@/components/movimientos-table';

const RANGOS = [14, 30, 60];

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
  href,
  children,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: LucideIcon;
  tone?: 'default' | 'warning';
  href?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <div
      className={cn(
        'flex h-full flex-col gap-1 rounded-lg border bg-card p-4 transition-colors',
        href && 'hover:bg-accent',
        tone === 'warning' && 'border-warning/40 bg-warning-soft/60',
      )}
    >
      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <span>{label}</span>
        <Icon className={cn('size-4', tone === 'warning' && 'text-warning-text')} strokeWidth={1.75} />
      </div>
      <div className="num font-sans text-[26px] font-semibold leading-tight sm:text-[30px]">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      {children && <div className="mt-auto pt-2">{children}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const [dias, setDias] = useState(14);
  const f = useFiltroUbicacion();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', f.empresa, f.ubicacion, dias],
    queryFn: () => api<Dashboard>('/dashboard', { params: { ...f.params, dias } }),
    refetchInterval: 60_000,
  });

  const k = data?.kpis;
  const v = k?.mes.variacion_pct ?? null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={<span className="first-letter:uppercase">Hoy, {fmtFechaLarga()}</span>}
        actions={
          <Link
            href="/movimientos/nuevo"
            className="inline-flex h-[34px] items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 max-md:hidden"
          >
            <Plus className="size-4" strokeWidth={2} />
            Registrar movimiento
          </Link>
        }
      />

      {/* Filtro: empresa (si hay varias) y, debajo, sus ubicaciones */}
      {f.variasEmpresas && (
        <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="Empresa">
          {[{ id: '', nombre: 'Todas las empresas' }, ...f.empresas].map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={f.empresa === e.id}
              onClick={() => f.setEmpresa(e.id)}
              className={cn(
                'h-8 shrink-0 rounded-md border px-3 text-[13px] font-medium transition-colors max-md:h-10',
                f.empresa === e.id ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card hover:bg-accent',
              )}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      )}
      <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="Ubicación">
        {[{ id: '', nombre: 'Todas las ubicaciones' }, ...f.ubicaciones].map((e) => (
          <button
            key={e.id}
            role="tab"
            aria-selected={f.ubicacion === e.id}
            onClick={() => f.setUbicacion(e.id)}
            className={cn(
              'h-8 shrink-0 rounded-md border px-3 text-[13px] transition-colors max-md:h-10',
              f.ubicacion === e.id ? 'border-primary/40 bg-accent font-medium text-accent-foreground' : 'border-input bg-card hover:bg-accent',
            )}
          >
            {f.variasEmpresas && !f.empresa && (e as { empresa?: { nombre: string } }).empresa
              ? `${(e as { empresa: { nombre: string } }).empresa.nombre} · ${e.nombre}`
              : e.nombre}
          </button>
        ))}
      </div>

      <ErrorNote error={error} />

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {isLoading || !k ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)
        ) : (
          <>
            <Kpi
              label="Cobrado hoy"
              icon={TrendingUp}
              value={`$${formatMoney(k.hoy.monto_mxn)}`}
              sub={`${k.hoy.movimientos} ${k.hoy.movimientos === 1 ? 'movimiento confirmado' : 'movimientos confirmados'}`}
            >
              <Sparkline values={data.serie.map((s) => s.monto_mxn)} />
            </Kpi>
            <Kpi
              label="Cobrado en el mes"
              icon={TrendingUp}
              value={`$${formatMoney(k.mes.monto_mxn)}`}
              sub={
                v === null ? (
                  `${k.mes.movimientos} movimientos`
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {v >= 0 ? <ArrowUpRight className="size-3.5 text-income" /> : <ArrowDownRight className="size-3.5" />}
                    <span className={cn('num font-medium', v >= 0 ? 'text-income' : 'text-foreground')}>
                      {v >= 0 ? '+' : '−'}
                      {Math.abs(v)}%
                    </span>
                    vs. mismo punto del mes anterior
                  </span>
                )
              }
            />
            <Kpi
              label="Por confirmar"
              icon={Clock}
              tone={k.por_confirmar.movimientos > 0 ? 'warning' : 'default'}
              href="/movimientos?estatus=PENDIENTE"
              value={`$${formatMoney(k.por_confirmar.monto_mxn)}`}
              sub={`${k.por_confirmar.movimientos} ${k.por_confirmar.movimientos === 1 ? 'pendiente' : 'pendientes'} de verse en el banco`}
            />
            <Kpi
              label="Por cobrar"
              icon={Users}
              value={`$${formatMoney(k.por_cobrar.monto_mxn)}`}
              sub={
                k.por_cobrar.por_moneda.length === 0
                  ? 'Ningún cliente con saldo'
                  : `${k.clientes_activos} clientes activos`
              }
            >
              {k.por_cobrar.por_moneda.length > 0 && (
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {k.por_cobrar.por_moneda.map((s) => (
                    <li key={s.moneda} className="inline-flex items-center gap-1.5">
                      <CurrencyChip code={s.moneda} />
                      <span className="num">{formatMoney(s.saldo)}</span>
                      <span className="text-muted-foreground">({s.clientes})</span>
                    </li>
                  ))}
                </ul>
              )}
            </Kpi>
          </>
        )}
      </div>

      {/* Serie + destino */}
      <div className="mb-5 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Panel
          title={`Cobranza confirmada, últimos ${dias} días`}
          action={
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Rango de días">
              {RANGOS.map((r) => (
                <button
                  key={r}
                  onClick={() => setDias(r)}
                  aria-pressed={dias === r}
                  className={cn('h-7 rounded-[4px] px-2.5 text-xs', dias === r ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {r} d
                </button>
              ))}
            </div>
          }
        >
          {!data ? (
            <Skeleton className="h-[240px]" />
          ) : (
            <BarSeries
              height={290}
              data={data.serie.map((s) => ({
                key: s.fecha,
                label: fmtDiaCorto(s.fecha),
                value: s.monto_mxn,
                highlight: s.es_hoy,
                tooltipTitle: s.es_hoy ? `Hoy, ${fmtDiaCorto(s.fecha)}` : fmtDiaCorto(s.fecha),
                tooltipSub: `${s.movimientos} ${s.movimientos === 1 ? 'movimiento' : 'movimientos'}`,
              }))}
            />
          )}
        </Panel>

        <Panel title="¿A dónde cayó el dinero?" action={<span className="text-xs text-muted-foreground">Mes en curso</span>}>
          {!data ? (
            <Skeleton className="h-[240px]" />
          ) : data.destino.total_mxn === 0 ? (
            <EmptyState title="Aún no hay dinero confirmado este mes.">
              Cuando confirmes un movimiento verás aquí en qué cuenta cayó.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-5">
              <ShareBar
                total={data.destino.total_mxn}
                segments={[
                  { key: 'empresa', label: 'Cuentas de la empresa', value: data.destino.empresa.monto_mxn, pct: data.destino.empresa.pct, className: 'bg-company' },
                  { key: 'ejecutivo', label: 'Cuentas de ejecutivos', value: data.destino.ejecutivo.monto_mxn, pct: data.destino.ejecutivo.pct, className: 'bg-executive' },
                ]}
              />
              <HBarList
                empty=""
                rows={data.destino.cuentas.slice(0, 5).map((c) => ({
                  key: c.cuenta_id,
                  label: <AccountTag type={c.tipo} name={c.alias} />,
                  sub: c.ejecutivo ?? c.banco,
                  value: c.monto_mxn,
                  pct: c.pct,
                  className: c.tipo === 'EMPRESA' ? 'bg-company' : 'bg-executive',
                }))}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* Por confirmar */}
      {(data?.por_confirmar.length ?? 0) > 0 && (
        <Panel
          className="mb-5 border-warning/30"
          title={
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4 text-warning-text" strokeWidth={1.75} />
              Por confirmar
            </span>
          }
          action={
            <Link href="/movimientos?estatus=PENDIENTE" className="text-[13px] font-medium text-primary hover:underline">
              Ver todos
            </Link>
          }
          flush
        >
          <MovimientosTable items={data!.por_confirmar} compacto />
        </Panel>
      )}

      {/* Top clientes / formas de pago / divisas */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Panel title="Quién más pagó este mes">
          {!data ? (
            <Skeleton className="h-40" />
          ) : (
            <HBarList
              empty="Sin cobranza confirmada este mes."
              rows={data.top_clientes.map((c) => ({
                key: c.cliente_id,
                label: <Link href={`/clientes/${c.cliente_id}`} className="hover:underline">{c.nombre}</Link>,
                sub: `${c.movimientos} ${c.movimientos === 1 ? 'movimiento' : 'movimientos'}`,
                value: c.monto_mxn,
                pct: c.pct,
              }))}
            />
          )}
        </Panel>
        <Panel title="Formas de pago">
          {!data ? (
            <Skeleton className="h-40" />
          ) : (
            <HBarList
              empty="Sin cobranza confirmada este mes."
              rows={data.metodos.map((m) => ({
                key: m.metodo,
                label: METODO_LABEL[m.metodo] ?? m.metodo,
                sub: `${m.movimientos} ${m.movimientos === 1 ? 'movimiento' : 'movimientos'}`,
                value: m.monto_mxn,
                pct: m.pct,
              }))}
            />
          )}
        </Panel>
        <Panel title="Por divisa" action={<span className="text-xs text-muted-foreground">Equivalente en MXN</span>}>
          {!data ? (
            <Skeleton className="h-40" />
          ) : (
            <HBarList
              empty="Sin cobranza confirmada este mes."
              rows={data.divisas.map((d) => ({
                key: d.moneda,
                label: <span className="inline-flex items-center gap-2"><CurrencyChip code={d.moneda} />{d.moneda === 'MXN' ? 'Peso mexicano' : d.moneda}</span>,
                sub: d.moneda === 'MXN' ? undefined : `${compacto(d.monto).replace('$', '')} ${d.moneda} recibidos`,
                value: d.monto_mxn,
                pct: d.pct,
                className: d.moneda === 'MXN' ? 'bg-company' : 'bg-brass',
              }))}
            />
          )}
        </Panel>
      </div>

      {/* Cuentas destino (detalle) */}
      {data && data.destino.cuentas.length > 0 && (
        <Panel title="Cuentas que recibieron dinero" action={<span className="text-xs text-muted-foreground">Mes en curso</span>} className="mb-5" flush>
          <div className="overflow-x-auto">
            <table className="w-full text-table">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="h-10 px-4 font-medium">Cuenta</th>
                  <th className="px-2 font-medium max-md:hidden">Tipo</th>
                  <th className="px-2 font-medium max-md:hidden">Titular / ejecutivo</th>
                  <th className="px-2 text-right font-medium">Movimientos</th>
                  <th className="px-2 text-right font-medium">Monto (MXN)</th>
                  <th className="px-4 text-right font-medium">Parte</th>
                </tr>
              </thead>
              <tbody>
                {data.destino.cuentas.map((c) => (
                  <tr key={c.cuenta_id} className="h-11 border-b last:border-0 hover:bg-accent">
                    <td className="px-4">
                      <div className="flex items-center gap-2.5">
                        <AccountGlyph type={c.tipo} className="size-7 [&>svg]:size-3.5" />
                        <Link href={`/movimientos?cuenta_destino_id=${c.cuenta_id}`} className="font-medium hover:underline">
                          {c.alias}
                        </Link>
                      </div>
                    </td>
                    <td className="px-2 max-md:hidden"><AccountTag type={c.tipo} /></td>
                    <td className="px-2 text-muted-foreground max-md:hidden">{c.ejecutivo ?? c.banco}</td>
                    <td className="num px-2 text-right">{c.movimientos}</td>
                    <td className="num px-2 text-right font-medium">${formatMoney(c.monto_mxn)}</td>
                    <td className="num px-4 text-right text-muted-foreground">{c.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Recientes */}
      <Panel
        title="Movimientos recientes"
        action={
          <Link href="/movimientos" className="text-[13px] font-medium text-primary hover:underline">
            Ver todos
          </Link>
        }
        flush
      >
        {!data ? (
          <div className="p-4"><Skeleton className="h-40" /></div>
        ) : (
          <MovimientosTable
            items={data.recientes}
            acciones={false}
            compacto
            vacio={
              <EmptyState title="Aún no hay movimientos.">
                <Link href="/movimientos/nuevo" className="font-medium text-primary hover:underline">Registra el primero.</Link>
              </EmptyState>
            }
          />
        )}
      </Panel>
    </>
  );
}
