# Modelo de amenazas STRIDE — E2-10 «Borrar una tarea»

**Estado:** previo a la implementación (no existe ni la ruta ni la interfaz de borrado). **Fecha:** 2026-10-13.
**Alcance:** la ruta nueva de borrado, el diálogo de confirmación y lo que ambos tocan. Fuera: el resto de auth (vallada en `BOUNDARIES.md`) y otras historias.
**Traza:** RF-12, RNF-7, PA-2, PA-8 y PA-10 del PRD; CA-1…CA-11 de `docs/backlog/E2-gestion-tareas/us-borrar-tarea.md`.

## 1. Activos y actores

| Activo | Por qué importa |
|---|---|
| **Filas de `tasks`** | Es lo único que se destruye. Sin papelera ni histórico (RF-12, PRD §4.2): perderlas es definitivo. `tasks` es una tabla hoja: nada apunta a ella, así que borrar una tarea no arrastra a otras (`backend/database/migrations/1790152501403_create_tasks_table.ts:8-17`). |
| **Token de acceso** | El único requisito para borrar. Es un bearer opaco guardado en `localStorage` bajo `flowsync.token` (`frontend/src/auth/auth-provider.tsx:7,32`), que **no caduca**: `DbAccessTokensProvider.forModel(User)` se crea sin `expiresIn` (`backend/app/models/user.ts:8`) y por defecto esos tokens no expiran. Solo se revoca al cerrar sesión (`backend/app/controllers/access_tokens_controller.ts:22`). |
| **Confianza en la lista** | Si las tareas pueden desaparecer sin explicación, el tablero deja de servir para lo que se usa. |

**Actores:** (a) el **miembro legítimo**, que por diseño puede borrar cualquier tarea (RF-12, CA-3); (b) el **miembro que se equivoca**, que es el caso más probable; (c) **cualquiera que se registre**: el alta es pública (`backend/start/routes.ts:22`) y devuelve un token al momento (`backend/app/controllers/new_account_controller.ts:10-11`), así que un desconocido se convierte en miembro (PA-10); (d) un **script o una página ajena** que actúa en el navegador de la víctima (XSS, clickjacking); (e) un **cliente sin interfaz** (curl), que habla con la API directamente.

## 2. Flujo de datos y fronteras de confianza

```
 Navegador (SPA React, :5173)          ║ TF-1 ║        API AdonisJS (:3333)              ║ TF-2 ║   SQLite
 [Borrar] → diálogo → [Confirmar]      ║      ║ cors → bodyparser → session → shield     ║      ║  tmp/db.sqlite3
 → lib/api.ts: DELETE /api/v1/tasks/:id ═════════► → initialize_auth → silent_auth          ═════════► DELETE FROM tasks
   Authorization: Bearer <token>       ║      ║ → auth() → controlador (findOrFail + delete)║      ║  WHERE id = ?
 ◄═══ 204 / 401 / 404 {errors} ════════╝      ╚══════════════════════════════════════════╝      ╚═══
 Otros navegadores: la tarea desaparece en su próxima lectura de GET /api/v1/tasks (CA-2).
```

- **TF-1 (navegador → API).** Todo lo que llega del navegador es no confiable, **también el hecho de que se haya confirmado**. El diálogo de CA-4 vive por completo al otro lado de esta frontera: el servidor no tiene forma de saber si hubo confirmación. Es un guardarraíl de producto contra el error humano, **no un control de seguridad**. La cadena de middleware ya existe (`backend/start/kernel.ts:25-41`). La protección real es `middleware.auth()` (`backend/app/middleware/auth_middleware.ts:17`), que se aplica por grupo (`backend/start/routes.ts:37-47`).
- **TF-2 (API → SQLite).** La API confía plenamente en la BD. Lucid parametriza las consultas; hoy el único patrón para buscar por id es `findOrFail` (`backend/app/controllers/task_statuses_controller.ts:10`), y una fila que no existe se responde con 404 `{ errors }` (`backend/app/exceptions/handler.ts:21-22`).
- **Lo que falta en el código para este flujo:** no hay ruta DELETE; `request()` no admite el verbo `DELETE` (`frontend/src/lib/api.ts:125`); no hay componente de diálogo en `frontend/src/components/ui/`, aunque `radix-ui` ya está instalado (`frontend/package.json:19`), así que traerlo con shadcn no añade ninguna dependencia.

## 3. Amenazas STRIDE

P = probabilidad, I = impacto (B/M/A). La P está estimada para un despliegue accesible; en local, la de S-3 y T-1 es baja.

