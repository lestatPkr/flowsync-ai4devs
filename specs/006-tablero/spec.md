# Feature Specification: Tablero de tareas por estado

**Feature Branch**: `build/kanban`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Nombre corto de la feature: tablero. Es una necesidad que ha salido del prototipo, no del backlog: una vista de tablero con las tareas del equipo. Entradas, léelas antes de escribir: la captura del prototipo hecho con Stitch (docs/design/prototipo-tablero.png), lo que dijo y lo que hizo la usuaria al probarlo (docs/design/feedback-prototipo.md) y el design system (DESIGN.md). Historia: «Como miembro del equipo, quiero ver todas las tareas del equipo en un tablero con una columna por estado y moverlas de columna, para saber de un vistazo en qué está cada cosa y ponerlo al día sin abrir nada.» Lo que la spec decide a partir del prototipo y del feedback: tres columnas fijas (Pendiente, En curso y Hecho), cada una con su recuento; el tablero muestra también las tareas hechas; cada tarjeta muestra el título (que lleva a la tarea), el responsable y el estado; se mueve de columna arrastrando Y, siempre, sin ratón desde la propia tarjeta, con el mismo control de estado que ya tiene la lista; el cambio se ve al instante y, si no se guarda, la tarjeta vuelve a su columna con un mensaje en castellano; una columna vacía lo dice con un mensaje; en pantallas estrechas las columnas se apilan; se vuelve a la lista en un clic y la lista sigue siendo la vista por defecto; todo es operable con teclado. Lo que el prototipo traía y NO entra: prioridades, avatares con foto, columnas configurables (añadir columna), reordenar dentro de una columna y los colores del prototipo (manda DESIGN.md). La marca de vencida en la tarjeta la pidió la usuaria (feedback, punto 3), pero choca con RF-15 del PRD (el vencimiento se ve al abrir la tarea, no en la vista principal) y con lo que la lista sabe hoy de cada tarea: no entra, y se deja anotada como decisión de producto pendiente. También fuera de alcance: crear tareas desde el tablero, filtros y ver en vivo los cambios de otras personas (E3). Restricciones que la spec respeta sin bajar a lo técnico: el servidor no cambia (ni datos ni reglas: el tablero usa lo que ya existe); la autenticación ya existe y no se toca; ninguna dependencia nueva; el estilo es el de DESIGN.md. Escribe la spec en español, con los escenarios de aceptación en DADO / CUANDO / ENTONCES, prioriza las historias (P1 ver el tablero con las tres columnas y abrir una tarea; P2 mover de columna con ratón y sin ratón, con el reflejo inmediato y la vuelta atrás si falla; P3 columnas vacías y pantallas estrechas), incluye una sección corta «Del prototipo a la spec» con lo que entra, lo que no y por qué, y marca como [NEEDS CLARIFICATION] solo lo que de verdad quede abierto; lo demás, como supuesto explícito."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el tablero con las tres columnas y abrir una tarea (Priority: P1)

Un miembro del equipo, con sesión iniciada, está en la lista de tareas y quiere ver de un vistazo en qué está cada cosa, incluido lo ya terminado. Con un clic pasa al tablero: tres columnas fijas —«Pendiente», «En curso» y «Hecho», en ese orden—, cada una con el número de tareas que contiene, y cada tarea del espacio compartido en la columna de su estado y en ninguna otra. Cada tarjeta dice qué es (el título), quién la lleva (el responsable) y en qué estado está; nada más. Si quiere ver una tarea por sí sola, la abre desde su título. Con otro clic vuelve a la lista, que sigue siendo donde se entra a FlowSync.

**Why this priority**: Es la mitad «saber de un vistazo» de la historia y lo que justifica que exista una segunda vista: responde «¿en qué está cada cosa?» (JTBD-1, RF-17) agrupando por estado, y es la única vista donde lo hecho convive con lo vivo (feedback, punto 4). Por sí sola ya entrega valor aunque todavía no se pueda mover nada.

