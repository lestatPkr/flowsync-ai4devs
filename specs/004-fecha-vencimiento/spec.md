# Feature Specification: Fecha de vencimiento y tareas vencidas

**Feature Branch**: `feat/fs-118-fecha-vencimiento-dry-run`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Nombre corto de la feature: fecha-vencimiento. Historia FS-118 del backlog de FlowSync (docs/backlog/E2-gestion-tareas/us-fechas-vencimiento.md; épica E2 «Gestión de tareas»; es la historia con cinco tickets, de la migración a las pruebas): «Como miembro del equipo, quiero poner o quitar una fecha de vencimiento al abrir una tarea y ver si se ha pasado de plazo, para comprometerme con una fecha solo cuando de verdad existe y no descubrir tarde que se me ha pasado.» Requisitos del PRD (docs/prd/flowsync-mvp.md) que cubre, a nivel producto: RF-13, la fecha de vencimiento es opcional y crear una tarea sin fecha es el camino por defecto; RF-14, una tarea está vencida si y solo si tiene fecha de vencimiento anterior al día actual Y su estado no es «Hecho»; RF-15, el vencimiento se ve al abrir la tarea y no en la vista principal de la lista. Criterios de la historia: CA-1 a CA-17, CA-19 y CA-20 (CA-18 queda fuera con la reasignación). Fuera de alcance: recordatorios o avisos de vencimiento, ordenar o filtrar por fecha, mostrar la fecha en la lista, reasignar (E2-7), editar el título (E2-6), borrar (E2-10) y ver en vivo cambios de otras personas (E3). Restricciones que la spec respeta sin bajar a lo técnico: la autenticación ya existe y no se toca; espacio único compartido; ninguna dependencia nueva; el estilo visual existente; la vista de la tarea ya existe (specs/003-abrir-tarea)."

## Clarifications

### Session 2026-09-30

- Q: Al vaciar el campo de fecha de una tarea abierta, ¿eso cuenta como quitar la fecha, o quitarla exige una acción explícita? → A: Ambas: hay una acción explícita «Quitar fecha» y, además, vaciar el campo equivale a quitarla; solo una fecha a medio escribir es un error.
- Q: ¿Las fechas de vencimiento admitidas tienen límites, o vale cualquier fecha real por lejana que sea? → A: Sin ventana ni tope: solo se rechaza una fecha imposible o mal formada, con un mensaje junto al campo y conservando la fecha que tuviera la tarea; cualquier fecha real y bien formada se acepta, también las pasadas.
- Q: ¿Qué es una fecha de vencimiento y de dónde sale el «hoy» con el que se decide si está vencida? → A: La fecha es un día natural, sin hora ni zona horaria. El «hoy» es el de quien mira y acompaña cada consulta de la tarea; si no llega, el sistema usa su propio día en UTC, y ese comportamiento queda documentado.
- Q: ¿Dónde se ve y se cambia la fecha, quién puede hacerlo y hay avisos de vencimiento? → A: Solo en la vista de la tarea (la lista no la muestra ni la marca); cualquier miembro puede ponerla o quitarla en cualquier tarea, sin permiso ni aviso; y no hay recordatorios ni avisos: solo la señal al abrir la tarea. *(Confirma lo que la spec ya recogía.)*
- Q: ¿La señal de vencida dice solo que la tarea está vencida o también cuánto tiempo lleva así? → A: Solo que está vencida, junto a la fecha; sin cuenta de días. *(Decidido como supuesto explícito: la persona indicó que lo no cubierto por sus decisiones se resuelva así.)*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Poner y quitar la fecha al abrir la tarea (Priority: P1)

Un miembro del equipo, con sesión iniciada, abre una tarea desde la lista (la vista de E2-5, que ya existe) y le pone una fecha de vencimiento cuando de verdad existe un compromiso; si deja de existir, se la quita. Lo hace sobre cualquier tarea del espacio, sea suya o de otra persona. El cambio se ve al instante y queda guardado sin ningún paso de guardado; quitar la fecha no pide confirmación. Crear una tarea sigue siendo solo escribir el título: la fecha no se ofrece ni se sugiere al crear.

