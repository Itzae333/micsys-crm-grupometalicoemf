# Despliegue — Cauce

API en **Railway** (con su propio Postgres), web en **Vercel**.

## 1. Base de datos (Railway)
Usa un servicio Postgres **solo para el CRM** (no el del ERP). El API se conecta por la URL **interna**:
`DATABASE_URL = ${{Postgres-XXXX.DATABASE_URL}}` (referencia al servicio). El TCP proxy público solo hace falta
si quieres conectarte desde tu PC; no pongas esa URL en producción.

## 2. API (Railway)
Servicio desde este repo; Root Directory vacío. El [railway.json](../railway.json) ya define build, migraciones
(`migrate:prod`) y `/health`.

| Variable | Valor |
|---|---|
| `DATABASE_URL` | referencia al Postgres del CRM |
| `JWT_SECRET` | `openssl rand -base64 64` (mínimo 32 caracteres; el API no arranca con uno corto en producción) |
| `JWT_EXPIRES_IN` | `30d` |
| `FRONTEND_URL` | URL de Vercel, sin barra final (varias separadas por coma) |
| `NODE_ENV` | `production` |
| `UPLOADS_DIR` | `/data/uploads` — **monta un Volume de Railway en `/data`** o se pierden los comprobantes en cada deploy |
| `ERP_INTEGRATION_ENABLED` / `ERP_API_URL` / `ERP_API_KEY` | integración con el ERP (ver [INTEGRACION-ERP.md](INTEGRACION-ERP.md)). La llave debe ser la misma que `INTEGRACION_API_KEY` del ERP |

## 2.1 ERP (Railway, servicio existente)
Agrega `INTEGRACION_API_KEY` (mínimo 24 caracteres; `openssl rand -base64 36`) para activar `/api/v1/integracion/*`. Sin ella el módulo responde 503. `INTEGRACION_EMPRESAS` define qué empresas puede leer el CRM: `*` para todas, o una lista (`EMFIMIFAR,Metálicos Lyeva`). Sin ella solo se expone EMFIMIFAR.

## 3. Web (Vercel)
Root Directory `apps/web`; usa [vercel.json](../vercel.json). Variable: `NEXT_PUBLIC_API_URL = https://<api>.railway.app/api/v1`.

## 4. Primer arranque
Las migraciones corren solas. Crea el usuario admin una vez, con la contraseña en el entorno (no en el repo):
```bash
railway run -s <servicio-api> -- env SEED_ADMIN_PASSWORD='...' pnpm --filter @micsys-crm/database run seed
```
El seed crea **solo** la organización, las divisas y el super usuario. Después entra, ve a **Configuración**: registra los tipos de cambio y usa **Traer ubicaciones del ERP**; da de alta las cuentas en **Cuentas** y da de alta al equipo en **Usuarios** (eligiendo a qué ubicaciones entra cada uno) y guarda clientes desde **Clientes → Guardar clientes del ERP**.

Para instalarla como PWA se necesita https (Vercel ya lo da). La app no funciona sin conexión a propósito.

## Pendiente antes de producción
- Mover comprobantes a almacenamiento de objetos (R2/S3) si se espera mucho volumen.
- Respaldos automáticos de Postgres (Railway Backups).
- Verificar el nombre “Cauce” en IMPI (clases 9 y 42) y el dominio.
