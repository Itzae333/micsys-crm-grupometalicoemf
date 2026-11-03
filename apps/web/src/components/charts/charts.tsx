'use client';

import { useState } from 'react';
import { compacto, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Redondea el máximo a un valor "bonito" para el eje Y. */
function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x + 1e-9) ?? 10;
  return m * p;
}

export interface BarDatum {
  key: string;
  label: string; // eje X
  value: number;
  tooltipTitle: string;
  tooltipSub?: string;
  highlight?: boolean; // "hoy" en latón
}

/** Una sola serie, un solo eje Y. Barras en `company`; el día de hoy en `brass`. */
export function BarSeries({ data, height = 200 }: { data: BarDatum[]; height?: number }) {
  const [active, setActive] = useState<string | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((t) => t * max);
  const cada = data.length > 20 ? Math.ceil(data.length / 10) : data.length > 10 ? 2 : 1;
  const sel = data.find((d) => d.key === active);

  return (
    <div className="relative" role="img" aria-label="Gráfica de barras de cobranza confirmada por día">
      <div className="flex" style={{ height }}>
        <div className="flex w-12 shrink-0 flex-col justify-between pr-2 text-right text-[11px] text-muted-foreground num" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0 last:-translate-y-1">
              {t === 0 ? '$0' : compacto(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="border-t border-border/70" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
            {data.map((d) => {
              const h = max > 0 ? (d.value / max) * 100 : 0;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-label={`${d.tooltipTitle}: ${formatMoney(d.value)} pesos`}
                  onMouseEnter={() => setActive(d.key)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(d.key)}
                  onBlur={() => setActive(null)}
                  className="group relative flex h-full flex-1 items-end focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'mx-auto w-full max-w-[56px] rounded-t-[3px] transition-opacity',
                      d.highlight ? 'bg-brass' : 'bg-company',
                      active && active !== d.key && 'opacity-45',
                      d.value === 0 && 'min-h-[2px] bg-border',
                    )}
                    style={{ height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%` }}
                  />
                  <span className="absolute inset-x-0 bottom-0 top-0 rounded-sm group-focus-visible:ring-2 group-focus-visible:ring-ring" />
                </button>
              );
            })}
          </div>
          {sel && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-pop"
              style={{
                left: `${((data.findIndex((d) => d.key === sel.key) + 0.5) / data.length) * 100}%`,
                bottom: `calc(${Math.min((sel.value / max) * 100, 100)}% + 8px)`,
              }}
            >
              <div className="whitespace-nowrap text-muted-foreground">{sel.tooltipTitle}</div>
              <div className="num whitespace-nowrap font-semibold">${formatMoney(sel.value)}</div>
              {sel.tooltipSub && <div className="whitespace-nowrap text-muted-foreground">{sel.tooltipSub}</div>}
            </div>
          )}
        </div>
      </div>
      <div className="flex pl-12 pt-1.5 text-[11px] text-muted-foreground" aria-hidden>
        {data.map((d, i) => (
          <span
            key={d.key}
            className={cn('flex-1 whitespace-nowrap text-center', d.highlight && 'font-semibold text-brass-foreground', i % cada !== 0 && 'invisible')}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  pct: number;
  className: string; // bg-company, bg-executive...
  sub?: string;
}

/** Barra segmentada con 2 px de separación, leyenda directa (monto + %) y tooltip. */
export function ShareBar({ segments, total }: { segments: Segment[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);
  const visibles = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-sm" role="img" aria-label="Reparto del dinero cobrado por tipo de cuenta">
        {total === 0 ? (
          <div className="h-full w-full bg-muted" />
        ) : (
          visibles.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: $${formatMoney(s.value)} (${s.pct}%)`}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              className={cn('h-full transition-opacity', s.className, active && active !== s.key && 'opacity-45')}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))
        )}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5">
            <span className={cn('mt-1 size-2.5 shrink-0 rounded-[2px]', s.className)} />
            <div className="min-w-0">
              <div className="text-[13px] text-muted-foreground">{s.label}</div>
              <div className="num text-base font-semibold">${formatMoney(s.value)}</div>
              <div className="text-xs text-muted-foreground">
                {s.pct}% {s.sub && `· ${s.sub}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface HBarRow {
  key: string;
  label: React.ReactNode;
  sub?: React.ReactNode;
  value: number;
  pct: number;
  right?: React.ReactNode;
  className?: string;
}

/** Lista con barra horizontal proporcional al máximo de la lista. */
export function HBarList({ rows, empty }: { rows: HBarRow[]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <div className="min-w-0 text-[13px]">
              <div className="truncate font-medium">{r.label}</div>
              {r.sub && <div className="truncate text-xs text-muted-foreground">{r.sub}</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="num text-[13px] font-semibold">{r.right ?? `$${formatMoney(r.value)}`}</div>
              <div className="num text-xs text-muted-foreground">{r.pct}%</div>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', r.className ?? 'bg-company')} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Mini línea para tarjetas KPI. Decorativa: el número manda. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - (v / max) * (h - 6)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-7 w-full', className)} aria-hidden>
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} className="fill-company/10 stroke-none" />
      <polyline points={pts.join(' ')} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" className="stroke-company" />
    </svg>
  );
}