**Why this priority**: Sin poder poner y quitar la fecha no hay nada sobre lo que calcular el vencimiento; es la base de toda la historia. Por sí sola ya aporta valor: la fecha queda anotada en la tarea y cualquiera que la abra la ve.

**Independent Test**: Con sesión iniciada, crear una tarea y comprobar que no se ofrece fecha; abrirla, ponerle una fecha, cerrar y volver a abrir (o recargar) y comprobar que la fecha sigue ahí; cambiarla por otra; quitarla y comprobar que queda sin fecha, sin diálogo; repetir sobre una tarea cuyo responsable es otra persona; intentar una fecha imposible y comprobar que se rechaza junto al campo y que la tarea conserva la fecha que tenía.

**Acceptance Scenarios**:

1. **DADO** un miembro que va a crear una tarea nueva, **CUANDO** escribe el título y la crea, **ENTONCES** la tarea queda sin fecha de vencimiento **Y** en ningún momento del flujo de creación se le ofrece ni se le sugiere ponerle una. *(CA-1, RF-13)*
2. **DADO** una tarea sin fecha de vencimiento, **CUANDO** un miembro la abre y le indica una fecha, **ENTONCES** la tarea queda con esa fecha **Y** la ve reflejada al instante, sin recargar ni volver a abrirla. *(CA-2)*
3. **DADO** una tarea con fecha de vencimiento, **CUANDO** un miembro la abre y le indica otra fecha, **ENTONCES** la tarea queda con la nueva fecha y deja de tener la anterior. *(CA-2)*
4. **DADO** una tarea con fecha de vencimiento, **CUANDO** un miembro la abre y se la quita con la acción explícita de quitar la fecha, **ENTONCES** la tarea vuelve a no tener fecha **Y** el cambio se aplica directamente, sin diálogo de confirmación. *(CA-3, CA-15)*
5. **DADO** una tarea con fecha de vencimiento, **CUANDO** un miembro la abre y vacía por completo el campo de la fecha, **ENTONCES** la tarea vuelve a no tener fecha, igual que con la acción explícita, sin diálogo de confirmación y sin ningún mensaje de error. *(CA-3, CA-15; aclaración 2026-09-30)*
6. **DADO** un miembro que ha puesto, cambiado o quitado la fecha de una tarea, **CUANDO** cierra la tarea y la vuelve a abrir, o recarga, **ENTONCES** ve la fecha tal como la dejó, sin haber hecho ningún paso extra de guardado. *(CA-16)*
7. **DADO** una tarea cuyo responsable es otra persona, **CUANDO** un miembro la abre y le pone, cambia o quita la fecha, **ENTONCES** el cambio se aplica sin advertencia, sin aviso de que es ajena y sin permiso especial, igual que sobre una tarea propia. *(CA-17)*
8. **DADO** una tarea abierta, **CUANDO** un miembro le pone una fecha anterior a hoy, **ENTONCES** el sistema la acepta sin impedírselo **Y** la tarea pasa a mostrarse vencida de inmediato. *(CA-13)*
9. **DADO** una tarea abierta, con o sin fecha, **CUANDO** un miembro intenta indicarle una fecha que no existe o que está a medio escribir (con parte de la fecha indicada y parte sin indicar), **ENTONCES** la tarea conserva la fecha que tuviera antes (o sigue sin fecha) **Y** se le explica el problema junto al propio campo, en castellano y en lenguaje corriente. *(CA-14)*

---

### User Story 2 - Saber si una tarea está vencida (Priority: P2)

