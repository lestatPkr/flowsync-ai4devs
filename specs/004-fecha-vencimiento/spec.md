# Feature Specification: Fecha de vencimiento y tareas vencidas

**Feature Branch**: `feat/fs-118-fecha-vencimiento`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Nombre corto de la feature: fecha-vencimiento. Historia FS-118 del backlog de FlowSync (docs/backlog/E2-gestion-tareas/us-fechas-vencimiento.md; épica E2 «Gestión de tareas»; es la historia con cinco tickets, de la migración a las pruebas): «Como miembro del equipo, quiero poner o quitar una fecha de vencimiento al abrir una tarea y ver si se ha pasado de plazo, para comprometerme con una fecha solo cuando de verdad existe y no descubrir tarde que se me ha pasado.» Requisitos del PRD (docs/prd/flowsync-mvp.md) que cubre, a nivel producto: RF-13, la fecha de vencimiento es opcional y crear una tarea sin fecha es el camino por defecto; RF-14, una tarea está vencida si y solo si tiene fecha de vencimiento anterior al día actual Y su estado no es «Hecho»; RF-15, el vencimiento se ve al abrir la tarea y no en la vista principal de la lista. Criterios de la historia: CA-1 crear sin fecha es el camino por defecto y el flujo de creación no la ofrece ni la sugiere; CA-2 la fecha se pone al abrir la tarea (la vista de E2-5, que ya existe) y se ve reflejada al instante; CA-3 quitar la fecha la deja sin fecha y deja de estar vencida si lo estaba; CA-4 al abrir una tarea vencida se indica explícitamente que lo está, con una señal propia, sin que haya que comparar la fecha con hoy; CA-5 vencer hoy todavía no es estar vencida, la regla exige que la fecha sea anterior al día de hoy; CA-6 una fecha futura nunca está vencida; CA-7 sin fecha no se vence nunca, por antigua que sea la tarea; CA-8 pasarla a «Hecho» la deja de vencer y conserva la fecha sin cambios; CA-9 una tarea hecha con la fecha pasada no está vencida; CA-10 aplazar la fecha a una posterior a hoy resuelve el vencimiento; CA-11 la fecha y la marca de vencida no asoman en la lista; CA-12 no tener fecha no se penaliza con ningún aviso; CA-13 poner una fecha que ya pasó está permitido y la tarea pasa a mostrarse vencida; CA-14 una fecha imposible o mal formada se rechaza con un mensaje junto al campo y la tarea conserva la fecha que tuviera; CA-15 quitar la fecha no pide confirmación; CA-16 el cambio se guarda solo, sin paso de guardado; CA-17 cualquiera puede poner o quitar la fecha de cualquier tarea; CA-19 cada persona ve el vencimiento según su propio día: el día de referencia es el de quien mira, y dos personas en husos distintos pueden ver la misma tarea una vencida y la otra no, ambas correctamente; CA-20 una tarea vence sola al pasar la medianoche de quien mira, sin que nadie la modifique: el vencimiento se decide en el momento de mirar, no se congela al guardar. Fuera de alcance: recordatorios o avisos de vencimiento, ordenar o filtrar por fecha, mostrar la fecha en la lista, reasignar (E2-7), editar el título (E2-6), borrar (E2-10) y ver en vivo cambios de otras personas (E3). Restricciones que la spec respeta sin bajar a lo técnico: la autenticación ya existe y no se toca; espacio único compartido; ninguna dependencia nueva; el estilo visual existente; la vista de la tarea ya existe (specs/003-abrir-tarea). Escribe la spec en español, con los escenarios de aceptación en DADO / CUANDO / ENTONCES, prioriza las historias (P1 poner y quitar la fecha al abrir la tarea, P2 saber si está vencida, con la regla completa y sus bordes, P3 lo que la lista no muestra), incluye como escenarios explícitos los cuatro bordes de la regla (día anterior, mismo día, día posterior, sin fecha) y el de los dos husos, y marca como [NEEDS CLARIFICATION] solo lo que de verdad quede abierto; lo demás, como supuesto explícito."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Poner, cambiar y quitar la fecha al abrir la tarea (Priority: P1)

