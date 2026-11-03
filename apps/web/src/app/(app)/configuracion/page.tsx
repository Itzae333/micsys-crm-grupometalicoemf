'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, clearToken } from '@/lib/api';
import { fmtFecha, formatMoney, num } from '@/lib/format';
import { useEmpresas, useMe, useMonedas, useUbicaciones } from '@/lib/hooks';
import { CurrencyChip } from '@/components/ui/badges';
import { InstallButton } from '@/components/pwa';
import { useErpEstado } from '@/components/erp-import';
import { Button, ErrorNote, Field, Input, PageHeader, Panel, Select, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export default function ConfiguracionPage() {
  const me = useMe();
  const monedas = useMonedas();
  const erp = useErpEstado();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nueva, setNueva] = useState({ codigo: '', nombre: '', simbolo: '' });

  const tipoCambio = useMutation({
    mutationFn: (v: { moneda: string; valor: number }) => api('/tipos-cambio', { body: v }),
    onSuccess: (_d, v) => {
      toast.ok(`Tipo de cambio de ${v.moneda} guardado.`);
      setValores((s) => ({ ...s, [v.moneda]: '' }));
      qc.invalidateQueries({ queryKey: ['monedas'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const crearMoneda = useMutation({
    mutationFn: () => api('/monedas', { body: nueva }),
    onSuccess: () => {
      toast.ok('Divisa agregada. Ahora registra su tipo de cambio.');
      setNueva({ codigo: '', nombre: '', simbolo: '' });
      qc.invalidateQueries({ queryKey: ['monedas'] });
    },
  });

  const cerrarSesiones = useMutation({
    mutationFn: () => api('/auth/cerrar-sesiones', { method: 'POST' }),
    onSuccess: () => {
      clearToken();
      qc.clear();
      router.replace('/login');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Configuración" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Divisas y tipo de cambio" className="lg:col-span-2">
          <p className="mb-4 text-sm text-muted-foreground">Todo se reporta en MXN. El tipo de cambio que registres aquí se propone al capturar un movimiento en otra divisa; cada movimiento guarda el que se usó.</p>
          {monedas.isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <ul className="divide-y rounded-md border">
              {monedas.data!.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 text-sm">
                    <CurrencyChip code={m.codigo} />
                    <div>
                      <div className="font-medium">{m.nombre}</div>
                      {m.codigo === 'MXN' ? (
                        <div className="text-xs text-muted-foreground">Moneda base</div>
                      ) : (
                        <div className="num text-xs text-muted-foreground">
                          {m.tipo_cambio ? `1 ${m.codigo} = $${formatMoney(num(m.tipo_cambio.valor))} MXN · ${fmtFecha(m.tipo_cambio.fecha)}` : 'Sin tipo de cambio registrado'}
                        </div>
                      )}
                    </div>
                  </div>
                  {m.codigo !== 'MXN' && (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = Number(valores[m.codigo]);
                        if (!(v > 0)) return toast.error('Escribe un tipo de cambio mayor a cero.');
                        tipoCambio.mutate({ moneda: m.codigo, valor: v });
                      }}
                    >
                      <Input aria-label={`Tipo de cambio de ${m.codigo}`} inputMode="decimal" placeholder="0.0000" className="num w-32 text-right" value={valores[m.codigo] ?? ''} onChange={(e) => setValores((s) => ({ ...s, [m.codigo]: e.target.value.replace(/[^\d.]/g, '') }))} />
                      <Button type="submit" variant="outline" loading={tipoCambio.isPending && tipoCambio.variables?.moneda === m.codigo}>Guardar</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[110px_1fr_110px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              crearMoneda.mutate();
            }}
          >
            <Field label="Código"><Input value={nueva.codigo} maxLength={3} placeholder="CAD" onChange={(e) => setNueva((s) => ({ ...s, codigo: e.target.value.toUpperCase() }))} /></Field>
            <Field label="Nombre"><Input value={nueva.nombre} placeholder="Dólar canadiense" onChange={(e) => setNueva((s) => ({ ...s, nombre: e.target.value }))} /></Field>
            <Field label="Símbolo"><Input value={nueva.simbolo} placeholder="CA$" onChange={(e) => setNueva((s) => ({ ...s, simbolo: e.target.value }))} /></Field>
            <Button type="submit" variant="outline" loading={crearMoneda.isPending} disabled={!nueva.codigo || !nueva.nombre || !nueva.simbolo}>Agregar divisa</Button>
          </form>
          <div className="mt-3"><ErrorNote error={crearMoneda.error} /></div>
        </Panel>

        <Panel title="Empresas y ubicaciones" className="lg:col-span-2">
          <UbicacionesPanel erpActivo={!!erp.data?.habilitado} puedeEditar={me.data?.rol === 'SUPER_ADMIN'} />
        </Panel>

        <Panel title="Integración con el ERP">
          {erp.isLoading ? (
            <Skeleton className="h-10" />
          ) : erp.data?.habilitado ? (
            <p className="inline-flex items-center gap-2 text-sm text-success-text"><CircleCheck className="size-4" strokeWidth={1.75} />Activa. El CRM puede importar clientes y consultar ventas (solo lectura).</p>
          ) : (
            <>
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><CircleX className="size-4" strokeWidth={1.75} />No está activada.</p>
              <p className="mt-2 text-xs text-muted-foreground">Se activa en el servidor con <span className="num">ERP_INTEGRATION_ENABLED</span>, <span className="num">ERP_API_URL</span> y <span className="num">ERP_API_KEY</span>. Mientras tanto, el CRM funciona completo con movimientos de “Otro concepto”.</p>
            </>
          )}
        </Panel>

        <Panel title="Instalar la app">
          <p className="mb-3 text-sm text-muted-foreground">Cauce se puede instalar como app en el celular o en la computadora. Necesita conexión a internet para funcionar.</p>
          <InstallButton />
        </Panel>

        <Panel title="Tu cuenta">
          {me.isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <>
              <p className="text-sm font-medium">{me.data?.nombre} {me.data?.apellidos}</p>
              <p className="text-sm text-muted-foreground">{me.data?.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">Rol: {me.data?.rol}</p>
              <Button variant="destructive" className="mt-4" loading={cerrarSesiones.isPending} onClick={() => cerrarSesiones.mutate()}>
                Cerrar todas las sesiones
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">Cierra la sesión en todos tus dispositivos, incluido este.</p>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

function UbicacionesPanel({ erpActivo, puedeEditar }: { erpActivo: boolean; puedeEditar: boolean }) {
  const ubicaciones = useUbicaciones(true);
  const empresas = useEmpresas();
  const qc = useQueryClient();
  const toast = useToast();
  const [empresaNueva, setEmpresaNueva] = useState('');
  const [nombre, setNombre] = useState('');
  const [empresaId, setEmpresaId] = useState('');

  const refrescar = () => {
    for (const k of ['ubicaciones', 'empresas', 'clientes', 'erp-ubicaciones-usuarios']) qc.invalidateQueries({ queryKey: [k] });
  };
  const crearEmpresa = useMutation({
    mutationFn: () => api('/empresas', { body: { nombre: empresaNueva } }),
    onSuccess: () => {
      toast.ok('Empresa creada. Ahora agrégale sus ubicaciones.');
      setEmpresaNueva('');
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const crear = useMutation({
    mutationFn: () => api('/ubicaciones', { body: { empresa_id: empresaId, nombre } }),
    onSuccess: () => {
      toast.ok('Ubicación creada.');
      setNombre('');
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const traer = useMutation({
    mutationFn: () => api<{ creadas: string[]; ligadas: string[]; empresas_nuevas: number }>('/erp/ubicaciones/importar', { method: 'POST' }),
    onSuccess: (r) => {
      toast.ok(
        r.creadas.length + r.ligadas.length === 0
          ? 'Las empresas y ubicaciones ya estaban al día.'
          : `Del ERP: ${r.empresas_nuevas} empresas nuevas, ${r.creadas.length} ubicaciones nuevas${r.ligadas.length ? `, ${r.ligadas.length} ligadas` : ''}.`,
      );
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const estado = useMutation({
    mutationFn: (v: { id: string; activa: boolean }) => api(`/ubicaciones/${v.id}`, { method: 'PUT', body: { activa: v.activa } }),
    onSuccess: refrescar,
    onError: (e: Error) => toast.error(e.message),
  });

  // Ubicaciones agrupadas por empresa (incluye empresas aún sin ubicaciones)
  const lista = ubicaciones.data ?? [];
  const grupos = new Map<string, { id: string; nombre: string; ubs: typeof lista }>();
  for (const e of empresas.data ?? []) grupos.set(e.id, { id: e.id, nombre: e.nombre, ubs: [] });
  for (const u of lista) {
    const k = u.empresa?.id ?? 'sin-empresa';
    if (!grupos.has(k)) grupos.set(k, { id: k, nombre: u.empresa?.nombre ?? 'Sin empresa', ubs: [] });
    grupos.get(k)!.ubs.push(u);
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        La estructura es la del ERP: <span className="font-medium text-foreground">empresa → ubicaciones</span>. Los clientes y sus movimientos van por ubicación. Al guardar un cliente del ERP,
        su empresa y su ubicación se crean solas si no existen.
      </p>
      {ubicaciones.isLoading || empresas.isLoading ? (
        <Skeleton className="h-20" />
      ) : grupos.size === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no hay empresas.{erpActivo ? ' Usa “Traer del ERP” para cargar las empresas y ubicaciones.' : ' Crea la primera abajo.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {[...grupos.values()].map((g) => (
            <div key={g.id} className="rounded-md border">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
                <div className="text-sm font-semibold">{g.nombre}</div>
                <span className="text-xs text-muted-foreground">{g.ubs.length} {g.ubs.length === 1 ? 'ubicación' : 'ubicaciones'}</span>
              </div>
              {g.ubs.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Sin ubicaciones todavía.</p>
              ) : (
                <ul className="divide-y">
                  {g.ubs.map((u) => (
                    <li key={u.id} className={'flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm' + (u.activa === false ? ' opacity-60' : '')}>
                      <div>
                        <div className="font-medium">{u.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {u._count?.clientes ?? 0} clientes{u.erp_ubicacion_id ? ' · del ERP' : ' · solo en el CRM'}
                          {u.activa === false ? ' · inactiva' : ''}
                        </div>
                      </div>
                      {puedeEditar && (
                        <Button size="sm" variant="ghost" onClick={() => estado.mutate({ id: u.id, activa: u.activa === false })}>
                          {u.activa === false ? 'Reactivar' : 'Desactivar'}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {!puedeEditar && <p className="mt-3 text-xs text-muted-foreground">Solo el super usuario puede crear o cambiar empresas y ubicaciones. Aquí ves las que tienes asignadas.</p>}
      {puedeEditar && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <form
            className="flex flex-wrap items-end gap-3 rounded-md border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (empresaNueva.trim()) crearEmpresa.mutate();
            }}
          >
            <Field label="Nueva empresa" hint="Para empresas que no están en el ERP." className="min-w-[200px] flex-1">
              <Input value={empresaNueva} onChange={(e) => setEmpresaNueva(e.target.value)} placeholder="Nombre de la empresa" />
            </Field>
            <Button type="submit" variant="outline" loading={crearEmpresa.isPending} disabled={!empresaNueva.trim()}>Agregar empresa</Button>
          </form>
          <form
            className="flex flex-wrap items-end gap-3 rounded-md border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (nombre.trim() && empresaId) crear.mutate();
            }}
          >
            <Field label="Empresa" className="min-w-[150px] flex-1">
              <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                <option value="">Elige…</option>
                {empresas.data?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </Select>
            </Field>
            <Field label="Nueva ubicación" className="min-w-[150px] flex-1">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="PV Centro" />
            </Field>
            <Button type="submit" variant="outline" loading={crear.isPending} disabled={!nombre.trim() || !empresaId}>Agregar</Button>
          </form>
          {erpActivo && (
            <div className="lg:col-span-2">
              <Button type="button" variant="outline" loading={traer.isPending} onClick={() => traer.mutate()}>
                Traer empresas y ubicaciones del ERP
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
