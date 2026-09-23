# Research: Crear tarea con solo el título

Todas las decisiones de esta fase estaban ya acotadas por el prompt del usuario para `/speckit-plan` y por las convenciones existentes del repo (`CLAUDE.md`, `BOUNDARIES.md`). No quedan `NEEDS CLARIFICATION` en el Technical Context de `plan.md`; este documento registra el porqué de cada elección para que quien retome el trabajo no tenga que releer el hilo de la conversación.

## 1. Representación de los tres estados de la tarea

- **Decision**: Columna `status` de tipo texto en SQLite, con los valores internos `pending`, `in_progress`, `done`, y un mapeo a las etiquetas en castellano (`Pendiente`, `En curso`, `Hecho`) en el transformer/frontend. Se define un `enum` TypeScript `TaskStatus` compartido dentro de `app/models/task.ts` para que el validador y el controlador lo referencien sin repetir los literales.
- **Rationale**: FR-004 de la spec cierra el catálogo a exactamente tres estados fijos, sin gestión de estados. Guardar el valor en inglés/snake_case sigue la convención ya usada en el resto del esquema (columnas en snake_case, sin texto de UI en la base de datos) y evita acoplar la base de datos al idioma de la interfaz. El valor por defecto de la columna es `pending`, alineado con FR-003.
- **Alternatives considered**:
  - *Tabla `statuses` separada con clave foránea*: rechazada — el catálogo es fijo y sin gestión (FR-04), así que una tabla aparte añadiría una entidad sin ningún caso de uso que la necesite (violaría "no over-engineer").
  - *Guardar directamente las etiquetas en castellano (`Pendiente`, etc.) en la columna*: rechazada — acopla el dato persistido al idioma de la UI y complica un futuro cambio de idioma o de copy sin tocar datos.

## 2. Ruta y agrupación de los endpoints nuevos

- **Decision**: Nuevo grupo de rutas hermano del existente, bajo el mismo prefijo `/api/v1`, con `prefix('tasks')` y `.use(middleware.auth())`:

  ```ts
  router
    .group(() => {
      router.get('/', [controllers.Tasks, 'index'])
      router.post('/', [controllers.Tasks, 'store'])
    })
    .prefix('tasks')
    .as('tasks')
    .use(middleware.auth())
  ```

  Este grupo se añade dentro del `router.group(() => {...}).prefix('/api/v1')` ya existente en `start/routes.ts`, junto a los grupos `auth` y `account` — no anidado dentro de `account`.
- **Rationale**: El prompt del usuario pide "rutas nuevas bajo `/api/v1/tasks` DENTRO del grupo existente protegido por `middleware.auth()`". El patrón de protección ya existente es exactamente `.use(middleware.auth())` sobre un grupo (como hace el grupo `account`); replicar ese mismo patrón en un grupo `tasks` hermano cumple la instrucción sin anidar un dominio nuevo (tareas) dentro de un prefijo que hoy es semánticamente "cuenta" (`/api/v1/account/...`). Las rutas públicas existentes (`/auth/*`) y las protegidas existentes (`/account/*`) no cambian, tal como exige BOUNDARIES.md.
- **Alternatives considered**:
  - *Anidar `tasks` dentro del prefijo `account`*: rechazada — produciría `/api/v1/account/tasks`, mezclando el dominio "cuenta" con el dominio "tareas" y alejándose de la ruta `/api/v1/tasks` que pide el prompt.

## 3. Responsable por defecto y relación `Task` → `User`

- **Decision**: Columna `assignee_id` (entero, FK a `users.id`, `NOT NULL`, `onDelete('CASCADE')` para consistencia con la FK ya existente de `auth_access_tokens`), fijada en el controlador a `auth.getUserOrFail().id` en el momento de crear la tarea — nunca aceptada como input del `store`. Relación Lucid `belongsTo(() => User, { foreignKey: 'assigneeId' })` en el modelo `Task`.
- **Rationale**: FR-002 exige que el responsable sea siempre quien crea la tarea, sin que la persona lo indique; no aceptar `assigneeId` en el validador de creación hace estructuralmente imposible violar FR-001 (ningún otro campo pedido o sugerido). `NOT NULL` porque, en el alcance de esta historia, toda tarea nace con responsable (reasignar o vaciar el responsable es una historia futura fuera de alcance).
- **Alternatives considered**:
  - *Permitir `assigneeId` opcional en el body y usarlo si viene*: rechazada — abriría una vía para "sugerir" o aceptar un dato que la spec (FR-001) prohíbe expresamente en el flujo de creación.

## 4. Longitud y normalización del título

- **Decision**: Validador VineJS `vine.string().trim().minLength(1).maxLength(200)` para el campo `title` del `store`. `trim()` de VineJS recorta antes de validar `minLength`, así que un título "solo espacios" cae en `minLength` con la regla `required`/`minLength`, produciendo el mismo mensaje de campo vacío que pide FR-005.
- **Rationale**: Cumple FR-005 (rechazo con mensaje comprensible), FR-006 (recorte de espacios sobrantes) y FR-007 (200 caracteres, límite acordado explícitamente por el usuario para esta spec y este plan). VineJS ya se usa así en `app/validators/user.ts` (mismo patrón `email()`/`password()` con builders reutilizables), así que este validador sigue la misma convención del repo.
- **Alternatives considered**: ninguna — el límite y la regla de recorte estaban dados por el usuario; no había ambigüedad que investigar.

## 5. Página de destino tras iniciar sesión

- **Decision**: `frontend/src/routes/app-routes.tsx` cambia su ruta protegida de destino de `/profile` a `/tasks` (nueva `TasksPage`), y el `Navigate` de fallback (`path="*"`) apunta también a `/tasks`. `/profile` se mantiene como ruta protegida existente, solo deja de ser la landing. `frontend/src/routes/public-only-route.tsx` (el guard que rebota fuera de `/login`/`/register` cuando ya hay sesión) también cambia su `Navigate` de `/profile` a `/tasks`, por la misma razón — se detectó durante la verificación manual (quickstart) que sin este cambio el registro/login seguía aterrizando en `/profile`.
- **Rationale**: El prompt del usuario es explícito: "la lista es la vista a la que se llega tras iniciar sesión, usando las rutas protegidas que ya existen". Reutilizar `<ProtectedRoute>` (ya existente) en vez de crear un mecanismo de protección nuevo respeta BOUNDARIES.md (no se toca `frontend/src/auth/`) y la convención IV de la constitución.
- **Alternatives considered**:
  - *Añadir `/tasks` sin tocar el destino por defecto*: rechazada — no cumpliría el requisito explícito de que la lista sea la vista de llegada tras el login, y dejaría la User Story 2/3 sin una entrada natural desde el flujo real de la app.

## 6. Suite de tests funcionales nueva

- **Decision**: Crear `backend/tests/functional/tasks/create_task.spec.ts` (y `list_tasks.spec.ts` si `tasks.md` lo separa), usando el `apiClient` de Japa ya conectado al registro Tuyau (`tests/bootstrap.ts`), con los hooks `testUtils.db()` para aislar cada test.
- **Rationale**: `backend/tests/functional/` no existe todavía; el Principio II de la constitución exige que la primera historia que la necesite la cree, y que los tests de la historia P1 se escriban antes que su implementación. Usar `testUtils.db()` evita que los tests contaminen `tmp/db.sqlite3`, el mismo fichero que usa `npm run dev` (documentado como riesgo en `CLAUDE.md`).
- **Alternatives considered**: ninguna — el propio prompt del usuario fija esta decisión ("la carpeta no existe todavía y crearla es parte de este cambio").
