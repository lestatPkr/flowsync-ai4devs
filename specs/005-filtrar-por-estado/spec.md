# Feature Specification: Filtrar la lista por estado

**Feature Branch**: `feat/fs-142-filtrar-por-estado`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Nombre corto de la feature: filtrar-por-estado. Historia FS-142 del backlog de FlowSync (docs/backlog/E2-gestion-tareas/us-filtrar-por-estado.md; épica E2 «Gestión de tareas»; deliberadamente ligera, un solo ticket, FS-142.1, de API): «Como miembro del equipo, quiero filtrar la lista por estado, para centrarme en lo pendiente sin que lo ya terminado me estorbe.» Requisitos del PRD (docs/prd/flowsync-mvp.md) que cubre: RF-20, filtrar la lista por estado; RF-21, por defecto las tareas en «Hecho» no aparecen en la lista pero siguen siendo consultables. Criterios de la historia: CA-1 sin filtro se ven pendientes y en curso, y ninguna hecha; CA-2 filtrar por «Pendiente» muestra únicamente las pendientes; CA-3 filtrar por «Hecho» muestra todas las hechas; CA-4 quitar el filtro devuelve a la vista por defecto y no existe una vista que mezcle las hechas con el resto; CA-5 marcar algo como hecho desde la vista por defecto lo saca de la vista y se recupera filtrando por «Hecho»; CA-7 un filtro válido sin resultados es una lista vacía que dice que no hay tareas en ese estado, no un error; CA-8 el espacio sin tareas sigue explicando qué es esto y ofreciendo crear la primera, sin confundirse con «no hay tareas con este filtro»; CA-9 y CA-10 pedir un estado que no es ninguno de los tres se rechaza avisando de que el filtro no es válido, nunca una lista vacía en silencio, y el aviso distingue el error de la ausencia; CA-15 el estado es la única dimensión de filtrado; CA-16 un solo estado a la vez, el nuevo sustituye al anterior; CA-17 el filtro no se queda pegado: al recargar o volver más tarde se aparece en la vista por defecto; CA-18 filtrar no modifica ninguna tarea. Decisión de producto tomada para este cambio (la contradicción CA-9/CA-17 del backlog): el filtro es direccionable desde fuera de la interfaz (una petición puede pedir un estado concreto, y por eso puede pedir uno que no existe), pero la interfaz arranca siempre en la vista por defecto y no recuerda el último filtro. Fuera de alcance: filtrar por responsable o por fecha, ordenar, la lista viva (CA-11 a CA-14 dependen de E3-2), y cualquier cambio en cómo se cambia el estado. Restricciones que la spec respeta sin bajar a lo técnico: la autenticación ya existe y no se toca; espacio único compartido; ninguna dependencia nueva; el estilo visual existente; la lista y el cambio de estado desde la lista ya existen (specs/001 y 002). Escribe la spec en español, con los escenarios de aceptación en DADO / CUANDO / ENTONCES, una historia P1 (acotar la lista por estado, con la vista por defecto, cada estado, el filtro válido sin resultados y el estado que no existe) y una P2 (el filtro en la interfaz: elegirlo, quitarlo, los tres vacíos distintos, no se queda pegado), y marca como [NEEDS CLARIFICATION] solo lo que de verdad quede abierto; lo demás, como supuesto explícito."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acotar la lista por estado (Priority: P1)

Un miembro del equipo, con sesión iniciada, pide la lista de tareas del espacio compartido. Si no dice nada más, recibe lo que está vivo —las pendientes y las que están en curso— y nada de lo ya terminado. Si pide un estado concreto, recibe exactamente las tareas de ese estado y ninguna otra; así es como lo hecho sigue siendo consultable aunque no ocupe sitio por defecto. La petición puede llegar desde fuera de la interfaz, y por eso puede pedir algo que no es ninguno de los tres estados: en ese caso se le dice que lo pedido no es un filtro válido, en lugar de devolverle una lista vacía que se leería como «el equipo no tiene nada en ese estado». Pedir la lista, con o sin filtro, no cambia ninguna tarea.

