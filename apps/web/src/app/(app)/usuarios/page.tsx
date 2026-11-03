'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, LogOut, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ROLES, ROL_DESCRIPCION, ROL_LABEL, passwordSchema, usuarioCrearSchema, usuarioEditarSchema } from '@micsys-crm/shared';
import type { Rol } from '@micsys-crm/shared';
import { api } from '@/lib/api';
import { haceCuanto } from '@/lib/format';
import { useMe, useUbicaciones } from '@/lib/hooks';
import type { UsuarioFila } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
import { Button, EmptyState, ErrorNote, Field, Input, PageHeader, Panel, Select, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

/** Contraseña aleatoria legible (sin caracteres que se confunden: 0/O, 1/l/I). */
function generarPassword(largo = 14) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(largo);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

function RolBadge({ rol }: { rol: Rol }) {
  const Icono = rol === 'SUPER_ADMIN' ? ShieldCheck : UserRound;
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-sm pl-1.5 pr-2 text-xs font-medium',
        rol === 'SUPER_ADMIN' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground',
      )}
    >
      <Icono className="size-3.5" strokeWidth={1.75} />
      {ROL_LABEL[rol]}
    </span>
  );
}

function Ubicaciones({ u }: { u: UsuarioFila }) {
  if (u.rol === 'SUPER_ADMIN') return <span className="text-sm text-muted-foreground">Todas (acceso total)</span>;
  if (u.ubicaciones.length === 0) return <span className="text-sm text-warning-text">Sin ubicaciones: no ve nada</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {u.ubicaciones.map((x) => (
        <span key={x.id} className="inline-flex items-center gap-1 rounded-[3px] bg-company-soft px-1.5 py-0.5 text-[11.5px] font-medium text-company-text">
          <Building2 className="size-3" strokeWidth={1.75} />
          {x.nombre}
        </span>
      ))}
    </div>
  );
}

