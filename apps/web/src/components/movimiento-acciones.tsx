'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { formatMoney, simboloMoneda } from '@/lib/format';
import { api } from '@/lib/api';
import type { Movimiento } from '@/lib/types';
import { Dialog } from '@/components/ui/dialog';
import { Button, ErrorNote, Field, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export function useRefrescarDatos() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['dashboard', 'movimientos', 'cliente', 'clientes']) qc.invalidateQueries({ queryKey: [k] });
  };
}

/** Confirmar / Rechazar (Pendiente) y Cancelar (Pendiente o Confirmado). */
export function AccionesMov({ mov, puedeCancelar = true }: { mov: Movimiento; puedeCancelar?: boolean }) {
  const toast = useToast();
  const refrescar = useRefrescarDatos();
  const [dlg, setDlg] = useState<'rechazar' | 'cancelar' | null>(null);
  const [motivo, setMotivo] = useState('');

  const confirmar = useMutation({
    mutationFn: () => api(`/movimientos/${mov.id}/confirmar`, { method: 'POST' }),
    onSuccess: () => {
      toast.ok(`Movimiento ${mov.folio} confirmado.`);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cerrar = useMutation({
    mutationFn: (tipo: 'rechazar' | 'cancelar') => api(`/movimientos/${mov.id}/${tipo}`, { body: { motivo } }),
    onSuccess: (_d, tipo) => {
      toast.ok(tipo === 'rechazar' ? `Movimiento ${mov.folio} rechazado.` : `Movimiento ${mov.folio} cancelado.`);
      setDlg(null);
      setMotivo('');
      refrescar();
    },
  });

  const monto = `${simboloMoneda(mov.moneda)}${formatMoney(Number(mov.monto))}`;
  const pend = mov.estatus === 'PENDIENTE';
  const conf = mov.estatus === 'CONFIRMADO';
  if (!pend && !(conf && puedeCancelar)) return null;

  return (
    <>
      <div className="flex items-center gap-1.5">
        {pend && (
          <>
            <Button size="sm" variant="outline" title="Confirmar" aria-label="Confirmar" loading={confirmar.isPending} onClick={() => confirmar.mutate()}>
              <Check className="size-3.5" strokeWidth={2} />
              <span className="md:max-2xl:hidden">Confirmar</span>
            </Button>
            <Button size="sm" variant="destructive" title="Rechazar" aria-label="Rechazar" onClick={() => setDlg('rechazar')}>
              <X className="size-3.5" strokeWidth={2} />
              <span className="md:max-2xl:hidden">Rechazar</span>
            </Button>
          </>
        )}
        {conf && puedeCancelar && (
          <Button size="sm" variant="destructive" onClick={() => setDlg('cancelar')}>
            Cancelar
          </Button>
        )}
      </div>

      <Dialog
        open={dlg !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDlg(null);
            cerrar.reset();
          }
        }}
        title={dlg === 'rechazar' ? `¿Rechazar el movimiento de ${monto}?` : `¿Cancelar el movimiento de ${monto}?`}
        description={
          dlg === 'rechazar'
            ? 'No procedió (cheque sin fondos, referencia falsa). El cliente seguirá debiendo ese monto.'
            : 'Se anula por error de captura y se revierte el saldo del cliente. Queda en el historial.'
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Motivo" hint="Queda guardado junto al movimiento.">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          </Field>
          <ErrorNote error={cerrar.error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDlg(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              loading={cerrar.isPending}
              disabled={motivo.trim().length < 3}
              onClick={() => dlg && cerrar.mutate(dlg)}
            >
              {dlg === 'rechazar' ? 'Rechazar movimiento' : 'Cancelar movimiento'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
