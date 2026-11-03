# Cauce — Sistema de diseño

CRM de administración del Grupo Metálico EMF (EMFIMIFAR, Metálicos Lyeva, Láminas Monterrey).
Referencias visuales: `docs/reference/mockups.html` (3 pantallas, claro/oscuro, escritorio/móvil) y
`brand/direcciones.html` (las 3 direcciones evaluadas).

---

## 1. Marca

### Nombre elegido: **Cauce**

> **Cada peso, en su cauce.**

El cauce es el lecho por donde corre el agua. El sistema hace eso con el dinero: dice por dónde
entró y en qué cuenta cayó. Es una palabra común del español, corta, se pronuncia igual en todo
México y no suena a banco.

`APP_NAME=Cauce` · slug `cauce` · dominio sugerido `cauce.<dominio-del-grupo>`

### Alternativas

| Nombre | Idea | Tagline | Nota |
|---|---|---|---|
| **Arqueo** | El arqueo de caja: contar lo que hay contra lo que debería haber. | Lo que entra, contado. | Muy de oficio administrativo. Dirección C. |
| **Fiel** | El fiel de la balanza, la aguja que indica si algo cuadra. | Las cuentas, en su fiel. | Tono notarial. Dirección B. |
| Nivela | Nivelar saldos; también el nivel de una estantería. | Saldos a nivel. | Más genérico. |
| Abono | El movimiento más común del sistema. | Cada abono, en su lugar. | Demasiado literal para crecer a más módulos. |
| Cuadra | “Que cuadren las cuentas”. | Que todo cuadre. | Descartado: existe la marca mexicana de botas Cuadra. |

Antes de usar el nombre fuera del grupo, verificar disponibilidad en el IMPI (clase 9 y 42) y del dominio.

### Las 3 direcciones (resumen)

| | A · **Cauce** (elegida) | B · Fiel | C · Arqueo |
|---|---|---|---|
| Carácter | Sobrio y cálido; flujo y orden | Notarial, despacho contable | Industrial, de planta |
| Color base | Petróleo `#155457` + latón | Tinta `#1F2A44` + latón | Grafito `#2B2F33` + amarillo seguridad |
| Tipografía | Schibsted Grotesk + IBM Plex Sans | Fraunces + Public Sans | Archivo |
| Por qué sí / no | Se distingue del ERP sin pelearse con él; Empresa/Ejecutivo validado para daltonismo | Mucha confianza, pero pesada en tablas densas y en móvil | Cercana al giro, pero se confunde con el ERP y su verde choca con “ingreso” |

---

## 2. Logo

Archivos en `brand/logo/`:

| Archivo | Uso |
|---|---|
| `cauce-horizontal.svg` | Encabezados claros, login, documentos |
| `cauce-horizontal-oscuro.svg` | Sidebar y fondos oscuros |
| `cauce-horizontal-mono.svg` | Una tinta (`currentColor`): impresión, sellos, fax |
| `cauce-simbolo.svg` / `-oscuro.svg` | Avatar de app, encabezado móvil |
| `cauce-simbolo-mono.svg` | Símbolo sin loseta a una tinta |
| `cauce-simbolo-mono-loseta.svg` | Loseta calada a una tinta |
| `cauce-wordmark.svg` | Solo palabra |
| `favicon.svg` | Favicon (trazo engrosado para 16–24 px) |
| `brand/pwa/*.png` | Íconos PWA: 192, 512, maskable 512, apple-touch 180, favicon 32 |

**Símbolo:** una C abierta (el cauce) que recibe una moneda de latón. El wordmark va en minúsculas,
Schibsted Grotesk Bold convertido a trazos (no depende de fuentes instaladas).

Reglas:
- Área de respeto: la mitad de la altura del símbolo alrededor.
- Tamaño mínimo: símbolo 16 px (usar `favicon.svg`); horizontal 96 px de ancho.
- La moneda siempre es latón o la misma tinta del trazo. Nunca verde, rojo ni otro color de estado.
- No rotar, no poner sombra, no colocar la versión a color sobre fotos.

---

## 3. Color