Quien abre una tarea quiere saber, sin hacer cuentas, si se ha pasado de plazo. La vista lo dice con una señal propia —no basta con mostrar la fecha y dejar que cada cual la compare con el calendario—. La regla es una sola: una tarea está vencida si y solo si tiene fecha de vencimiento, esa fecha es anterior al día de hoy de quien mira, y la tarea no está en «Hecho». El vencimiento se decide cada vez que alguien mira, así que una tarea vence sola al pasar la medianoche, y dos personas en husos distintos pueden verla de forma distinta durante unas horas, ambas correctamente.

**Why this priority**: Es el motivo por el que la fecha existe —«no descubrir tarde que se me ha pasado»—, pero depende de la User Story 1: sin fecha no hay nada que vencer. Es también donde están los bordes que más fácilmente se rompen (el día de más, el huso, el paso del tiempo).

**Independent Test**: Preparar tareas no hechas con fecha de ayer, de hoy, de mañana y sin fecha, y una tarea hecha con fecha de ayer; abrir cada una y comprobar que solo la no hecha con fecha de ayer muestra la señal de vencida; pasar a «Hecho» la vencida y comprobar que deja de estarlo y que la fecha no cambia; aplazarla a una fecha futura y comprobar que deja de estar vencida; repetir la lectura con dos días de referencia distintos para comprobar el caso de los husos, y dejar pasar la medianoche de quien mira para comprobar que una tarea con fecha de hoy aparece vencida sin que nadie la toque.

**Acceptance Scenarios**:

*La señal y los cuatro bordes de la regla (RF-14):*

1. **DADO** una tarea con fecha anterior a hoy y que no está hecha, **CUANDO** un miembro la abre, **ENTONCES** se le indica explícitamente que está vencida, con una señal propia, sin que tenga que comparar la fecha con el día de hoy. *(CA-4, RF-15)*
2. **DADO** una tarea no hecha cuya fecha de vencimiento es el **día anterior** al de hoy de quien mira, **CUANDO** la abre, **ENTONCES** se muestra como vencida. *(borde: día anterior)*
3. **DADO** una tarea no hecha cuya fecha de vencimiento es el **mismo día** que el de hoy de quien mira, **CUANDO** la abre, **ENTONCES** no se muestra como vencida, porque la regla exige que la fecha sea **anterior** al día actual. *(borde: mismo día, CA-5)*
4. **DADO** una tarea no hecha cuya fecha de vencimiento es el **día posterior** al de hoy de quien mira, o cualquier otro día futuro, **CUANDO** la abre, **ENTONCES** no se muestra como vencida. *(borde: día posterior, CA-6)*
5. **DADO** una tarea **sin fecha**, creada hace semanas y todavía pendiente, **CUANDO** un miembro la abre, **ENTONCES** no se muestra como vencida, por antigua que sea. *(borde: sin fecha, CA-7)*

*Cómo se sale del vencimiento:*

6. **DADO** una tarea vencida, **CUANDO** un miembro la pasa a «Hecho» y después la abre, **ENTONCES** ya no se muestra como vencida **Y** conserva su fecha de vencimiento sin ningún cambio. *(CA-8)*
7. **DADO** una tarea en «Hecho» cuya fecha ya pasó, **CUANDO** un miembro la abre, **ENTONCES** no se muestra como vencida. *(CA-9)*
8. **DADO** una tarea vencida, **CUANDO** un miembro le cambia la fecha a una posterior a hoy, **ENTONCES** deja de mostrarse como vencida, al instante. *(CA-10)*
9. **DADO** una tarea vencida, **CUANDO** un miembro le quita la fecha, **ENTONCES** deja de mostrarse como vencida, al instante. *(CA-3)*
10. **DADO** una tarea en «Hecho» con fecha anterior a hoy, **CUANDO** un miembro la devuelve a «Pendiente» o «En curso» y después la abre, **ENTONCES** vuelve a mostrarse como vencida, porque cumple de nuevo la regla. *(consecuencia de RF-14 y de la decisión de E2-4 que permite volver atrás desde «Hecho»)*

