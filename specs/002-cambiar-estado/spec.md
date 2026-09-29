# Feature Specification: Cambiar el estado de una tarea desde la lista

**Feature Branch**: `feat/e2-4-cambiar-estado`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Historia E2-4 del backlog de FlowSync (`docs/backlog/E2-gestion-tareas/us-cambiar-estado.md`; épica E2 «Gestión de tareas», quinta del orden priorizado): Como miembro del equipo, quiero cambiar el estado de una tarea desde la propia lista, para que mantener al día en qué ando cueste un gesto y no deje de hacerse. Cubre RF-8 (tres estados fijos, Pendiente / En curso / Hecho, sin vía para crear, renombrar ni eliminar estados) y RF-9 (cambiar el estado de cualquier tarea desde la propia lista, sin abrir la tarea, sin diálogo de confirmación y sin rellenar ningún campo; el nuevo estado se refleja en la vista de inmediato). Criterios: CA-1 sin salir de la lista; CA-2 cualquier tarea, no solo la mía, sin permiso especial ni advertencia; CA-3 los únicos destinos son esos tres y al terminar la tarea está en exactamente uno. Decisión de producto (cierra PA-7): cualquier transición entre los tres estados es válida, incluida volver atrás desde «Hecho». Un estado que no sea uno de los tres se rechaza con un mensaje comprensible y la tarea conserva el que tenía; si la tarea ya no existe, se avisa en vez de fingir que el cambio se aplicó. Fuera de alcance: filtrar por estado (FS-142), fecha de vencimiento, abrir la tarea, editar el título, reasignar, borrar, y ver en vivo los cambios hechos por otras personas (E3). Restricciones: autenticación existente sin tocar, espacio único compartido, sin dependencias nuevas, estilo visual existente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar el estado de una tarea desde la lista (Priority: P1)

Un miembro del equipo, con sesión iniciada, está mirando la lista de tareas del espacio compartido y quiere dejar constancia de que ha empezado algo, lo ha terminado o lo ha vuelto a dejar pendiente. Lo hace sobre la propia fila de la tarea, sin abrirla, sin confirmar nada en un diálogo y sin rellenar ningún campo. Puede hacerlo con cualquier tarea del espacio, sea suya o de otra persona, y puede moverla entre cualquiera de los tres estados en cualquier sentido.

**Why this priority**: Es el intercambio de valor entero del producto: si mantener el estado al día cuesta más que un gesto, deja de hacerse y la lista deja de responder «¿en qué anda cada uno?». El backlog la califica de «corazón del producto» (impacto alto) y la sitúa quinta en el orden priorizado, justo después de lo que hace falta para que existan tareas.

**Independent Test**: Con sesión iniciada y al menos una tarea en la lista, cambiarle el estado desde su fila y comprobar que la tarea queda guardada en el estado elegido —sigue ahí al recargar—, sin haber abierto la tarea, sin diálogo y sin campos; repetir con una tarea cuyo responsable es otra persona y con una vuelta atrás desde «Hecho».

**Acceptance Scenarios**:

