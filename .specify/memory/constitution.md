<!--
Sync Impact Report
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
(`npm test` en `backend/`) DEBE correr en verde antes de dar por hecha una tarea. Hoy no existe
base de pruebas (R-7 del PRD): el primer cambio que la necesite MUST montarla, y ese coste se
cuenta dentro del cambio, no se da por hecho.

**Razón**: sin tests funcionales la spec es solo prosa; el test es lo único que verifica que el
criterio de aceptación se cumple y sigue cumpliéndose.

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
harness). Las pantallas nuevas se pliegan al estilo visual existente (R-8): mismos componentes de
`frontend/src/components/ui/`, ningún rediseño. Migraciones para cualquier cambio de esquema.

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

## Governance

Esta constitución prevalece sobre `CLAUDE.md`/`AGENTS.md` cuando se contradicen. Cambiarla es un
PR aparte, con motivo y versión nueva.

**Versionado**: semántico (MAJOR.MINOR.PATCH). MAJOR ante eliminación o redefinición
incompatible de un principio; MINOR al añadir un principio o ampliar materialmente una guía;
PATCH ante aclaraciones o correcciones de redacción sin cambio semántico.

**Cumplimiento**: `/speckit-analyze` trata cualquier violación de esta constitución como CRÍTICA:
se ajusta la spec, el plan o las tareas, nunca el principio. Toda revisión del
`adversarial-reviewer` contrasta el cambio contra esta constitución y contra `BOUNDARIES.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-23 | **Last Amended**: 2026-09-23
