# Feature Specification: Abrir una tarea de la lista

**Feature Branch**: `feat/e2-5-abrir-tarea`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Nombre corto de la feature: abrir-tarea. Historia E2-5 del backlog de FlowSync (docs/backlog/E2-gestion-tareas/us-abrir-tarea.md; épica E2 «Gestión de tareas»): «Como miembro del equipo, quiero abrir una tarea de la lista, para ver y tocar lo que la lista deliberadamente no muestra.» No tiene requisito propio en el PRD: la presuponen RF-13 y RF-15 (la fecha de vencimiento se consulta y se establece únicamente al abrir la tarea, y el vencimiento se ve al abrirla y no en la lista), y PA-6 señala que esta superficie no estaba contabilizada. Decisión de producto tomada para este cambio (cierra PA-6 en lo mínimo): la vista de una tarea muestra su título, su responsable, su estado y cuándo se creó; la fecha de vencimiento y la señal de vencida llegarán con FS-118 sobre esta misma vista, no aquí. Criterios de la historia que cubre: CA-1 se abre desde la lista y se llega a una vista de esa tarea concreta; CA-2 desde la tarea se vuelve a la lista; CA-3 se abre y se vuelve solo con el teclado; CA-7 abrir y cerrar sin tocar nada no cambia estado, responsable ni nada; CA-8 se puede abrir cualquier tarea, sea de quien sea, sin advertencia ni permiso; CA-9 sin sesión no se ve su contenido; CA-10 una tarea que ya no existe no se inventa: se dice que ya no existe y se ofrece volver a la lista, nunca una vista vacía como si estuviera ahí. Fuera de alcance: fecha de vencimiento y vencimiento (FS-118), editar el título, reasignar, borrar, cambiar el estado desde la vista de la tarea (el estado se cambia desde la lista, E2-4, ya hecha), y ver en vivo cambios de otras personas (E3). Restricciones que la spec respeta sin bajar a lo técnico: la autenticación ya existe y no se toca; espacio único compartido; ninguna dependencia nueva; el estilo visual existente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir una tarea de la lista y volver (Priority: P1)

Un miembro del equipo, con sesión iniciada, está en la lista de tareas del espacio compartido y quiere ver una tarea concreta por sí sola: su título completo, quién la lleva, en qué estado está y cuándo se creó. La abre desde su fila, la mira y vuelve a la lista. Puede abrir cualquier tarea del espacio, sea suya o de otra persona, y hacerlo todo con el ratón o solo con el teclado. Mirar no cambia nada: la tarea queda exactamente como estaba.

**Why this priority**: Es la superficie que RF-13 y RF-15 dan por hecha y que PA-6 señala como no contabilizada. Por sí sola tiene impacto bajo, pero sin ella FS-118 (fecha de vencimiento) no tiene dónde vivir, y E2-6 (editar el título) cae casi sola una vez existe. El backlog la sitúa novena en el orden priorizado como habilitadora de lo que viene detrás.

**Independent Test**: Con sesión iniciada y al menos dos tareas en la lista —una propia y otra cuyo responsable es otra persona—, abrir cada una desde su fila, comprobar que la vista muestra el título, el responsable, el estado y la fecha de creación de esa tarea y no de otra, volver a la lista, y comprobar que ninguna de las dos ha cambiado; repetir el recorrido entero usando solo el teclado.

**Acceptance Scenarios**:

