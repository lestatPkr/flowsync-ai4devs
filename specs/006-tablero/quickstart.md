# Quickstart: Tablero de tareas por estado

Guía de validación de punta a punta. Qué debe verse, con sus nombres accesibles y textos exactos, está en [contracts/board-ui.md](./contracts/board-ui.md); de dónde sale cada dato, en [data-model.md](./data-model.md). Aquí solo se dice cómo comprobarlo.

## Prerrequisitos

- Rama `build/kanban`, dependencias instaladas en `backend/` y `frontend/`, `.env` creado y migraciones aplicadas (pasos de `CLAUDE.md`). **Este cambio no trae migración ni toca el backend.**
- Chromium de Playwright instalado una vez: `cd frontend && npx playwright install chromium`.
- Para la prueba manual, dos cuentas (p. ej. Oscar y Ana) con tareas en los tres estados.

## 0. Comprobaciones automáticas

```bash
cd frontend
npm run lint                                        # oxlint
npm run build                                       # typecheck de src/ y de e2e/ + build
npx playwright test e2e/task-status-list.spec.ts    # caracterización de la lista: verde antes y después del refactor
npx playwright test e2e/board.spec.ts               # la matriz del tablero
npm run test:e2e                                    # todo: humo + lista + tablero (arranca backend y frontend si hace falta)
npx playwright test e2e/board.spec.ts -g "US2-"     # una historia
```

Esperado: todo en verde. Y además, **desde la raíz del repo** (las rutas de `git diff` y de `grep` son relativas a ella):

```bash
cd ..
BASE=38b6d89                                        # el commit de partida anotado en T001
git diff --stat "$BASE" -- backend/                 # vacío: el backend no se toca
git diff --stat "$BASE" -- '*/package.json' '*/package-lock.json'   # vacío: ninguna dependencia nueva
git diff --stat "$BASE" -- frontend/src/components/ui/ frontend/src/auth/   # vacío: generado y valla intactos
git diff "$BASE" -- frontend/src/index.css          # vacío: ningún token nuevo

# Principio VI sobre TODOS los .tsx tocados (nuevos y modificados, también sin seguimiento; ui/ fuera):
# hex, funciones de color, valores arbitrarios -[#…] -[rgb…] -[hsl…] -[oklch…] -[color:…] -[var(…)],
# y cualquier familia de la paleta de Tailwind (white y black incluidos) con cualquier prefijo de color.
TSX=$( { git diff --name-only "$BASE" -- 'frontend/src/*.tsx'; git ls-files --others --exclude-standard -- 'frontend/src/*.tsx'; } \
  | grep -v '^frontend/src/components/ui/' | sort -u )
grep -nE '#[0-9a-fA-F]{3,8}\b|(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(|-\[(#|rgb|hsl|oklch|color:|var\()|\b(bg|text|border(-[xytrbse])?|ring(-offset)?|outline|divide|fill|stroke|from|via|to|shadow|inset-shadow|drop-shadow|decoration|caret|placeholder|accent)-(slate|gray|zinc|neutral|stone|taupe|mauve|mist|olive|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b' /dev/null $TSX
                                                    # vacío: solo tokens semánticos
```

**Rojo antes que verde** (principio II): con `e2e/board.spec.ts` y los helpers nuevos escritos, y **antes** de crear la ruta, `npx playwright test e2e/board.spec.ts` debe fallar **entero**: 29 ✗ / 0 ✓ (no hay `/tasks/board`; la lista no tiene «Tablero»). Ningún test vale si nace en verde, tampoco US1-11: su segunda mitad (tras `signIn`, el `h1` «Tablero») es la que falla hoy. Los tests de caracterización de la lista, en cambio, deben estar en **verde** contra el código actual antes de tocar `TaskStatusSelect`, y seguir en verde después.

## 1. Ver el tablero (US1, P1)

Con `npm run dev` en `backend/` y en `frontend/`, entra como Oscar en `http://localhost:5173`.

1. Llegas a la **lista** (`/tasks`). Pulsa **«Tablero»** → `/tasks/board`, `h1` «Tablero».
2. Tres columnas, en orden «Pendiente», «En curso», «Hecho», cada una con su recuento; las tareas hechas están en «Hecho» sin filtrar; las de Ana también salen.
3. Cada tarjeta: título, responsable y un control de estado. Ninguna fecha ni «Vencida», aunque la tarea esté vencida.
4. Pulsa un título → la tarea; **«Volver al tablero»** → el tablero, con el foco en esa tarjeta.
5. **«Lista»** → `/tasks`. Abre `http://localhost:5173/` → la lista, no el tablero.
6. Recarga estando en `/tasks/board` → sigue el tablero.
7. Con el backend parado, abre el tablero → «No se ha podido cargar el tablero» con «Reintentar», sin columnas. Arranca el backend y pulsa «Reintentar».
8. Cierra sesión y abre `/tasks/board` → `/login`.

## 2. Mover (US2, P2)

1. Arrastra una tarjeta de «Pendiente» a «En curso»: salta en el acto, los recuentos cambian; recarga y sigue allí.
2. Solo con teclado: `Tab` hasta el control de una tarjeta de «En curso», elige «Hecho» con las flechas: la tarjeta pasa a «Hecho» y el foco sigue en su control.
3. Suéltala en su propia columna o fuera del tablero: no pasa nada, no sale mensaje.
4. Pasa una a «Hecho», ve a «Lista»: no está; filtra por «Hecho»: está.
5. **Fallo al guardar**: en las DevTools (Network → bloquear `…/tasks/*/status`) o parando el backend, mueve una tarjeta: vuelve a su columna y debajo de su control sale «No se ha guardado el cambio. …».

## 3. Vacíos y pantallas estrechas (US3, P3)

1. Con una columna sin tareas (p. ej. pasa a otro estado la única de «En curso»): muestra «0» y «No hay tareas en este estado.» en el acto; mueve una tarjeta a ella y el mensaje desaparece.
2. En las DevTools, modo responsive a 320 px de ancho: las columnas, una debajo de otra, en el mismo orden; sin barra de desplazamiento horizontal; un título largo parte líneas. Cambiar el estado con el control funciona igual.
3. Con un espacio sin ninguna tarea (BD nueva): tres columnas vacías y «Todavía no hay tareas… Ir a la lista».

## 4. Accesibilidad

- El recorrido entero de los pasos 1 y 2 se hace solo con teclado, con el foco siempre visible.
- Con un lector de pantalla: cada columna se anuncia como región «Pendiente (N tareas)»; al mover se anuncia «… está ahora en …»; si falla, «No se ha guardado el cambio: … vuelve a …».
- `expectNoSeriousA11yViolations` en verde dentro de `board.spec.ts`: test `SC-007` (con tareas, columnas vacías y cambio fallido) y el estado de error de carga de `US1-10`.
