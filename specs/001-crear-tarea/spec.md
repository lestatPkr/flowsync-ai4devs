# Feature Specification: Crear tarea con solo el título

**Feature Branch**: `feat/e2-1-crear-tarea`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Historia E2-1 del backlog de FlowSync (épica E2 «Gestión de tareas»): Como miembro del equipo, quiero crear una tarea escribiendo únicamente su título, para que anotar en qué ando cueste segundos y no me frene un formulario. Cubre: crear con solo título (asignada a quien la crea, en Pendiente, sin pedir ni sugerir otro dato); título obligatorio con mensaje claro si está vacío/solo espacios; aviso en vez de recorte silencioso si el título es desmedido; tres estados fijos (Pendiente / En curso / Hecho) sin gestión de estados; la lista muestra título, responsable y estado sin abrir la tarea; la tarea creada aparece en la lista de quien la creó sin recargar ni navegar; con el espacio sin tareas, la lista explica qué es y ofrece crear la primera. Fuera de alcance: editar, borrar, reasignar, cambiar de estado, fecha de vencimiento, filtro por estado, y ver en vivo los cambios hechos por otras personas (E3). Restricciones: autenticación existente sin tocar, espacio único compartido, sin dependencias nuevas, estilo visual existente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una tarea escribiendo solo el título (Priority: P1)

Un miembro del equipo, con sesión iniciada, quiere anotar en qué está trabajando sin rellenar un formulario. Escribe únicamente el título de la tarea y la guarda: el sistema no le pide ni le sugiere ningún otro dato, y la tarea queda creada, asignada a quien la creó y en estado "Pendiente".

**Why this priority**: Es el punto de entrada de toda la gestión de tareas — sin esto no hay nada que ver, asignar ni cambiar de estado. El orden priorizado del backlog de E2 la sitúa en primer lugar por esta misma razón.

**Independent Test**: Con sesión iniciada, escribir un título y confirmar la creación sin tocar ningún otro campo; se verifica de forma aislada comprobando que la tarea queda creada con ese título, responsable = quien la creó y estado = "Pendiente".

**Acceptance Scenarios**:

1. **Given** un miembro con sesión iniciada en el espacio compartido, **When** escribe un título con contenido y confirma la creación sin tocar ningún otro campo, **Then** la tarea se crea con ese título, queda asignada a quien la creó y en estado "Pendiente", sin que se le haya pedido ni sugerido ningún otro dato.
2. **Given** un miembro que está creando una tarea, **When** confirma sin escribir ningún título o escribiendo solo espacios en blanco, **Then** la tarea no se crea y ve un mensaje comprensible junto al campo de título explicando que hace falta un título.
3. **Given** un miembro que está creando una tarea, **When** escribe un título que empieza o termina con espacios en blanco, **Then** la tarea se crea con el título sin esos espacios sobrantes.
4. **Given** un miembro que está creando una tarea, **When** escribe un título que supera el límite de longitud admitido, **Then** el sistema le avisa de que el título es demasiado largo y no crea la tarea recortándolo en silencio.

---

### User Story 2 - Ver la tarea recién creada en la lista (Priority: P2)

Quien acaba de crear una tarea quiere verla reflejada de inmediato en su lista de tareas, con su título, su responsable y su estado visibles, sin tener que abrirla ni recargar la página.

**Why this priority**: Crear una tarea sin poder verla inmediatamente no cierra el ciclo de valor — el miembro necesita confirmación visual de que su anotación quedó guardada, sin fricción adicional.

**Independent Test**: Tras crear una tarea (User Story 1), comprobar que aparece en la lista visible por quien la creó, sin recargar ni navegar, mostrando título, responsable y estado.

**Acceptance Scenarios**:

1. **Given** un miembro que acaba de crear una tarea, **When** mira la lista de tareas sin recargar la página ni navegar a otra pantalla, **Then** la tarea nueva aparece en la lista.
2. **Given** una tarea visible en la lista, **When** un miembro la mira sin abrirla, **Then** puede ver su título, su responsable y su estado directamente en la lista.

---

### User Story 3 - Espacio sin tareas todavía (Priority: P3)

Un miembro que entra a un espacio compartido que todavía no tiene ninguna tarea quiere entender qué es esa lista y cómo empezar a usarla, en vez de encontrarse una pantalla en blanco que parezca un error.

**Why this priority**: Es el primer contacto de cualquier equipo nuevo con el producto; no bloquea el resto del flujo (una vez existe al menos una tarea, este caso ya no se repite), pero es la puerta de entrada a las dos historias anteriores.

**Independent Test**: Con un espacio compartido sin ninguna tarea creada, abrir la lista y comprobar que se muestra una explicación y una vía directa para crear la primera tarea, en vez de una lista vacía sin contexto.

**Acceptance Scenarios**:

1. **Given** un espacio compartido sin ninguna tarea creada todavía, **When** un miembro con sesión iniciada abre la lista de tareas, **Then** ve una explicación de qué es esa lista y una opción para crear la primera tarea, en lugar de un área vacía sin mensaje.
2. **Given** un espacio en el estado de "lista vacía" descrito arriba, **When** el miembro usa la opción ofrecida para crear la primera tarea, **Then** se le lleva al mismo flujo de creación de la User Story 1.

