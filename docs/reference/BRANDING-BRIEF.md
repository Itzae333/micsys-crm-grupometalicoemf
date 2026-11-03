# Brief de Branding — CRM de Administración (para Claude Desktop)

> Pega este documento en Claude Desktop y pídele: "Con base en este brief, propón 3 direcciones de
> marca (nombre, logo, paleta, tipografía) y entrégame el resultado en el formato de la sección 7."

## 1. Contexto
Sistema interno (CRM) para la **administradora del Grupo Metálico EMF** (empresas: EMFIMIFAR,
Metálicos Lyeva, Láminas Monterrey; manufactura y venta de estantería, anaqueles y láminas, México).
Es una herramienta **personalizada para una sola persona**, pensada para crecer después a otros
usuarios/distribución. Convive con un ERP existente (rojo EMF `#C0392B`, estilo industrial), pero
**este CRM debe sentirse propio**, no una copia del ERP.

## 2. Qué hace el sistema
Gestiona clientes, sus cuentas, cobros, abonos, depósitos y transferencias, y registra **a qué
cuenta cayó el dinero** (cuenta de la empresa o de un ejecutivo). Puede ligar movimientos a ventas
del ERP. Multi-divisa (base MXN).

## 3. Usuaria y tono
- Una administradora que revisa dinero a diario: necesita **claridad, confianza y rapidez**.
- Tono: profesional, sobrio, cálido; nada infantil ni "startup juguetona".
- Palabras guía (ajustables): *control, claridad, confianza, orden, precisión*.
- Idioma: español (México).

## 4. Nombre
Proponer 5–8 opciones de nombre para el sistema (cortas, pronunciables, sin sonar a banco real
ni a marcas existentes). Incluir significado y una versión en una línea ("tagline"). Debe poder
escribirse en una sola palabra para usarla como `APP_NAME`.

## 5. Identidad visual requerida
- **Logo**: símbolo + versión horizontal; legible a 24 px (favicon) y en blanco/negro. Entregar SVG.
- **Paleta**: primario, secundario, acento, neutros (escala 50–900), y colores semánticos:
  éxito/ingreso, error/rechazado, advertencia/pendiente, info. Validar contraste WCAG AA.
- **Tipografía**: una familia para títulos y una para texto/números (cifras tabulares, importante
  para montos). Preferir Google Fonts.
- **Modo claro y oscuro**.
- **Estilo de componentes**: radios, sombras, densidad (tablas densas pero legibles), iconografía
  (Lucide).
- **Montos y divisas**: cómo se ven ingresos, egresos, MXN vs otras divisas (chips de moneda).
- **Estados de movimiento**: Pendiente, Confirmado, Rechazado, Cancelado (color + icono).
- **Tipo de cuenta destino**: Empresa vs Ejecutivo (diferenciables de un vistazo).

## 6. Restricciones técnicas
- Frontend: Next.js 14, Tailwind CSS, Radix UI (estilo shadcn), PWA móvil.
- Los colores deben entregarse como **tokens Tailwind** y **CSS variables**.
- Evitar copiar el rojo EMF como primario; puede usarse como acento sutil si ayuda a la familia.

## 7. Formato de entrega (obligatorio)
1. Nombre elegido + 2 alternativas.
2. Logo en SVG (símbolo, horizontal, monocromo).
3. `tailwind.config` (fragmento `theme.extend.colors` y `fontFamily`) y bloque `:root` / `.dark`.
4. Guía breve en Markdown (`DESIGN-SYSTEM.md`): uso de color, tipografía, botones, tablas,
   badges de estado, formularios, ejemplos de copy.
5. Mockup HTML de 3 pantallas: **Dashboard**, **Ficha de cliente (con movimientos)**,
   **Captura de movimiento** (cliente, cuenta destino, divisa, monto, comprobante, ventas ERP ligadas).

Guardar el resultado en `docs/DESIGN-SYSTEM.md`, `docs/reference/mockups.html` y `brand/`.