Un miembro del equipo, con sesión iniciada, abre una tarea desde la lista (la vista de E2-5) porque hay una fecha real con la que comprometerse. Le pone esa fecha, la ve reflejada en el acto y cierra la tarea sin buscar ningún botón de guardar: el cambio ya está hecho. Si la fecha cambia, la cambia; si deja de existir, la quita con un gesto, sin que nadie le pregunte si está seguro. Puede hacerlo sobre cualquier tarea del espacio, sea suya o de otra persona, y con el ratón o solo con el teclado. Si se equivoca al escribir una fecha que no existe, se le explica junto al propio campo y la tarea se queda con la fecha que tuviera.

**Why this priority**: Sin poder poner y quitar la fecha no hay nada sobre lo que aplicar la regla de vencimiento; es la base de RF-13 y el primer cambio que la vista de una tarea deja de ser solo de consulta. Por sí sola ya entrega valor: el equipo puede anotar un compromiso con fecha donde antes no podía.

**Independent Test**: Con sesión iniciada, abrir una tarea sin fecha, ponerle una fecha y comprobar que se ve al instante y que sigue ahí al recargar y al abrirla otra persona; cambiarla por otra; quitarla y comprobar que no se pide confirmación y que la tarea vuelve a no tener fecha; intentar una fecha inexistente y comprobar el mensaje junto al campo y que la fecha anterior sigue intacta; repetir sobre una tarea cuyo responsable es otra persona y usando solo el teclado.

**Acceptance Scenarios**:

1. **DADO** una tarea sin fecha de vencimiento, **CUANDO** un miembro la abre y le indica una fecha, **ENTONCES** la tarea queda con esa fecha y el miembro la ve reflejada al instante, sin recargar ni volver a abrirla. *(CA-2)*
2. **DADO** que un miembro acaba de poner, cambiar o quitar la fecha de una tarea, **CUANDO** cierra la tarea sin hacer nada más, **ENTONCES** el cambio ya está guardado: sigue ahí al recargar y cualquier otro miembro que abra la tarea lo ve, sin que haya habido ningún paso extra de guardado. *(CA-16)*
3. **DADO** una tarea con fecha de vencimiento, **CUANDO** un miembro la abre y le indica otra fecha, **ENTONCES** la tarea queda con la fecha nueva, y la anterior deja de aplicarse. *(CA-10, en su parte de edición)*
4. **DADO** una tarea con fecha de vencimiento, **CUANDO** un miembro la abre y se la quita, **ENTONCES** la tarea vuelve a no tener fecha, el cambio se aplica directamente, sin ningún diálogo de confirmación. *(CA-3, CA-15)*
5. **DADO** una tarea abierta, **CUANDO** un miembro le pone una fecha anterior al día de hoy, **ENTONCES** el producto la acepta sin impedírselo ni pedirle que la confirme. *(CA-13; que pase a mostrarse vencida se verifica en la User Story 2)*
6. **DADO** una tarea con o sin fecha, **CUANDO** un miembro intenta indicar una fecha que no existe en el calendario (por ejemplo, un 31 de abril o un 29 de febrero de un año no bisiesto) o que está incompleta o mal formada, **ENTONCES** la tarea conserva exactamente la fecha que tuviera antes (o sigue sin fecha), y se le explica el problema junto al propio campo, en castellano y en lenguaje corriente. *(CA-14)*
7. **DADO** una tarea cuyo responsable es otra persona, **CUANDO** un miembro la abre y le pone, cambia o quita la fecha, **ENTONCES** el cambio se aplica igual que si fuera suya, sin advertencia, sin aviso de que es ajena y sin ningún permiso especial. *(CA-17)*
8. **DADO** un miembro que usa únicamente el teclado, **CUANDO** abre una tarea y le pone, cambia o quita la fecha, **ENTONCES** puede hacer las tres cosas igual que con el ratón. *(RNF-6)*
9. **DADO** un miembro que intenta cambiar la fecha y el cambio no llega a guardarse por un fallo de conexión, **CUANDO** se resuelve el intento, **ENTONCES** se le explica que no se ha podido guardar y qué puede hacer, y la vista vuelve a mostrar la fecha que la tarea tiene realmente guardada, sin dar por hecho un cambio que no se aplicó. *(RNF-10)*
10. **DADO** un miembro que tiene abierta una tarea que otra persona ha borrado mientras tanto, **CUANDO** intenta ponerle, cambiarle o quitarle la fecha, **ENTONCES** se le dice que esa tarea ya no existe y se le ofrece volver a la lista, en lugar de fingir que el cambio se aplicó. *(coherente con E2-4 y E2-5)*
11. **DADO** una persona sin sesión iniciada, **CUANDO** intenta ver o cambiar la fecha de una tarea, **ENTONCES** no puede hacer ninguna de las dos cosas y recibe el mismo trato que en cualquier otra pantalla protegida de la autenticación existente, sin cambios en este alcance.
12. **DADO** una tarea abierta, **CUANDO** el miembro mira la vista, **ENTONCES** la fecha de vencimiento es lo único que puede cambiar desde ella: título, responsable y estado se siguen mostrando solo como consulta.