| ID | Cat. | Escenario concreto en FlowSync | P | I | Lo que hay hoy | Mitigación → req. |
|---|---|---|---|---|---|---|
| S-1 | Spoofing | La ruta se registra fuera del grupo protegido y un `DELETE` sin token borra. | B | A | Patrón correcto en `routes.ts:37-47`; la ruta todavía no existe. | Colgarla del grupo `tasks` con `auth()` → **R1** |
| S-2 | Spoofing | Un token robado (XSS, equipo compartido) sirve para siempre: no caduca y está en `localStorage`. | M | A | `user.ts:8`, `auth-provider.tsx:32`. No hay CSP en la SPA (`frontend/index.html`) y la CSP de la API está apagada (`backend/config/shield.ts:12`). No se usa `dangerouslySetInnerHTML` en `frontend/src`. | Fuera de alcance: auth vallada → §5 |
| S-3 | Spoofing | Un desconocido se registra y vacía el tablero del equipo (PA-10). | M | A | El alta es pública por diseño (supuesto 1 del PRD). | Decisión de producto → §5 |
| T-1 | Tampering | Borrado masivo con un script: `GET /tasks?status=…` da todos los ids (`tasks_controller.ts:28-34`), que además son secuenciales (`increments`), y luego se lanza un `DELETE` por id. | M | A | No hay limitador: `@adonisjs/limiter` no está en `backend/package.json`. | Un `DELETE` borra exactamente una fila y no existe borrado por colección → **R3**. Limitar el ritmo → §5 |
| T-2 | Tampering | Un `:id` manipulado (`abc`, `-1`, `1 OR 1=1`, `1,2`) borra otra fila o varias. | B | A | `findOrFail` + 404 (`handler.ts:21`). | Buscar por PK y borrar esa instancia, nunca un `delete()` del query builder montado con la entrada → **R4** |
| T-3 | Tampering | Un borrado accidental: «Borrar» está al lado del cambio de estado, que se hace en 2 interacciones sin confirmar (RF-9), y un Enter o un doble clic confirma. | A | M | Nada: no hay interfaz. | Diálogo con el foco en «Cancelar», separado del gesto de estado (CA-4…CA-7) → **R5** |
| T-4 | Tampering | Clickjacking: una página ajena enmarca la SPA y engaña al usuario para que pulse «Borrar» y luego «Confirmar». | B | M | La cabecera `xFrame: DENY` de `shield.ts:60-66` protege las respuestas de la API, no la SPA. Vite no envía cabeceras (`frontend/vite.config.ts`). | `frame-ancestors`/`X-Frame-Options` en la SPA → **R6** (depende del despliegue) |
| T-5 | Tampering | CSRF: una página ajena dispara el `DELETE` con las credenciales de la víctima. | B | A | El CSRF está apagado (`shield.ts:33`), pero el guard por defecto es `api` (`config/auth.ts:10`) y el bearer va en una cabecera que el navegador no adjunta por su cuenta. En desarrollo, CORS acepta cualquier origen con `credentials: true` (`cors.ts:21,42`), y eso solo importaría con cookies. | Aceptar el token **solo** por `Authorization`, nunca por el guard `web` (`auth.ts:26`), por cookie ni por query → **R2** |
| R-1 | Repudio | Alguien borra trabajo ajeno y nadie puede saber quién fue. | A | M | No hay auditoría (PRD §4.2) ni log de peticiones: el kernel no registra ningún logger de peticiones y `LOG_LEVEL=info`. | Sin mitigación técnica compatible con RNF-7 → §5. **R9** garantiza que siga así |
| I-1 | Info. | Un error del borrado devuelve la traza o el SQL (`debug = !app.inProduction`, `handler.ts:10`), o el aviso de «ya no existe» revela quién la borró. | B | B | El 404 ya tiene una forma limpia (`handler.ts:21-22`). | Respuestas sin cuerpo ni detalles y sin atribución → **R7** |
| D-1 | DoS | Dos personas borran la misma tarea, o una cambia el estado de una tarea ya borrada, y ven un error genérico (CA-11). | M | B | El 404 ya se traduce para lectura y estado (`frontend/src/lib/api.ts:273-279,317-321`). | Tratar el 404 del `DELETE` como «ya no existe» → **R8** |
| E-1 | Elevación | Cualquier cliente borra sin confirmar con `curl -X DELETE`. No es una elevación real: los roles son planos y el permiso es idéntico. | A | M | Es así por diseño (RF-12, CA-3). | No fingir un control en el servidor (un `confirm: true` en el cuerpo no protege nada). Mantener roles planos → **R10** |

## 4. Requisitos comprobables (para la spec)

**R1 · Solo con sesión** (S-1, CA-10) — functional
DADO una tarea existente
CUANDO llega `DELETE /api/v1/tasks/:id` sin `Authorization`, con un token inventado o con un token ya revocado por logout
ENTONCES responde 401 y la tarea sigue en la tabla `tasks`.

**R2 · El token solo viaja en la cabecera** (T-5) — functional
DADO un token válido
CUANDO se envía como `?token=` o en una cookie, y no en `Authorization: Bearer`
ENTONCES responde 401 y no se borra nada.