1. **DADO** un miembro con sesión iniciada que ve una tarea en la lista, **CUANDO** la abre desde su fila, **ENTONCES** llega a una vista de esa tarea concreta, que muestra su título, su responsable, su estado y cuándo se creó. *(CA-1, decisión que cierra PA-6 en lo mínimo)*
2. **DADO** una lista con varias tareas, **CUANDO** un miembro abre una de ellas, **ENTONCES** los datos que ve son los de la tarea que abrió y coinciden con los que la lista mostraba para ella (título, responsable y estado). *(CA-1)*
3. **DADO** un miembro que tiene una tarea abierta, **CUANDO** la cierra, **ENTONCES** vuelve a la lista de tareas. *(CA-2)*
4. **DADO** un miembro en la lista que usa únicamente el teclado, **CUANDO** abre una tarea y después la cierra, **ENTONCES** puede hacer ambas cosas igual que con el ratón, y al volver puede seguir recorriendo la lista desde la tarea que abrió. *(CA-3, RNF-6)*
5. **DADO** un miembro que abre una tarea y la cierra sin tocar nada, **CUANDO** vuelve a la lista, **ENTONCES** esa tarea conserva su título, su responsable y su estado, y no ha cambiado nada más en ella. *(CA-7)*
6. **DADO** una tarea cuyo responsable es otra persona, **CUANDO** un miembro la abre, **ENTONCES** la ve igual que si fuera suya, sin advertencia, sin aviso de que es ajena y sin que se le pida ningún permiso especial. *(CA-8)*
7. **DADO** una persona sin sesión iniciada, **CUANDO** intenta llegar a la vista de una tarea, **ENTONCES** no ve nada de su contenido —ni título, ni responsable, ni estado, ni fecha de creación— y se le trata como en cualquier otra pantalla protegida de la autenticación existente, sin cambios en este alcance. *(CA-9)*
8. **DADO** un miembro que está en la lista, **CUANDO** cambia el estado de una tarea desde su fila (E2-4), **ENTONCES** la tarea no se abre: abrir y cambiar el estado siguen siendo gestos distintos, y cambiar el estado sigue sin exigir abrir la tarea (RF-9).
9. **DADO** una tarea abierta, **CUANDO** el miembro mira la vista, **ENTONCES** no encuentra en ella ningún control para cambiar el estado, editar el título, reasignar ni borrar: en este cambio la vista es solo de consulta.

---

### User Story 2 - La tarea que ya no existe (Priority: P2)

Un miembro intenta abrir una tarea que ya no está: otra persona la borró después de que él cargara la lista, o llega a la vista de una tarea que no existe. En lugar de una vista vacía o a medio pintar que aparenta que la tarea sigue ahí, se le dice claramente que esa tarea ya no existe y se le ofrece volver a la lista.

**Why this priority**: Con roles planos y borrado sin papelera, que alguien borre una tarea mientras otro la tiene a la vista no es un caso raro, sino lo normal (motivo del CA-10 propuesto en la historia). Además, mientras la lista viva (E3) no exista, la lista de un miembro puede seguir mostrando tareas que ya se borraron. Depende de que exista la User Story 1, pero se puede verificar por separado.

**Independent Test**: Cargar la lista, borrar una de sus tareas por otra vía (o intentar llegar a la vista de una tarea que nunca existió), intentar abrirla y comprobar que se muestra un mensaje de que ya no existe junto con una forma de volver a la lista, y que en ningún momento aparece un título, un responsable, un estado o una fecha de creación.

**Acceptance Scenarios**:

1. **DADO** una tarea que se borró después de que el miembro cargara la lista, **CUANDO** intenta abrirla, **ENTONCES** se le dice, en castellano y de forma comprensible, que esa tarea ya no existe. *(CA-10)*
2. **DADO** un miembro al que se le acaba de decir que una tarea ya no existe, **CUANDO** mira la pantalla, **ENTONCES** tiene a mano una forma de volver a la lista, operable también solo con el teclado. *(CA-10, CA-3)*
3. **DADO** un intento de abrir una tarea que no existe, **CUANDO** se resuelve, **ENTONCES** no se muestra en ningún momento una vista de tarea vacía, con datos a medias o con datos de otra tarea, como si la tarea estuviera ahí. *(CA-10)*
4. **DADO** un miembro que intenta abrir una tarea y no se puede cargar por un fallo de conexión, **CUANDO** se resuelve, **ENTONCES** se le explica que no se ha podido cargar y qué puede hacer, sin decirle que la tarea no existe ni mostrarle una vista vacía (RNF-10).

---

### Edge Cases