*El día de referencia es el de quien mira:*

11. **DADO** una tarea no hecha cuya fecha ya pasó para quien mira desde un huso, pero es todavía hoy para quien mira desde otro, **CUANDO** ambas personas la abren a la vez, **ENTONCES** la primera la ve vencida y la segunda no **Y** las dos lecturas son correctas: el día de referencia es el de quien mira. *(CA-19, dos husos)*
12. **DADO** una tarea no hecha con fecha de hoy, que por tanto no se muestra como vencida, **CUANDO** pasa la medianoche en el huso de quien mira y esa persona vuelve a abrirla, **ENTONCES** aparece como vencida, sin que nadie haya modificado nada en ella. *(CA-20)*

---

### User Story 3 - Lo que la lista no muestra (Priority: P3)

La lista principal sigue siendo lo que era: título, responsable y estado. La fecha y el vencimiento viven solo dentro de la tarea abierta. Tampoco se castiga no tener fecha: una tarea sin fecha es un estado normal y no genera ningún aviso, recordatorio ni marca.

**Why this priority**: No añade capacidad nueva —protege lo que la historia deliberadamente no hace (RF-15)—. Se rompe con facilidad al construir las historias anteriores, por eso se especifica y se prueba por separado.

**Independent Test**: Con tareas sin fecha, con fecha futura y vencidas en la lista, mirar la lista y comprobar que ninguna muestra fecha ni marca de vencimiento; abrir una tarea sin fecha y comprobar que no aparece ningún aviso ni indicación de que le falte algo.

**Acceptance Scenarios**:

1. **DADO** una lista con tareas con fecha, algunas de ellas vencidas, **CUANDO** un miembro mira la lista principal, **ENTONCES** no ve ninguna fecha ni ninguna marca de vencimiento en ninguna tarea. *(CA-11, RF-15)*
2. **DADO** una tarea sin fecha, **CUANDO** un miembro la ve en la lista o la abre, **ENTONCES** no recibe ningún aviso, recordatorio ni señal de que le falte algo. *(CA-12, RF-13)*
3. **DADO** un miembro que pone, cambia o quita la fecha de una tarea y vuelve a la lista, **CUANDO** mira la fila de esa tarea, **ENTONCES** la fila no ha cambiado: sigue mostrando solo su título, su responsable y su estado. *(CA-11)*

---

### Edge Cases

