import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './common/auth';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { CatalogosController } from './catalogos/catalogos.controller';
import { CatalogosService } from './catalogos/catalogos.service';
import { MovimientosController } from './movimientos/movimientos.controller';
import { MovimientosService } from './movimientos/movimientos.service';
import { ComprobantesController } from './comprobantes/comprobantes.controller';
import { DashboardController, DashboardService } from './dashboard/dashboard.service';
import { ErpModule } from './erp/erp.module';
import { AccesoModule } from './common/acceso.service';
import { UsuariosController, UsuariosService } from './usuarios/usuarios.service';
import { CreditosController, CreditosService } from './creditos/creditos.service';
import { ReportesController, ReportesService } from './reportes/reportes.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]), PrismaModule, AccesoModule, AuthModule, ErpModule],
  controllers: [
    ClientesController,
    CatalogosController,
    MovimientosController,
    ComprobantesController,
    DashboardController,
    CreditosController,
    ReportesController,
    UsuariosController,
  ],
  providers: [
    ClientesService,
    CatalogosService,
    MovimientosService,
    DashboardService,
    CreditosService,
    ReportesService,
    UsuariosService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