Los tokens se generan con `tools/build_tokens.py` y están en `brand/tokens/`:

- `globals.css` → bloque `:root` / `.dark` en canales HSL (formato shadcn/ui).
- `tailwind.cauce.ts` → fragmento `theme.extend.colors`, `fontFamily`, radios, sombras y tamaños.
- `tokens.json` → escalas y tokens en hex (para Figma, correos, PDF).
- `contraste-wcag.md` → 70 combinaciones validadas, **todas AA** (texto ≥ 4.5:1, iconos ≥ 3:1).

### Escalas

| Escala | Rol | 50 | 100 | 300 | 500 | 700 | 900 |
|---|---|---|---|---|---|---|---|
| `petroleo` | Primario y cuentas de Empresa | `#EDF6F6` | `#D3EAEA` | `#76B9BC` | `#177E83` | `#155457` | `#0F3739` |
| `violeta` | Cuentas de Ejecutivo | `#F4F1FD` | `#E9E3FB` | `#B5A3EF` | `#7B5BD6` | `#55379E` | `#3A2967` |
| `laton` | Acento: moneda, divisa extranjera, “hoy” | `#FBF7EA` | `#F5EBC8` | `#DFBD57` | `#B98E1F` | `#725415` | `#503A17` |
| `acero` | Neutros | `#F6F7F7` | `#ECEFEF` | `#C2C9CB` | `#6A7477` | `#40474A` | `#1B2023` |
| `verde` | Éxito / ingreso / Confirmado | `#EFF7EE` | `#D8EDD5` | `#83C17B` | `#3D8B35` | `#275A23` | `#1D3C1B` |
| `naranja` | Advertencia / Pendiente | `#FFF5EB` | `#FEE6CC` | `#F9A85E` | `#E16E12` | `#96430E` | `#632F12` |
| `rojo` | Error / Rechazado (600 = rojo EMF `#C0392B`) | `#FDF1F0` | `#FADDDA` | `#EB8E84` | `#CD4535` | `#9A2E23` | `#6A261F` |
| `azul` | Información | `#EFF4FE` | `#DCE6FC` | `#8DADF2` | `#426BD9` | `#2B4597` | `#253563` |

Las escalas completas (50–950) están en `tailwind.cauce.ts` como `bg-petroleo-600`, `text-acero-500`, etc.

### Tokens semánticos (úsalos antes que las escalas)

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `primary` | petróleo 700 | petróleo 300 | Botón principal, pestaña activa |
| `background` / `card` | acero 50 / blanco | `#121618` / `#181D20` | Fondo de página / superficies |
| `muted-foreground` | acero 600 | acero 400 | Texto secundario |
| `brass` | latón 400 | latón 300 | Acento puntual; nunca para estados |
| `success` · `warning` · `danger` · `info` · `canceled` | — | — | Cada uno con `DEFAULT` (icono), `soft` (fondo de badge) y `text` (texto) |
| `income` / `expense` | verde 700 / acero 900 | verde 300 / acero 100 | Color de montos |
| `company` · `executive` | petróleo / violeta | — | Tipo de cuenta destino (`DEFAULT`, `soft`, `text`) |
| `currency.base` · `currency.fx` | — | — | Chips de divisa |

Ejemplo: `bg-warning-soft text-warning-text`, `text-income`, `bg-company-soft text-company-text`.

### Reglas de color

1. **El rojo es solo para lo que salió mal** (Rechazado, errores, borrar). Un egreso no es un error:
   se pinta en tinta normal con signo `−`.
2. **Verde = dinero que sí entró.** Ingresos confirmados y el estado Confirmado. No usar verde para
   decorar.
3. **Petróleo = la empresa, violeta = una persona.** Esta pareja se validó para daltonismo
   (ΔE 13.8 deuteranopia). Aun así, siempre va acompañada de icono y forma (ver §6).
4. **Latón aparece poco:** la moneda del logo, la divisa extranjera y la barra de “hoy” en gráficas.
   Si una pantalla tiene más de tres cosas en latón, sobra alguna.