---

### Edge Cases

- ¿Qué ve un miembro que intenta crear una tarea si su sesión ha expirado justo antes de confirmar? El sistema debe rechazar la creación como cualquier otra acción sin sesión válida (comportamiento ya cubierto por la autenticación existente, sin cambios en este alcance).
- Un título compuesto únicamente por espacios, tabulaciones o saltos de línea se trata igual que un título vacío (Acceptance Scenario 2 de la User Story 1).
- Si dos miembros crean una tarea al mismo tiempo, cada creación es independiente: no hay bloqueo ni conflicto entre ellas, cada una queda asignada a quien la creó.
- La lista de tareas es la del espacio único compartido: "espacio sin tareas" significa que no existe ninguna tarea en todo el espacio, no una vista filtrada por responsable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a cualquier miembro con sesión iniciada crear una tarea indicando únicamente un título, sin exigir ni ofrecer ningún otro campo durante la creación.
- **FR-002**: El sistema DEBE asignar automáticamente como responsable de la tarea creada a quien la crea, sin que esa persona tenga que indicarlo.
- **FR-003**: El sistema DEBE crear toda tarea nueva en el estado "Pendiente".
- **FR-004**: El sistema DEBE limitar los estados posibles de una tarea a exactamente tres: "Pendiente", "En curso" y "Hecho". Este cambio no incluye ninguna vía para crear, renombrar ni eliminar estados.
- **FR-005**: El sistema DEBE rechazar la creación de una tarea cuyo título esté vacío o compuesto únicamente por espacios en blanco, y mostrar un mensaje comprensible asociado al campo de título explicando el motivo.
- **FR-006**: El sistema DEBE eliminar los espacios en blanco sobrantes al principio y al final de un título antes de guardarlo.
- **FR-007**: El sistema DEBE avisar a quien crea la tarea cuando el título supera los 200 caracteres, y NO debe crear la tarea recortando el título en silencio.
- **FR-008**: El sistema DEBE mostrar la tarea recién creada en la lista de quien la creó de forma inmediata, sin que esa persona tenga que recargar la página ni navegar a otra pantalla.
- **FR-009**: La lista de tareas DEBE mostrar, para cada tarea y sin necesidad de abrirla, su título, su responsable y su estado.
- **FR-010**: Cuando el espacio compartido no tiene ninguna tarea, el sistema DEBE mostrar en la lista una explicación de qué es esa lista y una opción para crear la primera tarea, en vez de un área vacía sin contexto.
- **FR-011**: El sistema NO DEBE permitir crear ni ver tareas a ninguna persona sin sesión iniciada (reutilizando el mecanismo de autenticación ya existente, sin modificarlo).

*Fuera de alcance de esta especificación* (pertenecen a otras historias del backlog de E2/E3, ya identificadas): editar el título de una tarea existente, borrarla, reasignarla, cambiar su estado, ponerle fecha de vencimiento, filtrar la lista por estado, y reflejar en la lista de un miembro los cambios hechos por otra persona sin recargar.

### Key Entities

- **Tarea**: la unidad de trabajo que gestiona el espacio compartido. Para esta especificación, sus atributos relevantes son: título (obligatorio, sin espacios sobrantes, con una longitud máxima), responsable (fijado en la creación a quien la crea) y estado (fijado en la creación a "Pendiente", dentro del catálogo cerrado de tres valores).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro del equipo puede crear una tarea escribiendo un único dato (el título) y confirmando, sin encontrar en el camino ningún campo adicional obligatorio ni sugerido.
- **SC-002**: El 100% de los intentos de crear una tarea con el título vacío o solo con espacios son rechazados con un mensaje comprensible, y ninguno llega a crear una tarea.
- **SC-003**: El 100% de las tareas creadas con éxito quedan visibles en la lista de quien las creó en menos de 1 segundo después de confirmarse, sin recargar la página.
- **SC-004**: Un espacio compartido sin tareas nunca se presenta como una pantalla vacía sin explicación: siempre ofrece contexto y una vía directa para crear la primera tarea.

## Assumptions

- La lista de tareas y el flujo de creación a los que se refiere esta especificación ya existen como superficie de navegación dentro de la aplicación (la pantalla en sí no es nueva de este cambio; lo nuevo es que se pueda crear y ver una tarea en ella). Si la pantalla de lista aún no existe, su creación queda implícita como parte de las User Story 2 y 3.
- El catálogo de estados "Pendiente / En curso / Hecho" cierra el Punto abierto #3 del PRD (`docs/prd/flowsync-mvp.md`) para efectos de esta especificación; no se reabre aquí ni se ofrece ninguna forma de modificarlo.
- "Sin recargar ni navegar" (User Story 2) se limita a la sesión de quien crea la tarea. Que otras personas del espacio vean esa tarea nueva sin recargar por su cuenta es un requisito de E3 (Actividad del equipo) y queda fuera de esta especificación.
- El mensaje de "espacio sin tareas" y el texto exacto del aviso de título demasiado largo se redactan en la fase de diseño/plan, siguiendo el estilo visual y de idioma (castellano) ya existente en la aplicación; esta especificación solo exige que existan y sean comprensibles.