**Why this priority**: Es el ticket FS-142.1 entero y lo que hace verdad RF-20 y RF-21. Es también donde se pierde, si se pierde, la distinción entre *filtro no válido* y *filtro sin resultados*: si aquí se juntan, ya no se recuperan en ninguna capa de encima (nota de riesgo del backlog). Por sí sola ya entrega valor: la lista deja de arrastrar lo hecho y lo hecho no se pierde.

**Independent Test**: Con sesión iniciada y tareas en los tres estados, pedir la lista sin filtro, con cada uno de los tres estados, con un estado válido que no tiene ninguna tarea y con un estado que no existe; comprobar en cada caso qué tareas llegan —o que llega el rechazo— y que, tras todas las peticiones, ninguna tarea ha cambiado. Se verifica sin tocar la interfaz.

**Acceptance Scenarios**:

1. **DADO** un espacio con tareas en «Pendiente», «En curso» y «Hecho», **CUANDO** un miembro pide la lista sin indicar ningún estado, **ENTONCES** recibe todas las pendientes y todas las que están en curso, **Y** no recibe ninguna hecha. *(CA-1, RF-21)*
2. **DADO** un espacio con tareas en los tres estados, **CUANDO** un miembro pide la lista del estado «Pendiente», **ENTONCES** recibe todas las pendientes, **Y** ninguna en curso ni hecha. *(CA-2, RF-20)*
3. **DADO** un espacio con tareas en los tres estados, **CUANDO** un miembro pide la lista del estado «En curso», **ENTONCES** recibe todas las que están en curso, **Y** ninguna pendiente ni hecha. *(RF-20)*
4. **DADO** un espacio con tareas hechas, que la lista sin filtro no incluye, **CUANDO** un miembro pide la lista del estado «Hecho», **ENTONCES** recibe todas las hechas, **Y** ninguna pendiente ni en curso. *(CA-3, RF-21)*
5. **DADO** un espacio en el que ahora mismo ninguna tarea está «En curso», **CUANDO** un miembro pide la lista de ese estado, **ENTONCES** recibe una lista vacía, **Y** eso no es un error ni un rechazo: es la respuesta correcta a una pregunta válida. *(CA-7)*
6. **DADO** un miembro que pide la lista de un estado que no es ninguno de los tres (por ejemplo, «Archivada»), **CUANDO** el sistema lo recibe, **ENTONCES** lo rechaza avisando de que ese filtro no es válido, **Y** no devuelve ninguna lista, ni vacía ni con tareas. *(CA-9)*
7. **DADO** el rechazo del escenario anterior, **CUANDO** quien pidió la lista lee el aviso, **ENTONCES** el aviso dice que el problema es el estado pedido e indica cuáles son los tres válidos, **Y** no se puede confundir con la respuesta de un filtro válido sin resultados: son dos desenlaces distintos, no dos textos de un mismo desenlace. *(CA-10)*
8. **DADO** un miembro que pide una lista que mezcle las hechas con el resto (todas las tareas a la vez, o más de un estado en la misma petición), **CUANDO** el sistema lo recibe, **ENTONCES** lo rechaza como filtro no válido, igual que en el escenario 6, **Y** no existe ninguna forma de obtener en una sola lista las hechas junto a las demás. *(CA-4, CA-16)*
9. **DADO** una tarea que está en la lista sin filtro, **CUANDO** alguien la pasa a «Hecho» y después se vuelve a pedir la lista, **ENTONCES** ya no está en la lista sin filtro, **Y** sí está en la lista del estado «Hecho»; si después se devuelve a «Pendiente» o «En curso», reaparece en la lista sin filtro y sale de la de «Hecho». *(CA-5, RF-21)*
10. **DADO** un espacio con tareas en varios estados, **CUANDO** un miembro pide la lista varias veces, sin filtro y con distintos estados, válidos y no válidos, **ENTONCES** ninguna tarea cambia de estado, de responsable, de título ni de fecha de vencimiento. *(CA-18)*
11. **DADO** una lista, con o sin filtro, que no trae ninguna tarea, **CUANDO** se recibe, **ENTONCES** permite saber si el espacio no tiene ninguna tarea en absoluto o si sí tiene tareas, pero ninguna encaja en lo pedido. *(necesario para CA-8 en la User Story 2)*
12. **DADO** una persona sin sesión iniciada, **CUANDO** pide la lista, con o sin filtro, **ENTONCES** no recibe ninguna tarea, **Y** se le trata como en cualquier otra petición protegida de la autenticación existente, sin cambios en este alcance.