1. **DADO** un miembro con sesión iniciada que ve en la lista una tarea en «Pendiente», **CUANDO** cambia su estado a «En curso» desde la propia fila, **ENTONCES** la tarea queda en «En curso», y para ello no ha abierto la tarea, no ha confirmado en ningún diálogo ni ha rellenado ningún campo. *(CA-1)*
2. **DADO** una tarea de la lista cuyo responsable es otra persona, **CUANDO** un miembro cambia su estado desde la lista, **ENTONCES** el cambio se aplica igual que en una tarea propia, sin pedir ningún permiso especial ni mostrar ninguna advertencia, y el responsable de la tarea no cambia. *(CA-2)*
3. **DADO** un miembro que va a cambiar el estado de una tarea desde la lista, **CUANDO** ve a qué estados puede cambiarla, **ENTONCES** los únicos destinos ofrecidos son «Pendiente», «En curso» y «Hecho», y no hay ninguna opción para crear, renombrar ni eliminar estados. *(CA-3, RF-8)*
4. **DADO** una tarea en cualquiera de los tres estados, **CUANDO** un miembro la cambia a cualquiera de los otros dos, **ENTONCES** el cambio se acepta, incluidos los saltos directos («Pendiente» → «Hecho») y las vueltas atrás («Hecho» → «En curso», «Hecho» → «Pendiente», «En curso» → «Pendiente»). *(decisión de producto que cierra PA-7)*
5. **DADO** cualquier cambio de estado completado, **CUANDO** se consulta la tarea, **ENTONCES** está en exactamente uno de los tres estados: el elegido. *(CA-3)*
6. **DADO** un intento de cambiar una tarea a un estado que no es ninguno de los tres, **CUANDO** el sistema lo recibe, **ENTONCES** lo rechaza con un mensaje comprensible en castellano y la tarea conserva el estado que tenía.
7. **DADO** una tarea que ya no existe (por ejemplo, porque se borró después de que el miembro cargara la lista), **CUANDO** el miembro intenta cambiar su estado, **ENTONCES** el sistema le avisa de que esa tarea ya no existe, en lugar de mostrar el cambio como aplicado.
8. **DADO** una persona sin sesión iniciada, **CUANDO** intenta cambiar el estado de una tarea, **ENTONCES** el cambio no se aplica y la tarea conserva su estado (comportamiento de la autenticación existente, sin cambios en este alcance).

---

### User Story 2 - El nuevo estado se ve al instante en la fila (Priority: P2)

Quien acaba de cambiar el estado de una tarea quiere ver el resultado reflejado en esa misma fila en el acto, sin recargar ni navegar, y poder fiarse de lo que ve: si el cambio no llegó a guardarse, la fila no debe seguir mostrándolo como hecho.

**Why this priority**: Cambiar el estado sin ver la confirmación inmediata no cierra el gesto — el miembro repetiría la acción o recargaría para comprobarla, y el coste de actualizar deja de ser «un gesto» (RNF-1, RNF-3). Depende de que exista la User Story 1, pero se puede verificar por separado.

**Independent Test**: Tras cambiar el estado de una tarea (User Story 1), comprobar que su fila muestra el nuevo estado de inmediato, sin recargar, y que la tarea sigue en la misma lista; provocar un fallo del cambio y comprobar que la fila vuelve a mostrar el estado anterior acompañado de un aviso.

**Acceptance Scenarios**:

1. **DADO** un miembro que acaba de cambiar el estado de una tarea desde la lista, **CUANDO** mira esa fila sin recargar la página ni navegar a otra pantalla, **ENTONCES** la fila muestra el nuevo estado.
2. **DADO** un miembro que acaba de pasar una tarea a «Hecho», **CUANDO** mira la lista, **ENTONCES** la tarea sigue visible en la lista mostrando «Hecho», de modo que puede volver a cambiarla desde ahí si se equivocó.
3. **DADO** un cambio de estado que el sistema rechaza o no llega a guardar (estado no válido, tarea inexistente, sesión caducada o fallo de conexión), **CUANDO** el miembro mira la fila, **ENTONCES** la fila muestra el estado que la tarea tiene realmente, no el que se intentó poner, y el miembro ve un mensaje comprensible en castellano que explica qué ha pasado.
4. **DADO** un miembro que cambia el estado de una tarea, **CUANDO** el nuevo estado aparece en la fila, **ENTONCES** el resto de la lista no se altera: las demás tareas conservan su estado, no se pierde la posición en la lista y cualquier texto a medio escribir en el formulario de creación se mantiene.

---

### Edge Cases