---

### User Story 2 - Saber si una tarea está vencida (Priority: P2)

Quien abre una tarea quiere saber, sin hacer cuentas, si se ha pasado de plazo. Si la tarea está vencida, la vista lo dice con una señal propia, no solo mostrando la fecha. La regla es una y se aplica siempre igual: una tarea está vencida **si y solo si** tiene fecha de vencimiento, esa fecha es **anterior** al día de hoy de quien mira, **y** su estado no es «Hecho». No es una etiqueta que alguien ponga ni que se quede guardada: se decide cada vez que alguien mira, con su propio día, de modo que una tarea vence sola al pasar la medianoche y dos personas en husos distintos pueden verla de forma distinta durante unas horas, ambas correctamente.

**Why this priority**: Es la mitad del «para qué» de la historia («no descubrir tarde que se me ha pasado») y el riesgo más alto de FS-118: el día de más de CA-5 y la frontera entre decidir al mirar o congelar al guardar (CA-19 con CA-20) son los fallos que no se ven hasta que alguien cruza la medianoche. Depende de la User Story 1 para poder poner fechas, pero se verifica por separado con tareas preparadas en cada caso.

**Independent Test**: Preparar tareas no hechas con fecha de ayer, de hoy, de mañana y sin fecha; abrir cada una y comprobar que solo la de ayer se muestra vencida; pasar la de ayer a «Hecho» y comprobar que deja de estar vencida y conserva la fecha; devolverla a «Pendiente» y comprobar que vuelve a estarlo; aplazarla y comprobar que deja de estarlo; repetir la de hoy con el día de referencia del día siguiente y la misma tarea con dos días de referencia distintos.

**Regla de vencimiento, resumida** (el día de referencia es siempre el de quien mira):

| Fecha de vencimiento respecto a hoy | Estado distinto de «Hecho» | Estado «Hecho» |
|---|---|---|
| Sin fecha | No vencida | No vencida |
| Anterior a hoy (ayer o antes) | **Vencida** | No vencida |
| Hoy | No vencida | No vencida |
| Posterior a hoy (mañana o después) | No vencida | No vencida |

**Acceptance Scenarios**:

*Los cuatro bordes de la regla:*

1. **Día anterior** — **DADO** una tarea no hecha cuya fecha de vencimiento es el día anterior al de hoy de quien mira, **CUANDO** la abre, **ENTONCES** se le indica explícitamente que está vencida, con una señal propia, sin que tenga que comparar la fecha con el día de hoy. *(CA-4, RF-14)*
2. **Mismo día** — **DADO** una tarea no hecha cuya fecha de vencimiento es el día de hoy de quien mira, **CUANDO** la abre, **ENTONCES** no se muestra como vencida, porque la regla exige que la fecha sea **anterior** al día de hoy. *(CA-5)*
3. **Día posterior** — **DADO** una tarea no hecha cuya fecha de vencimiento es el día siguiente al de hoy de quien mira (o cualquier día posterior), **CUANDO** la abre, **ENTONCES** no se muestra como vencida. *(CA-6)*
4. **Sin fecha** — **DADO** una tarea sin fecha de vencimiento, creada hace semanas y todavía pendiente, **CUANDO** un miembro la abre, **ENTONCES** no se muestra como vencida, por muy antigua que sea. *(CA-7)*