---

### User Story 2 - El filtro en la interfaz (Priority: P2)

Un miembro del equipo abre la lista y la ve, siempre, en la vista por defecto: lo pendiente y lo que está en curso, sin lo terminado. Si quiere centrarse en un solo estado, elige uno de los tres; si elige otro, el nuevo sustituye al anterior; si lo quita, vuelve a la vista por defecto. No hay un «Todas» ni ninguna otra forma de acotar la lista. Cuando la lista se queda sin filas, entiende por qué: no es lo mismo «no hay tareas en este estado» que «este espacio todavía no tiene tareas». Y el filtro es algo de este momento, no un ajuste: si recarga o vuelve otro día, aparece de nuevo en la vista por defecto, para que nadie crea que el equipo está parado porque se dejó puesto «Hecho».

**Why this priority**: Es lo que hace observables para las personas CA-4, CA-5, CA-7, CA-8 y CA-17, que la User Story 1 no puede verificar por sí sola. Depende de ella, pero se puede comprobar por separado.

**Independent Test**: Con sesión iniciada, abrir la lista y comprobar que está en la vista por defecto; elegir cada estado, cambiar de uno a otro y quitar el filtro; pasar una tarea a «Hecho» desde la vista por defecto y recuperarla con el filtro; provocar cada uno de los vacíos (estado sin tareas, espacio sin tareas, todo hecho) y comprobar que el mensaje es distinto en cada uno; recargar con un filtro puesto y comprobar que vuelve la vista por defecto. Repetir el recorrido del filtro solo con el teclado.

**Acceptance Scenarios**:

1. **DADO** un miembro que abre la lista, **CUANDO** se muestra, **ENTONCES** está en la vista por defecto (pendientes y en curso, sin hechas), **Y** se ve que no hay ningún filtro aplicado y que lo hecho no se está mostrando. *(CA-1)*
2. **DADO** un miembro en la lista, **CUANDO** busca cómo acotar lo que ve, **ENTONCES** las únicas opciones son los tres estados, «Pendiente», «En curso» y «Hecho», y quitar el filtro, **Y** no hay ninguna opción de «Todas», ni de filtrar por responsable, por fecha ni por ninguna otra cosa. *(CA-4, CA-15, RF-20)*
3. **DADO** un miembro en la vista por defecto, **CUANDO** filtra por «Pendiente», **ENTONCES** ve únicamente las pendientes, **Y** se ve qué filtro tiene aplicado. *(CA-2)*
4. **DADO** un miembro que está filtrando por «Pendiente», **CUANDO** filtra por «En curso», **ENTONCES** ve únicamente las que están en curso: el nuevo filtro sustituye al anterior en lugar de sumarse. *(CA-16)*
5. **DADO** un miembro con un filtro aplicado, **CUANDO** lo quita, **ENTONCES** vuelve a la vista por defecto, con pendientes y en curso y sin hechas. *(CA-4)*
6. **DADO** un miembro en la vista por defecto, **CUANDO** marca una tarea como «Hecho» desde su fila y el cambio se guarda, **ENTONCES** la tarea desaparece de la vista, **Y** al filtrar por «Hecho» la encuentra ahí. *(CA-5, RF-21)*
7. **DADO** un miembro que está filtrando por un estado, **CUANDO** cambia desde su fila una de esas tareas a otro estado y el cambio se guarda, **ENTONCES** la tarea sale de la vista, porque ya no es de ese estado; en particular, devolver una tarea desde el filtro «Hecho» la saca de ahí y la hace aparecer en la vista por defecto. *(RF-21, PA-7)*
8. **DADO** un espacio con tareas en el que ahora mismo ninguna está «En curso», **CUANDO** un miembro filtra por «En curso», **ENTONCES** ve un mensaje que dice explícitamente que no hay tareas en ese estado, **Y** no se le presenta como un error ni como el mensaje de un espacio sin tareas. *(CA-7)*
9. **DADO** un espacio en el que no se ha creado ninguna tarea, **CUANDO** un miembro mira la lista, **ENTONCES** se le explica qué es esa lista y se le ofrece crear la primera tarea, como hasta ahora, **Y** no se le muestra el mensaje de «no hay tareas en este estado», que daría a entender que hay trabajo escondido detrás de un filtro. *(CA-8)*
10. **DADO** un espacio cuyas tareas están todas en «Hecho», **CUANDO** un miembro mira la vista por defecto, **ENTONCES** se le dice que no hay nada pendiente ni en curso y que lo hecho se consulta filtrando por «Hecho», **Y** no se le presenta como un espacio sin tareas ni se le invita a crear la primera. *(CA-7, CA-8)*
11. **DADO** un miembro que ha filtrado por «Hecho», **CUANDO** recarga la página, cierra sesión y vuelve a entrar, o vuelve a la lista otro día, **ENTONCES** aparece en la vista por defecto, no en el filtro que dejó puesto. *(CA-17)*
12. **DADO** un miembro que llega a la lista a través de un enlace o una dirección que pretende indicar un estado, válido o no, **CUANDO** se muestra la lista, **ENTONCES** aparece en la vista por defecto, **Y** no se le muestra un filtro aplicado ni un aviso de filtro no válido: la interfaz no recoge el filtro de fuera. *(decisión de producto sobre CA-9/CA-17)*
13. **DADO** un miembro que está filtrando por un estado, **CUANDO** abre una tarea de la lista y la cierra para volver, **ENTONCES** sigue viendo la lista con ese mismo filtro y puede seguir recorriéndola desde la tarea que abrió: abrir y cerrar una tarea no es «volver más tarde». *(CA-17, `specs/003-abrir-tarea/` CA-3)*
14. **DADO** un miembro en la lista que usa únicamente el teclado, **CUANDO** aplica un filtro, lo cambia por otro y lo quita, **ENTONCES** puede hacerlo todo igual que con el ratón, **Y** sabe en todo momento qué filtro tiene aplicado sin depender del color. *(CA-6, RNF-6)*
15. **DADO** un miembro que aplica y quita filtros varias veces, **CUANDO** vuelve a la vista por defecto, **ENTONCES** todas las tareas están en el estado en que estaban y con los mismos datos. *(CA-18)*
16. **DADO** un miembro que elige un filtro, **CUANDO** la lista no se puede cargar por un fallo de conexión, **ENTONCES** se le explica que no se ha podido cargar y qué puede hacer, **Y** no se le muestra ni el mensaje de «no hay tareas en este estado» ni el de espacio sin tareas. *(RNF-10)*

---

### Edge Cases

