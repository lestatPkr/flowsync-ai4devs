# Specification Quality Checklist: Cambiar el estado de una tarea desde la lista

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

- Todos los ítems pasan en la primera iteración. No queda ningún `[NEEDS CLARIFICATION]`: los dos huecos que la historia E2-4 dejaba abiertos se resuelven así:
  - **PA-7 (transiciones)**: cerrado por decisión de producto en la entrada — todas las transiciones son válidas, incluida la vuelta atrás desde «Hecho» (FR-006).
  - **PA-9 (qué es una interacción)**: resuelto como supuesto explícito (activación deliberada: clic, toque o tecla; mover el puntero o desplazarse no cuenta), para que FR-002 y SC-001 tengan un umbral que se pueda suspender.
- **RF-21** (lo hecho sale de la vista por defecto) se deja fuera de forma explícita: está trazado a FS-142 junto con el filtro, que es su camino de vuelta. Aquí la tarea en «Hecho» sigue visible (FR-013). Si producto quisiera ocultarla ya en este cambio, habría que reabrir el alcance: sin filtro, la vuelta atrás desde «Hecho» dejaría de poder hacerse desde la lista.
- La matriz de comportamiento del Principio II de la constitución (camino feliz / entrada inválida / sin sesión / recurso inexistente) queda cubierta a nivel de producto por los escenarios 1–8 de la User Story 1; su traducción a tests es trabajo de `/speckit-plan`.