*El estado «Hecho»:*

5. **DADO** una tarea vencida, **CUANDO** un miembro la pasa a «Hecho» (desde la lista, E2-4) y después la abre, **ENTONCES** ya no se muestra como vencida y conserva su fecha de vencimiento exactamente igual que antes. *(CA-8)*
6. **DADO** una tarea en estado «Hecho» cuya fecha de vencimiento ya pasó, **CUANDO** un miembro la abre, **ENTONCES** no se muestra como vencida. *(CA-9)*
7. **DADO** una tarea en «Hecho» con fecha de vencimiento anterior a hoy, **CUANDO** un miembro la devuelve a «Pendiente» o a «En curso» y la abre, **ENTONCES** vuelve a mostrarse vencida, sin que su fecha haya cambiado. *(consecuencia de RF-14 con la decisión de E2-4 que cierra PA-7: toda transición entre estados es válida)*

*Cambiar la fecha cambia la condición, en el acto:*

8. **DADO** una tarea vencida abierta, **CUANDO** el miembro le cambia la fecha a una posterior a hoy, **ENTONCES** deja de mostrarse como vencida en ese mismo momento, sin recargar. *(CA-10)*
9. **DADO** una tarea vencida abierta, **CUANDO** el miembro le quita la fecha, **ENTONCES** deja de mostrarse como vencida en ese mismo momento. *(CA-3)*
10. **DADO** una tarea no hecha abierta, sin fecha o con fecha de hoy o posterior, **CUANDO** el miembro le pone una fecha anterior a hoy, **ENTONCES** la tarea pasa a mostrarse vencida de inmediato. *(CA-13)*

*El día de referencia es el de quien mira, y se decide al mirar:*

11. **Dos husos** — **DADO** una tarea no hecha con fecha de vencimiento que, en un mismo instante, ya es ayer para una persona en un huso horario y todavía es hoy para otra persona en un huso distinto, **CUANDO** ambas la abren a la vez, **ENTONCES** la primera la ve vencida y la segunda no, las dos ven escrita la misma fecha de vencimiento, y las dos lecturas son correctas. *(CA-19, supuesto de RF-14)*
12. **Pasa la medianoche** — **DADO** una tarea no hecha cuya fecha de vencimiento es el día de hoy de quien mira, y que no se muestra vencida, **CUANDO** pasa la medianoche en el huso de esa persona y vuelve a abrirla, **ENTONCES** la ve vencida, sin que nadie haya modificado la tarea. *(CA-20)*
13. **DADO** una tarea que alguien guardó con una fecha de vencimiento futura, **CUANDO** llega y pasa ese día sin que nadie la toque, **ENTONCES** al abrirla después se muestra vencida: la condición no se quedó congelada en la que tenía cuando se guardó. *(CA-20)*

*La señal:*

14. **DADO** una tarea vencida abierta, **CUANDO** un miembro la mira, **ENTONCES** la señal de vencida se entiende sin depender solo del color (se lee como texto, también con tecnologías de asistencia) y respeta el contraste exigido al resto de la interfaz. *(CA-4, RNF-6)*
15. **DADO** una tarea que no está vencida (sin fecha, con fecha de hoy o posterior, o en «Hecho»), **CUANDO** un miembro la abre, **ENTONCES** no aparece ninguna señal de vencida ni ninguna otra advertencia sobre el plazo.

---

### User Story 3 - Lo que la lista y la creación no muestran (Priority: P3)

La fecha de vencimiento es deliberadamente discreta: no se pide al crear una tarea, no aparece en la lista principal y no tenerla no es un problema. Quien crea una tarea escribe el título y ya está; quien mira la lista ve título, responsable y estado como hasta ahora, tenga cada tarea fecha o no, esté vencida o no. Así la fecha solo aparece cuando alguien decide que de verdad existe, y no se convierte en un campo obligatorio de hecho.