- **Crear una tarea con un filtro que no la incluye.** Toda tarea nueva nace en «Pendiente» (`specs/001-crear-tarea/`) y debe aparecer en la lista de quien la crea sin recargar. Si en ese momento el filtro aplicado es «En curso» o «Hecho», la lista vuelve a la vista por defecto para que la tarea nueva se vea; con el filtro «Pendiente», o sin filtro, simplemente aparece.
- **El cambio de estado no se guarda con un filtro aplicado.** Se aplica lo ya exigido por `specs/002-cambiar-estado/` (FR-012): la fila muestra el estado real de la tarea y un mensaje comprensible. Como la tarea no ha cambiado de estado, no sale de la vista.
- **Varios cambios seguidos sobre la misma tarea con un filtro aplicado.** La tarea sale de la vista en cuanto su estado guardado deja de coincidir con el filtro; no hay que esperar a una recarga.
- **Otra persona cambia el estado de una tarea que tengo a la vista.** Sin lista viva (E3-2), mi vista no se entera sola: la tarea sigue donde estaba hasta que vuelva a cargar la lista, y entonces aparece donde le corresponde. Que la vista filtrada se mantenga cierta en vivo es CA-11 a CA-14 y queda fuera de este alcance.
- **El filtro es de cada persona.** Lo que una persona filtra no cambia lo que ve ninguna otra: lo compartido es el contenido de la lista, no la lente (CA-13). Como el filtro no se guarda en ningún sitio, esto se cumple sin lista viva.
- **Petición con el estado vacío, repetido o mezclado con otros.** Todo lo que no sea exactamente uno de los tres estados se rechaza como filtro no válido (User Story 1, escenarios 6 y 8); nunca se adivina qué se quería decir ni se devuelve una lista vacía en silencio.
- **Espacio sin tareas y filtro pedido desde fuera de la interfaz.** Si el filtro es válido, la respuesta es una lista vacía que permite saber que el espacio no tiene tareas (User Story 1, escenario 11); si no es válido, prevalece el rechazo: lo pedido no tiene sentido tenga o no tareas el espacio.
- **La sesión caduca con un filtro aplicado.** Al siguiente intento de cargar la lista se actúa como en cualquier otra pantalla protegida de la autenticación existente; al volver a entrar se aparece en la vista por defecto (User Story 2, escenario 11).
- **Muchas tareas hechas.** «Hecho» es el único conjunto que crece sin límite; en este cambio se muestra con el mismo orden que ya usa la lista, sin paginación ni orden propio (PA-3, fuera de alcance).
- **Tarea abierta desde el filtro «Hecho».** Se abre igual que cualquier otra (`specs/003-abrir-tarea/`), con su estado «Hecho»; al cerrarla se vuelve a la lista con el filtro «Hecho» (User Story 2, escenario 13).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sin ningún estado indicado, la lista DEBE incluir todas las tareas del espacio en «Pendiente» y en «En curso», y NO DEBE incluir ninguna en «Hecho» (RF-21).
- **FR-002**: La lista DEBE poder pedirse para exactamente uno de los tres estados, «Pendiente», «En curso» o «Hecho», y en ese caso DEBE incluir todas las tareas de ese estado y ninguna de otro (RF-20).
- **FR-003**: El filtro DEBE poder indicarse en la propia petición de la lista, de modo que pueda pedirse un estado concreto también desde fuera de la interfaz.
- **FR-004**: Un filtro válido sin ninguna tarea que encaje DEBE responderse con una lista vacía, NO con un error ni con un rechazo.
- **FR-005**: El sistema DEBE rechazar cualquier filtro que no sea exactamente uno de los tres estados —un estado desconocido, un valor vacío, varios estados a la vez o una petición de «todas»—, avisando en castellano de que el filtro no es válido e indicando cuáles son los tres estados válidos. Ante un filtro no válido NO DEBE devolver ninguna lista, ni vacía ni con tareas.
- **FR-006**: El rechazo de un filtro no válido y la respuesta a un filtro válido sin resultados DEBEN ser desenlaces distinguibles sin leer el texto del mensaje, y el rechazo DEBE seguir la misma forma de aviso que ya usa el resto del producto para lo pedido que no es válido.
- **FR-007**: NO DEBE existir ninguna forma, ni en la interfaz ni fuera de ella, de obtener en una misma lista las tareas hechas junto con las pendientes o en curso (CA-4).
- **FR-008**: Cuando la lista pedida, con o sin filtro, no trae ninguna tarea, DEBE poder saberse si el espacio no tiene ninguna tarea en absoluto o si tiene tareas pero ninguna encaja en lo pedido.
- **FR-009**: Pedir la lista, con cualquier filtro o sin él, NO DEBE modificar ninguna tarea: ni su estado, ni su responsable, ni su título, ni su fecha de vencimiento (CA-18).
- **FR-010**: Pedir la lista, con o sin filtro, DEBE exigir sesión iniciada, reutilizando la autenticación existente sin modificarla.
- **FR-011**: El estado DEBE ser la única dimensión de filtrado. NO DEBE ofrecerse ni aceptarse ningún filtro por responsable, por fecha ni por ningún otro dato (CA-15, RF-20).
- **FR-012**: La interfaz DEBE mostrar la lista en la vista por defecto cada vez que se llega a ella: al entrar, al recargar, al volver a iniciar sesión y al llegar a través de cualquier enlace o dirección, aunque este pretenda indicar un estado. La interfaz NO DEBE recordar el último filtro usado entre visitas (CA-17, decisión de producto).
- **FR-013**: Dentro de una misma visita a la lista, el filtro aplicado DEBE mantenerse al abrir una tarea y cerrarla para volver.
- **FR-014**: La interfaz DEBE ofrecer como filtros únicamente los tres estados y la opción de quitar el filtro; elegir un estado DEBE sustituir al que hubiera; quitarlo DEBE volver a la vista por defecto (CA-4, CA-16).
- **FR-015**: La interfaz DEBE dejar claro en todo momento si hay un filtro aplicado y cuál es, y, en la vista por defecto, que las tareas hechas no se están mostrando.
- **FR-016**: Cuando una tarea cambia de estado desde la lista y el cambio se guarda, DEBE salir de la vista si su nuevo estado ya no corresponde a lo que se está viendo, y aparecer en la vista del estado al que ha pasado. Esto sustituye, para la vista por defecto, lo que `specs/002-cambiar-estado/` exigía en su FR-013 (que la tarea hecha siguiera visible en la lista).
- **FR-017**: La interfaz DEBE distinguir, con mensajes distintos, estos vacíos: (a) filtro por un estado sin tareas, que dice que no hay tareas en ese estado y no se presenta como error; (b) espacio sin ninguna tarea, que explica qué es la lista y ofrece crear la primera, como exige `specs/001-crear-tarea/` (FR-010); (c) vista por defecto vacía con tareas hechas en el espacio, que dice que no hay nada pendiente ni en curso y cómo consultar lo hecho. El mensaje de (a) NUNCA DEBE mostrarse en el caso (b), y el de (b) NUNCA en los casos (a) ni (c).
- **FR-018**: Si la interfaz recibe el rechazo de un filtro no válido, DEBE mostrar un aviso de filtro no válido, distinto de los tres vacíos de FR-017, y ofrecer volver a la vista por defecto (CA-9, CA-10).
- **FR-019**: Un fallo al cargar la lista DEBE explicarse como tal, con un mensaje comprensible en castellano, y NO DEBE presentarse como ninguno de los vacíos de FR-017 ni como un filtro no válido (RNF-10).
- **FR-020**: Crear una tarea mientras el filtro aplicado es «En curso» o «Hecho» DEBE llevar la lista a la vista por defecto, de modo que la tarea nueva, que nace en «Pendiente», se vea sin recargar.
- **FR-021**: Aplicar, cambiar y quitar el filtro DEBE poder hacerse íntegramente con el teclado, el filtro aplicado DEBE identificarse sin depender del color (RNF-6), y todo ello DEBE plegarse al estilo visual ya existente en la lista (R-8).
- **FR-022**: Lo que una persona filtra NO DEBE cambiar lo que ve ninguna otra (CA-13).