**Independent Test**: Con sesión iniciada y tareas propias y ajenas en los tres estados, ir de la lista al tablero, comprobar que cada tarea está en la columna de su estado, que los recuentos coinciden con las tarjetas, que cada tarjeta muestra título, responsable y estado y nada más; abrir una tarea desde su título, volver, y volver a la lista; repetir el recorrido entero solo con el teclado. Se verifica sin mover ninguna tarjeta.

**Acceptance Scenarios**:

1. **DADO** un espacio con tareas en «Pendiente», «En curso» y «Hecho», **CUANDO** un miembro abre el tablero, **ENTONCES** ve exactamente tres columnas, en el orden «Pendiente», «En curso», «Hecho», y cada tarea del espacio aparece una sola vez, en la columna de su estado, sea suya o de otra persona.
2. **DADO** un espacio con tareas hechas, **CUANDO** un miembro abre el tablero, **ENTONCES** las tareas hechas aparecen en la columna «Hecho», sin tener que elegir ningún filtro. *(feedback, punto 4)*
3. **DADO** un tablero cargado, **CUANDO** un miembro mira la cabecera de cada columna, **ENTONCES** ve el nombre del estado y un recuento que coincide con el número de tarjetas de esa columna.
4. **DADO** un tablero cargado, **CUANDO** un miembro mira una tarjeta, **ENTONCES** ve su título, el nombre de su responsable y su estado, **Y** no ve prioridad, foto, fecha de vencimiento ni marca de vencida. *(RF-15, RF-17)*
5. **DADO** un miembro en el tablero, **CUANDO** activa el título de una tarjeta, **ENTONCES** llega a la vista de esa tarea concreta, la misma que se abre desde la lista. *(specs/003-abrir-tarea)*
6. **DADO** un miembro que ha abierto una tarea desde el tablero, **CUANDO** vuelve desde la tarea, **ENTONCES** regresa al tablero y puede seguir desde la tarjeta que abrió.
7. **DADO** un miembro en la lista, **CUANDO** quiere ver el tablero, **ENTONCES** llega a él con una sola interacción; **Y DADO** un miembro en el tablero, **CUANDO** quiere volver a la lista, **ENTONCES** llega a ella con una sola interacción. *(feedback, punto 10)*
8. **DADO** un miembro que usó el tablero en su visita anterior, **CUANDO** entra a FlowSync (inicia sesión o abre la aplicación sin indicar ninguna vista), **ENTONCES** aparece en la lista, no en el tablero. *(feedback, punto 10)*
9. **DADO** un miembro que usa únicamente el teclado, **CUANDO** pasa de la lista al tablero, recorre sus tarjetas, abre una tarea, vuelve y regresa a la lista, **ENTONCES** puede hacerlo todo, con el foco siempre visible y en un orden que sigue las columnas de izquierda a derecha y, dentro de cada una, las tarjetas de arriba abajo. *(RNF-6, feedback, punto 2)*
10. **DADO** un tablero que no consigue cargar las tareas, **CUANDO** el miembro lo mira, **ENTONCES** ve un mensaje en castellano que dice que no se han podido cargar y una forma de reintentar, **Y** no ve tres columnas vacías como si el equipo no tuviera tareas. *(feedback, punto 5; RNF-10)*
11. **DADO** una persona sin sesión iniciada, **CUANDO** intenta llegar al tablero, **ENTONCES** no ve ninguna tarea (comportamiento de la autenticación existente, sin cambios en este alcance). *(RF-4)*

---

### User Story 2 - Mover una tarea de columna, con ratón y sin ratón (Priority: P2)

