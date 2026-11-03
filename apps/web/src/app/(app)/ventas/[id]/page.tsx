'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, FileText, Link2, Lock, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, apiBlob } from '@/lib/api';
import { fmtFecha, fmtHora, formatMoney, METODO_LABEL, nombreCliente, num } from '@/lib/format';
import type { Dec, EstatusMovimientoLike, Ticket } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avance, EstatusErpBadge } from '@/components/tickets-table';
import { StatusBadge } from '@/components/ui/badges';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorNote, PageHeader, Panel, Skeleton } from '@/components/ui/primitives';

interface Evidencia {
  id: string;
  tipo: string;
  descripcion: string | null;
  fecha: string;
  tiene_archivo: boolean;
  mime: string | null;
  tamano_aprox: number | null;
  archivo_url: string | null;
}

interface VentaDetalle {
  ticket: Ticket & { cliente: Ticket['cliente'] };
  erp: {
    folio: number;
    ubicacion: string;
    estatus: string;
    tipo?: 'CREDITO' | 'CONTADO';
    cancelada_at?: string | null;
    motivo_cancelacion?: string | null;
    fecha: string;
    vence: string | null;
    cerrada_at: string | null;
    observaciones: string | null;
    vendedor: string | null;
    subtotal: number;
    descuento: number;
    aplica_iva: boolean;
    iva: number;
    total: number;
    pagado: number;
    saldo: number;
    lineas: { clave: string; descripcion: string; cantidad: number; precio_unitario: number; descuento: number; subtotal: number }[];
    pagos: { id: string; fecha: string; metodo: string; monto: number; referencia: string | null; registrado_por: string | null; tipo: 'ABONO' | 'AL_CIERRE' }[];
    movimientos_cuenta: { id: string; tipo: string; monto: number; saldo_antes: number; saldo_despues: number; concepto: string; fecha: string }[];
    evidencias: Evidencia[];
  };
  crm: {
    id: string;
    folio: number;
    tipo: string;
    metodo: string | null;
    estatus: EstatusMovimientoLike;
    moneda: string;
    monto: Dec;
    monto_aplicado: Dec;
    referencia: string | null;
    fecha_movimiento: string;
    cuenta_destino: { alias: string; tipo: string } | null;
    comprobantes: { id: string }[];
  }[];
}

const TIPO_EVIDENCIA: Record<string, string> = {
  COMPROBANTE_PAGO: 'Comprobante de pago',
  TICKET_ORIGINAL: 'Ticket original',
  TICKET_REEDITADO: 'Ticket regenerado',
  IMAGEN: 'Imagen',
};

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm">{children || '—'}</dd>
    </div>
  );
}