### Key Entities

- **Tarea** (existente): la unidad de trabajo del espacio compartido. Para este cambio solo importa su **estado**, uno de «Pendiente», «En curso» o «Hecho». Este cambio no le añade ni le quita ningún dato.
- **Vista por defecto**: lo que se ve de la lista cuando no hay ningún filtro: las tareas pendientes y en curso. No es un filtro más, sino la ausencia de filtro; no se elige, se vuelve a ella.
- **Filtro por estado**: la petición de ver solo las tareas de uno de los tres estados. Es de quien mira y de ese momento: no se guarda, no se comparte y no sobrevive a recargar o volver más tarde. Solo hay uno a la vez.
- **Filtro no válido**: cualquier cosa pedida como filtro que no sea exactamente uno de los tres estados. No es un vacío: es un rechazo.
- **Los vacíos de la lista**: estado sin tareas, espacio sin tareas y vista por defecto sin nada vivo. Tres situaciones que no se confunden entre sí ni con un filtro no válido ni con un fallo de carga.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con tareas en los tres estados, la lista sin filtro contiene el 100% de las pendientes y de las que están en curso, y el 0% de las hechas.
- **SC-002**: Para cada uno de los tres estados, la lista filtrada contiene el 100% de las tareas de ese estado y el 0% de las de los otros dos.
- **SC-003**: El 100% de las peticiones con un filtro que no es exactamente uno de los tres estados se rechazan con un aviso de filtro no válido; en 0 casos devuelven una lista, vacía o no.
- **SC-004**: El 100% de las peticiones con un filtro válido sin coincidencias devuelven una lista vacía; en 0 casos se rechazan o se presentan como error.
- **SC-005**: En 0 casos una lista contiene a la vez tareas hechas y tareas pendientes o en curso.
- **SC-006**: Tras cualquier secuencia de peticiones de la lista y de filtros en la interfaz, el 100% de las tareas conservan su estado, responsable, título y fecha de vencimiento.
- **SC-007**: En el 100% de las entradas a la lista —al entrar, al recargar, al volver a iniciar sesión o al llegar por un enlace— se aparece en la vista por defecto.
- **SC-008**: Aplicar un filtro, cambiarlo por otro o quitarlo cuesta 2 interacciones o menos desde la lista visible, contadas como en `specs/002-cambiar-estado/`, y se completa usando solo el teclado.
- **SC-009**: Una tarea marcada como hecha desde la vista por defecto sale de ella en cuanto el cambio se guarda, sin recargar, y se encuentra en el filtro «Hecho» en el 100% de los casos.
- **SC-010**: En cada uno de los vacíos (estado sin tareas, espacio sin tareas, vista por defecto con todo hecho), el filtro no válido y el fallo de carga, quien mira ve un mensaje distinto; en 0 casos uno de ellos se muestra en lugar de otro.
- **SC-011**: El resultado de aplicar o quitar un filtro se ve sin espera perceptible (menos de 1 segundo a la escala objetivo de RNF-5).

