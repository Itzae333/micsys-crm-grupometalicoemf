'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, FileText, Link2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TIPO_LABEL } from '@micsys-crm/shared';
import { api, apiBlob } from '@/lib/api';
import { fmtFecha, fmtHora, formatMoney, METODO_LABEL, nombreCliente, num, simboloMoneda } from '@/lib/format';
import type { Movimiento } from '@/lib/types';
import { AccionesMov, useRefrescarDatos } from '@/components/movimiento-acciones';
import { signoMov } from '@/components/movimientos-table';
import { AccountTag, Money, StatusBadge } from '@/components/ui/badges';
import { Button, ErrorNote, PageHeader, Panel, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm">{children || '—'}</dd>
    </div>
  );
}

export default function MovimientoDetalle() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const refrescar = useRefrescarDatos();
  const { data: m, isLoading, error } = useQuery({
    queryKey: ['movimientos', id],
    queryFn: () => api<Movimiento>(`/movimientos/${id}`),
  });

  const conciliar = useMutation({
    mutationFn: () => api(`/movimientos/${id}/conciliar`, { body: {} }),
    onSuccess: () => {
      toast.ok('Movimiento conciliado.');
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function verComprobante(cid: string) {
    try {
      const blob = await apiBlob(`/comprobantes/${cid}`);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (isLoading) return <Skeleton className="h-72" />;
  if (error || !m) return <ErrorNote error={error ?? new Error('No se encontró el movimiento.')} />;

  const ingreso = signoMov(m.tipo) === '+';

  return (
    <>
      <Link href="/movimientos" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Movimientos
      </Link>
      <PageHeader
        title={`Movimiento ${m.folio}`}
        subtitle={`${TIPO_LABEL[m.tipo]} · ${fmtFecha(m.fecha_movimiento)}`}
        actions={<AccionesMov mov={m} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-1.5"><StatusBadge status={m.estatus} /></div>
                <div className="text-[34px] leading-tight">
                  <Money value={num(m.monto)} currency={m.moneda} mxn={num(m.monto_mxn)} sign={signoMov(m.tipo)} status={m.estatus} align="left" className="[&_.num]:text-[34px] [&_.num]:font-semibold" />
                </div>
                {m.moneda !== 'MXN' && (
                  <p className="num mt-1 text-xs text-muted-foreground">Tipo de cambio usado: ${formatMoney(num(m.tipo_cambio))} por 1 {m.moneda}</p>
                )}
              </div>
              {m.motivo_cancelacion && (
                <p className="max-w-xs rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="block text-xs text-muted-foreground">Motivo</span>
                  {m.motivo_cancelacion}
                </p>
              )}
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Dato k="Cliente">
                <Link href={`/clientes/${m.cliente.id}`} className="font-medium text-primary hover:underline">{nombreCliente(m.cliente)}</Link>
              </Dato>
              <Dato k="Forma de pago">{m.metodo ? METODO_LABEL[m.metodo] : null}</Dato>
              {ingreso && (
                <Dato k="Cayó en">
                  {m.cuenta_destino ? (
                    <div className="flex flex-col gap-1">
                      <AccountTag type={m.cuenta_destino.tipo} name={m.cuenta_destino.alias} />
                      <span className="text-xs text-muted-foreground">
                        {m.cuenta_destino.ejecutivo ? `${m.cuenta_destino.ejecutivo.nombre} · ` : ''}
                        {m.cuenta_destino.banco}
                      </span>
                    </div>
                  ) : null}
                </Dato>
              )}
              <Dato k="Pagó desde">{m.cuenta_cliente ? m.cuenta_cliente.alias || m.cuenta_cliente.banco : null}</Dato>
              <Dato k="Clave de rastreo / referencia"><span className="num">{m.referencia}</span></Dato>
              <Dato k="Empresa del grupo">{m.empresa_grupo?.nombre}</Dato>
              <Dato k="Concepto">{m.concepto}</Dato>
              <Dato k="Motivo">{m.motivo === 'VENTA' ? 'Pago de ventas del ERP' : (m.categoria_otro ?? 'Otro concepto')}</Dato>
              <Dato k="Registrado">
                <span className="num">{fmtFecha(m.created_at)} · {fmtHora(m.created_at)}</span>
              </Dato>
              <Dato k="Saldo del cliente">
                <span className="num">
                  {simboloMoneda(m.moneda)}{formatMoney(num(m.saldo_antes))} → <span className="font-medium">{simboloMoneda(m.moneda)}{formatMoney(num(m.saldo_despues))}</span>
                </span>
                {m.estatus === 'PENDIENTE' && <span className="block text-xs text-muted-foreground">Aún no afecta el saldo: se aplica al confirmar.</span>}
              </Dato>
            </dl>
          </Panel>

          {m.ventas.length > 0 && (
            <Panel title="Ventas del ERP ligadas" flush>
              <table className="w-full text-table">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="h-10 px-4 font-medium">Venta</th>
                    <th className="px-2 font-medium">Empresa</th>
                    <th className="px-4 text-right font-medium">Monto aplicado</th>
                  </tr>
                </thead>
                <tbody>
                  {m.ventas.map((v) => (
                    <tr key={v.erp_venta_id} className="h-11 border-b last:border-0">
                      <td className="px-4">
                        <span className="inline-flex items-center gap-1.5 text-company-text"><Link2 className="size-3.5" strokeWidth={1.75} /><span className="num font-medium">{v.folio ?? v.erp_venta_id}</span></span>
                      </td>
                      <td className="px-2 text-muted-foreground">{v.erp_empresa ?? '—'}</td>
                      <td className="num px-4 text-right font-medium">{simboloMoneda(m.moneda)}{formatMoney(num(v.monto_aplicado))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Comprobantes">
            {m.comprobantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin comprobante adjunto.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {m.comprobantes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="truncate">{c.nombre}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => verComprobante(c.id)}>
                      <Eye className="size-3.5" />
                      Ver
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {m.estatus === 'CONFIRMADO' && (
            <Panel title="Conciliación">
              {m.conciliacion?.conciliado ? (
                <p className="inline-flex items-center gap-2 text-sm text-success-text">
                  <ShieldCheck className="size-4" strokeWidth={1.75} />
                  Conciliado con el estado de cuenta.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">Marca el movimiento cuando lo hayas verificado contra el estado de cuenta del banco.</p>
                  <Button variant="outline" loading={conciliar.isPending} onClick={() => conciliar.mutate()}>
                    Marcar como conciliado
                  </Button>
                </>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
