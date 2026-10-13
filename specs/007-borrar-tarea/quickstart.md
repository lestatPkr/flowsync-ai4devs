# Quickstart: validar «Borrar una tarea»

Guía para comprobar que el cambio funciona de punta a punta. Los detalles de qué devuelve cada caso están en los contratos: [API](./contracts/delete-task-api.md) e [interfaz](./contracts/delete-task-ui.md). Todos los comandos se ejecutan desde `backend/` o desde `frontend/`, nunca desde la raíz.

## Requisitos previos

```bash
cd backend
npm install
cp .env.example .env && node ace generate:key   # solo la primera vez
node ace migration:run                          # no hay migración nueva: no debe crear nada

cd ../frontend
npm install
npx playwright install chromium                 # solo la primera vez
```

> **Ojo con la base de datos.** `npm test` en `backend/` hace `truncate` sobre la misma `tmp/db.sqlite3` que usan `npm run dev` y los e2e. No corras las dos suites a la vez, y no las corras si tienes datos de desarrollo que quieras conservar.

## 1. Backend: la matriz del `DELETE`

```bash
cd backend
node ace test functional --files=delete_task   # solo la matriz nueva
npm test                                       # todo: las suites existentes siguen en verde sin editarse
npm run test:coverage                          # la cobertura de app/ no baja
npm run lint && npm run typecheck
node ace list:routes | grep tasks              # aparece DELETE /api/v1/tasks/:id (tasks.destroy); el resto, igual que antes
```

**Esperado**: los 21 casos de la [matriz](./contracts/delete-task-api.md#matriz-de-comportamiento-definition-of-done) en verde. Antes de implementar, el mismo comando debe dar **rojo** (sin ruta, `404` del router donde se espera `204`).

`git diff backend/.adonisjs/` muestra la ruta `tasks.destroy` en el registro; se commitea con el cambio.

## 2. Backend a mano (opcional)

Con `npm run dev` arrancado:

```bash
TOKEN=$(curl -s -X POST localhost:3333/api/v1/auth/login -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"email":"<tu email>","password":"<tu contraseña>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
ID=$(curl -s -X POST localhost:3333/api/v1/tasks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"title":"Para borrar"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.id')

curl -i -X DELETE localhost:3333/api/v1/tasks/0$ID -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'  # 404 Row not found: la forma no canónica no borra
curl -i -X DELETE localhost:3333/api/v1/tasks/$ID                                                                     # 401: sin sesión
curl -i -X DELETE localhost:3333/api/v1/tasks/$ID -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'    # 204 sin cuerpo, X-Frame-Options: DENY
curl -i -X DELETE localhost:3333/api/v1/tasks/$ID -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'    # 404 Row not found
curl -i -X OPTIONS localhost:3333/api/v1/tasks/1 -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: DELETE' -H 'Access-Control-Request-Headers: authorization'                     # preflight: DELETE permitido
```

## 3. Frontend: la matriz e2e

```bash
cd frontend
npx playwright test e2e/delete-task.spec.ts    # solo la matriz nueva
npm run test:e2e                               # todo: smoke, board y task-status-list siguen en verde sin editarse
npm run lint                                   # oxlint
npm run build                                  # typecheck de src/ y e2e/ + build
```

**Esperado**: los 19 tests de la [matriz](./contracts/delete-task-ui.md#matriz-de-comportamiento-definition-of-done) en verde, incluido axe con el diálogo abierto. Antes de implementar el frontend deben verse en **rojo**.

## 4. Recorrido manual

Con `npm run dev` en `backend/` y en `frontend/`, en `http://localhost:5173`:

1. **Borrar** — En la lista, abre una tarea. Pulsa «Borrar tarea»: aparece «¿Borrar «…»?» con «no se podrá recuperar», el foco en «Cancelar» y el resto de la página bloqueado. Espera medio segundo y pulsa «Borrar definitivamente»: vuelves a la lista con «Se ha borrado «…».» y la tarea ya no está; tampoco en el tablero.
2. **Cancelar** — Abre otra tarea y pide borrarla; cancela con el botón, con Escape y con un clic fuera. Cada vez, el foco vuelve a «Borrar tarea» y la tarea sigue igual.
3. **Sin accidentes** — Doble clic en «Borrar tarea», o Enter dos veces seguidas: la pregunta sigue abierta y no se borra nada.
4. **Desde el tablero** — Abre una tarjeta y bórrala: vuelves al tablero, con el aviso.
5. **Ya no existe** — Abre una tarea en dos pestañas; bórrala en una; en la otra pide borrarla y confirma: «Esta tarea ya no existe · Puede que alguien la haya borrado.», sin aspecto de error.
6. **Sin conexión** — Para el backend, pide borrar y confirma: el diálogo dice que no se ha podido borrar y la tarea sigue a la vista.
7. **Solo teclado** — Repite 1 y 2 sin ratón: el foco se ve siempre y no sale del diálogo mientras está abierto.
8. **Incrustar** — `curl -I localhost:5173` muestra `X-Frame-Options: DENY` y `Content-Security-Policy: frame-ancestors 'none'`.
9. **Nada en la lista ni en el tablero** — Ninguna fila ni tarjeta tiene un botón de borrar.

## 5. La valla

La base es el commit anotado en T001 (`ad1dded`), **no** `main`: `main` va por detrás de esta rama y el diff contra él ya trae migraciones, modelos y componentes de `ui/` de historias anteriores, así que nunca saldría vacío.

```bash
BASE=ad1dded   # el commit de partida anotado en T001
git diff --stat $BASE -- \
  backend/app/controllers/new_account_controller.ts backend/app/controllers/access_tokens_controller.ts \
  backend/app/controllers/profile_controller.ts backend/app/middleware/ backend/app/validators/user.ts \
  backend/app/models/ backend/database/ backend/config/ backend/app/exceptions/handler.ts \
  frontend/src/auth/ frontend/src/components/ui/ frontend/src/index.css \
  '*/package.json' '*/package-lock.json'
git status --porcelain -- backend/database/ backend/app/models/ frontend/src/auth/ frontend/src/components/ui/
```

**Esperado**: las dos salidas vacías (la segunda cubre los ficheros sin seguimiento, que `git diff` no ve). Ninguna migración nueva en `backend/database/migrations/` y `backend/database/schema.ts` sin cambios. Es la misma lista que el paso 1 de T043.