El mismo miembro quiere poner al día una tarea sin abrirla: la arrastra de una columna a otra, o —si trabaja con el teclado o no quiere arrastrar— cambia su estado desde la propia tarjeta con el mismo control de estado que ya tiene la lista. En los dos casos la tarjeta salta a su nueva columna en el acto y los recuentos se actualizan. Si el cambio no llega a guardarse, la tarjeta vuelve a la columna de la que salió y un mensaje en castellano explica qué ha pasado: el tablero nunca enseña como guardado algo que no se guardó.

**Why this priority**: Es la mitad «ponerlo al día sin abrir nada» de la historia, y lo primero que hizo la usuaria al probar el prototipo (feedback, punto 1). Depende de que exista el tablero (P1), pero el cambio de estado ya existe en la lista (`specs/002-cambiar-estado/`), así que el tablero sigue siendo útil sin esta historia. El camino sin ratón no es un extra: sin él, mover de columna excluye a quien trabaja con el teclado (feedback, punto 2; DESIGN.md: «una acción por arrastre tiene siempre una alternativa por teclado y por clic»).

**Independent Test**: Con el tablero cargado (User Story 1), arrastrar una tarjeta a otra columna y comprobar que aparece allí al instante, que los recuentos cambian y que al recargar sigue en su nueva columna; repetir el cambio solo con el teclado desde el control de estado de la tarjeta; provocar un fallo al guardar y comprobar que la tarjeta vuelve a su columna de origen con un mensaje.

**Acceptance Scenarios**:

1. **DADO** una tarjeta en «Pendiente», **CUANDO** un miembro la arrastra con el ratón y la suelta en «En curso», **ENTONCES** la tarjeta aparece en «En curso» sin recargar, el recuento de «Pendiente» baja en uno y el de «En curso» sube en uno, **Y** al recargar la tarea sigue en «En curso». *(feedback, punto 1)*
2. **DADO** un miembro que usa únicamente el teclado y tiene el foco en una tarjeta de «En curso», **CUANDO** elige «Hecho» en el control de estado de esa tarjeta, **ENTONCES** la tarjeta pasa a la columna «Hecho» sin recargar, los recuentos se actualizan, **Y** el foco sigue en esa misma tarjeta, ya en su nueva columna, para que pueda continuar desde ahí. *(feedback, punto 2; RNF-6)*
3. **DADO** cualquier tarjeta del tablero, **CUANDO** un miembro usa su control de estado, **ENTONCES** es el mismo control que tiene cada fila de la lista: ofrece únicamente «Pendiente», «En curso» y «Hecho» y el cambio se completa en 2 interacciones o menos, sin diálogo de confirmación ni campos que rellenar. *(RF-8, RF-9, RNF-1)*
4. **DADO** una tarjeta en cualquier columna, sea la tarea propia o de otra persona, **CUANDO** un miembro la mueve a cualquiera de las otras dos columnas, por arrastre o con el control, **ENTONCES** el cambio se acepta, incluidas las vueltas atrás desde «Hecho» y el salto directo de «Pendiente» a «Hecho», sin permiso especial ni advertencia. *(specs/002-cambiar-estado, FR-003 y FR-006)*
5. **DADO** un miembro que mueve una tarjeta a otra columna, **CUANDO** el cambio no llega a guardarse (fallo de conexión, sesión caducada o cualquier rechazo), **ENTONCES** la tarjeta vuelve a la columna de la que salió, los recuentos vuelven a sus valores anteriores, **Y** el miembro ve un mensaje comprensible en castellano que dice que el cambio no se ha guardado. *(feedback, punto 6; RNF-10)*
6. **DADO** una tarjeta cuya tarea ha borrado otra persona después de cargar el tablero, **CUANDO** un miembro la mueve de columna, **ENTONCES** el tablero no la muestra como movida **Y** el mensaje dice que esa tarea ya no existe, distinto del de un fallo de conexión. *(specs/002-cambiar-estado, FR-009)*
7. **DADO** un miembro que arrastra una tarjeta, **CUANDO** la suelta en su misma columna o fuera de cualquier columna, **ENTONCES** la tarjeta queda donde estaba, no cambia nada y no aparece ningún mensaje.
8. **DADO** un miembro que mueve una tarjeta, **CUANDO** el cambio se ve en el tablero, **ENTONCES** la tarea conserva su título y su responsable, las demás tarjetas no cambian de columna, **Y** la tarjeta ocupa en su nueva columna el sitio que le corresponde según el orden de la columna, no el punto exacto donde se soltó. *(no se reordena dentro de una columna)*
9. **DADO** un miembro que ha pasado una tarea a «Hecho» desde el tablero, **CUANDO** vuelve a la lista, **ENTONCES** esa tarea ya no aparece en la vista por defecto de la lista y sí aparece al filtrar por «Hecho»: tablero y lista enseñan el mismo estado guardado. *(RF-21, specs/005-filtrar-por-estado)*