- **El cambio de fecha no llega a guardarse** (por ejemplo, un fallo de conexión). La vista no sigue mostrando como guardada una fecha que no lo está: vuelve a la que había y explica, en castellano, que no se ha podido guardar y qué hacer. Lo mismo al quitar la fecha.
- **La tarea se borra mientras alguien la tiene abierta e intenta cambiarle la fecha.** Se avisa de que la tarea ya no existe y se ofrece volver a la lista, en vez de fingir que el cambio se aplicó (mismo trato que en E2-4 y E2-5).
- **Dos personas cambian a la vez la fecha de la misma tarea.** No hay bloqueo ni aviso de conflicto: prevalece el último cambio que se guarda, como en el cambio de estado (E2-4). Qué ve quien pierde el cambio sin recargar es PA-8 y requiere lista viva (E3): queda fuera.
- **La sesión caduca con la tarea abierta.** Un intento de cambiar la fecha sin sesión no se aplica, y se actúa como en cualquier otra pantalla protegida de la autenticación existente.
- **Una consulta llega sin el día de quien mira.** El vencimiento se decide con el día del propio sistema en UTC, como red de seguridad documentada (FR-011); la regla es la misma, solo cambia el día de referencia.
- **La tarea sigue abierta mientras pasa la medianoche.** Lo exigible es que al volver a abrirla o recargar se aplique el día nuevo (User Story 2, escenario 12); que la señal cambie sola sin que quien mira haga nada no forma parte de este alcance.
- **Poner la misma fecha que ya tenía.** No es un error: la tarea queda igual, sin avisos.
- **Fecha muy lejana en el pasado o en el futuro, pero real.** Se acepta como cualquier otra fecha real; solo se rechazan fechas que no existen o están a medio escribir.
- **Una tarea en «Hecho» sin fecha o con fecha futura.** Se abre igual que cualquier otra y no muestra señal de vencida.
- **Una tarea con fecha de hoy.** No se muestra como vencida ni lleva ningún aviso intermedio del tipo «vence hoy»: la única señal que añade esta historia es la de vencida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El flujo de creación de tareas NO DEBE contener ni sugerir la fecha de vencimiento; toda tarea recién creada DEBE quedar sin fecha (RF-13).
- **FR-002**: Al abrir una tarea (la vista de E2-5), un miembro con sesión iniciada DEBE poder ponerle una fecha de vencimiento, cambiarla por otra y quitarla.
- **FR-003**: La vista de una tarea DEBE mostrar su fecha de vencimiento cuando la tiene, y mostrar sin marca ni aviso que no la tiene cuando no la tiene.
- **FR-004**: Poner, cambiar o quitar la fecha DEBE reflejarse en la vista al instante, sin recargar ni volver a abrir la tarea, y DEBE quedar guardado sin ningún paso de guardado adicional.
- **FR-005**: Quitar la fecha DEBE poder hacerse de dos formas equivalentes: con una acción explícita de quitar la fecha, y vaciando por completo el campo de la fecha. Ninguna de las dos DEBE pedir confirmación ni mostrar un error.
- **FR-006**: El sistema DEBE aceptar como fecha de vencimiento cualquier fecha de calendario real y bien formada, incluidas las anteriores a hoy, sin ninguna ventana ni tope de años hacia el pasado o hacia el futuro.
- **FR-007**: El sistema DEBE rechazar una fecha que no existe o que está a medio escribir (parte indicada y parte sin indicar; un campo vacío del todo no es esto, sino quitar la fecha según FR-005), explicando el problema junto al propio campo, en castellano y en lenguaje corriente; tras el rechazo, la tarea DEBE conservar la fecha que tuviera antes, o seguir sin fecha si no la tenía.
- **FR-008**: Si un cambio de fecha no llega a guardarse por un motivo distinto de una fecha inválida, la vista NO DEBE mostrarlo como guardado: DEBE volver a la fecha anterior y explicar, en castellano, que no se pudo guardar y qué hacer, sin errores técnicos crudos (RNF-8, RNF-10).
- **FR-009**: Cualquier miembro DEBE poder poner, cambiar o quitar la fecha de cualquier tarea, con independencia de quién sea su responsable o quién la creó, sin advertencias ni permisos especiales.
- **FR-010**: Una tarea DEBE considerarse vencida si y solo si tiene fecha de vencimiento, esa fecha es anterior al día de hoy de quien mira, y su estado no es «Hecho» (RF-14). En cualquier otro caso —sin fecha, fecha de hoy, fecha futura o estado «Hecho»— NO DEBE considerarse vencida.
- **FR-011**: El día de referencia para decidir el vencimiento DEBE ser el día de hoy de la persona que mira, que acompaña cada consulta de la tarea. Si ese día no llega, el sistema DEBE usar su propio día en UTC, y ese comportamiento DEBE quedar documentado.
- **FR-012**: El vencimiento DEBE decidirse en el momento de mirar, no en el de guardar: una tarea DEBE pasar a vencida por el mero avance del día, sin que nadie la modifique, y dejar de estarlo en cuanto cambian la fecha o el estado que la hacían vencer.
- **FR-013**: Al abrir una tarea vencida, la vista DEBE indicarlo con una señal propia y explícita, distinta de la mera fecha, de modo que quien mira no tenga que comparar la fecha con el día de hoy (RF-15). La señal NO DEBE depender solo del color (RNF-6), DEBE limitarse a decir que la tarea está vencida —sin contar cuántos días lleva así— y DEBE mostrarse junto a la fecha de vencimiento.
- **FR-014**: Pasar una tarea a «Hecho» NO DEBE modificar su fecha de vencimiento.
- **FR-015**: La lista principal NO DEBE mostrar fechas de vencimiento ni marcas de vencimiento en ninguna tarea (RF-15).
- **FR-016**: El producto NO DEBE emitir ningún aviso, recordatorio ni señal por el hecho de que una tarea no tenga fecha.
- **FR-017**: El sistema NO DEBE permitir poner, cambiar ni quitar la fecha de una tarea a una persona sin sesión iniciada, reutilizando la autenticación existente sin modificarla.
- **FR-018**: Si la tarea ya no existe cuando se intenta cambiar su fecha, el sistema DEBE decir que ya no existe y ofrecer volver a la lista, sin fingir que el cambio se aplicó.
- **FR-019**: Poner, cambiar y quitar la fecha DEBEN poder hacerse íntegramente con el teclado (RNF-6).
- **FR-020**: Los controles, la señal de vencida y los mensajes DEBEN plegarse al estilo visual existente (R-8), y todos sus textos DEBEN estar en castellano (RNF-8).

