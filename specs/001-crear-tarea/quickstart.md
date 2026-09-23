# Quickstart: Crear tarea con solo el título

Guía para validar manualmente, de punta a punta, que la historia funciona una vez implementada. No sustituye a los tests funcionales de `backend/tests/functional/tasks/` (Principio II de la constitución); es la validación humana del flujo completo.

## Prerrequisitos

- Backend arrancado: `cd backend && npm run dev` (migraciones ya aplicadas con `node ace migration:run`).
- Frontend arrancado: `cd frontend && npm run dev`.
- Una cuenta de usuario ya creada (flujo de E1, sin cambios) — regístrate en `http://localhost:5173/register` si no tienes una.

## Escenario 1 — Crear una tarea con solo el título (User Story 1, P1)

1. Inicia sesión en `http://localhost:5173/login`.
2. Comprueba que aterrizas en la lista de tareas (`/tasks`), no en `/profile` (ver `research.md`, sección 5).
3. Escribe un título, p. ej. `Revisar el PR de auth`, y confirma sin tocar ningún otro campo.
4. **Resultado esperado**: la tarea aparece en la lista al instante, sin recargar la página, mostrando el título, tu nombre como responsable y el estado "Pendiente".
5. Repite el paso 3 dejando el título vacío (o solo con espacios) y confirma.
6. **Resultado esperado**: la tarea no se crea; aparece un mensaje junto al campo de título explicando que hace falta un título.
7. Repite el paso 3 con un título de más de 200 caracteres.
8. **Resultado esperado**: la tarea no se crea; aparece un aviso de que el título es demasiado largo (no se guarda recortado).

Contrato de referencia: [`contracts/tasks-api.md`](./contracts/tasks-api.md#post-apiv1tasks--crear-una-tarea).

## Escenario 2 — Ver la lista con título, responsable y estado (User Story 2, P2)

1. Con al menos una tarea creada (Escenario 1), recarga la página de la lista.
2. **Resultado esperado**: cada tarea muestra su título, su responsable (tu nombre) y su estado ("Pendiente") sin necesidad de abrirla.

Contrato de referencia: [`contracts/tasks-api.md`](./contracts/tasks-api.md#get-apiv1tasks--listar-tareas-del-espacio-compartido).

## Escenario 3 — Espacio sin tareas (User Story 3, P3)

1. Con una base de datos limpia (o una cuenta nueva en un espacio recién sembrado sin tareas — ver nota abajo), abre la lista de tareas.
2. **Resultado esperado**: en vez de una lista vacía sin contexto, ves una explicación de qué es esa lista y un botón/enlace para crear la primera tarea.
3. Usa esa opción.
4. **Resultado esperado**: te lleva al mismo flujo de creación validado en el Escenario 1.

> Nota: como el espacio es único y compartido (no hay aislamiento por usuario), este escenario solo se puede reproducir de verdad con la base de datos sin ninguna tarea todavía. Para probarlo en local: `node ace migration:fresh` desde `backend/` reinicia la base (borra también las cuentas existentes; hay que volver a registrarse).

## Validación cruzada con `data-model.md`

Tras el Escenario 1, inspecciona la fila creada (por ejemplo con `node ace repl` desde `backend/` y `await Task.query().first()`, o revisando `tmp/db.sqlite3`) y confirma que coincide con la tabla de campos de [`data-model.md`](./data-model.md#entidad-task): `status` guardado como `pending` (no como `"Pendiente"`), `assignee_id` igual al `id` de tu usuario, título sin espacios sobrantes.
