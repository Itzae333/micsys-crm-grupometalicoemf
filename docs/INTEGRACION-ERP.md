# Integración CRM ↔ ERP (API con API key, solo lectura)

El CRM **nunca escribe** en el ERP ni toca su base de datos: lee por HTTP con una API key de servicio.
Alcance: las **empresas que el ERP exponga** (variable `INTEGRACION_EMPRESAS`, por defecto solo EMFIMIFAR) con sus ubicaciones. Los clientes van por ubicación, igual que en el ERP.

## Cómo se usa (flujo del usuario)

1. **Configuración → Traer empresas y ubicaciones del ERP** (o crearlas a mano; también se pueden crear empresas que no estén en el ERP). Al guardar un cliente, su empresa y su ubicación se crean solas si faltan.
2. **Clientes → Guardar clientes del ERP**: se elige ubicación/búsqueda, se marcan hasta 100 clientes y se guardan.
   Quedan en el CRM con **saldo $0.00**. El saldo del ERP se guarda aparte como *foto* (`ErpLink.saldo_erp`).
   Al guardarlos también se leen sus tickets a crédito.
3. **Crédito**: lista de todos los tickets a crédito de esos clientes con total, pagado, avance, vencimiento y saldo.
4. **Actualizar desde el ERP** (en Clientes, Crédito, Reportes o en la ficha del cliente): vuelve a leer saldo y tickets.
   **No cambia el saldo del CRM.**
5. **Sincronizar saldo** (ficha del cliente, o varios a la vez desde Reportes → Crédito): vuelve a leer el saldo del ERP e iguala
   el saldo del CRM a ese valor. Queda un movimiento de tipo **Sincronización** (con su signo, saldo antes/después y el saldo del ERP).
   Si fue un error, se **cancela** y el saldo regresa.
6. **Reportes**: *Crédito* (cuántos clientes deben, tickets abiertos/vencidos, antigüedad, saldo ERP vs CRM, desincronizados) y
   *Cobranza* (cobrado, quién pagó, a qué cuenta cayó, clientes con crédito que no han pagado, aplicado a tickets).

Todo movimiento deja registro: abonos, cobros, cargos, sincronizaciones y cancelaciones (`Movimiento` + `AuditLog`).

## Del lado del ERP (módulo `integracion`, ya creado)

`apps/api/src/integracion/` — registrado en `app.module.ts`. Solo `GET`, `@Public()` para el JWT del ERP y protegido por
`ApiKeyGuard` (`x-api-key`, comparación en tiempo constante; sin llave configurada responde 503).

| Variable (ERP) | Valor |
|---|---|
| `INTEGRACION_API_KEY` | Obligatoria, mínimo 24 caracteres. `openssl rand -base64 36` |
| `INTEGRACION_EMPRESAS` | Empresas expuestas: nombres separados por coma (`EMFIMIFAR,Metálicos Lyeva`) o `*` para todas las activas. **Sin definir, solo `EMFIMIFAR`**: ampliar lo que la llave puede leer es una decisión explícita. Cambiarla requiere reiniciar el ERP |

| Endpoint | Para qué |
|---|---|
| `GET /api/v1/integracion/empresas` | Empresas que la llave puede leer |
| `GET /api/v1/integracion/ubicaciones` | Ubicaciones activas de esas empresas, cada una con su empresa |
| `GET /api/v1/integracion/clientes?ubicacion_id=&search=&page=&limit=&con_saldo=&ids=` | Clientes (excluye `MOSTRADOR`). `ids` = hasta 100 separados por coma |
| `GET /api/v1/integracion/clientes/saldos?ids=a,b,c` | Saldo y límite de crédito de hasta 200 clientes |
| `GET /api/v1/integracion/tickets?cliente_ids=a,b,c&estatus=abiertos\|todos` | Tickets a crédito de hasta 100 clientes |
| `GET /api/v1/integracion/tickets/:id` | Detalle de una venta: encabezado, productos, pagos (al cierre y abonos), movimientos de cuenta y lista de evidencias (sin el archivo) |
| `GET /api/v1/integracion/tickets/:id/evidencias/:evidenciaId` | El comprobante (imagen o PDF). Solo `jpeg/png/webp/gif/pdf`; cualquier otro tipo responde 404 |
| `GET /api/v1/integracion/clientes/:id/ventas?page&limit&estatus&tipo&desde&hasta&q` | **Todas** las ventas del cliente (contado y crédito, pagadas, canceladas…), paginadas, con formas de pago, fecha en que se liquidó cada una y días que tardó. No incluye carritos `ABIERTA`. `desde`/`hasta` en `YYYY-MM-DD` abarcan días completos (hora de México) |
| `GET /api/v1/integracion/clientes/:id/movimientos?limit=` | Cargos, abonos y ajustes de la cuenta del cliente |

**Ticket a crédito** = nota con `es_credito = true` (o estatus `CREDITO`) y estatus `CREDITO`, `PAGADA`, `FINALIZADA`, `INCOMPLETA` o `REABIERTA`.
`pagado` = suma de sus pagos; `saldo` = `total − pagado`; `abonos_count` = pagos posteriores al cierre (ligados a un movimiento de cuenta);
`vencido` = con saldo y `fecha_vencimiento` pasada. Solo se leen datos de la empresa configurada: no hay forma de pedir otra.

## Variables de entorno y la API key

La llave vive **solo en variables de entorno** (nunca en el repo). Es la misma cadena en los dos lados:

| Lado | Variable |
|---|---|
| ERP (api) | `INTEGRACION_API_KEY` |
| CRM (api) | `ERP_API_KEY` (+ `ERP_API_URL`, `ERP_INTEGRATION_ENABLED=true`) |

- **Desarrollo:** `openssl rand -hex 24` → se pone en `apps/api/.env` del ERP y en `apps/api/.env` del CRM. El ERP corre en 3000/3001 y el CRM en 3100/3101 para poder levantar los dos a la vez.
- **Railway:** se genera una llave **distinta** y se carga como variable en el servicio del ERP y en el del CRM. `ERP_API_URL` debe ser la URL pública (o interna) del ERP terminada en `/api/v1`.
- **Rotarla:** cambia primero la del ERP y luego la del CRM; mientras no coincidan, el CRM muestra “El ERP rechazó la API key” y sigue funcionando con lo ya guardado. Las llaves viejas dejan de servir al instante.

## Ver todas las ventas de un cliente (solo lectura)
En la ficha del cliente (guardado desde el ERP), la pestaña **Ventas** lista todas sus ventas leídas en vivo del ERP: tipo (contado/crédito), estatus del ERP,
formas de pago, **cuándo se liquidó** (fecha del pago que completó el total y cuántos días tardó), total, pagado y saldo; con resumen (total vendido, pagado,
por cobrar, cliente desde), filtros por estatus, tipo, fechas y folio, y exportación a CSV. Las canceladas muestran fecha y motivo y no suman al total vendido.
Cualquier venta se abre en su detalle (`/ventas/:id`), sea de crédito o no.

## Ver una venta en el CRM (solo lectura)
En **Crédito** o en la ficha del cliente, el folio del ticket abre su detalle: productos, pagos (al cerrar la venta y abonos, con quién los registró),
los movimientos de la cuenta ligados a esa venta, los **comprobantes** que el ERP tiene guardados (se ven en miniatura y se amplían), y lo que el CRM
tiene registrado contra ese ticket. Nada de esa pantalla modifica el ERP. Los comprobantes pasan por el API del CRM: el navegador nunca ve la API key
y respeta el alcance por ubicación del usuario.

## Del lado del CRM

| Variable (CRM api) | Valor |
|---|---|
| `ERP_INTEGRATION_ENABLED` | `true` |
| `ERP_API_URL` | `https://<api-erp>/api/v1` |
| `ERP_API_KEY` | la misma llave que `INTEGRACION_API_KEY` |

Si el ERP no responde, el CRM sigue funcionando (movimientos manuales y lo último leído); solo falla “Actualizar/Sincronizar”.

## Cómo se interpreta el saldo y los estatus del ERP

- **El saldo del ERP nunca es negativo.** En el ERP `saldo_pendiente` es lo que el cliente debe y todo el código lo limita a $0 (`Math.max(0, …)`): no existe saldo a favor, y un abono mayor se recorta al saldo de la nota. El CRM muestra ese valor tal cual. Solo el saldo **del CRM** puede quedar negativo (si registras abonos antes de sincronizar, porque arranca en $0).
- **Cada venta conserva el estatus del ERP** (Crédito, Pagada, Reabierta, Finalizada, Incompleta…). El CRM no lo reinterpreta; la fecha de vencimiento va en su propia columna y queda vacía cuando el ERP no la trae (hoy ninguna venta a crédito la tiene).
- **Ventas `REABIERTA`:** al reabrir una nota a crédito para editarla, el ERP le descuenta su cargo al cliente (movimiento AJUSTE “Reversión de crédito por edición autorizada”) y se lo vuelve a cobrar al cerrarla. Mientras tanto el cliente **aún no la debe**, así que el CRM la muestra aparte (“aún no se cobra”) y **no la suma** al saldo por cobrar, a la antigüedad ni a los totales.
- **Saldo sin venta que lo respalde:** hay clientes con saldo en el ERP sin ninguna venta a crédito abierta (saldos iniciales o ajustes, sin movimientos de cuenta). El CRM no lo oculta ni lo cuadra: lo desglosa en la ficha del cliente y en Reportes → Crédito.

## Modelo de datos (CRM)
- `Empresa` (con `erp_empresa_id`, nula si solo existe en el CRM) → `Ubicacion` (con `erp_ubicacion_id`; el nombre es único dentro de su empresa, así que dos empresas pueden tener su “Matriz”), `Cliente.ubicacion_id`, `UsuarioUbicacion` (alcance de cada usuario; ADMIN ve todas).
- `ErpLink`: cliente CRM ↔ cliente ERP, `saldo_erp` (foto), `saldo_erp_at`, `saldo_sincronizado_at`, `tickets_at`.
- `ErpTicket`: foto de los tickets a crédito (permite listar y reportar sin llamar al ERP cada vez).
- `Movimiento.tipo = SINCRONIZACION` con `signo` (+1/−1) y `saldo_erp`.

## Pruebas realizadas
Contra un ERP real (con sus migraciones) y datos de ejemplo, incluida una segunda empresa que **nunca** aparece:
llaves (sin llave / mala / correcta), importación múltiple sin duplicar, saldo del CRM en cero al importar,
tickets (pagado, saldo, avance, vencidos), reporte de crédito y antigüedad, un abono hecho en el ERP que el CRM no ve hasta “Actualizar”,
sincronización hacia arriba y hacia abajo, cancelar una sincronización, abono ligado a un ticket, cobranza,
y alcance por ubicación (un operador de PV Centro no ve ni sincroniza clientes de Matriz).