5. El rojo EMF `#C0392B` es `rojo-600` = `danger` en claro. Es el único guiño al ERP.

---

## 4. Tipografía

| Rol | Familia | Pesos | Uso |
|---|---|---|---|
| Títulos (`font-display`) | **Schibsted Grotesk** | 600, 700 | H1–H3, nombre de cliente, títulos de panel |
| Texto y cifras (`font-sans`) | **IBM Plex Sans** | 400, 500, 600 | Todo lo demás, **incluidos los montos grandes** |

IBM Plex Sans tiene cifras tabulares por defecto (todos los dígitos miden lo mismo), así que las
columnas de montos se alinean solas. Aun así, aplica la utilidad `.num` / `tabular-nums` en montos,
fechas y folios. Los montos **nunca** van en Schibsted: sus cifras tabulares separan demasiado la coma.

```tsx
// app/layout.tsx
import { Schibsted_Grotesk, IBM_Plex_Sans } from "next/font/google";
const display = Schibsted_Grotesk({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

Escala (razón 1.2 sobre 14 px):

| Clase | Tamaño | Uso |
|---|---|---|
| `text-2xl` font-display 700 | 24–28 px | H1 de página |
| `text-base` font-display 600 | 16 px | Título de panel |
| `text-sm` | 14 px | Texto base de la app |
| `text-table` | 13 px | Celdas de tabla |
| `text-xs` | 12 px | Encabezados de tabla, ayudas, metadatos |
| Monto protagonista | 26–34 px, Plex 600 | Total del día, monto en captura |

Encabezados de tabla y etiquetas: en tipo oración (“Cuenta destino”), nunca en MAYÚSCULAS.

---

## 5. Montos y divisas

```ts
// lib/money.ts
export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
```

| Caso | Se ve así | Clases |
|---|---|---|
| Ingreso MXN | **+$38,500.00** | `text-income font-medium tabular-nums` |
| Egreso MXN (devolución) | **−$4,640.00** | `text-expense font-medium` |
| Ingreso en otra divisa | **+US$3,250.00** `USD`<br><small>≈ $59,865.00 MXN</small> | chip `bg-currency-fx text-currency-fx-text` + línea de equivalencia en `muted-foreground` |
| Rechazado o cancelado | ~~$30,000.00~~ | `line-through text-canceled-text font-normal` (no suma en totales) |

Reglas:
- **La base no se anuncia; lo extranjero sí.** En tablas, MXN va sin chip. Cualquier otra divisa lleva
  chip de latón y su equivalente en MXN debajo, con el tipo de cambio usado al registrar.
- En totales, formularios y resúmenes, **siempre** se muestra el chip (también `MXN`, en petróleo suave).
- Signo explícito `+` / `−` (signo menos real `U+2212`, no guion) en listas de movimientos.
- Alineación a la derecha en tablas. Dos decimales siempre.
- El símbolo `$` sin prefijo significa MXN. Dólares: `US$`. Euros: `€`.

---

## 6. Estados y tipo de cuenta

### Estados de movimiento

Siempre **icono + texto + color**. Nunca solo un punto de color.

| Estado | Icono Lucide | Clases | Significado |
|---|---|---|---|
| Pendiente | `Clock` | `bg-warning-soft text-warning-text` | Registrado, falta verlo en el banco |
| Confirmado | `CircleCheck` | `bg-success-soft text-success-text` | Ya se vio en el banco; cuenta para saldos |
| Rechazado | `CircleX` | `bg-danger-soft text-danger-text` | No procedió (cheque sin fondos, referencia falsa). Muestra el motivo debajo |
| Cancelado | `Ban` | `bg-canceled-soft text-canceled-text` | Se anuló por error de captura. Monto tachado |

### Tipo de cuenta destino

Diferenciables por **color, icono y forma**, para que se lean de un vistazo incluso en blanco y negro:

| Tipo | Icono | Forma del distintivo | Clases |
|---|---|---|---|
| Empresa | `Building2` | Esquinas rectas (radio 3 px) | `rounded-[3px] bg-company-soft text-company-text` |
| Ejecutivo | `UserRound` | Píldora (totalmente redondo) | `rounded-full bg-executive-soft text-executive-text` |

En formularios, la cuenta destino se elige con tarjetas agrupadas en “Cuentas de la empresa” y
“Cuentas de ejecutivos”; la loseta del icono repite la forma (cuadrada vs círculo).

```tsx
// components/account-tag.tsx
import { Building2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountTag({ type, name }: { type: "empresa" | "ejecutivo"; name: string }) {
  const isCompany = type === "empresa";
  const Icon = isCompany ? Building2 : UserRound;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 pl-1.5 pr-2 text-[11.5px] font-medium",
        isCompany ? "rounded-[3px] bg-company-soft text-company-text" : "rounded-full bg-executive-soft text-executive-text",
      )}>
        <Icon className="size-3.5" strokeWidth={1.75} />
        {isCompany ? "Empresa" : "Ejecutivo"}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}