- **La tarea se borra mientras el miembro la tiene abierta.** Sin lista viva (E3), la vista no se entera sola y sigue mostrando lo que cargó; qué debe ver esa persona en ese momento es PA-8 y queda fuera de este alcance. Si vuelve a intentar abrirla —por ejemplo, recargando—, se aplica la User Story 2.
- **Otra persona cambia el estado, el responsable o el título de la tarea mientras está abierta.** La vista no se actualiza sola (E3-2 fuera de alcance); al volver a abrirla o recargar muestra los datos guardados en ese momento.
- **Recargar con una tarea abierta.** El miembro sigue en la vista de esa misma tarea, con sus datos guardados, sin volver a la lista ni perder la tarea.
- **La sesión caduca con una tarea abierta.** Al siguiente intento de ver la tarea se actúa como en cualquier otra pantalla protegida de la autenticación existente: no se muestra su contenido.
- **Título muy largo.** La vista muestra el título completo, aunque la lista lo recorte; nada se corta sin forma de leerlo.
- **Tarea abierta justo después de crearla.** Se abre igual que cualquier otra, con su responsable y su estado por defecto y su fecha de creación.
- **Tarea en «Hecho».** Se abre igual que cualquier otra; su estado se muestra como «Hecho» sin ningún tratamiento especial.
- **Fallo de conexión frente a tarea inexistente.** Son dos avisos distintos y no se confunden: uno dice que la tarea ya no existe; el otro, que no se ha podido cargar (User Story 2, escenarios 1 y 4).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a cualquier miembro con sesión iniciada abrir cualquier tarea del espacio compartido desde su fila en la lista y llegar a una vista dedicada a esa tarea concreta.
- **FR-002**: La vista de una tarea DEBE mostrar su título completo, su responsable, su estado y cuándo se creó; y NO DEBE mostrar datos de ninguna otra tarea.
- **FR-003**: Desde la vista de una tarea, el miembro DEBE poder volver a la lista de tareas.
- **FR-004**: Abrir una tarea y volver a la lista DEBEN poder hacerse íntegramente con el teclado; al volver con el teclado, el miembro DEBE poder seguir recorriendo la lista desde la tarea que abrió (RNF-6).
- **FR-005**: Abrir una tarea, mirarla y volver NO DEBE modificar ningún dato de esa tarea ni de ninguna otra: título, responsable, estado y fecha de creación quedan como estaban.
- **FR-006**: La vista de una tarea NO DEBE ofrecer en este cambio ninguna acción que modifique la tarea (cambiar el estado, editar el título, reasignar ni borrar).
- **FR-007**: El sistema DEBE mostrar cualquier tarea con independencia de quién sea su responsable o quién la creó, sin advertencias por tratarse de una tarea ajena y sin pedir permisos especiales.
- **FR-008**: El sistema NO DEBE mostrar ningún dato de una tarea a una persona sin sesión iniciada, reutilizando el mecanismo de autenticación existente sin modificarlo.
- **FR-009**: Si la tarea que se intenta abrir no existe o ya no existe, el sistema DEBE decir, con un mensaje comprensible en castellano, que esa tarea ya no existe, y DEBE ofrecer una forma de volver a la lista.
- **FR-010**: Ante una tarea inexistente, el sistema NO DEBE mostrar en ningún momento una vista de tarea vacía, con datos parciales o con datos de otra tarea.
- **FR-011**: Si la tarea no se puede cargar por un motivo distinto de que no exista (por ejemplo, un fallo de conexión), el sistema DEBE explicarlo con un mensaje comprensible en castellano que diga qué hacer, sin errores técnicos crudos y sin afirmar que la tarea no existe (RNF-8, RNF-10).
- **FR-012**: La vista de una tarea DEBE seguir mostrando esa misma tarea tras recargar, y un miembro con sesión DEBE poder llegar a ella de nuevo sin pasar por la lista.
- **FR-013**: Abrir una tarea NO DEBE interferir con el cambio de estado desde la lista (E2-4): cambiar el estado desde la fila no abre la tarea, y abrirla no cambia su estado.
- **FR-014**: La vista de una tarea y sus avisos DEBEN plegarse al estilo visual ya existente en el producto, sin rediseño (R-8), y todos sus textos DEBEN estar en castellano (RNF-8).

*Fuera de alcance de esta especificación* (pertenecen a otras historias del backlog de E2/E3, ya identificadas): fecha de vencimiento y señal de vencida (FS-118, RF-13, RF-14, RF-15, que se añadirán sobre esta misma vista), editar el título (E2-6), reasignar el responsable (E2-7), borrar la tarea (E2-10), cambiar el estado desde la vista de la tarea (el estado se cambia desde la lista, E2-4, ya hecha), qué ve quien tiene abierta una tarea que otra persona cambia o borra (PA-8), y reflejar sin recargar los cambios hechos por otras personas (E3).

### Key Entities

