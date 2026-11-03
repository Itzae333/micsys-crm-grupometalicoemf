import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { cuentaDestinoSchema, ejecutivoSchema, empresaSchema, tipoCambioSchema, ubicacionSchema } from '@micsys-crm/shared';
import type { CuentaDestinoInput, EjecutivoInput } from '@micsys-crm/shared';
import { CurrentUser, Roles, ZodPipe } from '../common/auth';
import type { AuthUser } from '../common/auth';
import { CatalogosService } from './catalogos.service';

@Controller()
export class CatalogosController {
  constructor(private svc: CatalogosService) {}

  // Empresas
  @Get('empresas')
  empresas(@CurrentUser() u: AuthUser) {
    return this.svc.empresas(u);
  }
  @Post('empresas')
  @Roles('SUPER_ADMIN')
  crearEmpresa(@CurrentUser() u: AuthUser, @Body(new ZodPipe(empresaSchema)) dto: { nombre: string }) {
    return this.svc.crearEmpresa(u, dto);
  }
  @Put('empresas/:id')
  @Roles('SUPER_ADMIN')
  actualizarEmpresa(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: { nombre?: string; activa?: boolean }) {
    return this.svc.actualizarEmpresa(u, id, dto);
  }

  // Ubicaciones
  @Get('ubicaciones')
  ubicaciones(@CurrentUser() u: AuthUser, @Query('todas') todas?: string) {
    return this.svc.ubicaciones(u, todas === 'true');
  }
  @Post('ubicaciones')
  @Roles('SUPER_ADMIN')
  crearUbicacion(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ubicacionSchema)) dto: { empresa_id: string; nombre: string; tipo?: string | null }) {
    return this.svc.crearUbicacion(u, dto);
  }
  @Put('ubicaciones/:id')
  @Roles('SUPER_ADMIN')
  actualizarUbicacion(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: { nombre?: string; tipo?: string | null; activa?: boolean },
  ) {
    return this.svc.actualizarUbicacion(u, id, dto);
  }

  // Ejecutivos
  @Get('ejecutivos')
  ejecutivos(@CurrentUser() u: AuthUser) {
    return this.svc.ejecutivos(u);
  }
  @Post('ejecutivos')
  crearEjecutivo(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ejecutivoSchema)) dto: EjecutivoInput) {
    return this.svc.crearEjecutivo(u, dto);
  }
  @Put('ejecutivos/:id')
  actualizarEjecutivo(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: EjecutivoInput & { activo?: boolean },
  ) {
    return this.svc.actualizarEjecutivo(u, id, dto);
  }

  // Cuentas destino
  @Get('cuentas-destino')
  cuentas(@CurrentUser() u: AuthUser, @Query('activas') activas?: string) {
    return this.svc.cuentasDestino(u, activas === 'true');
  }
  @Post('cuentas-destino')
  @Roles('SUPER_ADMIN', 'ADMIN')
  crearCuenta(@CurrentUser() u: AuthUser, @Body(new ZodPipe(cuentaDestinoSchema)) dto: CuentaDestinoInput) {
    return this.svc.crearCuentaDestino(u, dto);
  }
  @Put('cuentas-destino/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  actualizarCuenta(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(cuentaDestinoSchema)) dto: CuentaDestinoInput,
  ) {
    return this.svc.actualizarCuentaDestino(u, id, dto);
  }
  @Patch('cuentas-destino/:id/activa')
  @Roles('SUPER_ADMIN', 'ADMIN')
  activarCuenta(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { activa: boolean }) {
    return this.svc.activarCuentaDestino(u, id, !!b.activa);
  }

  // Divisas
  @Get('monedas')
  monedas(@CurrentUser() u: AuthUser) {
    return this.svc.monedas(u);
  }
  @Post('monedas')
  @Roles('SUPER_ADMIN', 'ADMIN')
  crearMoneda(@CurrentUser() u: AuthUser, @Body() dto: { codigo: string; nombre: string; simbolo: string }) {
    return this.svc.crearMoneda(u, dto);
  }
  @Post('tipos-cambio')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  tipoCambio(
    @CurrentUser() u: AuthUser,
    @Body(new ZodPipe(tipoCambioSchema)) dto: { moneda: string; valor: number; fecha?: string },
  ) {
    return this.svc.registrarTipoCambio(u, dto);
  }
}
