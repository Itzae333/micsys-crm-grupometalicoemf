import { Body, Controller, Get, Header, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { motivoSchema, movimientoSchema } from '@micsys-crm/shared';
import { CurrentUser, Roles, ZodPipe } from '../common/auth';
import type { AuthUser } from '../common/auth';
import { MovimientosService, normalizar } from './movimientos.service';
import type { FiltrosMov } from './movimientos.service';

@Controller('movimientos')
export class MovimientosController {
  constructor(private svc: MovimientosService) {}

  @Get()
  listar(@CurrentUser() u: AuthUser, @Query() q: FiltrosMov) {
    return this.svc.listar(u, q);
  }

  // Antes de ':id' para que no lo capture como parámetro
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportar(@CurrentUser() u: AuthUser, @Query() q: FiltrosMov, @Res() res: Response) {
    const csv = await this.svc.csv(u, q);
    res.setHeader('Content-Disposition', `attachment; filename="movimientos-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  detalle(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.detalle(u, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  crear(@CurrentUser() u: AuthUser, @Body(new ZodPipe(movimientoSchema)) dto: unknown) {
    return this.svc.crear(u, normalizar(dto));
  }

  @Post(':id/confirmar')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  confirmar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.confirmar(u, id);
  }

  @Post(':id/rechazar')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  rechazar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(motivoSchema)) b: { motivo: string }) {
    return this.svc.rechazar(u, id, b.motivo);
  }

  @Post(':id/cancelar')
  @Roles('SUPER_ADMIN', 'ADMIN')
  cancelar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(motivoSchema)) b: { motivo: string }) {
    return this.svc.cancelar(u, id, b.motivo);
  }

  @Post(':id/conciliar')
  @Roles('SUPER_ADMIN', 'ADMIN')
  conciliar(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() b: { referencia_estado_cuenta?: string; notas?: string },
  ) {
    return this.svc.conciliar(u, id, b);
  }
}