---

### User Story 3 - Columnas vacías y pantallas estrechas (Priority: P3)

Una columna sin tareas no se queda en blanco: dice que no hay tareas en ese estado, para que nadie la confunda con un error de carga. Y desde una pantalla estrecha —un móvil o una ventana pequeña— el tablero sigue siendo legible y usable: las columnas se colocan una debajo de otra, en el mismo orden, sin que la página haya que desplazarla de lado.

**Why this priority**: Pule dos situaciones que el prototipo dejó mal resueltas (feedback, puntos 5 y 9). Sin ellas el tablero funciona, pero una columna en blanco se lee como un fallo y en un móvil tres columnas lado a lado no caben. Depende de P1; se verifica por separado.

**Independent Test**: Con un espacio sin tareas en uno de los estados, abrir el tablero y comprobar que esa columna lo dice; mover la última tarjeta de una columna y comprobar que el mensaje aparece en el acto; abrir el tablero en una pantalla estrecha y comprobar que las columnas se apilan sin desplazamiento horizontal de la página y que el control de estado de cada tarjeta sigue funcionando.

**Acceptance Scenarios**:

1. **DADO** un espacio sin ninguna tarea en «En curso», **CUANDO** un miembro abre el tablero, **ENTONCES** la columna «En curso» muestra un recuento de 0 y un mensaje que dice que no hay tareas en ese estado. *(feedback, punto 5)*
2. **DADO** una columna con una sola tarjeta, **CUANDO** un miembro la mueve a otra columna, **ENTONCES** la columna que queda vacía muestra en el acto su mensaje de vacía, **Y** si el cambio no se guarda y la tarjeta vuelve, el mensaje desaparece.
3. **DADO** una columna vacía, **CUANDO** un miembro mueve una tarjeta a ella, **ENTONCES** el mensaje de vacía desaparece y en su lugar se ve la tarjeta. Una columna vacía admite que se suelte una tarjeta igual que una con tarjetas.
4. **DADO** un espacio sin ninguna tarea, **CUANDO** un miembro abre el tablero, **ENTONCES** ve las tres columnas con su mensaje de vacía y una indicación de que las tareas se crean desde la lista, con una forma de ir a ella.
5. **DADO** un miembro que abre el tablero en una pantalla estrecha, **CUANDO** lo mira, **ENTONCES** ve las columnas una debajo de otra, en el orden «Pendiente», «En curso», «Hecho», cada una con su recuento, **Y** la página no se desplaza en horizontal. *(feedback, punto 9; DESIGN.md, Layout)*
6. **DADO** un miembro en una pantalla estrecha, **CUANDO** cambia el estado de una tarjeta con su control, **ENTONCES** la tarjeta pasa a su nueva columna igual que en una pantalla ancha, y el foco sigue en ella.
7. **DADO** un tablero que está cargando, que ha fallado al cargar o que tiene columnas vacías, **CUANDO** un miembro lo mira, **ENTONCES** cada una de esas tres situaciones se ve distinta de las otras dos.

---

### Edge Cases