*Fuera de alcance de esta especificación*: recordatorios o avisos de vencimiento; ordenar o filtrar por fecha; mostrar la fecha o el vencimiento en la lista; reasignar el responsable (E2-7), y con ello CA-18 de la historia («reasignar no toca la fecha»); editar el título (E2-6); borrar la tarea (E2-10); cambiar el estado desde la vista de la tarea (se sigue cambiando desde la lista, E2-4); qué ve quien pierde un cambio simultáneo (PA-8), y reflejar sin recargar los cambios hechos por otras personas (E3).

### Key Entities

- **Tarea**: la unidad de trabajo del espacio compartido. Gana un dato opcional, su **fecha de vencimiento**; conserva su título, su responsable, su estado («Pendiente», «En curso» o «Hecho») y su momento de creación.
- **Fecha de vencimiento**: un día natural (día, mes y año), sin hora ni zona horaria, opcional. Es la misma para todas las personas que miran la tarea; lo que cambia de una persona a otra es su «hoy».
- **Condición de vencida**: no es un dato que se guarde, sino una lectura que se hace cada vez que alguien mira la tarea, a partir de su fecha de vencimiento, su estado y el día de hoy de quien mira.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con la tarea abierta, un miembro pone, cambia o quita la fecha en 3 interacciones o menos, y en 0 casos tiene que dar un paso de guardado aparte.
- **SC-002**: En el 100% de los cambios de fecha guardados, al volver a abrir la tarea o recargar se ve exactamente la fecha que se dejó (o ninguna, si se quitó).
- **SC-003**: En el 100% de los casos de la matriz de la regla —día anterior, mismo día, día posterior, sin fecha, y cada uno de ellos en «Hecho»—, la señal de vencida aparece solo en el caso «día anterior y no hecha», y en 0 casos más.
- **SC-004**: Quien abre una tarea vencida identifica que lo está sin consultar el calendario ni comparar fechas: la señal está presente en el 100% de las tareas vencidas y en 0 de las no vencidas.
- **SC-005**: En 0 casos pasar una tarea a «Hecho» altera su fecha de vencimiento.
- **SC-006**: En 0 casos una fecha inexistente o a medio escribir queda guardada, y en el 100% de esos intentos la tarea conserva su fecha anterior y el mensaje aparece junto al campo.
- **SC-007**: Con dos días de referencia distintos sobre la misma tarea, cada lectura coincide con la regla aplicada a su propio día en el 100% de los casos.
- **SC-008**: Una tarea con fecha de hoy aparece vencida al primer vistazo tras la medianoche de quien mira, en el 100% de los casos, sin que nadie la haya modificado.
- **SC-009**: En 0 casos la lista principal muestra una fecha de vencimiento o una marca de vencimiento, y en 0 casos una tarea sin fecha genera un aviso.
- **SC-010**: Poner, cambiar y quitar la fecha se completa usando solo el teclado.

