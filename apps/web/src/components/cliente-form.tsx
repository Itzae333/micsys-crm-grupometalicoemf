'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { clienteSchema } from '@micsys-crm/shared';
import { api } from '@/lib/api';
import { useUbicaciones } from '@/lib/hooks';
import type { Cliente } from '@/lib/types';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export function ClienteDialog({
  open,
  onOpenChange,
  cliente,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cliente?: Cliente;
  onSaved?: (c: Cliente) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const ubicaciones = useUbicaciones();
  const [f, setF] = useState({
    ubicacion_id: cliente?.ubicacion_id ?? '',
    nombre: cliente?.nombre ?? '',
    apellidos: cliente?.apellidos ?? '',
    razon_social: cliente?.razon_social ?? '',
    rfc: cliente?.rfc ?? '',
    telefono: cliente?.telefono ?? '',
    email: cliente?.email ?? '',
    direccion: cliente?.direccion ?? '',
    notas: cliente?.notas ?? '',
    etiquetas: (cliente?.etiquetas ?? []).join(', '),
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const guardar = useMutation({
    mutationFn: (body: unknown) =>
      cliente ? api<Cliente>(`/clientes/${cliente.id}`, { method: 'PUT', body }) : api<Cliente>('/clientes', { body }),
    onSuccess: (c) => {
      toast.ok(cliente ? 'Cliente actualizado.' : 'Cliente registrado.');
      for (const k of ['clientes', 'cliente']) qc.invalidateQueries({ queryKey: [k] });
      onSaved?.(c);
      onOpenChange(false);
    },
  });

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = clienteSchema.safeParse({
      ...f,
      etiquetas: f.etiquetas.split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[String(i.path[0])] = i.message;
      return setErrores(m);
    }
    setErrores({});
    guardar.mutate(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={cliente ? 'Editar cliente' : 'Nuevo cliente'} className="max-w-xl">
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field
          label="Ubicación"
          error={errores.ubicacion_id}
          hint={cliente?.erp_link ? 'Un cliente del ERP conserva la ubicación de su registro.' : undefined}
          className="sm:col-span-2"
        >
          <Select
            value={f.ubicacion_id}
            disabled={!!cliente?.erp_link}
            onChange={(e) => setF((s) => ({ ...s, ubicacion_id: e.target.value }))}
          >
            <option value="">Elige la ubicación</option>
            {ubicaciones.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre" error={errores.nombre}>
          <Input value={f.nombre} onChange={set('nombre')} autoFocus />
        </Field>
        <Field label="Apellidos">
          <Input value={f.apellidos} onChange={set('apellidos')} />
        </Field>
        <Field label="Razón social" className="sm:col-span-2">
          <Input value={f.razon_social} onChange={set('razon_social')} />
        </Field>
        <Field label="RFC">
          <Input value={f.rfc} onChange={(e) => setF((s) => ({ ...s, rfc: e.target.value.toUpperCase() }))} />
        </Field>
        <Field label="Teléfono">
          <Input value={f.telefono} onChange={set('telefono')} inputMode="tel" />
        </Field>
        <Field label="Correo" error={errores.email} className="sm:col-span-2">
          <Input type="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Dirección" className="sm:col-span-2">
          <Input value={f.direccion} onChange={set('direccion')} />
        </Field>
        <Field label="Etiquetas" hint="Sepáralas con coma: mayorista, Monterrey" className="sm:col-span-2">
          <Input value={f.etiquetas} onChange={set('etiquetas')} />
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <Textarea value={f.notas} onChange={set('notas')} />
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote error={guardar.error} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardar.isPending}>
            {cliente ? 'Guardar cambios' : 'Registrar cliente'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
