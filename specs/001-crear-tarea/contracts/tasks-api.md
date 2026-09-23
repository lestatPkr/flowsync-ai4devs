# Contract: `/api/v1/tasks`

Ambos endpoints viven dentro de un grupo protegido por `middleware.auth()` (guard `api`, el mismo de `/api/v1/account/*`). Sin sesión válida (`Authorization: Bearer <token>` ausente o inválido), responden `401` con la misma forma de error que ya usa el resto de la API protegida — comportamiento heredado de `middleware.auth()`, sin cambios (FR-011).

Toda respuesta de éxito va envuelta en `{ "data": ... }` por el serializer global (`serialize()`), igual que el resto de la API.

## `POST /api/v1/tasks` — crear una tarea

Cubre FR-001 a FR-007.

### Request

```
POST /api/v1/tasks
Authorization: Bearer <token>
Content-Type: application/json

{ "title": "Revisar el PR de auth" }
```

Único campo aceptado: `title`. Cualquier otro campo en el body se ignora — el endpoint no lo usa ni lo persiste (FR-001).

### Respuesta — éxito (201)

```json
{
  "data": {
    "id": 12,
    "title": "Revisar el PR de auth",
    "status": "pending",
    "assignee": { "id": 3, "fullName": "Oscar Torres", "initials": "OT" },
    "createdAt": "2026-09-23T10:15:00.000Z"
  }
}
```

- `status` siempre `"pending"` en la creación (FR-003).
- `assignee` siempre coincide con el usuario autenticado que hizo la petición (FR-002); el cliente no puede cambiarlo.

### Respuesta — título vacío o solo espacios (422)

```json
{
  "errors": [
    { "message": "The title field must be defined", "rule": "required", "field": "title" }
  ]
}
```

(Forma exacta del error de VineJS ya usada en el resto del backend, ver `app/validators/user.ts` / `frontend/src/lib/api.ts`.) FR-005: la tarea no se crea.

### Respuesta — título demasiado largo (422)

```json
{
  "errors": [
    {
      "message": "The title field must not be greater than 200 characters",
      "rule": "maxLength",
      "field": "title",
      "meta": { "max": 200 }
    }
  ]
}
```

FR-007: la tarea no se crea; el título no se recorta ni se guarda truncado.

### Respuesta — sin sesión (401)

Igual que cualquier otra ruta protegida existente (comportamiento de `middleware.auth()`, sin cambios).

## `GET /api/v1/tasks` — listar tareas del espacio compartido

Cubre FR-008, FR-009, FR-010.

### Request

```
GET /api/v1/tasks
Authorization: Bearer <token>
```

Sin parámetros de consulta en esta historia (filtrar por estado es FS-142, fuera de alcance).

### Respuesta — éxito (200), espacio con tareas

```json
{
  "data": [
    {
      "id": 12,
      "title": "Revisar el PR de auth",
      "status": "pending",
      "assignee": { "id": 3, "fullName": "Oscar Torres", "initials": "OT" },
      "createdAt": "2026-09-23T10:15:00.000Z"
    }
  ]
}
```

Devuelve **todas** las tareas del espacio único compartido (no solo las del usuario que consulta) — el espacio es compartido por todo el equipo (PRD, sección 4). Orden: más recientes primero (`created_at desc`, con `id desc` como criterio de desempate cuando dos tareas comparten el mismo `created_at`), para que una tarea recién creada aparezca arriba sin que el frontend tenga que ordenar.

### Respuesta — éxito (200), espacio sin tareas

```json
{ "data": [] }
```

El frontend traduce un array vacío en el estado "lista vacía" de FR-010 (explicación + CTA para crear la primera tarea); el backend no necesita un caso especial para esto, solo devolver `[]` de forma consistente.

### Respuesta — sin sesión (401)

Igual que en `POST`.
