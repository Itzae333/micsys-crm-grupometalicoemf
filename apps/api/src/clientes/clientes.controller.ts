import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { clienteSchema, cuentaClienteSchema } from '@micsys-crm/shared';
import type { ClienteInput, CuentaClienteInput } from '@micsys-crm/shared';
import { CurrentUser, ZodPipe } from '../common/auth';
import type { AuthUser } from '../common/auth';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private svc: ClientesService) {}

  @Get()
  listar(@CurrentUser() u: AuthUser, @Query() q: Record<string, string>) {
    return this.svc.listar(u, q);
  }

  @Get(':id')
  detalle(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.detalle(u, id);
  }

  @Post()
  crear(@CurrentUser() u: AuthUser, @Body(new ZodPipe(clienteSchema)) dto: ClienteInput) {
    return this.svc.crear(u, dto);
  }

  @Put(':id')
  actualizar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(clienteSchema)) dto: ClienteInput) {
    return this.svc.actualizar(u, id, dto);
  }

  @Patch(':id/activo')
  activar(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { activo: boolean }) {
    return this.svc.activar(u, id, !!b.activo);
  }

  @Post(':id/cuentas')
  crearCuenta(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(cuentaClienteSchema)) dto: CuentaClienteInput,
  ) {
    return this.svc.crearCuenta(u, id, dto);
  }

  @Put(':id/cuentas/:cuentaId')
  actualizarCuenta(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('cuentaId') cuentaId: string,
    @Body(new ZodPipe(cuentaClienteSchema)) dto: CuentaClienteInput,
  ) {
    return this.svc.actualizarCuenta(u, id, cuentaId, dto);
  }

  @Patch(':id/cuentas/:cuentaId/activa')
  activarCuenta(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('cuentaId') cuentaId: string,
    @Body() b: { activa: boolean },
  ) {
    return this.svc.activarCuenta(u, id, cuentaId, !!b.activa);
  }
}
