---
version: alpha
name: FlowSync
description: Gestión de tareas en equipo. Interfaz sobria, neutra y densa en información; el color se reserva para el estado y los errores.
colors:
  background: "#ffffff"
  foreground: "#0a0a0a"
  card: "#ffffff"
  card-foreground: "#0a0a0a"
  primary: "#171717"
  primary-foreground: "#fafafa"
  secondary: "#f5f5f5"
  secondary-foreground: "#171717"
  muted: "#f5f5f5"
  muted-foreground: "#737373"
  accent: "#f5f5f5"
  accent-foreground: "#171717"
  destructive: "#e7000b"
  success: "#008236"
  success-foreground: "#fafafa"
  border: "#e5e5e5"
  input: "#e5e5e5"
  ring: "#a1a1a1"
typography:
  h1:
    fontFamily: system-ui
    fontSize: 24px
    fontWeight: 600
    lineHeight: 32px
  h2:
    fontFamily: system-ui
    fontSize: 18px
    fontWeight: 600
    lineHeight: 28px
  body:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
  caption:
    fontFamily: system-ui
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
spacing:
  base: 4px
  gap-sm: 8px
  gap-md: 12px
  gap-lg: 24px
  page: 24px
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  task-meta:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
  page-surface:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
  menu-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  alert-destructive:
    backgroundColor: "{colors.card}"
    textColor: "{colors.destructive}"
  column-header-done:
    backgroundColor: "{colors.success}"
    textColor: "{colors.success-foreground}"
    rounded: "{rounded.md}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  switch-off:
    backgroundColor: "{colors.input}"
    rounded: "{rounded.xl}"
  focus-ring:
    backgroundColor: "{colors.ring}"
    width: 3px
---

# DESIGN.md — FlowSync

> Fuente única del diseño de FlowSync, en el formato abierto de Google Labs (`DESIGN.md`, alpha). Los **valores** de verdad viven en `frontend/src/index.css` (variables CSS en `oklch`, tema claro y oscuro); aquí están en hex para que cualquier herramienta (Stitch, Figma, un agente) los lea. Si cambia un token, cambian los dos archivos en el mismo commit. Validar: `npx @google/design.md lint DESIGN.md`.

## Overview

FlowSync es una herramienta de trabajo diario para equipos de 3 a 10 personas: se abre muchas veces al día, se lee en diagonal y se actúa en dos gestos. El diseño es **neutro y denso**: escala de grises de shadcn/ui (`neutral`), tipografía del sistema, tarjetas con borde fino y sin sombras marcadas. El color no decora: **señala** (estado de una tarea, error, foco). Todo es operable con teclado y el foco siempre se ve.

## Colors