- **Dos personas cambian a la vez el estado de la misma tarea.** No hay bloqueo ni aviso de conflicto: prevalece el último cambio que se guarda. Que quien hizo el primer cambio vea el resultado del segundo sin recargar es un requisito de E3 (lista viva) y queda fuera de este alcance.
- **La misma persona cambia varias veces seguidas el estado de la misma tarea.** Al terminar, la tarea queda en el último estado elegido, y la fila muestra ese mismo estado.
- **Elegir como destino el estado que la tarea ya tiene.** No es un error: la tarea sigue en ese estado y no se muestra ningún mensaje de fallo.
- **La sesión caduca con la lista abierta.** El cambio no se aplica y la fila no lo muestra como aplicado; se actúa como en cualquier otra acción sin sesión válida de la autenticación existente.
- **La tarea se borró o ya no existe.** Se avisa de que no existe (User Story 1, escenario 7); el aviso no debe confundirse con un error de conexión ni con un estado no válido.
- **El estado pedido no es uno de los tres** (solo alcanzable desde fuera de la interfaz, ya que la interfaz solo ofrece los tres). Se rechaza con un mensaje comprensible y la tarea conserva su estado (User Story 1, escenario 6).
- **Uso sin ratón.** El cambio de estado debe poder completarse entero con el teclado (RNF-6).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a cualquier miembro con sesión iniciada cambiar el estado de cualquier tarea del espacio compartido directamente desde la fila de esa tarea en la lista, sin abrir la tarea, sin diálogo de confirmación y sin rellenar ningún campo.
- **FR-002**: El cambio de estado DEBE completarse en 2 interacciones o menos desde la lista visible, contadas como se define en Assumptions (RF-9, RNF-1).
- **FR-003**: El sistema DEBE aplicar el cambio de estado sobre cualquier tarea con independencia de quién sea su responsable o quién la creó, sin pedir permisos especiales ni mostrar advertencias por tratarse de una tarea ajena.
- **FR-004**: El cambio de estado NO DEBE modificar ningún otro dato de la tarea: título y responsable quedan como estaban.
- **FR-005**: Los únicos estados de destino ofrecidos DEBEN ser «Pendiente», «En curso» y «Hecho». El producto NO DEBE ofrecer ninguna vía para crear, renombrar ni eliminar estados (RF-8).
- **FR-006**: El sistema DEBE aceptar cualquier transición entre los tres estados, en cualquier sentido, incluidas las vueltas atrás desde «Hecho» y los saltos directos entre «Pendiente» y «Hecho».
- **FR-007**: Tras cualquier cambio de estado, la tarea DEBE estar en exactamente uno de los tres estados.
- **FR-008**: El sistema DEBE rechazar un cambio a un estado que no sea uno de los tres, informar con un mensaje comprensible en castellano, y dejar la tarea en el estado que tenía.
- **FR-009**: Si la tarea cuyo estado se intenta cambiar ya no existe, el sistema DEBE avisar de que no existe y NO DEBE presentar el cambio como aplicado.
- **FR-010**: El sistema NO DEBE permitir cambiar el estado de ninguna tarea a una persona sin sesión iniciada, reutilizando el mecanismo de autenticación existente sin modificarlo.
- **FR-011**: El nuevo estado DEBE reflejarse en la fila de la tarea de inmediato para quien hizo el cambio, sin recargar la página ni navegar a otra pantalla (RF-9, RNF-3).
- **FR-012**: Si el cambio no llega a guardarse, por el motivo que sea, la fila DEBE terminar mostrando el estado real de la tarea y el miembro DEBE ver un mensaje comprensible en castellano, sin errores técnicos crudos (RNF-8, RNF-10). En ningún caso la lista debe mostrar como guardado un estado que no se guardó.
- **FR-013**: Una tarea que pasa a «Hecho» DEBE seguir visible en la lista, mostrando su nuevo estado y pudiendo cambiarse de nuevo desde ahí.
- **FR-014**: Cambiar el estado de una tarea NO DEBE alterar el resto de la lista: ni el estado de las demás tareas, ni la posición de lectura, ni el texto a medio escribir en la creación de tareas.
- **FR-015**: El cambio de estado DEBE poder completarse íntegramente con el teclado (RNF-6), y su presentación DEBE plegarse al estilo visual ya existente en la lista (R-8).

