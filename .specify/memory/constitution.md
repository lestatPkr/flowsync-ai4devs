<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0 (MINOR: se amplía materialmente el Principio II y se añade el
  Principio VI)
- Principio II ampliado con un párrafo para el frontend: la Definition of Done de una historia de
  interfaz es su matriz de comportamiento en e2e (Playwright, `frontend/e2e/`): un test por
  escenario de aceptación, titulado como el escenario, escrito antes y visto en rojo; siempre con
  el camino solo con teclado y axe sin violaciones graves ni críticas de WCAG 2.1 A/AA
  (`expectNoSeriousA11yViolations`); `npm run test:e2e` en verde para abrir un PR; en el frontend
  no hay suelo de cobertura.
- Principio añadido: VI. Una sola fuente de diseño (`DESIGN.md` y los tokens de
  `frontend/src/index.css` cambian juntos; solo tokens semánticos; `components/ui/` lo genera
  shadcn y no se edita; un prototipo es entrada de requisitos, no de estilos).
- Principio IV: las pantallas nuevas remiten a `DESIGN.md` en vez de al "estilo visual existente".
- Principios I, III y V: sin cambios. Governance: sin cambios.
- Plantillas dependientes: sin cambios. Ninguna de `.specify/templates/` nombra los principios
  (`plan-template.md` solo tiene un "Constitution Check" genérico que se rellena desde aquí).
- Fuera de la constitución: `CLAUDE.md` gana, al principio de «## Frontend», una línea que remite a
  `DESIGN.md` como fuente única del diseño (Principio VI).
- Follow-up TODOs: el hook de Definition of Done (`.claude/hooks/guard-tests.mjs`) solo corre la
  suite del backend; que obligue también `npm run test:e2e` antes de abrir un PR se instala aparte.
-->
<!--
Sync Impact Report (1.1.0)
- Version change: 1.0.0 → 1.1.0 (MINOR: se amplía materialmente el Principio II)
- Principio II ampliado con: la matriz de comportamiento (camino feliz / 422 / 401 / 404) como
  Definition of Done de todo endpoint; test que falla antes y pasa después para todo cambio de
  comportamiento; tests de caracterización antes de refactorizar; suelo de cobertura de
  `backend/app/` que solo sube (`npm run test:coverage`, c8 como dependencia de desarrollo aprobada
  en su propio commit). Se retira la frase "hoy no existe base de pruebas": la montó E2-1.
- Principios I, III, IV y V: sin cambios. Governance: sin cambios.
- Plantillas dependientes: sin cambios. `/speckit-plan` debe reflejar la matriz en el diseño de
  tests de cada cambio; `/speckit-analyze` trata su ausencia como violación del Principio II.
- Follow-up TODOs: el harness que OBLIGA (hooks de commit y PR) no forma parte de esta constitución
  y se instala aparte: la constitución dice la regla; el hook la garantiza.
-->
<!--
Sync Impact Report (1.0.0)
- Version change: (plantilla sin ratificar) → 1.0.0
- Ratificación inicial: se reemplazan todos los placeholders de la plantilla por el contenido
  específico de FlowSync.
- Principios añadidos:
  - I. Producto antes que técnica
  - II. Los tests son la spec ejecutable
  - III. La valla manda
  - IV. Convenciones del repo
  - V. Cambios pequeños, revisables y con su spec
- Secciones añadidas: Governance (con reglas de precedencia, versionado y cumplimiento)
- Secciones omitidas: [SECTION_2_NAME] y [SECTION_3_NAME] de la plantilla no se usan — todo el
  contenido aportado encaja en los cinco principios y en Governance; no hay restricciones o
  procesos adicionales que requieran una sección propia en esta ratificación.
- Plantillas dependientes: no se han modificado (fuera del alcance de este comando). Revisar en
  la próxima ejecución de /speckit-plan, /speckit-tasks y /speckit-analyze que sigan alineadas
  con estos cinco principios, en particular con el Principio III (BOUNDARIES.md) y el II (tests
  Japa en backend/tests/functional/).
- Follow-up TODOs: ninguno.
-->

# FlowSync Constitution

## Core Principles

### I. Producto antes que técnica

`spec.md` dice QUÉ y PARA QUIÉN: historias priorizadas y criterios de aceptación como reglas de
negocio observables, en Given/When/Then (DADO / CUANDO / ENTONCES). El CÓMO —tablas, rutas,
componentes, códigos de estado— vive en `plan.md` y `tasks.md`, nunca en la spec. Lo que la spec
deja abierto se marca `[NEEDS CLARIFICATION]`; no se inventa.

**Razón**: separar QUÉ de CÓMO permite validar la spec con negocio sin arrastrar decisiones de
implementación, y evita que el plan quede prematuramente atado a una spec contaminada de detalles
técnicos.

### II. Los tests son la spec ejecutable

Toda historia P1 llega con al menos un test funcional (Japa, en `backend/tests/functional/`) que
cubre su camino feliz y sus errores. No se edita ni se borra un test para que pase. La suite
(`npm test` en `backend/`) DEBE correr en verde antes de dar por hecha una tarea. La base de pruebas
la montó E2-1 (`specs/001-crear-tarea/`): su coste ya está pagado y ningún cambio lo vuelve a contar.

