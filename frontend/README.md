# FlowSync — frontend

SPA en React 19 + Vite que consume la API de `backend/`. Componentes con
[shadcn/ui](https://ui.shadcn.com) (Tailwind CSS v4) y enrutado con React Router.

## Puesta en marcha

El backend tiene que estar corriendo (por defecto en `http://localhost:3333`).

```bash
npm install
cp .env.example .env   # solo si tu backend no está en el puerto 3333
npm run dev            # http://localhost:5173
```

## Variables de entorno

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3333` | URL base de la API. Cámbiala si el backend escucha en otro puerto (el `PORT` de `backend/.env`). |

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview  # sirve el build de producción
```

## Despliegue

Usa `BrowserRouter`, así que el servidor estático tiene que devolver
`index.html` en cualquier ruta (fallback SPA). Sin eso, entrar directamente a
`/login` da un 404. `npm run dev` y `npm run preview` ya lo hacen.

## Cómo está organizado `src/`

| Carpeta | Qué hay |
| --- | --- |
| `lib/` | Cliente de la API (`api.ts`), traducción de errores a mensajes de formulario (`api-errors.ts`), validación previa al envío (`form-validation.ts`) y persistencia del token (`auth-storage.ts`). |
| `auth/` | Contexto de sesión: `AuthProvider` valida el token guardado al arrancar y expone `login`, `signup` y `logout` vía `useAuth`. |
| `routes/` | `ProtectedRoute` y `PublicOnlyRoute`, los guardas de las rutas. |
| `pages/` | Pantallas: login, registro y perfil. |
| `components/ui/` | Componentes de shadcn/ui. Se añaden con `npx shadcn@latest add <componente>`. |

El token de acceso se guarda en `localStorage` bajo la clave `flowsync.token`.
Solo se borra cuando el backend lo rechaza (401/403) o al cerrar sesión: un
fallo de red o un 500 no destruyen una sesión que probablemente siga siendo
válida.