## Assumptions

- **CA-4, CA-13, CA-14, CA-15, CA-16, CA-17 y CA-20 se dan por validados.** En el backlog aparecen como **[PROPUESTO]**; esta especificación los adopta tal como vienen en la entrada. Si alguno se descarta en la validación, la spec se revisa antes del plan.
- **La fecha de vencimiento es un día, no un instante.** Se indica y se guarda como día del calendario, sin hora, y todas las personas ven la misma fecha. El huso solo interviene en qué día es «hoy» para cada una.
- **«Hoy» es el día de quien mira, y viaja con cada consulta** (aclaración 2026-09-30, en línea con el [SUPUESTO] de RF-14 del PRD). No hay huso de equipo ni ajuste guardado por persona. Si una consulta llega sin ese día, se usa el día del propio sistema en UTC; es una red de seguridad documentada, no el camino normal, y con ella una persona lejos de UTC puede ver durante unas horas una lectura distinta de la que vería con su propio día.
- **El vencimiento se lee al abrir o recargar la tarea.** Ahí se aplica el día de hoy vigente; que la señal cambie sola mientras la tarea permanece abierta al cruzar la medianoche no se exige.
- **Volver atrás desde «Hecho» está permitido** (decisión de E2-4, `specs/002-cambiar-estado/`, que cierra PA-7): una tarea que vuelve a «Pendiente» o «En curso» con fecha pasada vuelve a estar vencida por la propia regla. El pendiente que el backlog anotaba para este caso queda así resuelto.
- **El estado se sigue cambiando desde la lista** (E2-4). CA-8 se cumple pasando la tarea a «Hecho» desde la lista y abriéndola después; esta historia no añade el cambio de estado a la vista de la tarea.
- **Concurrencia**: con dos cambios de fecha simultáneos sobre la misma tarea prevalece el último que se guarda, sin aviso de conflicto, igual que en E2-4. PA-8 no se resuelve aquí.
- **Qué cuenta como interacción**: la definición de E2-4 para PA-9 — una activación deliberada (un clic, un toque o una pulsación de tecla que selecciona o confirma); mover el puntero o desplazarse no cuenta.
- **Cómo se presenta la fecha**: como fecha absoluta en castellano (día, mes y año), no relativa («dentro de 3 días»), en coherencia con cómo E2-5 muestra cuándo se creó la tarea. El formato exacto se fija en el plan.
- **Qué es una fecha «mal formada»**: la que no se puede leer como un día concreto del calendario. La forma exacta en que se escribe una fecha —y, con ella, qué cuenta como mal formada— se fija en el plan; la spec solo exige que no haya ventana ni tope de años más allá de eso (aclaración 2026-09-30).
- **Una única señal nueva, sin cuenta de días.** La historia añade la señal de «vencida», que dice solo eso, junto a la fecha; no cuenta cuántos días lleva vencida ni hay avisos intermedios («vence hoy», «vence pronto»), que serían recordatorios y están fuera de alcance (aclaración 2026-09-30, decidida como supuesto).
- **Los textos exactos** de la señal de vencida y de los mensajes (fecha inválida, no se pudo guardar) se redactan en el plan, en castellano y con el tono de los mensajes ya existentes.
- **La vista de la tarea ya existe** (`specs/003-abrir-tarea/`) y hasta ahora era solo de consulta; este cambio le añade la primera edición —la de la fecha—, sin rehacerla ni tocar lo que ya muestra.
- **Espacio único compartido y roles planos** (PRD, R-4): cualquier miembro puede tocar la fecha de cualquier tarea; no hay propiedad ni permisos que lo restrinjan.
- **Sin dependencias nuevas** y sin tocar la autenticación: el cambio se construye con lo que ya hay en el proyecto.