**R3 · Una petición, una fila como máximo** (T-1) — functional
DADO N tareas
CUANDO se pide `DELETE /api/v1/tasks`, sin id y con o sin filtros
ENTONCES no se borra ninguna (la ruta no existe) y siguen N
Y un `DELETE /api/v1/tasks/:id` válido deja exactamente N−1.

**R4 · El id no se interpreta** (T-2) — functional
DADO las tareas 1 y 2
CUANDO se pide `DELETE` con `:id` = `abc`, `-1`, `999`, `1 OR 1=1` o `1,2` (codificados en la URL)
ENTONCES responde 404 con `{ errors: [...] }` y las dos tareas siguen.

**R5 · Confirmación que no se dispara sola** (T-3, CA-4…CA-7) — e2e con Playwright, contando las peticiones `DELETE`
DADO la lista o el tablero con tareas
CUANDO pulso «Borrar»
ENTONCES aparece un diálogo modal que dice que no se puede recuperar, con el foco inicial en «Cancelar»
Y si pulso Escape, Enter o «Cancelar», o hago clic fuera, no sale ninguna petición `DELETE` y la tarea sigue igual
Y «Borrar» no ocupa el mismo control ni la misma posición que el cambio de estado.

**R6 · La SPA no se puede enmarcar** (T-4) — comprobación del despliegue
DADO el frontend servido en un entorno accesible
CUANDO una página de otro origen lo carga en un `<iframe>`
ENTONCES el navegador lo bloquea (`Content-Security-Policy: frame-ancestors 'none'` o `X-Frame-Options: DENY`).

**R7 · Respuestas sin fugas ni atribución** (I-1, RNF-7) — functional + e2e
DADO un borrado correcto
CUANDO responde la API
ENTONCES devuelve 204 sin cuerpo
Y cualquier error tiene la forma `{ errors: [{ message }] }`, sin traza ni SQL
Y ningún mensaje de la interfaz dice quién borró la tarea.

**R8 · Borrar lo ya borrado** (D-1, CA-11) — functional + e2e
DADO una tarea que otra persona ya ha borrado
CUANDO la borro
ENTONCES la API responde 404, la interfaz dice en castellano que la tarea ya no existe, sin presentarlo como un fallo del sistema, y la quita de mi vista.

**R9 · El borrado es real y anónimo** (R-1, CA-8, RNF-7) — functional + revisión del diff
DADO una tarea borrada
CUANDO consulto la base de datos y los logs a nivel `info`
ENTONCES la fila no existe (no hay borrado lógico ni papelera encubierta)
Y ninguna tabla, columna o línea de log nueva guarda quién la borró.

**R10 · Roles planos de verdad** (E-1, CA-3) — functional
DADO una tarea de la que es responsable B
CUANDO A, autenticado, la borra
ENTONCES responde 204, sin ningún permiso especial.

## 5. Fuera de alcance o pendiente de una decisión de producto

- **Quién borró (R-1).** Registrarlo choca de frente con RNF-7 y con la exclusión de la auditoría (§4.2). Se acepta el repudio como riesgo residual. Revertirlo es una decisión de producto, no un ticket.
- **Papelera o deshacer (PA-2).** Es la única mitigación real contra T-3, S-3 y T-1 a la vez. Hoy está excluida, y la confirmación (R5) es solo su sustituto.
- **Alta abierta × borrado irreversible (PA-10).** Sin invitaciones (excluidas en §4.2) ni red privada, S-3 queda abierto en cuanto haya un despliegue accesible.
- **Limitar el ritmo de borrado (T-1).** Necesita `@adonisjs/limiter`, una dependencia nueva que `BOUNDARIES.md` prohíbe añadir sin aprobación. Además, roza RNF-7 si cuenta acciones por persona.
- **Caducidad y almacenamiento del token (S-2), y CSP de la SPA.** Tocan `frontend/src/auth/` y la configuración de auth, que están vallados (`BOUNDARIES.md`) y requieren un revisor humano nombrado en la spec. Los dos agrandan el alcance de cualquier robo de token, y el borrado es lo que lo hace irreversible.
- **Despliegue.** R6, la lista de orígenes CORS en producción (hoy vacía, `cors.ts:21`) y las copias de seguridad de `tmp/db.sqlite3` son operación, no producto.
- **PA-8.** Qué ve quien tiene abierta una tarea cuando otro la borra: falta la decisión en el PRD.
- **Nota para quien escriba los tests.** Las suites functional hacen `truncate` (p. ej. `backend/tests/functional/tasks/list_tasks.spec.ts:14`) sobre la **misma** SQLite que el servidor de desarrollo (`CLAUDE.md`). Los tests de R1–R10 borrarán también los datos de desarrollo.