- **Mover dos veces seguidas la misma tarjeta**, antes de que se guarde el primer cambio: al terminar, la tarjeta queda en la columna del último estado elegido y la tarea guardada tiene ese mismo estado.
- **Dos personas mueven a la vez la misma tarea**: prevalece el último cambio que se guarda, sin aviso de conflicto. Que la otra persona lo vea sin recargar es la lista viva (E3-2) y queda fuera de este alcance.
- **Otra persona cambia, borra o crea tareas con el tablero abierto**: el tablero no se entera solo; muestra lo que cargó hasta que se recarga o se vuelve a él. Fuera de alcance (E3).
- **La sesión caduca con el tablero abierto**: el cambio no se guarda, la tarjeta vuelve a su columna y se actúa como en cualquier otra acción sin sesión válida de la autenticación existente.
- **Títulos largos**: el título completo es legible en la tarjeta, partiendo líneas si hace falta, sin ensanchar la columna ni provocar desplazamiento horizontal.
- **Muchas tareas en una columna** (en particular «Hecho», que acumula todo lo terminado): la columna crece hacia abajo y la página se desplaza en vertical; no hay paginación ni límite visible a la escala objetivo (RNF-5).
- **Arrastrar en pantallas táctiles**: el camino garantizado es el control de estado de la tarjeta; arrastrar con el dedo no es un requisito.
- **Llegar al tablero directamente** (recargar estando en él, o abrir su dirección): se muestra el tablero, no la lista. Que la lista sea la vista por defecto significa que es donde se entra, no que el tablero no tenga dirección propia.

## Requirements *(mandatory)*

### Functional Requirements

**Ver el tablero (P1)**

- **FR-001**: El sistema DEBE ofrecer a cualquier miembro con sesión iniciada una vista de tablero con todas las tareas del espacio compartido, propias y ajenas, organizadas en exactamente tres columnas fijas: «Pendiente», «En curso» y «Hecho», en ese orden.
- **FR-002**: Cada tarea DEBE aparecer una sola vez en el tablero, en la columna de su estado guardado. Las tareas en «Hecho» DEBEN mostrarse en su columna sin ningún filtro.
- **FR-003**: Cada columna DEBE mostrar el nombre de su estado y un recuento igual al número de tarjetas que contiene en cada momento.
- **FR-004**: Cada tarjeta DEBE mostrar el título de la tarea, el nombre de su responsable y su estado, y NO DEBE mostrar prioridad, foto de perfil, fecha de vencimiento ni marca de vencida.
- **FR-005**: El título de cada tarjeta DEBE llevar a la vista de esa tarea, la misma que se abre desde la lista; al volver desde una tarea abierta desde el tablero, el miembro DEBE regresar al tablero y poder seguir desde la tarjeta que abrió.
- **FR-006**: Desde la lista DEBE poder llegarse al tablero, y desde el tablero a la lista, con una sola interacción en cada sentido.
- **FR-007**: La lista DEBE seguir siendo la vista por defecto: al entrar a FlowSync sin indicar una vista, el miembro aparece en la lista, haya usado el tablero o no en su visita anterior.
- **FR-008**: Si las tareas no se pueden cargar, el tablero DEBE decirlo con un mensaje en castellano y ofrecer reintentar, y NO DEBE mostrar las columnas vacías como si no hubiera tareas.
- **FR-009**: El tablero NO DEBE ser visible para una persona sin sesión iniciada, reutilizando la autenticación existente sin modificarla.
- **FR-010**: El tablero NO DEBE ofrecer ninguna vía para crear tareas, añadir, quitar, renombrar o reordenar columnas, ni filtrar.

**Mover de columna (P2)**