*Fuera de alcance de esta especificación* (pertenecen a otras historias del backlog de E2/E3, ya identificadas): filtrar la lista por estado y ocultar lo hecho de la vista por defecto (FS-142, RF-20, RF-21), fecha de vencimiento (FS-118), abrir la tarea (E2-5), editar el título (E2-6), reasignar el responsable (E2-7), borrar la tarea (E2-10), y reflejar en la lista de un miembro los cambios de estado hechos por otra persona sin recargar (E3-2).

### Key Entities

- **Tarea**: la unidad de trabajo del espacio compartido. Para esta especificación, el único atributo que cambia es su **estado**; título y responsable se muestran pero no se modifican.
- **Estado**: catálogo cerrado de exactamente tres valores —«Pendiente», «En curso» y «Hecho»—, sin orden obligatorio entre ellos a efectos de transición: desde cualquiera se puede ir a cualquier otro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro cambia el estado de cualquier tarea visible en la lista en 2 interacciones o menos, sin abrir la tarea, sin diálogo de confirmación y con 0 campos que rellenar.
- **SC-002**: El 100% de los cambios de estado aceptados se ven en la fila de quien los hizo en menos de 1 segundo, sin recargar la página.
- **SC-003**: Las 6 transiciones posibles entre los tres estados (incluidas las 2 que salen de «Hecho») se completan con éxito, tanto sobre tareas propias como ajenas.
- **SC-004**: El 100% de los intentos de cambiar a un estado que no es uno de los tres, o de cambiar una tarea que ya no existe, se rechazan con un mensaje comprensible, y en ninguno de ellos cambia el estado guardado de la tarea.
- **SC-005**: En 0 casos la lista termina mostrando como guardado un estado que no se guardó.
- **SC-006**: El cambio de estado se completa de principio a fin usando solo el teclado.

## Assumptions

- **Qué cuenta como interacción** (PA-9, abierto en el PRD para RF-9/RNF-1): una interacción es una activación deliberada —un clic, un toque o una pulsación de tecla que selecciona o confirma—; mover el puntero o desplazarse por la lista no cuenta. Con esa definición, el cambio de estado cabe en 2 interacciones o menos (por ejemplo, desplegar los destinos y elegir uno). La forma concreta del control se decide en el plan.
- **Las tareas en «Hecho» siguen en la lista en este cambio.** RF-21 (lo hecho sale de la vista por defecto) está trazado a FS-142 junto con el filtro por estado, que es su camino de vuelta, y ambos llegan después. Ocultar lo hecho sin ese camino dejaría la vuelta atrás desde «Hecho» sin forma de hacerse desde la lista; por eso aquí la tarea permanece visible mostrando «Hecho».
- **La decisión sobre transiciones cierra PA-7** para efectos de esta especificación: todas las transiciones entre los tres estados son válidas y no hay confirmación extra para marcar como hecho. El riesgo de marcar algo como hecho por error se mitiga porque la tarea sigue visible y se puede devolver con el mismo gesto.
- **Concurrencia**: con dos cambios simultáneos sobre la misma tarea prevalece el último que se guarda, sin aviso de conflicto. La colisión con ediciones o borrados ajenos (PA-8) no se resuelve aquí; solo se exige que borrar una tarea antes de cambiarle el estado produzca el aviso de «ya no existe».
- **La lista de tareas ya existe** (E3-1/E2-1, `specs/001-crear-tarea/`) y ya muestra título, responsable y estado de cada tarea; este cambio añade la posibilidad de cambiar el estado sobre ella, no una pantalla nueva.
- **Cualquier miembro del espacio único compartido** puede cambiar el estado de cualquier tarea: no existen roles ni propiedad que lo restrinjan (roles planos del PRD).
- **Los textos exactos** de los mensajes (estado no válido, tarea inexistente, fallo al guardar) se redactan en el plan, en castellano y con el tono de los mensajes ya existentes; esta especificación solo exige que existan, se distingan entre sí y sean comprensibles.
- **Sin dependencias nuevas** y sin tocar la autenticación: el cambio se construye con lo que ya hay en el proyecto.
