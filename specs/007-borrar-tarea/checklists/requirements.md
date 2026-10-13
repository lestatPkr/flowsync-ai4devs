# Specification Quality Checklist: Borrar una tarea

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-13
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

- FR-012 (desde dónde se pide borrar) quedó resuelto el 2026-10-13 en la entrada de `/speckit-plan`: solo desde la tarea abierta (ver «Clarifications» en la spec).
- Sin detalles técnicos: el modelo de amenazas habla de verbos, códigos de estado, cabeceras y tablas; la spec los traduce a comportamiento observable («una referencia mal formada no borra nada», «el permiso solo por la vía actual», «no se puede incrustar»). El CÓMO va en `plan.md` (Constitución I).
- Las 10 mitigaciones (R1–R10) entran como escenario y requisito; las que chocan con el PRD (quién borró, papelera, alta abierta, PA-8) o caen fuera (ritmo de borrado, sesión, despliegue) están anotadas en «Del modelo de amenazas a la spec».
- CA-7 y CA-11 entran marcados como [PROPUESTO], igual que en la historia.