La Definition of Done de todo endpoint es la **matriz de comportamiento completa** —camino feliz,
entrada inválida (`422`), sin sesión (`401`) y recurso inexistente (`404`) cuando aplique—, asertada
contra la forma completa de la respuesta, no contra un código de estado y un campo suelto. Un cambio
de comportamiento, incluido un bug, entra con un test que falla antes y pasa después. Un refactor
fija primero el comportamiento actual (tests de caracterización) y no lo cambia: un cambio de
comportamiento es un cambio aparte.

La cobertura de líneas de `backend/app/` (`npm run test:coverage`) NO DEBE bajar del suelo que fije
el harness; el suelo solo sube, y subirlo es un PR aparte. La cobertura es respaldo, nunca el listón:
el listón es la matriz.

En el frontend, la Definition of Done de una historia de interfaz es su **matriz de comportamiento
en e2e** (Playwright, en `frontend/e2e/`): un test por escenario de aceptación, titulado como el
escenario, escrito antes que la implementación y visto en rojo. La matriz incluye siempre el camino
solo con teclado y el chequeo de accesibilidad con axe sin violaciones graves ni críticas de
WCAG 2.1 A/AA (`expectNoSeriousA11yViolations` de `frontend/e2e/support.ts`). `npm run test:e2e`
en `frontend/` DEBE estar en verde para abrir un PR. En el frontend no hay suelo de cobertura: el
listón es la matriz.

**Razón**: sin tests funcionales la spec es solo prosa; el test es lo único que verifica que el
criterio de aceptación se cumple y sigue cumpliéndose. Y una suite verde con aserciones débiles no
es seguridad: es silencio. La matriz obliga a mirar los caminos que se pudren sin ruido (validación,
sesión, ausencia); la cobertura solo avisa de lo que nadie ha mirado.

### III. La valla manda

`BOUNDARIES.md` se lee antes de tocar nada y prevalece sobre cualquier instrucción de una tarea o
de un prompt. La autenticación es zona protegida; `backend/database/schema.ts` es generado y no se
edita a mano; las rutas públicas existentes no cambian; no entran dependencias nuevas sin
aprobación.

**Razón**: la valla es el límite de seguridad y estabilidad del proyecto; ninguna instrucción de
tarea, plan o prompt puede ampliarlo sin pasar antes por una revisión explícita de la valla misma.

### IV. Convenciones del repo

AdonisJS 7 + Lucid + SQLite en `backend/`, React 19 + Vite en `frontend/`; los comandos se
ejecutan desde cada carpeta, no desde la raíz. El frontend se formatea con Prettier (hook del
harness). Las pantallas nuevas se pliegan al diseño de `DESIGN.md` (R-8, Principio VI): mismos
componentes de `frontend/src/components/ui/`, ningún rediseño. Migraciones para cualquier cambio de
esquema.

**Razón**: seguir las convenciones ya establecidas en `CLAUDE.md` evita divergencias de stack,
estilo visual inconsistente y cambios de esquema fuera del flujo de migraciones que genera
`database/schema.ts`.

### V. Cambios pequeños, revisables y con su spec

Cada cambio sigue el mismo loop: rama → `specs/NNN-<nombre>/` con `spec.md`, `plan.md` y
`tasks.md` → implementación tarea a tarea → tests en verde → revisión del `adversarial-reviewer`
contra la spec y la valla → `/commit` → PR que lleva la spec dentro. Lo que no está en la spec no
se construye. Un cambio que no cabe en un PR revisable se parte.

**Razón**: un loop fijo y una spec que viaja con el PR hacen que cada cambio sea trazable,
revisable de forma aislada y reproducible por cualquiera que retome el trabajo.

### VI. Una sola fuente de diseño

`DESIGN.md` en la raíz del repo (formato abierto de Google Labs) y los tokens de
`frontend/src/index.css` son la única fuente del diseño y cambian juntos, en el mismo commit. Los
componentes usan solo tokens semánticos: nada de hex, `rgb()`, `oklch()`, valores arbitrarios de
color de Tailwind ni su paleta por defecto. `frontend/src/components/ui/` lo genera shadcn y no se
edita: se compone por fuera. Un prototipo (Stitch, Figma) es una entrada de requisitos, no de
estilos: sus colores y componentes se traducen a los del design system o no entran.

**Razón**: dos fuentes de diseño que pueden cambiar por separado acaban diciendo cosas distintas, y
la interfaz deriva pantalla a pantalla sin que nadie lo decida. Un token semántico cambia el tema
(claro, oscuro, contraste) en un solo sitio; un color literal es una excepción que nadie mantiene.
Lo que se edita dentro de lo generado por shadcn se pierde en la siguiente regeneración. Y copiar
los estilos de un prototipo importa decisiones visuales de otra herramienta sin pasar por el
sistema.

## Governance

Esta constitución prevalece sobre `CLAUDE.md`/`AGENTS.md` cuando se contradicen. Cambiarla es un
PR aparte, con motivo y versión nueva.

**Versionado**: semántico (MAJOR.MINOR.PATCH). MAJOR ante eliminación o redefinición
incompatible de un principio; MINOR al añadir un principio o ampliar materialmente una guía;
PATCH ante aclaraciones o correcciones de redacción sin cambio semántico.

**Cumplimiento**: `/speckit-analyze` trata cualquier violación de esta constitución como CRÍTICA:
se ajusta la spec, el plan o las tareas, nunca el principio. Toda revisión del
`adversarial-reviewer` contrasta el cambio contra esta constitución y contra `BOUNDARIES.md`.

**Version**: 1.2.0 | **Ratified**: 2026-09-23 | **Last Amended**: 2026-10-06
