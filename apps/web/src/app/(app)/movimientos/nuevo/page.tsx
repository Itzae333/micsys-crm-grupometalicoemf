'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Link2, Paperclip, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { movimientoSchema, TIPOS_INGRESO, TIPO_LABEL, TIPOS_MOVIMIENTO } from '@micsys-crm/shared';
import type { TipoMovimiento } from '@micsys-crm/shared';
import { api, apiUpload } from '@/lib/api';
import { cuentaCorta, fmtFecha, formatMoney, hoyYmd, METODO_LABEL, nombreCliente, num, simboloMoneda } from '@/lib/format';
import { useCuentasDestino, useDebounced, useMonedas } from '@/lib/hooks';
import type { Cliente, ClienteDetalle, CuentaDestino, Ticket, TicketsPage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AccountGlyph, CurrencyChip } from '@/components/ui/badges';
import { Button, ErrorNote, Field, Input, PageHeader, Panel, Select, Skeleton, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

const METODOS = ['TRANSFERENCIA', 'DEPOSITO', 'EFECTIVO', 'CHEQUE'] as const;

function ClientePicker({ value, onChange }: { value: Cliente | null; onChange: (c: Cliente | null) => void }) {
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const s = useDebounced(q.trim(), 250);
  const { data } = useQuery({
    queryKey: ['clientes', 'picker', s],
    queryFn: () => api<{ items: Cliente[] }>('/clientes', { params: { q: s, limit: 8, activo: true } }),
    enabled: abierto,
  });
  if (value) {
    return (
      <div className="flex h-9 items-center justify-between rounded-md border border-input bg-card px-3 text-sm max-md:h-[42px]">
        <span className="truncate font-medium">{nombreCliente(value)}</span>
        <button type="button" aria-label="Quitar cliente" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Buscar cliente por nombre, RFC o teléfono…" value={q} onChange={(e) => { setQ(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)} />
      {abierto && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-pop">
          {(data?.items.length ?? 0) === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">{s ? 'Sin resultados.' : 'Escribe para buscar.'}</li>
          ) : (
            data!.items.map((c) => (
              <li key={c.id}>
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={() => { onChange(c); setQ(''); setAbierto(false); }}>
                  <div className="font-medium">{nombreCliente(c)}</div>
                  <div className="num text-xs text-muted-foreground">{[c.rfc, c.telefono].filter(Boolean).join(' · ')}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function CuentaCard({ c, sel, onSel }: { c: CuentaDestino; sel: boolean; onSel: () => void }) {
  return (
    <button
      type="button"
      onClick={onSel}
      aria-pressed={sel}
      className={cn(
        'flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors',
        sel ? 'border-primary bg-accent ring-1 ring-primary' : 'bg-card hover:bg-accent',
      )}
    >
      <AccountGlyph type={c.tipo} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{c.alias}</div>
        <div className="truncate text-xs text-muted-foreground">
          {c.tipo === 'EJECUTIVO' && c.ejecutivo ? `${c.ejecutivo.nombre} · ` : ''}
          {cuentaCorta(c.banco, c.clabe, c.numero)}
        </div>
      </div>
      {c.moneda !== 'MXN' && <CurrencyChip code={c.moneda} />}
      {sel && <Check className="size-4 shrink-0 text-primary" strokeWidth={2} />}
    </button>
  );
}

function Formulario() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const cuentas = useCuentasDestino(true);
  const monedas = useMonedas();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [tipo, setTipo] = useState<TipoMovimiento>('COBRO');
  const [metodo, setMetodo] = useState<(typeof METODOS)[number]>('TRANSFERENCIA');
  const [fecha, setFecha] = useState(hoyYmd());
  const [referencia, setReferencia] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [monto, setMonto] = useState('');
  const [tc, setTc] = useState('');
  const [motivo, setMotivo] = useState<'VENTA' | 'OTRO'>('OTRO');
  const [categoria, setCategoria] = useState('');
  const [concepto, setConcepto] = useState('');
  const [cuentaClienteId, setCuentaClienteId] = useState('');
  const [aplicar, setAplicar] = useState<Record<string, string>>({});
  const [archivos, setArchivos] = useState<File[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState('');

  // Cliente preseleccionado desde ?cliente_id=
  const preId = sp.get('cliente_id');
  const pre = useQuery({
    queryKey: ['cliente', preId],
    queryFn: () => api<ClienteDetalle>(`/clientes/${preId}`),
    enabled: !!preId,
  });
  useEffect(() => {
    if (pre.data && !cliente) setCliente(pre.data);
  }, [pre.data, cliente]);

  const detalle = useQuery({
    queryKey: ['cliente', cliente?.id],
    queryFn: () => api<ClienteDetalle>(`/clientes/${cliente!.id}`),
    enabled: !!cliente,
  });
  const cuentasCliente = detalle.data?.cuentas.filter((c) => c.activa) ?? [];
  const vinculadoErp = !!detalle.data?.erp_link;

  const esIngreso = TIPOS_INGRESO.includes(tipo);
  const cuenta = cuentas.data?.find((c) => c.id === cuentaId);
  const moneda = cuenta?.moneda ?? 'MXN';
  const fx = moneda !== 'MXN';
  const montoN = Number(monto) || 0;

  // Tipo de cambio sugerido: el último registrado de esa moneda
  const tcSugerido = monedas.data?.find((m) => m.codigo === moneda)?.tipo_cambio?.valor;
  useEffect(() => {
    setTc(fx && tcSugerido ? String(Number(tcSugerido)) : '');
  }, [moneda, fx, tcSugerido]);
  const tcN = fx ? Number(tc) || 0 : 1;

  // Tickets a crédito del cliente (foto del ERP guardada en el CRM)
  const ventasQ = useQuery({
    queryKey: ['creditos', 'cliente', cliente?.id, 'abiertos', 'captura'],
    queryFn: () => api<TicketsPage>('/creditos/tickets', { params: { cliente_id: cliente!.id, estado: 'abiertos', limit: 100 } }),
    enabled: !!cliente && motivo === 'VENTA' && vinculadoErp,
  });
  const ventas: Ticket[] = (ventasQ.data?.items ?? []).filter((v) => num(v.saldo) > 0);
  const aplicado = useMemo(() => Object.values(aplicar).reduce((a, v) => a + (Number(v) || 0), 0), [aplicar]);

  function toggleVenta(v: Ticket, on: boolean) {
    setAplicar((s) => {
      const n = { ...s };
      if (!on) {
        delete n[v.id];
        return n;
      }
      const restante = Math.max(0, montoN - Object.values(s).reduce((a, x) => a + (Number(x) || 0), 0));
      n[v.id] = String(Math.min(num(v.saldo), restante || num(v.saldo)));
      return n;
    });
  }

  const guardar = useMutation({
    mutationFn: async () => {
      const body = {
        cliente_id: cliente?.id ?? '',
        tipo,
        metodo: esIngreso ? metodo : null,
        motivo,
        categoria_otro: motivo === 'OTRO' ? categoria : null,
        concepto: concepto.trim() || (motivo === 'VENTA' ? 'Pago de tickets a crédito' : ''),
        referencia: referencia || null,
        cuenta_destino_id: esIngreso ? cuentaId || null : null,
        cuenta_cliente_id: cuentaClienteId || null,
        monto: montoN,
        tipo_cambio: fx ? tcN : undefined,
        fecha_movimiento: fecha,
        confirmar,
        ventas:
          motivo === 'VENTA'
            ? ventas
                .filter((v) => Number(aplicar[v.id]) > 0)
                .map((v) => ({ erp_venta_id: v.erp_nota_id, folio: String(v.folio), erp_empresa: v.cliente.ubicacion.nombre, monto_aplicado: Number(aplicar[v.id]) }))
            : [],
      };
      const p = movimientoSchema.safeParse(body);
      if (!p.success) throw new Error(p.error.issues[0].message);
      if (fx && !(tcN > 0)) throw new Error(`Indica el tipo de cambio de ${moneda}.`);
      const mov = await api<{ id: string; folio: number }>('/movimientos', { body: p.data });
      // Los comprobantes se suben después; si uno falla, el movimiento ya quedó registrado.
      const fallos: string[] = [];
      for (const f of archivos) {
        try {
          await apiUpload(`/movimientos/${mov.id}/comprobantes`, f);
        } catch (e) {
          fallos.push(`${f.name}: ${(e as Error).message}`);
        }
      }
      return { mov, fallos };
    },
    onSuccess: ({ mov, fallos }) => {
      if (fallos.length) toast.error(`El movimiento se registró, pero no se pudo subir: ${fallos.join('; ')}`);
      else toast.ok(`Movimiento ${mov.folio} registrado. ${confirmar ? 'Quedó Confirmado.' : 'Quedó Pendiente.'}`);
      router.push(`/movimientos/${mov.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const grupos = {
    EMPRESA: cuentas.data?.filter((c) => c.tipo === 'EMPRESA') ?? [],
    EJECUTIVO: cuentas.data?.filter((c) => c.tipo === 'EJECUTIVO') ?? [],
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        guardar.mutate();
      }}
      className="grid gap-5 lg:grid-cols-[1fr_340px]"
    >
      <div className="flex flex-col gap-5">
        <Panel title="¿Quién pagó?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" className="sm:col-span-2">
              <ClientePicker value={cliente} onChange={(c) => { setCliente(c); setAplicar({}); setCuentaClienteId(''); }} />
            </Field>
            <Field label="Tipo de movimiento">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
                {TIPOS_MOVIMIENTO.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </Select>
            </Field>
            {esIngreso && (
              <Field label="Forma de pago" className="sm:col-span-2">
                <div className="grid grid-cols-4 gap-1 rounded-md border p-0.5" role="radiogroup" aria-label="Forma de pago">
                  {METODOS.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={metodo === m} onClick={() => setMetodo(m)}
                      className={cn('h-8 rounded-[4px] px-1 text-xs max-md:h-9', metodo === m ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
                      {METODO_LABEL[m]}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Fecha en que cayó">
              <Input type="date" value={fecha} max={hoyYmd()} onChange={(e) => setFecha(e.target.value)} className="num" />
            </Field>
            {esIngreso && (
              <Field label="Clave de rastreo / referencia" hint="Tal como aparece en el banco.">
                <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="num" />
              </Field>
            )}
            {cuentasCliente.length > 0 && (
              <Field label="Cuenta desde la que pagó" hint="Opcional.">
                <Select value={cuentaClienteId} onChange={(e) => setCuentaClienteId(e.target.value)}>
                  <option value="">Sin especificar</option>
                  {cuentasCliente.map((c) => <option key={c.id} value={c.id}>{c.alias || cuentaCorta(c.banco, c.clabe, c.numero)}</option>)}
                </Select>
              </Field>
            )}
          </div>
        </Panel>

        {esIngreso && (
          <Panel title="¿En qué cuenta se recibió el dinero?">
            {cuentas.isLoading ? (
              <Skeleton className="h-24" />
            ) : (cuentas.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay cuentas destino. Da de alta una en <a href="/cuentas" className="font-medium text-primary hover:underline">Cuentas</a>.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {(['EMPRESA', 'EJECUTIVO'] as const).map((g) =>
                  grupos[g].length === 0 ? null : (
                    <div key={g}>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">{g === 'EMPRESA' ? 'Cuentas de la empresa' : 'Cuentas de ejecutivos'}</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {grupos[g].map((c) => <CuentaCard key={c.id} c={c} sel={cuentaId === c.id} onSel={() => setCuentaId(c.id)} />)}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </Panel>
        )}

        <Panel title="Monto">
          <div className="flex flex-col gap-4">
            <div className="flex h-12 items-center gap-2 rounded-md border border-input bg-card px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 max-md:h-14">
              <span className="num text-lg text-muted-foreground">{simboloMoneda(moneda)}</span>
              <input
                aria-label="Monto recibido"
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))}
                className="num min-w-0 flex-1 bg-transparent text-right text-[22px] font-semibold outline-none placeholder:text-muted-foreground/50"
              />
              <CurrencyChip code={moneda} />
            </div>
            {fx && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Tipo de cambio (1 ${moneda} = ? MXN)`} hint={tcSugerido ? 'Sugerido con el último registrado; puedes ajustarlo.' : `Aún no hay tipo de cambio de ${moneda}.`}>
                  <Input value={tc} onChange={(e) => setTc(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className="num" />
                </Field>
                <div className="flex flex-col justify-end pb-1 text-sm">
                  <span className="text-xs text-muted-foreground">Equivale a</span>
                  <span className="num text-lg font-semibold">${formatMoney(montoN * tcN)} <span className="text-xs font-normal text-muted-foreground">MXN</span></span>
                </div>
              </div>
            )}
            {esIngreso && !cuenta && <p className="text-xs text-muted-foreground">La divisa la define la cuenta destino. Elige una para ver si lleva tipo de cambio.</p>}
          </div>
        </Panel>

        <Panel title="¿De qué es este pago?">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-md border p-0.5" role="radiogroup" aria-label="Motivo">
              {([['OTRO', 'Otro concepto'], ['VENTA', 'Tickets a crédito']] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={motivo === v} onClick={() => setMotivo(v)}
                  className={cn('inline-flex h-9 items-center justify-center gap-1.5 rounded-[4px] text-sm', motivo === v ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
                  {v === 'VENTA' && <Link2 className="size-3.5" />}
                  {l}
                </button>
              ))}
            </div>

            {motivo === 'OTRO' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Categoría" hint="Ej. anticipo, servicio, préstamo, otro.">
                  <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                </Field>
                <Field label="Concepto">
                  <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} />
                </Field>
              </div>
            ) : !cliente ? (
              <p className="text-sm text-muted-foreground">Elige primero al cliente para ver sus tickets.</p>
            ) : !vinculadoErp ? (
              <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-text">
                Este cliente no viene del ERP, así que no tiene tickets a crédito. Usa “Otro concepto”, o guarda al cliente desde el ERP.
              </p>
            ) : ventasQ.isLoading ? (
              <Skeleton className="h-24" />
            ) : ventasQ.error ? (
              <ErrorNote error={ventasQ.error} />
            ) : ventas.length === 0 ? (
              <p className="text-sm text-muted-foreground">El cliente no tiene tickets con saldo. Si es reciente, usa “Actualizar” en su ficha para leerlos del ERP.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-table">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="h-9 w-10 px-3" />
                      <th className="px-2 font-medium">Ticket</th>
                      <th className="px-2 font-medium">Fecha</th>
                      <th className="px-2 font-medium">Vence</th>
                      <th className="px-2 text-right font-medium">Saldo</th>
                      <th className="px-3 text-right font-medium">Aplicar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v) => {
                      const on = v.id in aplicar;
                      return (
                        <tr key={v.id} className="h-11 border-b last:border-0">
                          <td className="px-3"><input type="checkbox" aria-label={`Aplicar a ${v.folio}`} checked={on} onChange={(e) => toggleVenta(v, e.target.checked)} className="accent-[hsl(var(--primary))]" /></td>
                          <td className="num px-2 font-medium">#{v.folio}</td>
                          <td className="num px-2">{fmtFecha(v.fecha)}</td>
                          <td className="num px-2">{fmtFecha(v.vence)}</td>
                          <td className="num px-2 text-right">${formatMoney(num(v.saldo))}</td>
                          <td className="px-3 text-right">
                            <input disabled={!on} inputMode="decimal" value={aplicar[v.id] ?? ''} onChange={(e) => setAplicar((s) => ({ ...s, [v.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                              className="num h-8 w-28 rounded-md border border-input bg-card px-2 text-right text-sm disabled:opacity-40" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Comprobante">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input px-4 py-4 text-sm text-muted-foreground hover:bg-accent">
            <Paperclip className="size-4" strokeWidth={1.75} />
            <span>{archivos.length ? `${archivos.length} archivo(s) listo(s) para subir` : 'Adjuntar captura o PDF (JPG, PNG, WEBP o PDF · máx. 8 MB)'}</span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
          </label>
          {archivos.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {archivos.map((f) => <li key={f.name + f.size} className="num truncate">{f.name} · {(f.size / 1024).toFixed(0)} KB</li>)}
            </ul>
          )}
        </Panel>
      </div>

      {/* Resumen */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Panel title="Resumen">
          <dl className="flex flex-col gap-2.5 text-sm">
            <Fila k="Cliente" v={cliente ? nombreCliente(cliente) : '—'} />
            <Fila k="Tipo" v={TIPO_LABEL[tipo]} />
            {esIngreso && <Fila k="Cayó en" v={cuenta?.alias ?? '—'} />}
            <Fila k="Fecha" v={fmtFecha(`${fecha}T12:00:00-06:00`)} />
            <div className="my-1 border-t" />
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Monto</dt>
              <dd className="num text-xl font-semibold">{simboloMoneda(moneda)}{formatMoney(montoN)}</dd>
            </div>
            {fx && <Fila k="Equivale a" v={`$${formatMoney(montoN * tcN)} MXN`} />}
            {motivo === 'VENTA' && (
              <>
                <Fila k="Aplicado a tickets" v={`${simboloMoneda(moneda)}${formatMoney(aplicado)}`} />
                <Fila k="Sin aplicar" v={`${simboloMoneda(moneda)}${formatMoney(Math.max(0, montoN - aplicado))}`} warn={montoN - aplicado > 0.005} />
              </>
            )}
          </dl>

          {esIngreso && (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm has-[:checked]:border-success/40 has-[:checked]:bg-success-soft">
              <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} className="mt-0.5 accent-[hsl(var(--success))]" />
              <span>
                <span className="font-medium">Ya lo vi reflejado en el banco</span>
                <span className="block text-xs text-muted-foreground">Se registra como Confirmado. Si no, queda Pendiente.</span>
              </span>
            </label>
          )}

          {error && <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-text">{error}</p>}

          <div className="mt-4 flex flex-col gap-2">
            <Button type="submit" loading={guardar.isPending} className="h-10">Registrar movimiento</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          </div>
        </Panel>
      </aside>
    </form>
  );
}

function Fila({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn('num truncate text-right font-medium', warn && 'text-warning-text')}>{v}</dd>
    </div>
  );
}

export default function NuevoMovimientoPage() {
  return (
    <>
      <PageHeader title="Registrar movimiento" subtitle="Anota qué se recibió y en qué cuenta cayó." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Formulario />
      </Suspense>
    </>
  );
}
