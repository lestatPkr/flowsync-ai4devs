# Feature Specification: Borrar una tarea

**Feature Branch**: `build/borrar`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Nombre corto de la feature: borrar-tarea. Historia E2-10 del backlog (docs/backlog/E2-gestion-tareas/us-borrar-tarea.md), con sus criterios CA-1 a CA-11 (los [PROPUESTO] entran como propuestos). Entrada obligatoria, léela antes de escribir: el modelo de amenazas docs/security/threat-model-e2-10.md. Cada mitigación de ese modelo entra en la spec como requisito o escenario de aceptación, o queda anotada como decisión de producto pendiente si choca con el PRD (por ejemplo, registrar quién borró frente a RNF-7). Prioriza: P1 borrar una tarea, propia o ajena, con confirmación explícita que dice que no hay vuelta atrás; P2 los guardarraíles (cancelar no borra nada, sin sesión no se borra nada, borrar lo que ya no existe se explica sin parecer un fallo, borrar cuesta más que cambiar de estado y nunca se completa por accidente); P3 lo que pide el modelo de amenazas y no está en la historia. Restricciones que la spec respeta sin bajar a lo técnico: la autenticación ya existe y no se toca; roles planos (cualquiera puede borrar cualquier tarea); no hay papelera; ninguna dependencia nueva; el estilo es el de DESIGN.md. Escribe la spec en español, con los escenarios en DADO / CUANDO / ENTONCES, incluye una sección corta «Del modelo de amenazas a la spec» que diga qué mitigación entra por qué escenario y cuál queda fuera y por qué, y marca como [NEEDS CLARIFICATION] solo lo que de verdad quede abierto. NO hagas commit, ni push, ni abras ningún PR."

> **Por qué esta spec es más larga de lo que el gesto sugiere.** Borrar es la única acción irreversible del producto: no hay papelera, ni histórico, y los roles son planos (RF-12, PRD §4.2). Casi todo lo que sigue son guardarraíles, y esa proporción es deliberada. La confirmación es un guardarraíl **de producto** contra el error humano, no un control de seguridad: quien habla con el sistema sin pasar por la interfaz no la ve (modelo de amenazas, TF-1 y E-1).

## Clarifications

### Session 2026-10-13

- Q: ¿Desde dónde se pide borrar una tarea (FR-012)? → A: Solo desde la tarea abierta (E2-5); ni la fila de la lista ni la tarjeta del tablero llevan la acción. Decidido en la entrada de `/speckit-plan`: borrar tiene que costar más que cambiar de estado (CA-7).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Borrar una tarea, propia o ajena, confirmando que no hay vuelta atrás (Priority: P1)

Un miembro del equipo, con sesión iniciada, encuentra una tarea que ya no tiene sentido —suya o de otra persona— y quiere quitarla para que la lista no se llene de ruido. Pide borrarla; el producto le pregunta, nombrando la tarea, si de verdad quiere hacerlo y le avisa de que no se podrá recuperar. Confirma, y la tarea desaparece: de su vista en el acto y de la de todo el equipo en cuanto vuelva a mirar.

**Why this priority**: Es el intercambio de valor entero de la historia (RF-12) y, a la vez, el guardarraíl mínimo que el PRD exige para que exista: sin confirmación explícita que avise de la irreversibilidad, borrar no se puede entregar. La historia lo dice sin rodeos: un borrado sin su confirmación deja el guardarraíl sin construir, y el guardarraíl es lo que esta historia entrega.

**Independent Test**: Con sesión iniciada y dos tareas —una propia y otra cuyo responsable y creador es otra persona—, pedir borrar cada una, comprobar que antes de borrar se pide confirmar con un mensaje que nombra la tarea y dice que no se puede recuperar, confirmar, y comprobar que la tarea ya no aparece ni en la lista ni en el tablero, ni para quien la borró ni para otra persona que entre después.

**Acceptance Scenarios**:

1. **DADO** un miembro con sesión iniciada que está sobre una tarea existente, **CUANDO** pide borrarla y confirma, **ENTONCES** la tarea desaparece de su vista sin recargar la página, y deja de aparecer en la lista y en el tablero. *(CA-1)*
2. **DADO** que un miembro ha borrado una tarea, **CUANDO** otra persona del equipo carga la lista o el tablero, **ENTONCES** esa tarea tampoco está para ella. *(CA-2)*
3. **DADO** una tarea que creó y lleva otra persona, **CUANDO** un miembro la borra y confirma, **ENTONCES** se borra igual que una propia, sin pedir ningún permiso especial ni mostrar ninguna advertencia por ser ajena. *(CA-3, R10)*
4. **DADO** un miembro que pide borrar una tarea, **CUANDO** el producto le responde, **ENTONCES** antes de borrar nada le pide confirmar de forma explícita, en una pregunta que bloquea el resto de la pantalla hasta que la responda. *(CA-4)*
5. **DADO** un miembro al que se le está pidiendo confirmar un borrado, **CUANDO** lee la pregunta, **ENTONCES** ve el título de la tarea que va a borrar y entiende, sin tener que deducirlo, que después no se podrá recuperar. *(CA-5)*
6. **DADO** un miembro al que se le está pidiendo confirmar un borrado, **CUANDO** mira las opciones, **ENTONCES** la que borra dice lo que hace (borrar la tarea, no un «Aceptar» genérico) y se distingue visualmente como acción destructiva, y la que no borra es igual de visible. *(CA-5, DESIGN.md)*
7. **DADO** un miembro que acaba de confirmar un borrado, **CUANDO** se completa, **ENTONCES** se le indica brevemente que la tarea se ha borrado, sin ofrecer «deshacer» ni ninguna otra vía de recuperarla. *(CA-8)*
8. **DADO** un borrado confirmado que no llega a completarse por un fallo de conexión, **CUANDO** el miembro mira la pantalla, **ENTONCES** la tarea sigue mostrándose, se le explica en castellano que no se ha podido borrar y qué puede hacer, y en ningún momento se le ha presentado como borrada. *(RNF-10)*

---

### User Story 2 - Los guardarraíles: nada se borra sin querer (Priority: P2)

Quien pide borrar puede echarse atrás sin consecuencias; quien no ha entrado no puede borrar nada; quien llega tarde a borrar una tarea que ya borró otra persona recibe una explicación, no un error; y el gesto irreversible está lejos del gesto barato de cambiar de estado, de modo que ni un doble clic, ni un Enter de más, ni un clic en el sitio equivocado completan un borrado.

**Why this priority**: El borrado de la P1 ya pide confirmación, pero sin estos límites la confirmación se puede saltar por inercia o por la cercanía con el cambio de estado, que se hace en dos interacciones y sin confirmar (RF-9). Es el caso más probable del modelo de amenazas (T-3: un miembro que se equivoca). Depende de la User Story 1, pero se verifica por separado.

**Independent Test**: Con la pregunta de confirmación abierta, cancelarla de cada forma posible —el botón de cancelar, Escape, Enter sin mover el foco, un clic fuera— y comprobar que la tarea sigue idéntica y que no se ha intentado borrar nada; intentar borrar sin sesión y con una sesión ya cerrada; borrar una tarea que otra persona acaba de borrar; y comparar el número de interacciones que cuesta borrar con el que cuesta cambiar el estado.

**Acceptance Scenarios**:

1. **DADO** un miembro al que se le está pidiendo confirmar un borrado, **CUANDO** cancela —con la opción de cancelar, con Escape o haciendo clic fuera de la pregunta—, **ENTONCES** la tarea sigue exactamente igual que antes (título, responsable, estado y fecha), la pregunta se cierra y el foco vuelve a donde estaba antes de pedir borrar. *(CA-6, R5)*
2. **DADO** que se acaba de abrir la pregunta de confirmación, **CUANDO** el miembro pulsa Enter sin moverse de donde la pregunta deja el foco, **ENTONCES** no se borra nada: la opción que recibe el foco al abrirse es la que no borra. *(CA-7, R5)*
3. **DADO** un miembro que pide borrar con un doble clic o pulsando dos veces seguidas la tecla que activa «Borrar», **CUANDO** se completa el gesto, **ENTONCES** la tarea no se ha borrado y la pregunta de confirmación sigue abierta esperando una respuesta deliberada. *(CA-7, R5)* · **[PROPUESTO]**
4. **DADO** un miembro en la lista o en el tablero, **CUANDO** compara lo que cuesta borrar una tarea con lo que cuesta cambiarle el estado, **ENTONCES** borrar cuesta más interacciones, y la acción de borrar no comparte control ni posición con el cambio de estado. *(CA-7, R5)* · **[PROPUESTO]**
5. **DADO** una persona sin sesión iniciada, o con una sesión que ya cerró, **CUANDO** intenta borrar una tarea por cualquier vía, **ENTONCES** no se borra nada y la tarea sigue para todo el equipo. *(CA-10, R1; autenticación existente sin cambios)*
6. **DADO** que otra persona ya ha borrado una tarea que un miembro todavía tenía a la vista, **CUANDO** el miembro intenta borrarla y confirma, **ENTONCES** se le dice en castellano que esa tarea ya no existe, sin presentarlo como un fallo del sistema, y la tarea deja de mostrarse en su vista. *(CA-11, R8)* · **[PROPUESTO]**
7. **DADO** un miembro que quiere quitar de la vista una tarea terminada, **CUANDO** usa el estado «Hecho», **ENTONCES** la tarea sale de la vista por defecto pero sigue siendo consultable, y ese camino es distinto del borrado: no pide confirmación ni destruye nada. *(CA-9, RF-21)*
8. **DADO** un miembro que usa solo el teclado, **CUANDO** pide borrar, recorre la pregunta y la confirma o la cancela, **ENTONCES** puede hacer todo el recorrido igual que con el ratón, con el foco siempre visible y sin salir de la pregunta mientras está abierta. *(RNF-6)*

---

### User Story 3 - Lo que pide el modelo de amenazas y no está en la historia (Priority: P3)

Más allá del miembro que se equivoca, el borrado tiene que aguantar a quien intenta abusar de él: borrar muchas tareas de golpe, colar una referencia a tarea manipulada, hacer que otra web borre en nombre de alguien, enmarcar la aplicación para engañar a alguien y que confirme, o sacar del mensaje de error algo que no debería ver. Y, por diseño, el borrado tiene que ser real y anónimo: la tarea deja de existir de verdad y nadie guarda quién la borró.

**Why this priority**: No lo pide la historia, pero sin esto el borrado irreversible se convierte en la vía más barata para vaciar el tablero de un equipo (modelo de amenazas, T-1, T-2, T-4, T-5, I-1, R-1). Se puede verificar por separado de las User Stories 1 y 2.

**Independent Test**: Con varias tareas creadas, intentar borrar todas a la vez, borrar con referencias a tarea mal formadas o inexistentes, provocar un borrado desde una página de otro sitio con una sesión abierta y cargar la aplicación dentro de una página de otro sitio; comprobar en cada caso cuántas tareas quedan. Después, borrar una tarea y comprobar que no queda rastro de ella ni de quién la borró.

**Acceptance Scenarios**:

1. **DADO** un espacio con N tareas, **CUANDO** alguien intenta borrar varias o todas a la vez, en una sola petición y con o sin criterio de selección, **ENTONCES** no se borra ninguna y siguen N; y un borrado válido de una tarea deja exactamente N−1. *(R3)*
2. **DADO** las tareas existentes, **CUANDO** se pide borrar con una referencia a tarea mal formada, negativa, compuesta por varias o que no corresponde a ninguna tarea, **ENTONCES** no se borra ninguna, la respuesta es la misma que para «esa tarea no existe» y todas siguen. *(R4)*
3. **DADO** un miembro con sesión abierta que visita una página de otro sitio, **CUANDO** esa página intenta que su navegador pida borrar una tarea, **ENTONCES** no se borra nada: el permiso para borrar solo vale cuando lo presenta la propia aplicación por la vía con que ya lo hace hoy, nunca adjunto a una dirección ni de forma automática por el navegador. *(R2)*
4. **DADO** la aplicación servida en un entorno accesible, **CUANDO** una página de otro sitio intenta mostrarla incrustada dentro de la suya, **ENTONCES** el navegador se niega a mostrarla, de modo que nadie puede superponer un engaño a los botones de borrar y confirmar. *(R6)*
5. **DADO** un borrado, correcto o fallido, **CUANDO** el sistema responde, **ENTONCES** la respuesta no contiene datos de la tarea, detalles técnicos internos ni ninguna indicación de quién la borró; y ningún mensaje de la interfaz dice quién borró una tarea. *(R7, RNF-7)*
6. **DADO** una tarea borrada, **CUANDO** se busca por cualquier vía del producto, **ENTONCES** ya no existe —no está oculta ni marcada como borrada— y en ningún dato ni registro nuevo queda constancia de quién la borró. *(R9, CA-8, RNF-7)*

---

### Edge Cases

- **Dos personas borran la misma tarea a la vez.** Gana la primera; la segunda recibe el aviso de «ya no existe» (User Story 2, escenario 6), no un error genérico. No hay bloqueo ni aviso previo de que otra persona está borrando.
- **La tarea se borra mientras otra persona la tiene abierta o a la vista.** Sin lista viva (E3), su vista no se entera sola y sigue mostrando lo que cargó. Lo mínimo garantizado: cualquier cosa que intente hacer después con esa tarea —abrirla, cambiarle el estado, borrarla— le dice que ya no existe, como ya hacen E2-4 y E2-5. Qué debe ver en el momento del borrado es **PA-8** y sigue abierto en el PRD (ver «Del modelo de amenazas a la spec»).
- **La sesión caduca o se cierra con la pregunta de confirmación abierta.** Confirmar no borra nada; se actúa como en cualquier otra acción sin sesión válida de la autenticación existente.
- **Confirmar sin conexión.** No se borra nada y no se muestra como borrado (User Story 1, escenario 8); la tarea sigue y se puede volver a intentar.
- **Título muy largo en la pregunta de confirmación.** Se muestra entero o con una forma de leerlo completo: quien confirma tiene que poder saber qué tarea va a desaparecer.
- **Borrar una tarea en «Hecho», vencida o con fecha.** Se borra igual que cualquier otra, con la misma confirmación; la fecha desaparece con ella.
- **Borrar la última tarea de la lista o de una columna del tablero.** La vista pasa a su estado vacío ya existente, sin errores.
- **Borrar desde fuera de la interfaz.** Quien habla con el sistema directamente no ve la confirmación: es así por diseño, porque el permiso para borrar es el mismo que en la interfaz (roles planos). La spec no finge un control en el servidor que no protegería nada (E-1, R10).

## Requirements *(mandatory)*

### Functional Requirements

**Borrar (P1)**

- **FR-001**: El sistema DEBE permitir a cualquier miembro con sesión iniciada borrar cualquier tarea del espacio compartido, con independencia de quién la creó o quién la lleva, sin permisos especiales ni advertencias por tratarse de una tarea ajena (RF-12, CA-3, R10).
- **FR-002**: El sistema DEBE pedir una confirmación explícita antes de borrar, siempre y sin excepción, también para tareas recién creadas, propias o en «Hecho» (CA-4).
- **FR-003**: La pregunta de confirmación DEBE nombrar la tarea que se va a borrar (su título) y decir de forma inequívoca que no se podrá recuperar (CA-5).
- **FR-004**: La opción que borra DEBE decir la acción que realiza y presentarse con el tratamiento de acción destructiva de `DESIGN.md`; la opción que no borra DEBE ser igual de visible (CA-5, DESIGN.md).
- **FR-005**: Tras confirmar, la tarea DEBE desaparecer de la vista de quien la borró sin recargar, y dejar de aparecer en la lista y el tablero de cualquier persona del equipo en su siguiente carga (CA-1, CA-2).
- **FR-006**: Tras un borrado correcto, el sistema DEBE indicar brevemente que la tarea se ha borrado y NO DEBE ofrecer deshacer ni ninguna vía de recuperación (CA-8).
- **FR-007**: Si el borrado no llega a completarse por cualquier motivo distinto de «ya no existe», la tarea DEBE seguir mostrándose y el miembro DEBE ver un mensaje comprensible en castellano que explica qué ha pasado y qué puede hacer, sin errores técnicos crudos. En ningún caso se muestra como borrada una tarea que no se borró (RNF-8, RNF-10).