```

```tsx
// components/status-badge.tsx
import { Ban, CircleCheck, CircleX, Clock } from "lucide-react";

const MAP = {
  PENDIENTE: { label: "Pendiente", Icon: Clock, cls: "bg-warning-soft text-warning-text" },
  CONFIRMADO: { label: "Confirmado", Icon: CircleCheck, cls: "bg-success-soft text-success-text" },
  RECHAZADO: { label: "Rechazado", Icon: CircleX, cls: "bg-danger-soft text-danger-text" },
  CANCELADO: { label: "Cancelado", Icon: Ban, cls: "bg-canceled-soft text-canceled-text" },
} as const;

export function StatusBadge({ status }: { status: keyof typeof MAP }) {
  const { label, Icon, cls } = MAP[status];
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-sm pl-1.5 pr-2 text-xs font-medium ${cls}`}>
      <Icon className="size-3.5" strokeWidth={1.75} />{label}
    </span>
  );
}
```

---

## 7. Componentes

### Radios, sombras y densidad

| Elemento | Radio | Sombra |
|---|---|---|
| Paneles, diálogos (`rounded-lg`) | 8 px | Ninguna; solo borde `border` |
| Botones, inputs (`rounded-md`) | 6 px | Ninguna |
| Badges, chips (`rounded-sm`) | 4 px (Empresa 3 px, Ejecutivo píldora) | Ninguna |
| Popovers, menús, tooltips | 6 px | `shadow-pop` |

Jerarquía por bordes, no por sombras: la pantalla es de trabajo diario y las sombras en cada tarjeta
cansan la vista. Las sombras se reservan para lo que flota.

Densidad: base de 4 px. Filas de tabla de 40 px, inputs de 36 px, botones de 34 px (28 px los pequeños).
En móvil, objetivos táctiles de 42 px mínimo.

### Botones

| Variante | Uso | Ejemplo |
|---|---|---|
| `default` (primary) | Una acción principal por vista | “Registrar movimiento” |
| `outline` | Acciones secundarias | “Estado de cuenta”, “Confirmar” en listas |
| `ghost` | Acciones terciarias, iconos | “Ver comprobante”, `⋯` |
| `destructive` outline | Rechazar o cancelar movimientos | “Rechazar” (texto rojo, sin fondo rojo) |

Un botón dice exactamente lo que pasa. Sin flechas decorativas al final.

### Tablas

- Texto 13 px, encabezado 12 px en `muted-foreground`, filas de 40 px, separadores de 1 px.
- Columnas de monto alineadas a la derecha con cifras tabulares.
- Hover de fila: `bg-accent`. Sin zebra.
- Orden de columnas en movimientos: Fecha · Folio · Forma de pago · Cuenta destino · Referencia ·
  Venta ERP · Monto · Estado · acciones.
- Pie con conteo y suma de lo **confirmado** del filtro, separado por divisa.
- En móvil (< 860 px) cada fila se vuelve una tarjeta de dos columnas: cliente/fecha y cuenta a la
  izquierda; monto y estado a la derecha.

### Filtros

Chips con borde punteado cuando están vacíos y relleno `accent` cuando tienen valor
(“Estado: todos”, “Últimos 90 días”). Siempre en una sola fila sobre la tabla.

### Formularios

- Etiqueta arriba, 13 px peso 500. Ayuda debajo, 12 px `muted-foreground`.
- Foco: borde `ring` + halo de 3 px al 22 %.
- Monto: input grande (48 px, 22 px de texto) alineado a la derecha, con prefijo de símbolo y chip de divisa.
- **La divisa la define la cuenta destino.** Si la cuenta es en USD, aparece el tipo de cambio y la
  equivalencia en MXN en vivo.
- Ventas del ERP ligadas: tabla con casilla y columna “Aplicar”; resumen “Aplicado / Sin aplicar”.
- El movimiento nace **Pendiente**. La casilla “Ya lo vi reflejado en el banco” lo registra como Confirmado.

### Gráficas

- Una serie: barras en `company`; el día de hoy en `brass`.
- La barra “¿A dónde cayó el dinero?” agrupa Empresa (petróleo) y Ejecutivos (violeta), con 2 px de
  separación entre segmentos, leyenda directa con monto y porcentaje, y tooltip al pasar el mouse.
- Nunca dos ejes Y. Nunca colores de estado como colores de serie.

### Iconografía

Lucide, 16 px en la interfaz (20 px en la barra móvil), trazo 1.75. Iconos recurrentes:
`LayoutDashboard`, `Users`, `ArrowLeftRight` (movimientos), `Landmark` (cuenta bancaria),
`Building2` (Empresa), `UserRound` (Ejecutivo), `ReceiptText` (ventas ERP), `Paperclip` (comprobante),
`Coins` (divisa), `Link2` (venta ligada).

---

## 8. Modo oscuro

No es una inversión automática: cada token tiene su propio paso en `.dark` y está validado contra
`#181D20`. Los estados usan fondos oscuros teñidos (`warning-soft #33220F`) con texto en el paso 300.
El primario cambia a petróleo 300 con texto oscuro. Activar con `next-themes` (`attribute="class"`).

---

## 9. Voz y copy

Tono: profesional, sobrio, cálido. Habla como una contadora de confianza: directa, sin tecnicismos de
sistema, sin exclamaciones.

| En lugar de | Escribe |
|---|---|
| Crear transacción | Registrar movimiento |
| Destination account | Cuenta destino / “¿En qué cuenta se recibió el dinero?” |
| Status: PENDING | Pendiente |
| Submit / Enviar | Registrar movimiento |
| ¡Éxito! Registro guardado | Movimiento registrado. Quedó Pendiente. |
| Error 422 | El monto aplicado supera el saldo de F-EMF-21004. Ajusta “Aplicar” a $2,150.00 o menos. |
| No hay datos | Aún no hay movimientos de este cliente. Registra el primero. |
| ¿Está seguro? | ¿Rechazar el movimiento de $30,000.00? El cliente seguirá debiendo ese monto. |

Reglas:
- Una acción conserva su nombre en todo el flujo: botón “Confirmar” → aviso “Movimiento confirmado”.
- Los errores dicen qué pasó y cómo corregirlo. No piden disculpas.
- Fechas `03/11/2026` en tablas; “martes 3 de noviembre” en títulos. Hora en 24 h.
- Cuentas bancarias: banco + `••` + últimos 4 dígitos (`BBVA •• 4821`). Nunca la CLABE completa en listas.

---

## 10. Instalación rápida

1. Copia `brand/tokens/globals.css` a `app/globals.css` (reemplaza el de shadcn).
2. Fusiona `brand/tokens/tailwind.cauce.ts` en `tailwind.config.ts` (`theme.extend`).
3. Configura las fuentes con `next/font` (§4).
4. Copia `brand/logo/favicon.svg` a `app/icon.svg` y `brand/pwa/*` a `public/icons/`.
5. En `manifest.webmanifest`: `"name": "Cauce"`, `"theme_color": "#155457"`, `"background_color": "#F6F7F7"`.
6. Para cambiar un color, edita `tools/build_tokens.py` y vuelve a generar: el script revalida el contraste.