**Why this priority**: Son criterios negativos, pero son la identidad del producto (RF-13, RF-15) y la contención del riesgo nº 2 del PRD (que la fecha acabe siendo obligatoria de facto, S-3). Se colocan en P3 porque el comportamiento ya es el actual y lo que se exige es que las User Stories 1 y 2 no lo rompan; por eso se verifican de forma explícita.

**Independent Test**: Con tareas con fecha, algunas vencidas, y tareas sin fecha, mirar la lista principal y comprobar que en ninguna fila aparece una fecha de vencimiento ni una marca de vencida; crear una tarea nueva y comprobar que el flujo no ofrece ni sugiere fecha y que la tarea creada queda sin ella; abrir una tarea sin fecha y comprobar que no hay aviso de que le falte.

**Acceptance Scenarios**:

1. **DADO** que un miembro va a crear una tarea nueva, **CUANDO** escribe el título y la crea, **ENTONCES** la tarea queda sin fecha de vencimiento y en ningún momento del flujo de creación se le ofrece, se le pide ni se le sugiere ponerle una. *(CA-1, RF-13)*
2. **DADO** que hay tareas con fecha, algunas de ellas vencidas, y tareas sin fecha, **CUANDO** un miembro mira la lista principal, **ENTONCES** no ve ninguna fecha de vencimiento ni ninguna marca de vencida en ninguna tarea, y cada fila muestra lo mismo que antes de este cambio. *(CA-11, RF-15)*
3. **DADO** una tarea sin fecha, **CUANDO** un miembro la ve en la lista o la abre, **ENTONCES** no recibe ningún aviso, recordatorio ni señal de que le falte algo, y la ausencia de fecha se presenta como un estado normal. *(CA-12, RF-13)*
4. **DADO** un miembro que acaba de poner, cambiar o quitar la fecha de una tarea, **CUANDO** vuelve a la lista, **ENTONCES** la fila de esa tarea no ha cambiado: mismo título, mismo responsable, mismo estado, sin fecha ni marca añadidas. *(CA-11)*
5. **DADO** una tarea cuya fecha de vencimiento es hoy o mañana, **CUANDO** un miembro la abre o la ve en la lista, **ENTONCES** no recibe ningún aviso de «vence hoy», «vence pronto» ni recordatorio alguno: la única señal que existe es la de vencida. *(fuera de alcance: recordatorios o avisos de vencimiento)*

---

### Edge Cases