**Guardarraíles (P2)**

- **FR-008**: Cancelar la confirmación —con la opción de cancelar, con Escape o haciendo clic fuera— NO DEBE borrar nada ni modificar ningún dato de la tarea, y DEBE devolver el foco a donde estaba antes de pedir borrar (CA-6).
- **FR-009**: Al abrirse la confirmación, el foco DEBE quedar en la opción que no borra, de modo que pulsar Enter sin moverse no borre nada (CA-7, R5).
- **FR-010**: Un doble clic o una activación repetida sobre la acción de pedir borrar NO DEBE completar el borrado: confirmar exige una activación deliberada y distinta sobre la opción que borra (CA-7, R5). · **[PROPUESTO]**
- **FR-011**: Borrar una tarea DEBE costar estrictamente más interacciones que cambiarle el estado (que cuesta 2 o menos, RF-9), contadas con la misma definición de interacción que E2-4; y la acción de borrar NO DEBE compartir control ni posición con el cambio de estado, ni en la lista ni en el tablero (CA-7, R5). · **[PROPUESTO]**
- **FR-012**: La acción de borrar DEBE estar disponible solo desde la tarea abierta (E2-5), y NO en la fila de la lista ni en la tarjeta del tablero; desde ellas se llega abriendo la tarea, lo que cumple FR-011 por construcción (CA-7, R5).
- **FR-013**: El sistema NO DEBE borrar nada a petición de una persona sin sesión iniciada ni con una sesión ya cerrada, reutilizando la autenticación existente sin modificarla (CA-10, R1).
- **FR-014**: Si la tarea que se intenta borrar ya no existe, el sistema DEBE decir en castellano que esa tarea ya no existe, sin presentarlo como un fallo del sistema, y DEBE quitarla de la vista de quien lo intentó (CA-11, R8). · **[PROPUESTO]**
- **FR-015**: Borrar DEBE seguir siendo un camino distinto de marcar como «Hecho»: el estado «Hecho» no pide confirmación ni destruye nada, y borrar no cambia el estado de ninguna otra tarea (CA-9).
- **FR-016**: Todo el recorrido —pedir borrar, leer la pregunta, confirmar o cancelar— DEBE poder completarse solo con el teclado, con el foco siempre visible y contenido en la pregunta mientras está abierta, y sin violaciones graves ni críticas de accesibilidad (RNF-6, Constitución II).

**Lo que pide el modelo de amenazas (P3)**

- **FR-017**: Cada petición de borrado DEBE afectar como máximo a una tarea. El sistema NO DEBE ofrecer ninguna forma de borrar varias tareas a la vez, ni en la interfaz ni fuera de ella (R3).
- **FR-018**: Una referencia a tarea mal formada, negativa, compuesta o inexistente NO DEBE borrar ninguna tarea y DEBE responderse igual que «esa tarea no existe» (R4).
- **FR-019**: El permiso para borrar DEBE aceptarse solo por la vía con la que la aplicación ya lo presenta hoy; NO DEBE aceptarse adjunto a una dirección ni aportado automáticamente por el navegador, de modo que una página de otro sitio no pueda borrar en nombre de un miembro (R2).
- **FR-020**: La aplicación NO DEBE poder mostrarse incrustada dentro de una página de otro sitio (R6). La parte que depende de dónde se despliegue se verifica en el despliegue, no en este cambio.
- **FR-021**: Las respuestas a un borrado, correcto o fallido, NO DEBEN contener datos de la tarea, detalles técnicos internos ni indicación alguna de quién la borró; y ningún mensaje de la interfaz DEBE atribuir un borrado a una persona (R7, RNF-7).
- **FR-022**: El borrado DEBE ser real: la tarea deja de existir, sin ocultarla, marcarla como borrada ni guardarla en ningún sitio aparte (CA-8, R9).
- **FR-023**: El sistema NO DEBE guardar, en ningún dato ni registro nuevo, quién borró una tarea ni cuándo (RNF-7, R9). Revertir esta decisión es una decisión de producto, no un cambio de esta spec (ver «Del modelo de amenazas a la spec»).