Tokens **semánticos**, nunca de paleta. En el código se usan como utilidades de Tailwind generadas desde `index.css` (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`…).

- **background / foreground**: lienzo y texto principal.
- **card / card-foreground**: superficie de cada tarea, columna o bloque.
- **primary / primary-foreground**: la acción principal de cada pantalla (una sola por vista).
- **secondary, muted, accent**: superficies de apoyo; `muted-foreground` para metadatos (responsable, fechas), **siempre sobre `card` o `background`**: sobre `muted` se queda en 4,35:1 y no llega al AA (lo dice `npx @google/design.md lint`).
- **destructive**: errores y acciones destructivas. También «vencida».
- **success / success-foreground**: el estado «hecho» (hoy, la cabecera de la columna «Hecho» del tablero). `success` pasa el AA también como texto sobre `card` (4,9:1 en claro, 10:1 en oscuro), y `success-foreground` sobre `success` (4,7:1 y 10:1).
- **border, input, ring**: bordes, campos y anillo de foco (`focus-visible:ring-[3px] ring-ring/50`).

Un color nuevo (como lo fue `success`, el verde de «hecho») **no se escribe en un componente**: se añade como token en `index.css` (claro y oscuro, más su línea en `@theme inline`) y aquí, en el mismo commit.

## Typography

Fuente del sistema (`system-ui`), sin fuentes web. Jerarquía corta: `h1` para el título de la página, `h2` para secciones o columnas, `body` (14 px) para todo lo demás, `caption` (12 px) para metadatos. Pesos 400, 500 y 600; nada más.

## Layout

Rejilla de 4 px. Página con `page` (24 px) de margen y contenido centrado; la lista usa un ancho máximo de 672 px (`max-w-2xl`), las vistas de varias columnas pueden usar el ancho completo con columnas de igual ancho y `gap-md` entre ellas. En pantallas estrechas las columnas se apilan; nunca hay scroll horizontal de página.

## Elevation & Depth

Plano. Las superficies se separan con borde (`border`) y un fondo `muted/40` en la página, no con sombras. Solo `shadow-xs` en campos y tarjetas, como hace shadcn/ui.

## Shapes

Radio base `lg` (10 px) en tarjetas; `md` en botones, campos y selects; `sm` en anillos de foco y elementos pequeños; píldoras (`rounded-full`) solo para insignias de estado o recuento.

## Components

Los componentes base son los de **shadcn/ui** en `frontend/src/components/ui/` (Button, Card, Input, Label, Alert…). Son **generados**: se traen con `npx shadcn@latest add <componente>` y no se editan; lo propio se construye **componiéndolos** en `frontend/src/components/`. Patrones ya existentes que cualquier vista nueva reutiliza:

- **Fila / tarjeta de tarea**: título (enlace al detalle), responsable en `muted-foreground`, control de estado.
- **Control de estado**: `<select>` nativo con las clases de `Input` (`TaskStatusSelect`); cambia en 2 interacciones, optimista con reconciliación.
- **Vacíos**: `Card` centrada con título y una frase que dice qué hacer.
- **Errores**: `Alert variant="destructive"` con una frase en castellano y, si tiene sentido, un botón «Reintentar».
- **Columna con recuento** (tablero): una región `Card` con nombre, cuyo `h2` lleva el estado y una píldora `bg-secondary`/`text-secondary-foreground` con el número (oculta al lector, que oye el recuento en un texto `sr-only`). La cabecera de «Hecho» se distingue en verde (`column-header-done`): banda `bg-success`/`text-success-foreground` con `rounded-md`; las otras dos, sin fondo. Sin tarjetas, una frase en `text-muted-foreground`, nunca en blanco. Por debajo de `md` las columnas se apilan en el mismo orden.
- **Destino al arrastrar**: la columna que admite la tarjeta se marca con `bg-accent` + `border-ring` mientras está encima, y la tarjeta arrastrada baja a `opacity-50`. El arrastre es siempre un atajo: lo mismo se hace con el control de estado, por teclado.
- **Confirmación destructiva** (para toda acción irreversible; hoy, borrar una tarea): una pregunta **modal** (`<dialog>` nativo con `showModal()`, sobre `bg-card`/`text-card-foreground` con borde y `rounded-xl`, *backdrop* `bg-background/80`) que **nombra el objeto** («¿Borrar «…»?») y dice que **no hay vuelta atrás**. La opción que destruye es un `Button variant="destructive"` que dice la acción («Borrar definitivamente», nunca «Aceptar»); «Cancelar» es `outline`, del **mismo tamaño**, va **primero** y recibe el **foco inicial**. Nace desarmada durante 500 ms para que un doble clic o un Enter de más no la respondan; Escape y el clic fuera cancelan y devuelven el foco a quien la abrió. Sin «deshacer»: si existiera, no haría falta la pregunta. La acción que la abre vive lejos de los gestos baratos (nunca junto al control de estado).

## Do's and Don'ts

- **Do**: usar solo tokens semánticos; componer los componentes de `ui/`; textos en castellano, cortos y con la acción; foco visible y orden de tabulación lógico; todo alcanzable con teclado.
- **Do**: que una acción por arrastre tenga siempre una alternativa por teclado y por clic.
- **Don't**: hex, `rgb()`, `oklch()` o valores arbitrarios de color (`bg-[#…]`) en un componente.
- **Don't**: la paleta por defecto de Tailwind (`bg-green-100`, `text-red-600`): se salta el design system.
- **Don't**: editar `frontend/src/components/ui/`; ni una segunda fuente de verdad del diseño (los colores de un prototipo no entran tal cual: se traducen a tokens).