export default function VentaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [visor, setVisor] = useState<{ url: string; titulo: string } | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['creditos', 'venta', id],
    queryFn: () => api<VentaDetalle>(`/erp/tickets/${id}`),
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data) return <ErrorNote error={error ?? new Error('No se encontró el ticket.')} />;
  const { erp, ticket, crm } = data;
  const avance = erp.total > 0 ? Math.min(100, Math.round((erp.pagado / erp.total) * 100)) : 0;
  const reabierta = erp.estatus === 'REABIERTA';
  const cancelada = erp.estatus === 'CANCELADA';
  const abierto = erp.saldo > 0.005 && !cancelada;
  // Se liquidó con el pago que hizo que lo pagado alcanzara el total
  let corrido = 0;
  let liquidadaEl: string | null = null;
  for (const p of erp.pagos) {
    corrido += p.monto;
    if (corrido >= erp.total - 0.005) {
      liquidadaEl = p.fecha;
      break;
    }
  }
  const diasLiquidar = liquidadaEl ? Math.max(0, Math.floor((new Date(liquidadaEl).getTime() - new Date(erp.fecha).getTime()) / 86_400_000)) : null;
  const vencido = abierto && !reabierta && !!erp.vence && new Date(erp.vence) < new Date();
  const dias = vencido ? Math.floor((Date.now() - new Date(erp.vence!).getTime()) / 86_400_000) : 0;
  const conArchivo = erp.evidencias.filter((e) => e.tiene_archivo);
  const otrasNotas = erp.evidencias.filter((e) => !e.tiene_archivo && e.descripcion);

  return (
    <>
      <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Volver
      </button>
      <PageHeader
        title={`Venta #${erp.folio}`}
        subtitle={
          <span className="not-italic">
            {erp.ubicacion} ·{' '}
            <Link href={`/clientes/${ticket.cliente.id}`} className="text-primary hover:underline">
              {nombreCliente(ticket.cliente)}
            </Link>{' '}
            · {fmtFecha(erp.fecha)}
          </span>
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground" title="El CRM no modifica nada del ERP">
            <Lock className="size-3.5" strokeWidth={1.75} />
            Solo lectura · leído del ERP
          </span>
        }
      />

      {cancelada && (
        <div className="mb-5 rounded-lg border border-danger/30 bg-danger-soft/60 px-4 py-3 text-sm text-danger-text" role="status">
          <span className="font-medium">Venta cancelada{erp.cancelada_at ? ` el ${fmtFecha(erp.cancelada_at)}` : ''}.</span>
          {erp.motivo_cancelacion && <span> Motivo: {erp.motivo_cancelacion}</span>}
        </div>
      )}
      {reabierta && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-info/30 bg-info-soft/60 px-4 py-3 text-sm text-info-text" role="status">
          <span className="font-medium">Venta reabierta.</span>
          <span>Se abrió para editarla: el ERP ya descontó su cargo del saldo del cliente y no se le cobra hasta que se cierre de nuevo.</span>
        </div>
      )}

      {/* Resumen */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-[13px] text-muted-foreground">Total de la venta</div>
          <div className="num mt-1 text-[26px] font-semibold leading-tight">${formatMoney(erp.total)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{erp.lineas.length} {erp.lineas.length === 1 ? 'producto' : 'productos'}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-[13px] text-muted-foreground">Pagado</div>
          <div className="num mt-1 text-[26px] font-semibold leading-tight">${formatMoney(erp.pagado)}</div>
          <Avance pct={avance} className="mt-2" />
        </div>
        <div className={cn('rounded-lg border bg-card p-4', vencido && 'border-danger/30 bg-danger-soft/50', reabierta && 'border-info/30 bg-info-soft/50')}>
          <div className="text-[13px] text-muted-foreground">Saldo de la venta</div>
          <div className={cn('num mt-1 text-[26px] font-semibold leading-tight', reabierta && 'text-muted-foreground')}>{cancelada ? '—' : `$${formatMoney(erp.saldo)}`}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {cancelada ? 'Venta cancelada' : reabierta ? 'Aún no se le cobra al cliente' : vencido ? `Vencido hace ${dias} ${dias === 1 ? 'día' : 'días'}` : erp.vence ? `Vence ${fmtFecha(erp.vence)}` : abierto ? 'Sin fecha de vencimiento en el ERP' : 'Liquidada'}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-[13px] text-muted-foreground">Estatus en el ERP</div>
          <div className="mt-1.5"><EstatusErpBadge estatus={erp.estatus} className="h-7 text-sm" /></div>
          <div className="mt-2 text-xs text-muted-foreground">Vendió: {erp.vendedor ?? '—'}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Panel title="Pagos" flush>
            {erp.pagos.length === 0 ? (
              <EmptyState title={cancelada ? 'Venta cancelada: no tiene pagos.' : 'Esta venta aún no tiene pagos.'}>{cancelada ? 'No se cobró nada.' : 'Todo el monto está pendiente.'}</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-table">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="h-10 px-4 font-medium">Fecha</th>
                      <th className="px-2 font-medium">Tipo</th>
                      <th className="px-2 font-medium">Forma de pago</th>
                      <th className="px-2 font-medium">Referencia</th>
                      <th className="px-2 font-medium max-md:hidden">Registró</th>
                      <th className="px-4 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {erp.pagos.map((p) => (
                      <tr key={p.id} className="h-11 border-b last:border-0">
                        <td className="num whitespace-nowrap px-4">{fmtFecha(p.fecha)} <span className="text-xs text-muted-foreground">{fmtHora(p.fecha)}</span></td>
                        <td className="px-2">{p.tipo === 'ABONO' ? 'Abono' : 'Al cerrar la venta'}</td>
                        <td className="px-2">{METODO_LABEL[p.metodo] ?? p.metodo.charAt(0) + p.metodo.slice(1).toLowerCase()}</td>
                        <td className="num px-2 text-muted-foreground">{p.referencia ?? '—'}</td>
                        <td className="px-2 text-muted-foreground max-md:hidden">{p.registrado_por ?? '—'}</td>
                        <td className="num px-4 text-right font-medium">${formatMoney(p.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/40 text-sm">
                      <td colSpan={5} className="h-10 px-4 text-right text-muted-foreground">Total pagado</td>
                      <td className="num px-4 text-right font-semibold">${formatMoney(erp.pagado)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Productos" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-table">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="h-10 px-4 font-medium">Clave</th>
                    <th className="px-2 font-medium">Descripción</th>
                    <th className="px-2 text-right font-medium">Cantidad</th>
                    <th className="px-2 text-right font-medium">Precio</th>
                    <th className="px-2 text-right font-medium max-md:hidden">Desc.</th>
                    <th className="px-4 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {erp.lineas.map((l, i) => (
                    <tr key={i} className="h-11 border-b last:border-0">
                      <td className="num px-4 font-medium">{l.clave}</td>
                      <td className="max-w-[260px] truncate px-2 text-muted-foreground">{l.descripcion || '—'}</td>
                      <td className="num px-2 text-right">{l.cantidad}</td>
                      <td className="num px-2 text-right">${formatMoney(l.precio_unitario)}</td>
                      <td className="num px-2 text-right text-muted-foreground max-md:hidden">{l.descuento ? `${l.descuento}%` : '—'}</td>
                      <td className="num px-4 text-right">${formatMoney(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr className="border-t"><td colSpan={5} className="h-9 px-4 text-right text-muted-foreground">Subtotal</td><td className="num px-4 text-right">${formatMoney(erp.subtotal)}</td></tr>
                  {erp.aplica_iva && <tr><td colSpan={5} className="h-9 px-4 text-right text-muted-foreground">IVA</td><td className="num px-4 text-right">${formatMoney(erp.iva)}</td></tr>}
                  <tr className="border-t bg-muted/40"><td colSpan={5} className="h-10 px-4 text-right font-medium">Total</td><td className="num px-4 text-right font-semibold">${formatMoney(erp.total)}</td></tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          {erp.movimientos_cuenta.length > 0 && (
            <Panel title="Movimientos de esta venta en la cuenta del ERP" flush>
              <div className="overflow-x-auto">
                <table className="w-full text-table">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="h-10 px-4 font-medium">Fecha</th>
                      <th className="px-2 font-medium">Tipo</th>
                      <th className="px-2 font-medium">Concepto</th>
                      <th className="px-2 text-right font-medium">Monto</th>
                      <th className="px-4 text-right font-medium">Saldo después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {erp.movimientos_cuenta.map((m) => (
                      <tr key={m.id} className="h-11 border-b last:border-0">
                        <td className="num px-4">{fmtFecha(m.fecha)}</td>
                        <td className="px-2">{m.tipo === 'CARGO' ? 'Cargo' : m.tipo === 'ABONO' ? 'Abono' : 'Ajuste'}</td>
                        <td className="max-w-[260px] truncate px-2 text-muted-foreground">{m.concepto}</td>
                        <td className="num px-2 text-right font-medium">{m.tipo === 'ABONO' ? '−' : m.tipo === 'CARGO' ? '+' : ''}${formatMoney(m.monto)}</td>
                        <td className="num px-4 text-right">${formatMoney(m.saldo_despues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Comprobantes" action={<span className="text-xs text-muted-foreground">Guardados en el ERP</span>}>
            {conArchivo.length === 0 ? (
              <p className="text-sm text-muted-foreground">El ERP no tiene comprobantes adjuntos a esta venta.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {conArchivo.map((e) => (
                  <li key={e.id}>
                    <Evidencia ventaId={id} ev={e} onVer={(url, titulo) => (e.mime === 'application/pdf' ? window.open(url, '_blank', 'noopener') : setVisor({ url, titulo }))} />
                  </li>
                ))}
              </ul>
            )}
            {erp.evidencias.some((e) => !e.tiene_archivo && e.archivo_url) && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {erp.evidencias.filter((e) => !e.tiene_archivo && e.archivo_url).map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-muted-foreground">
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{TIPO_EVIDENCIA[e.tipo] ?? e.tipo}: archivo externo en el ERP</span>
                  </li>
                ))}
              </ul>
            )}
            {otrasNotas.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                {otrasNotas.map((e) => (
                  <li key={e.id}>{fmtFecha(e.fecha)} · {e.descripcion}</li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Registrado en el CRM" flush>
            {crm.length === 0 ? (
              <EmptyState title="Aún no hay movimientos del CRM ligados a esta venta.">Cuando registres un cobro o abono y lo ligues a este ticket, aparecerá aquí.</EmptyState>
            ) : (
              <ul className="divide-y">
                {crm.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/movimientos/${m.id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                        <Link2 className="size-3.5" strokeWidth={1.75} />
                        Movimiento {m.folio}
                      </Link>
                      <div className="num text-xs text-muted-foreground">
                        {fmtFecha(m.fecha_movimiento)} · {m.cuenta_destino?.alias ?? '—'}
                        {m.comprobantes.length > 0 && <Paperclip className="ml-1.5 inline size-3" aria-label="Con comprobante" />}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="num font-medium">${formatMoney(num(m.monto_aplicado))}</span>
                      <StatusBadge status={m.estatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Datos de la venta">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Dato k="Ubicación">{erp.ubicacion}</Dato>
              <Dato k="Fecha"><span className="num">{fmtFecha(erp.fecha)}</span></Dato>
              <Dato k="Vence"><span className="num">{erp.vence ? fmtFecha(erp.vence) : null}</span></Dato>
              <Dato k="Cerrada"><span className="num">{erp.cerrada_at ? fmtFecha(erp.cerrada_at) : null}</span></Dato>
              <Dato k="Tipo">{erp.tipo === 'CREDITO' ? 'Crédito' : erp.tipo === 'CONTADO' ? 'Contado' : null}</Dato>
              <Dato k="Liquidada">
                {liquidadaEl ? (
                  <span className="num">
                    {fmtFecha(liquidadaEl)}
                    <span className="block text-xs text-muted-foreground">{diasLiquidar === 0 ? 'el mismo día de la venta' : `a los ${diasLiquidar} ${diasLiquidar === 1 ? 'día' : 'días'}`}</span>
                  </span>
                ) : null}
              </Dato>
            </dl>
            {erp.observaciones && (
              <div className="mt-3 border-t pt-3">
                <div className="text-xs text-muted-foreground">Observaciones</div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{erp.observaciones}</p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Dialog open={!!visor} onOpenChange={(o) => !o && setVisor(null)} title={visor?.titulo ?? 'Comprobante'} className="max-w-3xl">
        {visor && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visor.url} alt={visor.titulo} className="max-h-[70vh] w-full rounded-md border bg-muted object-contain" />
        )}
      </Dialog>
    </>
  );
}

/** Miniatura de un comprobante: se descarga con la sesión del usuario (el navegador nunca ve la API key del ERP). */
function Evidencia({ ventaId, ev, onVer }: { ventaId: string; ev: Evidencia; onVer: (url: string, titulo: string) => void }) {
  const esPdf = ev.mime === 'application/pdf';
  const { data: url, isLoading, error } = useQuery({
    queryKey: ['creditos', 'evidencia', ventaId, ev.id],
    queryFn: async () => URL.createObjectURL(await apiBlob(`/erp/tickets/${ventaId}/evidencias/${ev.id}`)),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const titulo = `${TIPO_EVIDENCIA[ev.tipo] ?? ev.tipo}${ev.descripcion ? ` · ${ev.descripcion}` : ''}`;
  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => url && onVer(url, titulo)}
      className="group block w-full overflow-hidden rounded-md border text-left hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        {isLoading ? (
          <Skeleton className="size-full rounded-none" />
        ) : error || !url ? (
          <span className="px-2 text-center text-xs text-muted-foreground">No se pudo cargar</span>
        ) : esPdf ? (
          <FileText className="size-8 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={titulo} className="size-full object-cover" />
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className="truncate text-xs font-medium">{TIPO_EVIDENCIA[ev.tipo] ?? ev.tipo}</div>
        <div className="num truncate text-[11px] text-muted-foreground">{fmtFecha(ev.fecha)}{ev.descripcion ? ` · ${ev.descripcion}` : ''}</div>
      </div>
    </button>
  );
}