*Fuera de alcance de esta especificación*: papelera, deshacer o cualquier recuperación (PA-2); limitar quién o cuánto se puede borrar (roles planos, ritmo de borrado); registro de quién borró (RNF-7); que la lista o la tarea abierta de otra persona reflejen el borrado sin recargar (E3, PA-8); caducidad y almacenamiento de la sesión; cambios en el alta o el acceso (autenticación vallada); editar el título (E2-6) y reasignar (E2-7).

### Key Entities

- **Tarea**: la unidad de trabajo del espacio compartido. En esta spec solo se destruye, entera y de forma definitiva; ninguna otra tarea ni ningún otro dato depende de ella, así que borrarla no arrastra nada más.
- **Confirmación de borrado**: la pregunta que se interpone entre pedir borrar y borrar. Nombra la tarea, avisa de la irreversibilidad y tiene dos salidas: borrar o no hacer nada. No es un dato que se guarde ni algo que el sistema pueda comprobar después.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los borrados completados desde la interfaz han pasado por una confirmación que nombra la tarea y dice que no se puede recuperar.
- **SC-002**: Un miembro borra cualquier tarea, propia o ajena, en menos de 10 segundos desde que decide hacerlo, y la tarea deja de verse en su pantalla en menos de 1 segundo tras confirmar.
- **SC-003**: Borrar cuesta al menos una interacción más que cambiar el estado de una tarea (es decir, 3 o más frente a 2 o menos).
- **SC-004**: En el 100% de las cancelaciones —botón, Escape, Enter sin mover el foco, clic fuera, doble clic sobre «Borrar»— el número de tareas y sus datos quedan idénticos, y no se ha intentado ningún borrado.
- **SC-005**: El 100% de los intentos de borrar sin sesión válida, con una referencia a tarea manipulada, de varias tareas a la vez o desde una página de otro sitio terminan con 0 tareas borradas.
- **SC-006**: El 100% de los intentos de borrar una tarea que ya no existe muestran el aviso de «ya no existe», y 0 de ellos se presentan como un error del sistema.
- **SC-007**: Tras cualquier borrado, 0 datos, registros o mensajes permiten saber quién lo hizo, y la tarea no puede recuperarse por ninguna vía del producto.
- **SC-008**: El recorrido completo de borrar y de cancelar se hace solo con el teclado, con 0 violaciones graves o críticas de accesibilidad.

## Del modelo de amenazas a la spec

Cada mitigación de `docs/security/threat-model-e2-10.md` y dónde queda:

| Mitigación | Amenaza | Entra por | Notas |
|---|---|---|---|
| R1 · Solo con sesión | S-1 | US2-5, FR-013 | Incluye la sesión ya cerrada. La autenticación no se toca. |
| R2 · El permiso solo por la vía actual | T-5 | US3-3, FR-019 | |
| R3 · Una petición, una tarea | T-1 | US3-1, FR-017 | Mitiga el borrado masivo en bloque, no el de una en una (ver «limitar el ritmo»). |
| R4 · La referencia no se interpreta | T-2 | US3-2, FR-018 | |
| R5 · Confirmación que no se dispara sola | T-3 | US1-4…6, US2-1…4, FR-008…FR-011 | CA-7 entra como [PROPUESTO]. La acción vive solo en la tarea abierta (FR-012, ver «Clarifications»). |
| R6 · No se puede incrustar | T-4 | US3-4, FR-020 | Lo que dependa del entorno de despliegue se comprueba allí. |
| R7 · Sin fugas ni atribución | I-1 | US3-5, FR-021 | |
| R8 · Borrar lo ya borrado | D-1 | US2-6, FR-014 | CA-11 entra como [PROPUESTO]. |
| R9 · Borrado real y anónimo | R-1 | US3-6, FR-022, FR-023 | Hace cumplir RNF-7; ver la primera decisión pendiente. |
| R10 · Roles planos de verdad | E-1 | US1-3, FR-001 | Sin «confirmación en el servidor»: no protegería nada. |