- **Tarea**: la unidad de trabajo del espacio compartido. Para esta especificación se consultan, sin modificarse, su **título**, su **responsable** (la persona registrada que la lleva), su **estado** (uno de «Pendiente», «En curso» o «Hecho») y su **momento de creación**.
- **Vista de una tarea**: la superficie donde se consulta una única tarea por sí sola; es donde FS-118 añadirá después la fecha de vencimiento y la señal de vencida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro abre cualquier tarea visible en la lista con 1 interacción desde su fila, y vuelve a la lista con 1 interacción desde la vista de la tarea.
- **SC-002**: En el 100% de las aperturas, la vista muestra el título, el responsable, el estado y la fecha de creación de la tarea abierta, y sus datos coinciden con los que la lista mostraba para ella; en 0 casos muestra datos de otra tarea.
- **SC-003**: La vista de una tarea existente aparece sin espera perceptible (menos de 1 segundo a la escala objetivo de RNF-5).
- **SC-004**: En 0 casos abrir una tarea y volver sin tocar nada deja cambiado algún dato de esa tarea o de otra.
- **SC-005**: El recorrido completo —abrir una tarea desde la lista y volver a ella, y también volver a la lista desde el aviso de tarea inexistente— se completa usando solo el teclado.
- **SC-006**: El 100% de los intentos de abrir una tarea que no existe terminan en el aviso de que ya no existe con una forma de volver a la lista, y en 0 casos se muestra una vista vacía o con datos.
- **SC-007**: En 0 casos una persona sin sesión iniciada ve algún dato de una tarea.
- **SC-008**: Las tareas propias y las ajenas se abren con el mismo recorrido y el mismo resultado, con 0 advertencias o peticiones de permiso.

## Assumptions

- **Contenido mínimo de la vista (cierra PA-6 en lo mínimo)**: título, responsable, estado y cuándo se creó, por decisión de producto tomada para este cambio. La fecha de vencimiento y la señal de vencida llegan con FS-118 sobre esta misma vista. Cualquier otro dato queda fuera hasta que una historia lo pida.
- **Cómo se presenta «cuándo se creó»**: como fecha absoluta en castellano (día, mes y año, con la hora), no como tiempo relativo («hace 2 días»). Es el formato menos ambiguo para una vista de consulta; el formato exacto se fija en el plan.
- **Qué cuenta como interacción**: la misma definición que fijó E2-4 (`specs/002-cambiar-estado/`) para PA-9: una activación deliberada —un clic, un toque o una pulsación de tecla que selecciona o confirma—; mover el puntero o desplazarse no cuenta.
- **La vista es solo de consulta en este cambio.** Las acciones que modifican una tarea viven en otras historias: el estado se cambia desde la lista (E2-4), y editar el título, reasignar y borrar llegan después (E2-6, E2-7, E2-10), previsiblemente sobre esta misma vista.
- **La vista de una tarea tiene su propia dirección dentro del producto**, de modo que recargar mantiene al miembro en ella y puede llegarse de nuevo sin pasar por la lista. Es lo que hace que CA-9 («intento llegar a la vista de una tarea») y CA-10 (intentar abrir una tarea borrada) sean situaciones reales y comprobables.
- **Sin sesión se aplica la autenticación existente tal cual.** Una persona sin sesión que intenta llegar a la vista de una tarea recibe el mismo trato que en cualquier otra pantalla protegida. Que tras iniciar sesión vuelva a la tarea que intentaba abrir no forma parte de este cambio: exigiría tocar la autenticación, que es zona protegida.
- **«Ya no existe» cubre también la tarea que nunca existió.** Desde el punto de vista de quien la busca no hay diferencia útil entre una tarea borrada y una que no existió nunca: en ambos casos se dice que ya no existe y se ofrece volver.
- **Sin lista viva todavía.** Hasta que llegue E3, ni la lista ni la vista de una tarea reflejan solas los cambios de otras personas; lo que se ve es lo guardado en el momento de cargar. Por eso el caso de la tarea borrada que sigue en la lista de alguien es frecuente y se cubre en la User Story 2.
- **Cualquier miembro del espacio único compartido** puede abrir cualquier tarea: no existen roles ni propiedad que lo restrinjan (roles planos del PRD, R-4).
- **Los textos exactos** de la vista y de los avisos (tarea inexistente, fallo al cargar) se redactan en el plan, en castellano y con el tono de los mensajes ya existentes; esta especificación solo exige que existan, se distingan entre sí y sean comprensibles.
- **La lista de tareas ya existe** (`specs/001-crear-tarea/`, `specs/002-cambiar-estado/`) y ya muestra título, responsable y estado, con cambio de estado desde la fila; este cambio añade la vía para abrir cada tarea, no rehace la lista.
- **Sin dependencias nuevas** y sin tocar la autenticación: el cambio se construye con lo que ya hay en el proyecto.
