import { Body, Controller, Get, Module, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../common/auth';
import type { AuthUser } from '../common/auth';
import { ErpClient } from './erp.client';
import { ErpService } from './erp.service';

@Controller('erp')
export class ErpController {
  constructor(private svc: ErpService) {}

  @Get('estado')
  estado() {
    return this.svc.estado();
  }

  // Ubicaciones
  @Get('ubicaciones')
  ubicaciones(@CurrentUser() u: AuthUser) {
    return this.svc.ubicacionesErp(u);
  }
  @Post('ubicaciones/importar')
  @Roles('SUPER_ADMIN')
  importarUbicaciones(@CurrentUser() u: AuthUser) {
    return this.svc.importarUbicaciones(u);
  }

  // Clientes del ERP (para elegir)
  @Get('clientes')
  clientes(@CurrentUser() u: AuthUser, @Query() q: { ubicacion_id?: string; empresa_id?: string; search?: string; page?: string; con_saldo?: string }) {
    return this.svc.clientesErp(u, q);
  }

  /** Guarda en el CRM los clientes elegidos (saldo del CRM en cero). */
  @Post('clientes/importar')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  importar(@CurrentUser() u: AuthUser, @Body() b: { erp_cliente_ids: string[] }) {
    return this.svc.importarClientes(u, b.erp_cliente_ids ?? []);
  }

  /** Lee del ERP saldo y tickets de los clientes ligados. No modifica el saldo del CRM. */
  @Post('clientes/actualizar')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  actualizar(@CurrentUser() u: AuthUser, @Body() b: { cliente_ids?: string[]; ubicacion_id?: string }) {
    return this.svc.actualizar(u, b ?? {});
  }

  /** Iguala el saldo del CRM al del ERP para varios clientes. */
  @Post('clientes/sincronizar-saldos')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  sincronizarVarios(@CurrentUser() u: AuthUser, @Body() b: { cliente_ids: string[] }) {
    return this.svc.sincronizarSaldos(u, b.cliente_ids ?? []);
  }

  @Post('clientes/:id/sincronizar-saldo')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  sincronizar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.sincronizarSaldo(u, id);
  }

  @Post('clientes/:id/actualizar')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  actualizarUno(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.actualizar(u, { cliente_ids: [id] });
  }

  /** Todas las ventas del cliente (contado y crédito), con cuándo se liquidó cada una. */
  @Get('clientes/:id/ventas')
  ventasCliente(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query() q: Record<string, string>) {
    return this.svc.ventasDeCliente(u, id, q);
  }

  @Get('clientes/:id/ventas.csv')
  async ventasCsv(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query() q: Record<string, string>, @Res() res: Response) {
    const csv = await this.svc.ventasCsv(u, id, q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ventas-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  /** Detalle de una venta del ERP (productos, pagos, comprobantes) y lo registrado en el CRM. Solo lectura. */
  @Get('tickets/:erpNotaId')
  venta(@CurrentUser() u: AuthUser, @Param('erpNotaId') id: string) {
    return this.svc.ventaDetalle(u, id);
  }

  @Get('tickets/:erpNotaId/evidencias/:evidenciaId')
  async evidencia(@CurrentUser() u: AuthUser, @Param('erpNotaId') id: string, @Param('evidenciaId') ev: string, @Res() res: Response) {
    const { mime, buffer } = await this.svc.evidencia(u, id, ev);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  }

  @Get('clientes/:id/movimientos')
  movimientos(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.movimientosErp(u, id);
  }
}

@Module({ controllers: [ErpController], providers: [ErpClient, ErpService], exports: [ErpService] })
export class ErpModule {}