- **FR-011**: Un miembro DEBE poder cambiar el estado de cualquier tarea del tablero arrastrando su tarjeta con el ratón a otra columna.
- **FR-012**: Cada tarjeta DEBE incluir el mismo control de estado que ya tiene cada fila de la lista, que permite cambiar el estado sin ratón y sin arrastrar, en 2 interacciones o menos, sin diálogo de confirmación y sin campos que rellenar (RF-9, RNF-1).
- **FR-013**: El tablero DEBE aceptar cualquier transición entre los tres estados, en cualquier sentido, sobre cualquier tarea, con las mismas reglas que el cambio de estado desde la lista (`specs/002-cambiar-estado/`).
- **FR-014**: Tras un cambio de estado, la tarjeta DEBE aparecer en su nueva columna y los recuentos DEBEN actualizarse de inmediato, sin recargar ni navegar (RNF-3).
- **FR-015**: Si el cambio no llega a guardarse, por el motivo que sea, la tarjeta DEBE volver a su columna de origen, los recuentos DEBEN volver a sus valores anteriores y el miembro DEBE ver un mensaje comprensible en castellano, sin errores técnicos crudos. Si la tarea ya no existe, el mensaje DEBE decirlo y distinguirse del de un fallo de conexión. En ningún caso el tablero debe mostrar en una columna una tarea cuyo estado guardado es otro.
- **FR-016**: Cuando el cambio se hace con el control de estado de la tarjeta, el foco DEBE quedarse en esa tarjeta, en su nueva columna (o en la de origen, si el cambio no se guardó).
- **FR-017**: Soltar una tarjeta en su misma columna o fuera de cualquier columna NO DEBE cambiar nada ni mostrar ningún mensaje.
- **FR-018**: Mover una tarjeta NO DEBE modificar ningún otro dato de la tarea (título, responsable) ni el estado de las demás tareas. Dentro de cada columna, las tarjetas DEBEN seguir el mismo orden que la lista; mover una tarjeta no la coloca donde se soltó.
- **FR-019**: Un cambio de estado hecho desde el tablero DEBE ser el mismo cambio que hace la lista: lo que el tablero muestra como guardado es lo que la lista muestra (incluido que una tarea pasada a «Hecho» salga de la vista por defecto de la lista, RF-21).

**Columnas vacías y pantallas estrechas (P3)**

- **FR-020**: Una columna sin tareas DEBE mostrar un recuento de 0 y un mensaje que diga que no hay tareas en ese estado; el mensaje DEBE aparecer o desaparecer en el acto cuando una tarjeta sale de la columna o entra en ella.
- **FR-021**: Con el espacio sin ninguna tarea, el tablero DEBE indicar, además, que las tareas se crean desde la lista y ofrecer ir a ella.
- **FR-022**: Cargando, error de carga y columna vacía DEBEN distinguirse a simple vista entre sí.
- **FR-023**: En pantallas estrechas, las columnas DEBEN colocarse una debajo de otra, en el mismo orden, y la página NO DEBE desplazarse en horizontal en ningún ancho de pantalla.

**Transversales**

- **FR-024**: Todo lo que el tablero permite —ir y volver de la lista, recorrer las tarjetas, abrir una tarea, cambiar el estado— DEBE poder hacerse solo con el teclado, con el foco siempre visible y un orden de tabulación que sigue las columnas y, dentro de cada una, las tarjetas (RNF-6).
- **FR-025**: El tablero DEBE plegarse a DESIGN.md: los colores, superficies, tipografía y componentes son los del design system, no los del prototipo (Principio VI).
- **FR-026**: Todos los textos del tablero (nombres de columna, mensajes de vacía, de error y de cambio no guardado) DEBEN estar en castellano y con el tono de los ya existentes (RNF-8).

### Key Entities

