# Specification Quality Checklist: Fecha de vencimiento y tareas vencidas

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-30
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Todos los ítems pasan en la primera iteración. No queda ningún `[NEEDS CLARIFICATION]`: nada de lo que la historia deja abierto carece de un valor por defecto razonable, así que todo se resuelve como supuesto explícito:
  - **Día de referencia** (el de quien mira, según su dispositivo) y **fecha como día sin hora**: siguen el [SUPUESTO] de RF-14 del PRD y CA-19.
  - **Volver atrás desde «Hecho» con la fecha pasada** (pendiente de PA-7 en el backlog): ya lo cerró E2-4 (`specs/002-cambiar-estado/`); se añade como escenario 10 de la User Story 2.
  - **Dos cambios simultáneos** (PA-8): prevalece el último, como en E2-4; qué ve quien pierde el cambio queda fuera, con E3.
  - **Medianoche con la tarea abierta**: se exige al abrir o recargar (CA-20), no en vivo.
- Los criterios **[PROPUESTO]** del backlog (CA-4, CA-13 a CA-17, CA-20) se adoptan tal como llegan en la entrada; queda anotado en Assumptions por si la validación descarta alguno.
- **CA-18** (reasignar no toca la fecha) queda fuera con E2-7, porque la reasignación no existe todavía.
- Los cuatro bordes de la regla y el caso de los dos husos están como escenarios explícitos: User Story 2, escenarios 2–5 y 11.
- La matriz del Principio II de la constitución queda cubierta a nivel de producto: camino feliz (US1, 1–8), entrada inválida (US1, 9; FR-007), sin sesión (FR-017) y recurso inexistente (FR-018). Su traducción a tests es trabajo de `/speckit-plan`.