export default function UsuariosPage() {
  const me = useMe();
  const [dlg, setDlg] = useState<UsuarioFila | 'nuevo' | null>(null);
  const [pass, setPass] = useState<UsuarioFila | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api<UsuarioFila[]>('/usuarios'),
    enabled: me.data?.rol === 'SUPER_ADMIN',
  });

  if (me.isLoading) return <Skeleton className="h-64" />;
  if (me.data?.rol !== 'SUPER_ADMIN') {
    return (
      <Panel>
        <EmptyState title="Esta sección es solo para el super usuario.">Pídele a quien administra el sistema que te dé de alta o te cambie los permisos.</EmptyState>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={`Quién entra al sistema y a qué ubicaciones de ${me.data.organizacion.nombre} puede acceder.`}
        actions={
          <Button onClick={() => setDlg('nuevo')}>
            <Plus className="size-4" strokeWidth={2} />
            Nuevo usuario
          </Button>
        }
      />
      <ErrorNote error={error} />

      <Panel flush>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full text-table">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="h-10 px-4 font-medium">Usuario</th>
                    <th className="px-2 font-medium">Rol</th>
                    <th className="px-2 font-medium">Ubicaciones</th>
                    <th className="px-2 font-medium">Último acceso</th>
                    <th className="w-px px-4" />
                  </tr>
                </thead>
                <tbody>
                  {data!.map((u) => (
                    <tr key={u.id} className={cn('border-b last:border-0 hover:bg-accent', !u.activo && 'opacity-60')}>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {u.nombre} {u.apellidos}
                          {u.id === me.data!.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(tú)</span>}
                          {!u.activo && <span className="ml-2 rounded-sm bg-canceled-soft px-1.5 py-0.5 text-[11px] font-normal text-canceled-text">Inactivo</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-2"><RolBadge rol={u.rol} /></td>
                      <td className="max-w-[320px] px-2"><Ubicaciones u={u} /></td>
                      <td className="whitespace-nowrap px-2 text-muted-foreground">{haceCuanto(u.ultimo_acceso)}</td>
                      <td className="whitespace-nowrap px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setPass(u)}>
                          <KeyRound className="size-3.5" />
                          Contraseña
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDlg(u)}>Editar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil: una tarjeta por usuario */}
            <ul className="divide-y md:hidden">
              {data!.map((u) => (
                <li key={u.id} className={cn('flex flex-col gap-2.5 px-4 py-3.5', !u.activo && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {u.nombre} {u.apellidos}
                        {u.id === me.data!.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <RolBadge rol={u.rol} />
                  </div>
                  <Ubicaciones u={u} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {u.activo ? `Entró ${haceCuanto(u.ultimo_acceso)}` : 'Inactivo'}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="max-md:h-9" onClick={() => setPass(u)}>Contraseña</Button>
                      <Button size="sm" variant="outline" className="max-md:h-9" onClick={() => setDlg(u)}>Editar</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Qué puede hacer cada rol" className="mt-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-md border p-3">
              <dt><RolBadge rol={r} /></dt>
              <dd className="mt-1.5 text-sm text-muted-foreground">{ROL_DESCRIPCION[r]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Las ubicaciones disponibles son las de {me.data.organizacion.nombre}. Si falta alguna, tráela del ERP en Configuración.
        </p>
      </Panel>

      {dlg && <UsuarioDialog usuario={dlg === 'nuevo' ? undefined : dlg} yoId={me.data.id} onClose={() => setDlg(null)} />}
      {pass && <PasswordDialog usuario={pass} onClose={() => setPass(null)} />}
    </>
  );
}

function CampoPassword({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [ver, setVer] = useState(false);
  return (
    <Field label="Contraseña" error={error} hint="Mínimo 10 caracteres. Anótala o compártela por un medio seguro: después no se puede volver a ver.">
      <div className="flex gap-2">
        <Input type={ver ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} className="num" />
        <Button type="button" variant="outline" className="shrink-0" onClick={() => { onChange(generarPassword()); setVer(true); }}>
          Generar
        </Button>
        <Button type="button" variant="ghost" className="shrink-0" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {ver ? 'Ocultar' : 'Ver'}
        </Button>
      </div>
    </Field>
  );
}

function UsuarioDialog({ usuario, yoId, onClose }: { usuario?: UsuarioFila; yoId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ubicaciones = useUbicaciones();
  const editando = !!usuario;
  const soyYo = usuario?.id === yoId;
  const [f, setF] = useState({
    nombre: usuario?.nombre ?? '',
    apellidos: usuario?.apellidos ?? '',
    email: usuario?.email ?? '',
    password: '',
    rol: (usuario?.rol ?? 'OPERADOR') as Rol,
    activo: usuario?.activo ?? true,
  });
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(usuario?.ubicaciones.map((x) => x.id) ?? []));
  const [errores, setErrores] = useState<Record<string, string>>({});

  const todas = ubicaciones.data ?? [];
  const alternar = (id: string) => setElegidas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todasMarcadas = todas.length > 0 && todas.every((u) => elegidas.has(u.id));

  const guardar = useMutation({
    mutationFn: (body: unknown) => (editando ? api(`/usuarios/${usuario!.id}`, { method: 'PUT', body }) : api('/usuarios', { body })),
    onSuccess: () => {
      toast.ok(editando ? 'Usuario actualizado.' : 'Usuario creado. Ya puede iniciar sesión.');
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
  });
  const cerrar = useMutation({
    mutationFn: () => api(`/usuarios/${usuario!.id}/cerrar-sesiones`, { method: 'POST' }),
    onSuccess: () => toast.ok('Se cerraron todas sus sesiones.'),
    onError: (e: Error) => toast.error(e.message),
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const base = { nombre: f.nombre, apellidos: f.apellidos, rol: f.rol, ubicacion_ids: f.rol === 'SUPER_ADMIN' ? [] : [...elegidas] };
    const parsed = editando
      ? usuarioEditarSchema.safeParse({ ...base, activo: f.activo })
      : usuarioCrearSchema.safeParse({ ...base, email: f.email, password: f.password });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[String(i.path[0])] = i.message;
      return setErrores(m);
    }
    setErrores({});
    guardar.mutate(parsed.data);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={editando ? 'Editar usuario' : 'Nuevo usuario'} className="max-w-xl">
      <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={errores.nombre}>
          <Input value={f.nombre} onChange={(e) => setF((s) => ({ ...s, nombre: e.target.value }))} autoFocus />
        </Field>
        <Field label="Apellidos">
          <Input value={f.apellidos} onChange={(e) => setF((s) => ({ ...s, apellidos: e.target.value }))} />
        </Field>
        {!editando && (
          <>
            <Field label="Correo" error={errores.email} className="sm:col-span-2">
              <Input type="email" autoComplete="off" value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <CampoPassword value={f.password} onChange={(v) => setF((s) => ({ ...s, password: v }))} error={errores.password} />
            </div>
          </>
        )}
        <Field label="Rol" className="sm:col-span-2" hint={ROL_DESCRIPCION[f.rol]}>
          <Select value={f.rol} disabled={soyYo} onChange={(e) => setF((s) => ({ ...s, rol: e.target.value as Rol }))}>
            {ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </Select>
        </Field>

        {f.rol !== 'SUPER_ADMIN' ? (
          <fieldset className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <legend className="text-[13px] font-medium">Ubicaciones a las que puede entrar</legend>
              {todas.length > 1 && (
                <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setElegidas(todasMarcadas ? new Set() : new Set(todas.map((u) => u.id)))}>
                  {todasMarcadas ? 'Quitar todas' : 'Marcar todas'}
                </button>
              )}
            </div>
            {ubicaciones.isLoading ? (
              <Skeleton className="h-20" />
            ) : todas.length === 0 ? (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-text">Aún no hay ubicaciones. Tráelas del ERP en Configuración.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {todas.map((u) => (
                  <li key={u.id}>
                    <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-md border p-2.5 text-sm max-md:min-h-[44px]', elegidas.has(u.id) && 'border-primary bg-accent')}>
                      <input type="checkbox" checked={elegidas.has(u.id)} onChange={() => alternar(u.id)} className="accent-[hsl(var(--primary))]" />
                      <Building2 className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="truncate">{u.nombre}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {errores.ubicacion_ids && <p className="mt-1.5 text-xs text-danger-text">{errores.ubicacion_ids}</p>}
          </fieldset>
        ) : (
          <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground sm:col-span-2">El super usuario entra a todas las ubicaciones; no hay que asignarlas.</p>
        )}

        {editando && !soyYo && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border p-3 text-sm sm:col-span-2 has-[:checked]:border-success/40">
            <input type="checkbox" checked={f.activo} onChange={(e) => setF((s) => ({ ...s, activo: e.target.checked }))} className="accent-[hsl(var(--success))]" />
            <span>
              <span className="font-medium">Usuario activo</span>
              <span className="block text-xs text-muted-foreground">Si lo desactivas, pierde el acceso al instante.</span>
            </span>
          </label>
        )}
        {soyYo && <p className="text-xs text-muted-foreground sm:col-span-2">No puedes cambiar tu propio rol ni desactivarte.</p>}

        <div className="sm:col-span-2"><ErrorNote error={guardar.error} /></div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
          <div>
            {editando && (
              <Button type="button" variant="ghost" loading={cerrar.isPending} onClick={() => cerrar.mutate()}>
                <LogOut className="size-4" strokeWidth={1.75} />
                Cerrar sus sesiones
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={guardar.isPending}>{editando ? 'Guardar cambios' : 'Crear usuario'}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordDialog({ usuario, onClose }: { usuario: UsuarioFila; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const guardar = useMutation({
    mutationFn: () => api(`/usuarios/${usuario.id}/password`, { body: { password } }),
    onSuccess: () => {
      toast.ok(`Contraseña de ${usuario.nombre} actualizada. Sus sesiones abiertas se cerraron.`);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Nueva contraseña para ${usuario.nombre}`} description="Se cierran sus sesiones abiertas; tendrá que entrar con la nueva.">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const p = passwordSchema.safeParse({ password });
          if (!p.success) return setErr(p.error.issues[0].message);
          setErr('');
          guardar.mutate();
        }}
      >
        <CampoPassword value={password} onChange={setPassword} error={err} />
        <ErrorNote error={guardar.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={guardar.isPending}>Guardar contraseña</Button>
        </div>
      </form>
    </Dialog>
  );
}