**Decisiones de producto pendientes** (chocan con el PRD o lo exceden; la spec sigue al PRD y las deja anotadas):

- **Quién borró (R-1 frente a RNF-7).** Registrarlo daría con el responsable de un borrado dañino, pero RNF-7 y la exclusión de la auditoría (PRD §4.2) lo prohíben. La spec sigue al PRD (FR-023) y acepta el repudio como riesgo residual.
- **Papelera o deshacer (PA-2).** Es la única mitigación real a la vez contra el error (T-3), el vaciado del tablero por un desconocido (S-3) y el borrado masivo de una en una (T-1). Hoy está excluida; la confirmación es su sustituto.
- **Alta abierta × borrado irreversible (PA-10, S-3).** Cualquiera que se registre puede vaciar el tablero. Cerrarlo pasa por invitaciones o una red privada, ambas fuera del MVP.
- **PA-8.** Qué ve quien tiene abierta una tarea cuando otro la borra. La spec solo garantiza el mínimo (el aviso de «ya no existe» al siguiente intento); el resto espera la decisión en el PRD y la lista viva (E3).

**Fuera de esta spec** (no chocan con el producto, pero no caben aquí):

- **Limitar el ritmo de borrado (T-1).** Exige una dependencia nueva, prohibida sin aprobación, y contar acciones por persona roza RNF-7.
- **Caducidad y almacenamiento de la sesión, y política de contenido de la aplicación (S-2).** Tocan la autenticación vallada y necesitarían un revisor humano nombrado en una spec propia. Se anotan porque el borrado es lo que vuelve irreversible el robo de una sesión.
- **Operación del despliegue.** Orígenes permitidos en producción, copias de seguridad de los datos y la parte de R6 que depende del servidor.

## Assumptions

- **Qué cuenta como interacción**: la misma definición que E2-4 (`specs/002-cambiar-estado/`): una activación deliberada —un clic, un toque o una tecla que selecciona o confirma—; mover el puntero o desplazarse no cuenta.
- **Los criterios [PROPUESTO] (CA-7 y CA-11) entran como propuestos**: se construyen y se prueban como el resto, pero siguen pendientes de validación con negocio. Descartarlos no basta para quitar FR-010, FR-011 y FR-014: el modelo de amenazas los pide también (R5 y R8), así que habría que revisarlo a la vez.
- **«Desaparece para todo el equipo» significa en su siguiente carga** de la lista o el tablero: la lista viva (RF-18) es E3 y no existe todavía.
- **La vista de la tarea abierta (E2-5) existe** y hoy es de consulta (`specs/003-abrir-tarea/`, escenario 9); con FR-012 resuelto, este cambio le añade la acción de borrar. Tras borrar desde ella, el miembro vuelve a la vista de la que vino.
- **El aviso de «ya no existe» ya existe** al abrir una tarea y al cambiarle el estado (E2-4, E2-5); el de borrar lo sigue en tono y comportamiento.
- **Textos exactos** de la pregunta, de la confirmación de borrado y de los avisos: se redactan en el plan, en castellano, cortos y con la acción, con el tono de los mensajes existentes (DESIGN.md, RNF-8).
- **Sin dependencias nuevas, autenticación sin tocar y estilo de `DESIGN.md`**: el borrado se construye con lo que ya hay en el proyecto y con los componentes y tokens del design system.
- **Ninguna otra entidad depende de una tarea**, así que borrarla no deja datos huérfanos ni afecta a otras tareas.