- **Tarea**: la unidad de trabajo del espacio compartido, la misma que ya muestra la lista. En el tablero se ven su título, su responsable y su estado; el único dato que el tablero puede cambiar es el estado.
- **Estado**: catálogo cerrado de tres valores —«Pendiente», «En curso», «Hecho»—; cualquier transición entre ellos es válida.
- **Columna**: no es un dato nuevo, sino la agrupación visible de las tareas de un mismo estado, con su recuento. Hay tres, una por estado, y no se pueden configurar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona que abre el tablero enumera qué tareas hay pendientes, en curso y hechas, y quién lleva cada una, en menos de 10 segundos y sin abrir ninguna tarea (P-1 del PRD, sobre el tablero).
- **SC-002**: En el 100% de los casos, cada tarea del espacio aparece en una sola columna, la de su estado guardado, y el recuento de cada columna coincide con sus tarjetas.
- **SC-003**: Un miembro cambia una tarea de columna con 1 arrastre, o con 2 interacciones o menos desde el control de estado de la tarjeta, sin abrirla y sin confirmar nada.
- **SC-004**: El 100% de los cambios de estado aceptados se ven en el tablero (tarjeta en su nueva columna y recuentos al día) en menos de 1 segundo, sin recargar.
- **SC-005**: En 0 casos el tablero termina mostrando una tarea en una columna que no corresponde a su estado guardado, incluidos los cambios que fallan.
- **SC-006**: Todos los recorridos del tablero —ir y volver de la lista, abrir una tarea y volver, mover una tarea a cada una de las otras dos columnas— se completan usando solo el teclado.
- **SC-007**: El tablero no presenta ninguna violación grave ni crítica de accesibilidad WCAG 2.1 A/AA, en ninguno de sus estados (con tareas, con columnas vacías, con un cambio fallido).
- **SC-008**: En una pantalla de 320 px de ancho, las tres columnas se leen apiladas y la página no se desplaza en horizontal.
- **SC-009**: Con unas 200 tareas repartidas entre las tres columnas (RNF-5), abrir el tablero y mover una tarjeta se hacen sin espera perceptible.
- **SC-010**: Con el mismo estado guardado, el tablero y la lista nunca se contradicen: una tarea movida en el tablero aparece con ese estado en la lista (y viceversa) en el 100% de los casos.

## Assumptions

- **El servidor no cambia.** El tablero se construye con lo que ya existe: la consulta de tareas por estado (`specs/005-filtrar-por-estado/`) y el cambio de estado (`specs/002-cambiar-estado/`). No hay datos, reglas ni validaciones nuevas; si algo del tablero no pudiera hacerse sin tocar el servidor, se vuelve a la spec antes de cambiarlo.
- **El tablero no altera la decisión de RF-21.** La lista sigue escondiendo lo hecho por defecto; el tablero es una segunda vista, a la que se va a propósito, y es la única que enseña lo hecho junto a lo vivo. RF-16 (una sola lista para todos) se mantiene: el tablero enseña el mismo conjunto de tareas a todos, agrupado de otra forma.
- **«Volver» desde una tarea abierta desde el tablero lleva al tablero**, no a la lista. Amplía, sin contradecirlo, el FR-003 de `specs/003-abrir-tarea/` (desde la lista, se vuelve a la lista): se vuelve a la vista desde la que se abrió.
- **El tablero tiene dirección propia.** Recargar estando en él, o abrir su dirección, muestra el tablero. «La lista es la vista por defecto» se lee como «se entra por la lista y FlowSync no recuerda cuál se usó la última vez», igual que el filtro de `specs/005-filtrar-por-estado/` no se queda pegado.
- **Orden dentro de cada columna**: el mismo que ya usa la lista. Fijar un orden propio es PA-3 del PRD y queda fuera; reordenar a mano dentro de una columna no entra (ver «Del prototipo a la spec»).
- **La columna «Hecho» enseña todas las tareas hechas**, sin límite ni paginación. A la escala objetivo (unas 200 tareas, RNF-5) cabe; si deja de caber, es una decisión de producto aparte.
- **El estado se ve en la tarjeta a través de su control de estado**, que ya muestra el estado actual; la columna lo refuerza. No hace falta una etiqueta de estado adicional.
- **Arrastrar es con ratón (o puntero).** En pantallas táctiles, el camino garantizado para mover una tarea es el control de estado de la tarjeta; el arrastre táctil no se exige (RNF-9: escritorio primero).
- **Qué cuenta como interacción**: lo mismo que en `specs/002-cambiar-estado/` (una activación deliberada —clic, toque o tecla que selecciona o confirma—). Un arrastre completo, de coger a soltar, cuenta como una.
- **Los textos exactos** (mensajes de columna vacía, de espacio sin tareas, de error de carga y de cambio no guardado) se redactan en el plan, en castellano y con el tono de los existentes; esta spec solo exige que existan y se distingan.
- **Cómo se señala el estado con color**, si se señala, se resuelve con tokens semánticos de DESIGN.md; un color nuevo se añade como token, nunca copiado del prototipo.
- **Fuera de alcance**: crear tareas desde el tablero, filtros, editar, reasignar o borrar desde la tarjeta, y ver en vivo los cambios de otras personas (E3-2).
- **Sin dependencias nuevas** y sin tocar la autenticación.

