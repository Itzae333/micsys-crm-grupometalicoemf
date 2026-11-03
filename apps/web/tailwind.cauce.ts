// Cauce — fragmento para tailwind.config.ts (Next.js 14 + Tailwind 3 + shadcn/ui)
// Generado por tools/build_tokens.py. Requiere globals.css con las variables.
import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Partial<Config> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        "border": "hsl(var(--border) / <alpha-value>)",
        "input": "hsl(var(--input) / <alpha-value>)",
        "ring": "hsl(var(--ring) / <alpha-value>)",
        "background": "hsl(var(--background) / <alpha-value>)",
        "foreground": "hsl(var(--foreground) / <alpha-value>)",
        "primary": {
          "DEFAULT": "hsl(var(--primary) / <alpha-value>)",
          "foreground": "hsl(var(--primary-foreground) / <alpha-value>)"
        },
        "secondary": {
          "DEFAULT": "hsl(var(--secondary) / <alpha-value>)",
          "foreground": "hsl(var(--secondary-foreground) / <alpha-value>)"
        },
        "destructive": {
          "DEFAULT": "hsl(var(--destructive) / <alpha-value>)",
          "foreground": "hsl(var(--destructive-foreground) / <alpha-value>)"
        },
        "muted": {
          "DEFAULT": "hsl(var(--muted) / <alpha-value>)",
          "foreground": "hsl(var(--muted-foreground) / <alpha-value>)"
        },
        "accent": {
          "DEFAULT": "hsl(var(--accent) / <alpha-value>)",
          "foreground": "hsl(var(--accent-foreground) / <alpha-value>)"
        },
        "popover": {
          "DEFAULT": "hsl(var(--popover) / <alpha-value>)",
          "foreground": "hsl(var(--popover-foreground) / <alpha-value>)"
        },
        "card": {
          "DEFAULT": "hsl(var(--card) / <alpha-value>)",
          "foreground": "hsl(var(--card-foreground) / <alpha-value>)"
        },
        "brass": {
          "DEFAULT": "hsl(var(--brass) / <alpha-value>)",
          "foreground": "hsl(var(--brass-foreground) / <alpha-value>)"
        },
        "sidebar": {
          "DEFAULT": "hsl(var(--sidebar) / <alpha-value>)",
          "foreground": "hsl(var(--sidebar-foreground) / <alpha-value>)"
        },
        "success": {
          "DEFAULT": "hsl(var(--success) / <alpha-value>)",
          "soft": "hsl(var(--success-soft) / <alpha-value>)",
          "text": "hsl(var(--success-text) / <alpha-value>)"
        },
        "warning": {
          "DEFAULT": "hsl(var(--warning) / <alpha-value>)",
          "soft": "hsl(var(--warning-soft) / <alpha-value>)",
          "text": "hsl(var(--warning-text) / <alpha-value>)"
        },
        "danger": {
          "DEFAULT": "hsl(var(--danger) / <alpha-value>)",
          "soft": "hsl(var(--danger-soft) / <alpha-value>)",
          "text": "hsl(var(--danger-text) / <alpha-value>)"
        },
        "info": {
          "DEFAULT": "hsl(var(--info) / <alpha-value>)",
          "soft": "hsl(var(--info-soft) / <alpha-value>)",
          "text": "hsl(var(--info-text) / <alpha-value>)"
        },
        "canceled": {
          "DEFAULT": "hsl(var(--canceled) / <alpha-value>)",
          "soft": "hsl(var(--canceled-soft) / <alpha-value>)",
          "text": "hsl(var(--canceled-text) / <alpha-value>)"
        },
        "company": {
          "DEFAULT": "hsl(var(--company) / <alpha-value>)",
          "soft": "hsl(var(--company-soft) / <alpha-value>)",
          "text": "hsl(var(--company-text) / <alpha-value>)"
        },
        "executive": {
          "DEFAULT": "hsl(var(--executive) / <alpha-value>)",
          "soft": "hsl(var(--executive-soft) / <alpha-value>)",
          "text": "hsl(var(--executive-text) / <alpha-value>)"
        },
        "income": "hsl(var(--income) / <alpha-value>)",
        "expense": "hsl(var(--expense) / <alpha-value>)",
        "currency": {
          "base": "hsl(var(--currency-base-soft) / <alpha-value>)",
          "base-text": "hsl(var(--currency-base-text) / <alpha-value>)",
          "fx": "hsl(var(--currency-fx-soft) / <alpha-value>)",
          "fx-text": "hsl(var(--currency-fx-text) / <alpha-value>)"
        },
        "petroleo": {
          "50": "#EDF6F6",
          "100": "#D3EAEA",
          "200": "#A9D5D6",
          "300": "#76B9BC",
          "400": "#44999D",
          "500": "#177E83",
          "600": "#1A676B",
          "700": "#155457",
          "800": "#124447",
          "900": "#0F3739",
          "950": "#082123"
        },
        "violeta": {
          "50": "#F4F1FD",
          "100": "#E9E3FB",
          "200": "#D3C8F6",
          "300": "#B5A3EF",
          "400": "#9A82E6",
          "500": "#7B5BD6",
          "600": "#6744C0",
          "700": "#55379E",
          "800": "#462F80",
          "900": "#3A2967",
          "950": "#241A42"
        },
        "laton": {
          "50": "#FBF7EA",
          "100": "#F5EBC8",
          "200": "#EBD68F",
          "300": "#DFBD57",
          "400": "#D4A834",
          "500": "#B98E1F",
          "600": "#967016",
          "700": "#725415",
          "800": "#5F4517",
          "900": "#503A17"
        },
        "acero": {
          "50": "#F6F7F7",
          "100": "#ECEFEF",
          "200": "#DCE1E2",
          "300": "#C2C9CB",
          "400": "#949EA1",
          "500": "#6A7477",
          "600": "#525B5E",
          "700": "#40474A",
          "800": "#2A3033",
          "900": "#1B2023",
          "950": "#121618"
        },
        "verde": {
          "50": "#EFF7EE",
          "100": "#D8EDD5",
          "200": "#B2DAAC",
          "300": "#83C17B",
          "400": "#58A64F",
          "500": "#3D8B35",
          "600": "#2F7129",
          "700": "#275A23",
          "800": "#22481F",
          "900": "#1D3C1B"
        },
        "naranja": {
          "50": "#FFF5EB",
          "100": "#FEE6CC",
          "200": "#FDCB98",
          "300": "#F9A85E",
          "400": "#F28A33",
          "500": "#E16E12",
          "600": "#BD560C",
          "700": "#96430E",
          "800": "#793812",
          "900": "#632F12"
        },
        "rojo": {
          "50": "#FDF1F0",
          "100": "#FADDDA",
          "200": "#F4BAB4",
          "300": "#EB8E84",
          "400": "#DE6355",
          "500": "#CD4535",
          "600": "#C0392B",
          "700": "#9A2E23",
          "800": "#7F2921",
          "900": "#6A261F"
        },
        "azul": {
          "50": "#EFF4FE",
          "100": "#DCE6FC",
          "200": "#B9CDF8",
          "300": "#8DADF2",
          "400": "#6189E8",
          "500": "#426BD9",
          "600": "#3255BB",
          "700": "#2B4597",
          "800": "#283C7A",
          "900": "#253563"
        }
      },
      fontFamily: {
        // next/font expone estas variables (ver DESIGN-SYSTEM.md › Tipografía)
        display: ["var(--font-display)", ...fontFamily.sans],
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },
      borderRadius: {
        lg: "var(--radius)",            // 8px  tarjetas, diálogos
        md: "calc(var(--radius) - 2px)", // 6px  botones, inputs
        sm: "calc(var(--radius) - 4px)", // 4px  badges, chips
      },
      boxShadow: {
        card: "0 1px 0 0 hsl(var(--border)), 0 1px 2px 0 hsl(195 20% 10% / 0.04)",
        pop: "0 8px 24px -6px hsl(195 25% 10% / 0.18), 0 0 0 1px hsl(var(--border))",
      },
      fontSize: {
        // escala 1.2 sobre 14px; tablas usan 13px
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        xs: ["0.75rem", { lineHeight: "1rem" }],
        table: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.2rem", { lineHeight: "1.75rem" }],
        xl: ["1.44rem", { lineHeight: "2rem" }],
        "2xl": ["1.728rem", { lineHeight: "2.25rem" }],
        "3xl": ["2.074rem", { lineHeight: "2.5rem" }],
      },
    },
  },
};

export default config;
