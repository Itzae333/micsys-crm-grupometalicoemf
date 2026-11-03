# CRM Administración — Proyecto Maestro

> CRM a medida para la administradora del Grupo Metálico EMF. Controla clientes, cuentas,
> cobros, abonos, depósitos y transferencias, y **dónde cayó cada peso**.
> Stack idéntico al ERP `micsys-erp-grupometalicoemf` (ver `STACK.md` de ese repo).
> Nombre y marca: **pendientes** (ver `docs/reference/BRANDING-BRIEF.md`). Usar `APP_NAME` configurable.

## 1. Alcance
- Un solo usuario (administradora) hoy; modelo de usuarios/roles listo para expandir a distribución.
- Registrar movimientos de dinero de clientes y **a qué cuenta cayeron**.
- Referenciar ventas del ERP cuando el cobro/abono corresponde a ventas, o registrar movimientos que **no son de ventas**.
- Multi-divisa; todo se reporta en MXN.
- Consulta de clientes y ventas del ERP **solo lectura, vía API (opción A)**.

## 2. Arquitectura
Monorepo Turborepo + pnpm: `apps/web` (Next.js 14 PWA → Vercel), `apps/api` (NestJS 11 → Railway),
`packages/database` (Prisma 5 + Postgres Railway), `packages/shared` (Zod/tipos).
Scope de paquetes: `@micsys-crm/*`.

## 3. Modelo de datos

### Cuentas destino (donde cae el dinero)
`CuentaDestino`: alias, banco, CLABE/número, moneda, **tipo `EMPRESA | EJECUTIVO`**, titular
(si es ejecutivo: `ejecutivo_id`), activa, fecha alta/baja, notas.
`Ejecutivo`: nombre, teléfono, activo (persona que recibe dinero en cuenta propia).
Dar de alta una cuenta deja `AuditLog`; no se borran, se desactivan.

### Clientes
`Cliente`: datos de contacto/fiscales, estatus, etiquetas, `origen: MANUAL | ERP`.
`CuentaCliente`: cuentas bancarias del cliente (banco, CLABE, titular, alias).
`ErpLink`: `cliente_id` ↔ `erp_cliente_id` (sin duplicar por RFC/teléfono).

### Movimientos (núcleo)
`Movimiento`:
- `tipo`: `COBRO | ABONO | DEPOSITO | TRANSFERENCIA | RETIRO | AJUSTE`
- `cliente_id`, `cuenta_destino_id` (obligatoria en ingresos), `cuenta_cliente_id?` (origen)
- `metodo`: efectivo | transferencia | depósito | cheque | otro
- `moneda`, `monto`, `tipo_cambio`, `monto_mxn` (congelados al capturar)
- `fecha_movimiento`, `referencia_bancaria`, `concepto`, `motivo: VENTA | OTRO` + `categoria_otro?`
- `estatus`: `PENDIENTE | CONFIRMADO | RECHAZADO | CANCELADO` (nunca borrado físico)
- `saldo_antes/saldo_despues` por cliente **y por moneda**, calculados en transacción
- `usuario_id`, `created_at`
`MovimientoVentaRef` (N:M): `movimiento_id`, `erp_venta_id`, `folio`, `monto_aplicado` →
un abono puede cubrir varias ventas y una venta recibir varios abonos.
`Comprobante`: archivos (imagen/PDF) del movimiento en storage (R2).
`Conciliacion`: verificación contra estado de cuenta.
`AuditLog`: quién cambió qué.

### Divisas
`Moneda` (código ISO, símbolo, activa; base = MXN) y `TipoCambio` (moneda, fecha, valor, fuente).
Al capturar, el tipo de cambio se propone del último registrado y es editable; se guarda en el
movimiento para que los reportes históricos no cambien. Saldos por cliente se llevan **por moneda**;
los reportes consolidan a MXN con `monto_mxn`.

## 4. Integración ERP (opción A — API)
- Módulo nuevo en el ERP: `/integracion/*` solo lectura, protegido con API key de servicio
  (`ERP_INTEGRATION_KEY`), rate-limited.
  - `GET /integracion/clientes?search=&updated_since=`
  - `GET /integracion/clientes/:id/ventas?estatus=&desde=&hasta=`
  - `GET /integracion/ventas/:id`
- CRM: `ErpClientModule` con `ERP_API_URL` + `ERP_API_KEY`; flag `ERP_INTEGRATION_ENABLED`.
- Funciones: importar cliente, ver ventas del cliente (pestaña solo lectura), elegir ventas al
  registrar cobro/abono (alimenta `MovimientoVentaRef`).
- El CRM nunca escribe en el ERP. Si el ERP no responde, el CRM sigue operando (movimientos "OTRO").

## 5. Fases
| # | Fase | Contenido |
|---|---|---|
| 0 | Fundación | Monorepo, auth, usuario admin, layout, deploy Railway+Vercel |
| 1 | Clientes | CRUD, búsqueda, ficha con timeline |
| 2 | Cuentas | Ejecutivos, cuentas destino (empresa/ejecutivo), cuentas cliente |
| 3 | Divisas | Monedas, tipos de cambio |
| 4 | Movimientos | Captura, comprobantes, saldos, cancelación con auditoría |
| 5 | Integración ERP | API en ERP, importar clientes, ver/ligar ventas |
| 6 | Reportes | Por cuenta destino, ejecutivo, cliente, periodo; CSV/Excel/PDF; conciliación |
| 7 | Pulido | PWA móvil, notificaciones, respaldos, branding final |

## 6. Reglas críticas
- Montos `Decimal(12,2)`; saldos y movimientos en transacción.
- Sin borrado físico de movimientos ni cuentas.
- Todo ingreso debe indicar a qué cuenta destino cayó.
- Branding vía tokens (Tailwind/CSS vars) para aplicar el resultado del brief sin refactor.