- **Fecha inexistente o incompleta mientras el guardado es automático.** CA-16 (se guarda solo) y CA-14 (lo inválido no se traga) se reconcilian así: solo se guarda una fecha completa y existente; una fecha a medio escribir no sustituye a la anterior. Si el miembro deja el campo con una fecha inválida, se le explica junto al campo y la tarea sigue con la fecha que tuviera.
- **Fecha muy antigua o muy lejana.** Cualquier día que exista en el calendario se acepta, esté a años vista o hace años (una fecha pasada es legítima: anotar algo que ya debería estar hecho, CA-13). Los límites extremos del rango admitido se fijan en el plan.
- **Poner la misma fecha que ya tenía.** No cambia nada ni produce ningún aviso.
- **La tarea se reabre o se recarga.** Muestra la fecha guardada y su condición de vencida recalculada con el día de hoy de quien mira en ese momento.
- **La vista queda abierta mientras pasa la medianoche.** La condición correcta se garantiza al abrir o recargar la tarea (User Story 2, escenario 12); que una vista ya abierta se actualice sola en el instante de la medianoche no se exige en este cambio.
- **Otra persona cambia la fecha mientras un miembro tiene la tarea abierta.** Sin lista viva (E3), la vista no se entera sola; queda guardado el último cambio que llega y, al reabrir o recargar, se ve la fecha guardada. Qué debe ver quien pierde el cambio es PA-8 y queda fuera de este alcance.
- **La tarea se borra mientras está abierta y el miembro toca la fecha.** Se avisa de que la tarea ya no existe y se ofrece volver a la lista (User Story 1, escenario 10).
- **La sesión caduca con la tarea abierta.** El siguiente intento de cambiar la fecha no se aplica y se actúa como en cualquier otra pantalla protegida de la autenticación existente.
- **Cambiar el estado no toca la fecha.** Cualquier transición entre los tres estados, en cualquier sentido, conserva la fecha de vencimiento tal cual; solo cambia si la tarea está vencida o no.
- **Tareas anteriores a este cambio.** Todas las tareas que ya existían quedan sin fecha de vencimiento, son válidas tal cual y no están vencidas.
- **Misma fecha escrita para todos.** La fecha de vencimiento es un día del calendario, no un instante: quien la mira desde cualquier huso ve escrito el mismo día que se puso; lo único que puede variar entre personas es si ese día ya es anterior a su hoy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Una tarea DEBE poder tener una fecha de vencimiento o no tenerla; no tener fecha DEBE ser un estado normal de la tarea, sin aviso, marca ni indicación de que le falte algo (RF-13).
- **FR-002**: El flujo de creación de tareas NO DEBE contener, ofrecer ni sugerir la fecha de vencimiento, y toda tarea creada por él DEBE quedar sin fecha (RF-13, CA-1).
- **FR-003**: Cualquier miembro con sesión iniciada DEBE poder poner, cambiar y quitar la fecha de vencimiento de cualquier tarea del espacio compartido desde la vista de esa tarea, con independencia de quién sea su responsable o quién la creó, sin advertencias ni permisos especiales (CA-2, CA-3, CA-17).
- **FR-004**: La vista de una tarea DEBE ser el único lugar del producto donde se consulta y se establece la fecha de vencimiento (RF-13).
- **FR-005**: Quitar la fecha NO DEBE pedir confirmación (CA-15).
- **FR-006**: Poner, cambiar o quitar la fecha DEBE quedar guardado sin ningún paso de guardado adicional, y DEBE reflejarse en la vista al instante, sin recargar ni reabrir la tarea (CA-2, CA-16, RNF-3).
- **FR-007**: El producto DEBE aceptar como fecha de vencimiento cualquier día que exista en el calendario, incluidos los anteriores al día de hoy (CA-13).
- **FR-008**: El producto DEBE rechazar una fecha que no existe en el calendario, incompleta o mal formada, explicando el problema junto al propio campo con un mensaje comprensible en castellano; en ese caso la tarea DEBE conservar la fecha que tuviera antes, o seguir sin fecha si no la tenía (CA-14, RNF-8).
- **FR-009**: Si un cambio de fecha no llega a guardarse por un motivo distinto de una fecha inválida (por ejemplo, un fallo de conexión), el producto DEBE explicarlo en castellano, decir qué hacer y mostrar la fecha que la tarea tiene realmente guardada, sin dar por aplicado un cambio que no se aplicó (RNF-10).
- **FR-010**: Si la tarea ya no existe cuando se intenta cambiar su fecha, el producto DEBE decir que ya no existe y ofrecer volver a la lista, sin fingir que el cambio se aplicó.
- **FR-011**: Una tarea DEBE considerarse vencida **si y solo si** tiene fecha de vencimiento, esa fecha es anterior al día de hoy de quien mira, y su estado no es «Hecho». En cualquier otro caso —sin fecha, con fecha de hoy, con fecha posterior o en «Hecho»— NO DEBE considerarse vencida (RF-14, CA-5 a CA-9).
- **FR-012**: El día de referencia para decidir el vencimiento DEBE ser el día de hoy de la persona que mira, en su propio huso horario; dos personas en husos distintos PUEDEN ver la misma tarea una vencida y la otra no, y ambas lecturas DEBEN ser correctas (CA-19).
- **FR-013**: La condición de vencida DEBE decidirse en el momento de mirar, no en el de guardar: una tarea DEBE pasar a vencida por el mero paso del día, sin que nadie la modifique, y DEBE reflejar al abrirse o recargarse su fecha y su estado actuales (CA-20).
- **FR-014**: Cambiar el estado de una tarea, en cualquier sentido, NO DEBE modificar su fecha de vencimiento; solo DEBE cambiar su condición de vencida según FR-011 (CA-8).
- **FR-015**: Al abrir una tarea vencida, la vista DEBE indicarlo explícitamente con una señal propia, distinta de la mera fecha, que se entienda sin comparar la fecha con el día de hoy, que no dependa solo del color y que respete el contraste y la accesibilidad exigidos al resto de la interfaz (CA-4, RF-15, RNF-6).
- **FR-016**: La vista de una tarea NO vencida NO DEBE mostrar la señal de vencida ni ninguna otra advertencia sobre el plazo; el producto NO DEBE mostrar avisos de «vence hoy», «vence pronto» ni recordatorios (CA-12).
- **FR-017**: La lista principal NO DEBE mostrar fechas de vencimiento ni marcas de vencida en ninguna tarea, y poner, cambiar o quitar la fecha NO DEBE alterar lo que la fila de la tarea muestra (CA-11, RF-15).
- **FR-018**: Poner, cambiar y quitar la fecha DEBEN poder hacerse íntegramente con el teclado (RNF-6).
- **FR-019**: El producto NO DEBE permitir ver ni cambiar la fecha de vencimiento a una persona sin sesión iniciada, reutilizando la autenticación existente sin modificarla.
- **FR-020**: Fuera de la fecha de vencimiento, la vista de una tarea DEBE seguir siendo solo de consulta: título, responsable y estado no se editan desde ella en este cambio.
- **FR-021**: La fecha, la señal de vencida y los mensajes de error DEBEN plegarse al estilo visual ya existente, sin rediseño (R-8), y todos sus textos DEBEN estar en castellano (RNF-8).
- **FR-022**: Las tareas que ya existían antes de este cambio DEBEN seguir siendo válidas y quedar sin fecha de vencimiento.

