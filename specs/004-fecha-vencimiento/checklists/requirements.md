# Specification Quality Checklist: Fecha de vencimiento y tareas vencidas

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-29
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

- Todos los ítems pasan en la primera iteración. No queda ningún `[NEEDS CLARIFICATION]`: lo que la historia FS-118 dejaba abierto está ya decidido en otro sitio o tiene un valor por defecto razonable, y se deja como supuesto explícito:
  - **Volver desde «Hecho» con la fecha pasada** (pendiente de PA-7 en el backlog): E2-4 cerró PA-7, así que toda transición es válida y, por RF-14, la tarea vuelve a estar vencida (US2, escenario 7).
  - **Día de referencia**: el del dispositivo de quien mira (supuesto de RF-14); la fecha es un día del calendario, igual para todos (edge case «Misma fecha escrita para todos»).
  - **Cómo encajan CA-14 y CA-16** (guardar solo frente a no tragarse una fecha inválida): solo se guarda una fecha completa y existente (edge case correspondiente).
  - **Criterios [PROPUESTO] del backlog** (CA-4, CA-13 a CA-17, CA-20): se dan por validados porque la entrada los incluye.
- Fuera de alcance, pero anotado para que nadie lo dé por cubierto: **PA-8** (cambios simultáneos de fecha; queda el último guardado) y **CA-18** (reasignar no toca la fecha), que espera a E2-7.
- Matriz de comportamiento del Principio II, a nivel de producto: camino feliz (US1, escenarios 1–5 y 7), entrada inválida (US1, escenario 6), sin sesión (US1, escenario 11) y tarea inexistente (US1, escenario 10). Su traducción a tests es trabajo de `/speckit-plan`.
- Riesgo que el plan debe tratar primero: los bordes de US2 (escenarios 1–4) y el par dos husos / medianoche (escenarios 11–13) son los que el backlog señala como el ticket más peligroso (FS-118.2).