## Del prototipo a la spec

El prototipo de Stitch (`docs/design/prototipo-tablero.png`) y la sesión con la usuaria (`docs/design/feedback-prototipo.md`) son entrada de requisitos, no de estilos (Principio VI).

**Entra**

| Del prototipo o del feedback | En la spec | Por qué |
|---|---|---|
| Tres columnas con recuento | FR-001, FR-003 | Son los tres estados fijos de RF-8 (feedback, punto 8). |
| Arrastrar de columna | FR-011 | Fue lo primero que hizo la usuaria y le salió bien (punto 1). |
| Mover sin ratón desde la tarjeta | FR-012, FR-016, FR-024 | No pudo hacerlo con el teclado (punto 2); DESIGN.md exige alternativa al arrastre. |
| Las hechas, en su columna | FR-002 | «Las tareas hechas no me las quitéis» (punto 4). |
| Columna vacía que lo dice | FR-020 a FR-022 | Una columna en blanco le pareció un error de carga (punto 5). |
| La tarjeta vuelve si no se guarda | FR-015 | «Al moverla, ¿se ha guardado?» (punto 6). |
| Columnas apiladas en móvil | FR-023 | Punto 9, y DESIGN.md (Layout). |
| «Vista de lista» en un clic; la lista, por defecto | FR-006, FR-007 | Punto 10. |
| Título y responsable en la tarjeta | FR-004 | Son los datos que ya muestra la lista (RF-17). |

**No entra**

| Del prototipo o del feedback | Por qué no |
|---|---|
| Prioridades (Alta / Media / Baja) | FlowSync no tiene prioridades; el PRD las excluye (§4.2) y la usuaria dice que no las usan (punto 7). |
| Avatares con foto | FlowSync no tiene fotos de perfil; el responsable se muestra por su nombre (punto 7). |
| «+ Añadir columna» (columnas configurables) | Los estados son tres y fijos (RF-8, E2-4; punto 8). |
| Reordenar dentro de una columna | El orden no es un dato de FlowSync y sería planificación (PRD §4.2); PA-3 sigue abierto. |
| Colores del prototipo | Manda DESIGN.md: color solo para estado, error y foco, con tokens semánticos. |
| Crear tarea desde el tablero («Nueva tarea… / Crear») | Fuera de alcance: se crea desde la lista. |
| Fechas en la tarjeta | RF-15: la fecha se ve al abrir la tarea, no en la vista principal. |
| Marca de vencida en la tarjeta (punto 3) | **Decisión de producto pendiente.** La pidió la usuaria, pero choca con RF-15 y con PA-1 del PRD (el vencimiento no se ve de un vistazo en el MVP), y la vista principal no sabe hoy si una tarea está vencida. No se resuelve en esta spec: queda anotada para que producto decida si el tablero (o la lista) debe enseñarla, lo que reabriría RF-15. |
| Ver en vivo los cambios de otras personas | Es E3-2, que no está construida. |