*Fuera de alcance de esta especificación* (pertenecen a otras historias del backlog o a decisiones abiertas del PRD, ya identificadas): recordatorios o avisos de vencimiento, ordenar o filtrar la lista por fecha, mostrar la fecha o el vencimiento en la lista (RF-15, PA-1), reasignar el responsable (E2-7) —y con él CA-18, «reasignar no toca la fecha», que se verificará cuando exista la reasignación—, editar el título (E2-6), borrar la tarea (E2-10), qué ve quien pierde un cambio simultáneo de fecha (PA-8), y reflejar sin recargar los cambios de otras personas (E3).

### Key Entities

- **Tarea**: la unidad de trabajo del espacio compartido. Este cambio le añade una **fecha de vencimiento opcional**: un día del calendario (día, mes y año, sin hora), igual para todos los que la miran, o ninguno. Su **estado** («Pendiente», «En curso», «Hecho») sigue como estaba y no se ve afectado por la fecha.
- **Condición de vencida**: no es un dato que alguien ponga ni que quede guardado en la tarea, sino una lectura que se hace cada vez que alguien mira, a partir de la fecha de vencimiento, el estado y el día de hoy de quien mira (FR-011 a FR-013).
- **Día de referencia**: el día de hoy de la persona que mira, en su propio huso horario. Es lo único que puede hacer que dos personas lean distinto la misma tarea.
- **Vista de una tarea** (existente, `specs/003-abrir-tarea/`): la superficie donde se consulta una tarea por sí sola; aquí gana la fecha de vencimiento editable y la señal de vencida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quitar la fecha de una tarea abierta cuesta 1 interacción; poner o cambiar una fecha no requiere ningún paso de guardado (0 interacciones más allá de indicar la fecha).
- **SC-002**: El cambio de fecha, y el cambio de condición de vencida que produce, se ven en la vista sin espera perceptible (menos de 1 segundo a la escala objetivo de RNF-5).
- **SC-003**: En los cuatro bordes de la regla (día anterior, mismo día, día posterior y sin fecha), combinados con los estados «Hecho» y no «Hecho», el 100% de las tareas se muestran vencidas o no exactamente según la tabla de la User Story 2: solo la combinación «fecha anterior a hoy y no hecha» aparece vencida.
- **SC-004**: En el 100% de los casos, pasar una tarea a «Hecho», o sacarla de «Hecho», deja su fecha de vencimiento idéntica a la que tenía.
- **SC-005**: Con la misma tarea vista a la vez desde dos días de referencia distintos, cada persona obtiene la lectura que corresponde a su propio día, y ambas ven escrita la misma fecha.
- **SC-006**: En 0 casos una tarea con fecha de hoy sigue mostrándose no vencida al abrirla después de pasar la medianoche de quien mira, estando sin hacer.
- **SC-007**: El 100% de las fechas inexistentes, incompletas o mal formadas se rechazan con un mensaje junto al campo, y en 0 casos cambian la fecha que la tarea tenía.
- **SC-008**: En 0 casos la lista principal muestra una fecha de vencimiento o una marca de vencida, y en 0 casos el flujo de creación ofrece o sugiere una fecha; el 100% de las tareas creadas por ese flujo quedan sin fecha.
- **SC-009**: En 0 casos una tarea sin fecha, o no vencida, muestra un aviso, recordatorio o señal relacionada con el plazo.
- **SC-010**: Poner, cambiar y quitar la fecha se completa usando solo el teclado, y la señal de vencida se identifica sin depender del color.
- **SC-011**: Las tareas propias y las ajenas admiten el mismo recorrido de fecha con el mismo resultado, con 0 advertencias o peticiones de permiso.

