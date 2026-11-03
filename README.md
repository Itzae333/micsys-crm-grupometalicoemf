# Cauce — CRM de administración · Grupo Metálico EMF

> **Cada peso, en su cauce.** Clientes, cobros, abonos, depósitos y transferencias, y la cuenta exacta donde cayó cada uno.

Monorepo Turborepo + pnpm, mismo stack que el ERP (`micsys-erp-grupometalicoemf`).

```
apps/web         Next.js 14 (App Router) · Tailwind con tokens de Cauce        → Vercel
apps/api         NestJS 11 · JWT + argon2 · Zod                                → Railway
packages/database Prisma 5 + PostgreSQL (schema, migraciones, seed)
packages/shared  Esquemas Zod y helpers compartidos web ↔ api
brand/           Logos, tokens y PWA icons       docs/DESIGN-SYSTEM.md  Sistema de diseño
```

## Arrancar en local

```bash
docker compose up -d                                   # Postgres en :5434
cp packages/database/.env.example packages/database/.env
cp apps/api/.env.example apps/api/.env                 # pon un JWT_SECRET propio
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm db:generate && pnpm db:migrate                    # aplica migraciones
SEED_ADMIN_PASSWORD='elige-una-contraseña' pnpm db:seed   # crea SOLO la organización, las divisas y el super usuario
pnpm --filter @micsys-crm/shared run build
pnpm dev                                               # web :3100 · api :3101 (el ERP usa 3000/3001)
```

Usuario inicial: el **super usuario** `admin@crm.local` (cambia con `SEED_ADMIN_EMAIL`). El seed no crea ubicaciones, clientes ni cuentas:
entra, trae las ubicaciones del ERP en **Configuración** y da de alta al resto del equipo en **Usuarios**.

### Usuarios y ubicaciones
Solo el **super usuario** ve todo, da de alta usuarios y decide a qué ubicaciones de EMFIMIFAR entra cada uno.
Cualquier otro rol (Administrador, Operador, Solo consulta) ve únicamente lo que se le asignó: clientes, movimientos, crédito, reportes y
hasta los clientes del ERP que puede guardar. Los permisos aplican al instante; al desactivar a alguien o cambiarle la contraseña sus sesiones se cierran.

## Qué hay

| Módulo | Estado |
|---|---|
| Auth (JWT, cierre de todas las sesiones, throttling) · **Usuarios** (solo super usuario) y alcance por ubicación | ✅ |
| Ubicaciones (a mano o traídas del ERP) · clientes por ubicación · cuentas del cliente · estado de cuenta CSV | ✅ |
| Cuentas destino (Empresa / Ejecutivo), ejecutivos, baja sin borrar | ✅ |
| Divisas y tipo de cambio (todo se consolida en MXN) | ✅ |
| Movimientos: Pendiente → Confirmado / Rechazado / Cancelado, saldos por divisa, comprobantes, conciliación, CSV | ✅ |
| **ERP por API (solo lectura):** guardar clientes elegidos (saldo en cero), leer saldo y tickets a crédito, sincronizar saldo a voluntad | ✅ |
| **Crédito:** todos los tickets a crédito, avance, vencimiento, saldo | ✅ |
| **Reportes:** crédito (clientes, tickets, antigüedad, ERP vs CRM) y cobranza | ✅ |
| Dashboard por ubicación: KPIs, serie diaria, “¿a dónde cayó el dinero?”, por confirmar | ✅ |
| PWA instalable (sin offline) | ✅ |
| PDF/Excel, notificaciones, modo offline | ⏳ |

Integración con el ERP: [docs/INTEGRACION-ERP.md](docs/INTEGRACION-ERP.md).

## Reglas que el código garantiza

- Montos `Decimal`; saldos y cambios de estado en transacción con bloqueo de fila.
- Un movimiento **Pendiente no mueve el saldo**; al confirmar sí. Cancelar uno confirmado revierte el saldo.
- Todo ingreso exige cuenta destino, y la **divisa la define la cuenta**.
- Nada se borra: cuentas se dan de baja, movimientos se cancelan con motivo y quedan en `AuditLog`.
- Un movimiento hereda la ubicación del cliente; ningún usuario ve ni toca clientes fuera de las suyas.
- Sincronizar saldo nunca es automático: lo decide el usuario y queda como movimiento cancelable.
- Los comprobantes solo admiten JPG/PNG/WEBP/PDF (máx. 8 MB), con nombre generado por el servidor.

Despliegue: [docs/DEPLOY.md](docs/DEPLOY.md).
