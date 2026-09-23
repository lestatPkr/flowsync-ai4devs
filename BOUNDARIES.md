# BOUNDARIES.md — la valla eléctrica

Una lista corta y explícita de lo que un agente **nunca** hace en este repo. Es el seguro más barato contra un output incorrecto llegando a producción: no sube la probabilidad de acertar, **impide** una clase entera de fallos. Se lee antes de tocar nada; el revisor la comprueba después.

## Nunca

- **Tocar la autenticación sin un revisor humano nombrado en la spec.** Zona vallada:
  `backend/app/controllers/new_account_controller.ts`, `backend/app/controllers/access_tokens_controller.ts`, `backend/app/controllers/profile_controller.ts`, `backend/app/middleware/auth_middleware.ts`, `backend/app/middleware/silent_auth_middleware.ts`, `backend/app/validators/user.ts`, `backend/app/models/user.ts`, las migraciones de `users` y `access_tokens`, y `frontend/src/auth/`.
- **Editar `backend/database/schema.ts` a mano.** Es generado: lo reescribe `node ace migration:run`. Se cambia el esquema con una migración, nunca editando ese archivo.
- **Cambiar una ruta pública existente** bajo `/api/v1` (path, verbo o forma de la respuesta). Añadir rutas nuevas sí, y siempre dentro de `middleware.auth()`.
- **Añadir una dependencia** a `backend/package.json` o `frontend/package.json` sin aprobación explícita. Lo que hace falta ya está instalado (R-3 del PRD).
- **Commitear secretos** (`.env`, `APP_KEY`), ni **editar o borrar un test** para que la suite pase.

## Por qué auth está vallada

E1 (cuentas y acceso) está implementada de punta a punta y verificada (R-2 del PRD). Todo lo que se construye hoy trabaja **al lado** de auth: la lista de tareas vive detrás del login, el responsable por defecto es el usuario autenticado y las rutas nuevas cuelgan del mismo grupo protegido. Un implementador "ordenado" tiende a limpiar el validador o el middleware que tiene al lado mientras implementa. Ese edit **lo tiene que cazar el `adversarial-reviewer` antes de que lo mire un humano** — y, si el hook está activo, el commit ni siquiera entra.