## Assumptions

- **«El día de hoy de quien mira» es el de su propio dispositivo.** El producto no tiene una preferencia de huso horario por persona; el día de referencia sale del reloj y el huso del dispositivo con el que la persona está mirando. Es la lectura directa del supuesto de RF-14 y la que hace verdad CA-19 sin añadir ajustes nuevos.
- **La fecha de vencimiento es un día, no un momento.** Se indica y se muestra como día del calendario, sin hora, y es el mismo día escrito para todos. «Vence el 30» significa que el 30 todavía no está vencida y el 1 sí (CA-5), sea cual sea la hora.
- **Cómo se muestra la fecha**: como fecha absoluta en castellano (día, mes y año), en línea con la fecha de creación de E2-5; el formato exacto y cómo se indica (campo, selector) se deciden en el plan, sin traer dependencias nuevas.
- **La señal de vencida es una sola y es binaria**: vencida o nada. No hay «vence hoy», «vence pronto» ni grados de retraso; eso rozaría los recordatorios, que están fuera de alcance.
- **CA-4, CA-13, CA-14, CA-15, CA-16, CA-17 y CA-20 se dan por validados.** El backlog los marca como [PROPUESTO]; la entrada de este cambio los incluye como criterios de la historia, y así se tratan aquí.
- **Volver desde «Hecho» ya está decidido.** E2-4 (`specs/002-cambiar-estado/`) cerró PA-7: toda transición entre los tres estados es válida. Por RF-14, una tarea que sale de «Hecho» con la fecha pasada vuelve a estar vencida (User Story 2, escenario 7); no queda como criterio pendiente.
- **Las tareas en «Hecho» siguen en la lista y se pueden abrir** (decisión de E2-4 hasta que llegue FS-142), así que CA-8 y CA-9 se verifican abriendo la tarea desde la lista.
- **Colisiones sin resolver (PA-8).** Si dos personas cambian la fecha de la misma tarea a la vez, queda el último cambio guardado; qué ve quien pierde el suyo sigue abierto en el PRD y no se decide aquí.
- **CA-18 (reasignar no toca la fecha) se aplaza** hasta que exista la reasignación (E2-7); este cambio no la construye.
- **La vista de la tarea ya existe** (`specs/003-abrir-tarea/`) con título, responsable, estado y fecha de creación; este cambio le añade la fecha de vencimiento y la señal de vencida, y deja de ser solo de consulta únicamente para la fecha.
- **Uso esperado (S-3 del PRD).** Se espera que una minoría de las tareas vivas lleve fecha; que acabe llevándola la mayoría indicaría que la fecha se ha vuelto obligatoria de hecho. Es un indicador de seguimiento tras el uso, no un criterio de aceptación de este cambio.
- **Cualquier miembro del espacio único compartido** puede poner o quitar la fecha de cualquier tarea: no existen roles ni propiedad que lo restrinjan (roles planos del PRD).
- **Los textos exactos** de la señal de vencida y de los mensajes (fecha inválida, fallo al guardar, tarea inexistente) se redactan en el plan, en castellano y con el tono de los mensajes ya existentes.
- **Sin dependencias nuevas y sin tocar la autenticación**: el cambio se construye con lo que ya hay en el proyecto.
