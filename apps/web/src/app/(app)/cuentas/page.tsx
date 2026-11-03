'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cuentaDestinoSchema, ejecutivoSchema } from '@micsys-crm/shared';
import { api } from '@/lib/api';
import { cuentaCorta } from '@/lib/format';
import { useCuentasDestino, useEjecutivos, useMonedas } from '@/lib/hooks';
import type { CuentaDestino } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AccountGlyph, AccountTag, CurrencyChip } from '@/components/ui/badges';
import { Dialog } from '@/components/ui/dialog';
import { Button, EmptyState, ErrorNote, Field, Input, PageHeader, Panel, Select, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export default function CuentasPage() {
  const cuentas = useCuentasDestino();
  const ejecutivos = useEjecutivos();
  const [cuentaDlg, setCuentaDlg] = useState<CuentaDestino | 'nueva' | null>(null);
  const [ejecDlg, setEjecDlg] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  const estado = useMutation({
    mutationFn: (v: { id: string; activa: boolean }) => api(`/cuentas-destino/${v.id}/activa`, { method: 'PATCH', body: { activa: v.activa } }),
    onSuccess: (_d, v) => {
      toast.ok(v.activa ? 'Cuenta reactivada.' : 'Cuenta dada de baja. Conserva su historial.');
      qc.invalidateQueries({ queryKey: ['cuentas-destino'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = cuentas.data ?? [];
  const grupos = [
    { tipo: 'EMPRESA' as const, titulo: 'Cuentas de la empresa', items: lista.filter((c) => c.tipo === 'EMPRESA') },
    { tipo: 'EJECUTIVO' as const, titulo: 'Cuentas de ejecutivos', items: lista.filter((c) => c.tipo === 'EJECUTIVO') },
  ];

  return (
    <>
      <PageHeader
        title="Cuentas"
        subtitle="Las cuentas donde cae el dinero. No se borran: se dan de baja y conservan su historial."
        actions={
          <>
            <Button variant="outline" onClick={() => setEjecDlg(true)}>
              <UserRound className="size-4" strokeWidth={1.75} />
              Nuevo ejecutivo
            </Button>
            <Button onClick={() => setCuentaDlg('nueva')}>
              <Plus className="size-4" strokeWidth={2} />
              Dar de alta una cuenta
            </Button>
          </>
        }
      />

      {cuentas.isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="flex flex-col gap-5">
          {grupos.map((g) => (
            <Panel key={g.tipo} title={g.titulo} flush>
              {g.items.length === 0 ? (
                <EmptyState title={g.tipo === 'EMPRESA' ? 'Aún no hay cuentas de la empresa.' : 'Aún no hay cuentas de ejecutivos.'}>
                  {g.tipo === 'EJECUTIVO' && 'Primero registra al ejecutivo y luego da de alta su cuenta.'}
                </EmptyState>
              ) : (
                <ul className="divide-y">
                  {g.items.map((c) => (
                    <li key={c.id} className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3', !c.activa && 'opacity-60')}>
                      <div className="flex min-w-0 items-center gap-3">
                        <AccountGlyph type={c.tipo} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/movimientos?cuenta_destino_id=${c.id}`} className="truncate text-sm font-medium hover:underline">{c.alias}</Link>
                            {c.moneda !== 'MXN' && <CurrencyChip code={c.moneda} />}
                            {!c.activa && <span className="rounded-sm bg-canceled-soft px-1.5 py-0.5 text-[11px] text-canceled-text">De baja</span>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {c.tipo === 'EJECUTIVO' && c.ejecutivo ? `${c.ejecutivo.nombre} · ` : ''}
                            {cuentaCorta(c.banco, c.clabe, c.numero)}
                            {c.titular ? ` · ${c.titular}` : ''}
                            {` · ${c._count?.movimientos ?? 0} movimientos`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AccountTag type={c.tipo} />
                        <Button size="sm" variant="ghost" onClick={() => setCuentaDlg(c)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => estado.mutate({ id: c.id, activa: !c.activa })}>
                          {c.activa ? 'Dar de baja' : 'Reactivar'}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}

          <Panel title="Ejecutivos" flush>
            {(ejecutivos.data?.length ?? 0) === 0 ? (
              <EmptyState title="Aún no hay ejecutivos." />
            ) : (
              <ul className="divide-y">
                {ejecutivos.data!.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-full bg-executive-soft text-executive-text"><UserRound className="size-[18px]" strokeWidth={1.75} /></span>
                      <div>
                        <div className="font-medium">{e.nombre}</div>
                        <div className="text-xs text-muted-foreground">{e.telefono ?? 'Sin teléfono'} · {e._count?.cuentas ?? 0} {(e._count?.cuentas ?? 0) === 1 ? 'cuenta' : 'cuentas'}</div>
                      </div>
                    </div>
                    {!e.activo && <span className="rounded-sm bg-canceled-soft px-1.5 py-0.5 text-[11px] text-canceled-text">Inactivo</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {cuentaDlg && <CuentaDialog cuenta={cuentaDlg === 'nueva' ? undefined : cuentaDlg} onClose={() => setCuentaDlg(null)} />}
      {ejecDlg && <EjecutivoDialog onClose={() => setEjecDlg(false)} />}
    </>
  );
}

function CuentaDialog({ cuenta, onClose }: { cuenta?: CuentaDestino; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ejecutivos = useEjecutivos();
  const monedas = useMonedas();
  const [f, setF] = useState({
    tipo: cuenta?.tipo ?? 'EMPRESA',
    ejecutivo_id: cuenta?.ejecutivo_id ?? '',
    alias: cuenta?.alias ?? '',
    banco: cuenta?.banco ?? '',
    clabe: cuenta?.clabe ?? '',
    numero: cuenta?.numero ?? '',
    titular: cuenta?.titular ?? '',
    moneda: cuenta?.moneda ?? 'MXN',
    notas: cuenta?.notas ?? '',
  });
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const guardar = useMutation({
    mutationFn: (body: unknown) => (cuenta ? api(`/cuentas-destino/${cuenta.id}`, { method: 'PUT', body }) : api('/cuentas-destino', { body })),
    onSuccess: () => {
      toast.ok(cuenta ? 'Cuenta actualizada.' : 'Cuenta dada de alta.');
      qc.invalidateQueries({ queryKey: ['cuentas-destino'] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={cuenta ? 'Editar cuenta' : 'Dar de alta una cuenta'} description="¿Dónde se recibe el dinero? La cuenta define la divisa de los movimientos." className="max-w-xl">
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const p = cuentaDestinoSchema.safeParse({ ...f, ejecutivo_id: f.tipo === 'EJECUTIVO' ? f.ejecutivo_id : null });
          if (!p.success) return setErr(p.error.issues[0].message);
          setErr('');
          guardar.mutate(p.data);
        }}
      >
        <div className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-1 rounded-md border p-0.5" role="radiogroup" aria-label="Tipo de cuenta">
            {(['EMPRESA', 'EJECUTIVO'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={f.tipo === t} onClick={() => setF((s) => ({ ...s, tipo: t }))}
                className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-[4px] text-sm', f.tipo === t ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent')}>
                <AccountTag type={t} />
              </button>
            ))}
          </div>
        </div>
        {f.tipo === 'EJECUTIVO' && (
          <Field label="Ejecutivo dueño de la cuenta" className="sm:col-span-2">
            <Select value={f.ejecutivo_id} onChange={set('ejecutivo_id')}>
              <option value="">Elige un ejecutivo</option>
              {ejecutivos.data?.filter((e) => e.activo).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Alias" hint="Cómo la reconoces: “BBVA Empresa”.">
          <Input value={f.alias} onChange={set('alias')} autoFocus />
        </Field>
        <Field label="Banco">
          <Input value={f.banco} onChange={set('banco')} />
        </Field>
        <Field label="CLABE">
          <Input value={f.clabe} onChange={set('clabe')} inputMode="numeric" className="num" />
        </Field>
        <Field label="Número de cuenta / tarjeta">
          <Input value={f.numero} onChange={set('numero')} inputMode="numeric" className="num" />
        </Field>
        <Field label="Titular">
          <Input value={f.titular} onChange={set('titular')} />
        </Field>
        <Field label="Divisa" hint={cuenta ? 'No cambies la divisa si ya tiene movimientos.' : undefined}>
          <Select value={f.moneda} onChange={set('moneda')}>
            {(monedas.data ?? [{ codigo: 'MXN', nombre: 'Peso mexicano' }]).map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo} · {m.nombre}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2 flex flex-col gap-3">
          {err && <p role="alert" className="text-sm text-danger-text">{err}</p>}
          <ErrorNote error={guardar.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={guardar.isPending}>{cuenta ? 'Guardar cambios' : 'Dar de alta'}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function EjecutivoDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [err, setErr] = useState('');
  const crear = useMutation({
    mutationFn: (body: unknown) => api('/ejecutivos', { body }),
    onSuccess: () => {
      toast.ok('Ejecutivo registrado.');
      qc.invalidateQueries({ queryKey: ['ejecutivos'] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Nuevo ejecutivo" description="Persona que recibe dinero en una cuenta propia.">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const p = ejecutivoSchema.safeParse({ nombre, telefono });
          if (!p.success) return setErr(p.error.issues[0].message);
          setErr('');
          crear.mutate(p.data);
        }}
      >
        <Field label="Nombre" error={err}><Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Field>
        <Field label="Teléfono"><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" /></Field>
        <ErrorNote error={crear.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={crear.isPending}>Registrar ejecutivo</Button>
        </div>
      </form>
    </Dialog>
  );
}