## Assumptions

- **Decisión sobre la contradicción CA-9/CA-17.** El filtro es direccionable en la petición de la lista (FR-003): por eso existe el filtro no válido y por eso se rechaza. La interfaz, en cambio, no recoge el filtro de ningún enlace ni lo recuerda: siempre arranca en la vista por defecto (FR-012). En consecuencia, el «enlace guardado» de CA-9 se verifica en la User Story 1 (la petición), no en la interfaz, que solo ofrece los tres estados y nunca puede pedir uno inexistente; FR-018 cubre, por robustez, qué muestra la interfaz si aun así recibiera el rechazo.
- **«Volver más tarde» (CA-17) es una visita nueva**: recargar, volver a iniciar sesión, abrir la aplicación otro día o llegar desde un enlace. Abrir una tarea y cerrarla para volver a la lista no lo es: el filtro se mantiene (FR-013), para no romper el recorrido de `specs/003-abrir-tarea/` (volver y seguir desde la tarea que se abrió), que con el filtro «Hecho» sería imposible si el filtro se perdiera.
- **Varios estados a la vez, «todas» y valores vacíos se rechazan**, en lugar de interpretarse. CA-16 (un solo estado a la vez) y CA-4 (ninguna vista mezcla lo hecho con el resto) se leen así también fuera de la interfaz: lo que no es exactamente un estado es un filtro no válido, y el backlog pide no adivinar ni responder vacío en silencio.
- **Se incluye la interfaz (User Story 2) aunque el backlog saque FS-142 con un único ticket de API.** CA-4, CA-5, CA-7, CA-8 y CA-17 solo son observables en la interfaz, y sin ella RF-21 escondería lo hecho sin camino de vuelta desde la lista. La User Story 1 es el ticket FS-142.1 y se puede entregar sola; cómo se reparten ambas historias en commits o PRs se decide en el plan.
- **CA-6 (manejar el filtro sin ratón) entra en el alcance** aunque no figure en la lista de criterios de la entrada: RNF-6 nombra «filtrar» entre las acciones que deben ser operables por teclado.
- **El filtro es una recuperación suficiente para lo marcado como hecho por error** (segunda mitad de PA-7). `specs/002-cambiar-estado/` ya decidió que toda transición es válida; aquí, lo que cambia es que la tarea hecha deja de estar a la vista y se recupera filtrando por «Hecho» y devolviéndola desde su fila. No se añade deshacer ni confirmación: cambiar cómo se cambia el estado está fuera de alcance.
- **Esta spec sustituye dos decisiones provisionales anteriores**: el FR-013 y el escenario 2 de la User Story 2 de `specs/002-cambiar-estado/` (la tarea hecha sigue visible en la lista) y el supuesto de `specs/004-fecha-vencimiento/` de que las tareas hechas siguen en la lista «hasta que llegue FS-142». Ambos se escribieron a la espera de este cambio.
- **Crear con un filtro que no incluye «Pendiente» vuelve a la vista por defecto** (FR-020), porque `specs/001-crear-tarea/` exige que la tarea creada se vea sin recargar ni navegar, y es la lectura más simple que lo cumple sin añadir avisos nuevos.
- **El orden de la lista no cambia**: la lista filtrada usa el mismo orden que ya tiene la lista. Fijar un orden, en particular para «Hecho», es PA-3 y queda fuera de alcance, igual que paginar.
- **Cómo se nombran los estados al pedirlos desde fuera de la interfaz**, y si se distingue mayúsculas de minúsculas, se fija en el plan; esta spec solo exige que los tres estados válidos se puedan pedir, que cualquier otra cosa se rechace y que el rechazo diga cuáles son los válidos.
- **Los textos exactos** de los mensajes (estado sin tareas, vista por defecto sin nada vivo, filtro no válido) se redactan en el plan, en castellano y con el tono de los ya existentes; el del espacio sin tareas es el que ya hay. Esta spec solo exige que existan, que se distingan y que sean comprensibles.
- **La forma del control del filtro** (pestañas, selector u otro) se decide en el plan, con los componentes ya existentes y sin dependencias nuevas.
- **Fuera de alcance**: filtrar por responsable o por fecha, ordenar o agrupar la lista, la lista viva y la coherencia en vivo del filtro con los cambios ajenos (CA-11, CA-12 y CA-14, que dependen de E3-2), y cualquier cambio en cómo se cambia el estado de una tarea.
- **Sin dependencias nuevas**, sin tocar la autenticación y sin nada nuevo que almacenar: filtrar se apoya en el estado que ya guarda cada tarea, en el espacio único compartido.
