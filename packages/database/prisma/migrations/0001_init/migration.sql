-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'CONSULTA');

-- CreateEnum
CREATE TYPE "OrigenCliente" AS ENUM ('MANUAL', 'ERP');

-- CreateEnum
CREATE TYPE "TipoCuentaDestino" AS ENUM ('EMPRESA', 'EJECUTIVO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('CARGO', 'SINCRONIZACION', 'COBRO', 'ABONO', 'DEPOSITO', 'TRANSFERENCIA', 'RETIRO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MetodoMovimiento" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'OTRO');

-- CreateEnum
CREATE TYPE "MotivoMovimiento" AS ENUM ('VENTA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstatusMovimiento" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "organizaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "moneda_base" TEXT NOT NULL DEFAULT 'MXN',
    "config_marca" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "erp_ubicacion_id" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_ubicaciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "ubicacion_id" TEXT NOT NULL,

    CONSTRAINT "usuario_ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "ubicacion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "razon_social" TEXT,
    "rfc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origen" "OrigenCliente" NOT NULL DEFAULT 'MANUAL',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "clabe" TEXT,
    "numero" TEXT,
    "titular" TEXT,
    "alias" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_links" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "erp_cliente_id" TEXT NOT NULL,
    "erp_ubicacion_id" TEXT NOT NULL,
    "saldo_erp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "limite_credito_erp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo_erp_at" TIMESTAMP(3),
    "saldo_sincronizado_at" TIMESTAMP(3),
    "tickets_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_tickets" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "erp_nota_id" TEXT NOT NULL,
    "erp_ubicacion_id" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vence" TIMESTAMP(3),
    "total" DECIMAL(14,2) NOT NULL,
    "pagado" DECIMAL(14,2) NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL,
    "abierto" BOOLEAN NOT NULL,
    "estatus" TEXT NOT NULL,
    "abonos_count" INTEGER NOT NULL DEFAULT 0,
    "abonos_monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ultimo_pago_at" TIMESTAMP(3),
    "actualizado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecutivos" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_destino" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "tipo" "TipoCuentaDestino" NOT NULL,
    "ejecutivo_id" TEXT,
    "alias" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "clabe" TEXT,
    "numero" TEXT,
    "titular" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fecha_alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_baja" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_destino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monedas" (
    "id" TEXT NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "monedas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_cambio" (
    "id" TEXT NOT NULL,
    "moneda_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "valor" DECIMAL(14,6) NOT NULL,
    "fuente" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" TEXT NOT NULL,
    "folio" SERIAL NOT NULL,
    "organizacion_id" TEXT NOT NULL,
    "ubicacion_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "metodo" "MetodoMovimiento",
    "motivo" "MotivoMovimiento" NOT NULL DEFAULT 'OTRO',
    "categoria_otro" TEXT,
    "concepto" TEXT NOT NULL,
    "referencia" TEXT,
    "cuenta_destino_id" TEXT,
    "cuenta_cliente_id" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "monto" DECIMAL(14,2) NOT NULL,
    "tipo_cambio" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "monto_mxn" DECIMAL(14,2) NOT NULL,
    "saldo_antes" DECIMAL(14,2) NOT NULL,
    "saldo_despues" DECIMAL(14,2) NOT NULL,
    "signo" INTEGER NOT NULL DEFAULT 0,
    "saldo_erp" DECIMAL(14,2),
    "fecha_movimiento" TIMESTAMP(3) NOT NULL,
    "estatus" "EstatusMovimiento" NOT NULL DEFAULT 'PENDIENTE',
    "confirmado_at" TIMESTAMP(3),
    "confirmado_por_id" TEXT,
    "motivo_cancelacion" TEXT,
    "cancelado_at" TIMESTAMP(3),
    "cancelado_por_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_venta_refs" (
    "id" TEXT NOT NULL,
    "movimiento_id" TEXT NOT NULL,
    "erp_venta_id" TEXT NOT NULL,
    "erp_empresa" TEXT,
    "folio" TEXT,
    "monto_aplicado" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',

    CONSTRAINT "movimiento_venta_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "moneda" TEXT NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" TEXT NOT NULL,
    "movimiento_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "subido_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conciliaciones" (
    "id" TEXT NOT NULL,
    "movimiento_id" TEXT NOT NULL,
    "conciliado" BOOLEAN NOT NULL DEFAULT true,
    "referencia_estado_cuenta" TEXT,
    "notas" TEXT,
    "conciliado_por_id" TEXT,
    "conciliado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "antes" JSONB,
    "despues" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_organizacion_id_nombre_key" ON "ubicaciones"("organizacion_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_organizacion_id_erp_ubicacion_id_key" ON "ubicaciones"("organizacion_id", "erp_ubicacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_ubicaciones_usuario_id_ubicacion_id_key" ON "usuario_ubicaciones"("usuario_id", "ubicacion_id");

-- CreateIndex
CREATE INDEX "clientes_organizacion_id_ubicacion_id_nombre_idx" ON "clientes"("organizacion_id", "ubicacion_id", "nombre");

-- CreateIndex
CREATE INDEX "clientes_organizacion_id_rfc_idx" ON "clientes"("organizacion_id", "rfc");

-- CreateIndex
CREATE UNIQUE INDEX "erp_links_cliente_id_key" ON "erp_links"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "erp_links_erp_cliente_id_key" ON "erp_links"("erp_cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "erp_tickets_erp_nota_id_key" ON "erp_tickets"("erp_nota_id");

-- CreateIndex
CREATE INDEX "erp_tickets_cliente_id_abierto_idx" ON "erp_tickets"("cliente_id", "abierto");

-- CreateIndex
CREATE INDEX "erp_tickets_abierto_vence_idx" ON "erp_tickets"("abierto", "vence");

-- CreateIndex
CREATE INDEX "cuentas_destino_organizacion_id_activa_idx" ON "cuentas_destino"("organizacion_id", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "monedas_organizacion_id_codigo_key" ON "monedas"("organizacion_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_cambio_moneda_id_fecha_key" ON "tipos_cambio"("moneda_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_organizacion_id_cliente_id_fecha_movimiento_idx" ON "movimientos"("organizacion_id", "cliente_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_organizacion_id_cuenta_destino_id_fecha_movimie_idx" ON "movimientos"("organizacion_id", "cuenta_destino_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_organizacion_id_estatus_idx" ON "movimientos"("organizacion_id", "estatus");

-- CreateIndex
CREATE INDEX "movimientos_organizacion_id_ubicacion_id_fecha_movimiento_idx" ON "movimientos"("organizacion_id", "ubicacion_id", "fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimiento_venta_refs_erp_venta_id_idx" ON "movimiento_venta_refs"("erp_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_venta_refs_movimiento_id_erp_venta_id_key" ON "movimiento_venta_refs"("movimiento_id", "erp_venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_cliente_cliente_id_moneda_key" ON "saldos_cliente"("cliente_id", "moneda");

-- CreateIndex
CREATE UNIQUE INDEX "conciliaciones_movimiento_id_key" ON "conciliaciones"("movimiento_id");

-- CreateIndex
CREATE INDEX "audit_logs_entidad_entidad_id_idx" ON "audit_logs"("entidad", "entidad_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_ubicaciones" ADD CONSTRAINT "usuario_ubicaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_ubicaciones" ADD CONSTRAINT "usuario_ubicaciones_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_cliente" ADD CONSTRAINT "cuentas_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_links" ADD CONSTRAINT "erp_links_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_tickets" ADD CONSTRAINT "erp_tickets_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecutivos" ADD CONSTRAINT "ejecutivos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_destino" ADD CONSTRAINT "cuentas_destino_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_destino" ADD CONSTRAINT "cuentas_destino_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "ejecutivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monedas" ADD CONSTRAINT "monedas_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_cambio" ADD CONSTRAINT "tipos_cambio_moneda_id_fkey" FOREIGN KEY ("moneda_id") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuenta_destino_id_fkey" FOREIGN KEY ("cuenta_destino_id") REFERENCES "cuentas_destino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuenta_cliente_id_fkey" FOREIGN KEY ("cuenta_cliente_id") REFERENCES "cuentas_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_venta_refs" ADD CONSTRAINT "movimiento_venta_refs_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_cliente" ADD CONSTRAINT "saldos_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conciliaciones" ADD CONSTRAINT "conciliaciones_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

