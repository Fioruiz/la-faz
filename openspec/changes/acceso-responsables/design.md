# Design

## Context

Estado observado: la tabla `responsables` ya existe en `lib/schema.ts` (`id` identidad, `nombre`, `correo` único, `password_hash`, `activo`, `creado_en`) y la rama `production` de Neon está migrada. La app tiene `lib/db-client.ts` (pool perezoso con `DATABASE_URL`), `lib/db.ts` (`server-only`), una portada "En construcción" y las pruebas de esquema con `node:test` bajo `tsx` contra la rama `test-esquema` (`tests/test-db.ts` rechaza apuntar a producción). No hay Auth.js, `proxy.ts`, Zod ni librería de hash instalados. El cambio `esquema-base-datos` sigue sin archivar y `andamiaje-despliegue-base` sigue en curso.

Restricciones heredadas: ADR 0004 (Auth.js con credenciales, sesión JWT), ADR 0009 (JWT solo con el id; `requireResponsableActivo()` consulta Postgres en cada acceso privado; `proxy` solo redirige; ningún componente privado consulta tablas), ADR 0005 (páginas sin caché) y ADR 0003 (Zod en la entrada). El proyecto usa datos reales, así que "es una prueba" no justifica relajar nada. Next es 16.4.3: el archivo se llama `proxy.ts`. `next.config.ts` tiene `cacheComponents: true` y `partialPrefetching: true`, que contradicen el ADR 0005 y obligarían a leer la sesión detrás de `<Suspense>` (guía de autenticación con Cache Components en `node_modules/next/dist/docs/`). Los requisitos están en `specs/`; la motivación en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Un único punto, `requireResponsableActivo()`, por el que pasa toda operación privada, y una forma de que las pruebas lo ejerciten en cada ruta privada con un responsable desactivado.
- Login que no revele si un correo existe, ni si la cuenta está desactivada.
- Un responsable inicial creado fuera de la app, sin contraseña en el repo.

**Non-Goals:**
- Pantalla de gestión de responsables, cambio o recuperación de contraseña, segundo factor, roles.
- Límite de intentos de login, captcha y bloqueo de cuentas: el usuario decidió no bloquear a nadie en esta primera versión (A5, va en #14).
- La plantilla de Server Action con Zod y `audit_log` (#4); aquí solo se valida el formulario de login.
- Añadir cachés o prerenderizado a páginas con datos: el ADR 0005 pide lo contrario.

## Decisions

**1. `next-auth@5.0.0-beta.32` (Auth.js v5), versión exacta y sin `^`.**
El ADR 0004 nombra "Auth.js (NextAuth)". La v5 es la que expone `auth()`, `signIn()` y `signOut()` para Server Components y Server Actions, y declara soporte para Next 16 en sus peer dependencies. La v4 estable (`4.24.15`) también declara Next 16 pero obliga a `getServerSession` y a un `getToken` manual en el `proxy`. Se fija la versión exacta para que `npm install` no cambie una beta bajo los pies. Alternativa descartada: sesión propia con `jose`, que el ADR 0004 ya descartó por dejar la seguridad de cookies a cargo del desarrollador.

**2. Estrategia JWT con solo el id; la sesión nunca decide permisos.**
Se usa `session: { strategy: "jwt", maxAge: 7 días }`. El callback `jwt` guarda únicamente `token.sub` = id del responsable (como texto) y el callback `session` expone `session.user.id`; no se copian correo, nombre ni `activo`. El nombre que muestra el panel se lee de la base en cada petición (spec: "La sesión no mantiene datos del responsable"). Alternativa descartada: guardar `activo` en el JWT y refrescarlo, porque reintroduce la ventana de 7 días que el ADR 0009 elimina.

**3. `authorize` consulta a Postgres, valida con Zod y no distingue causas.**
El proveedor de credenciales valida `{ correo, password }` con Zod (correo con formato válido y en minúsculas recortado, contraseña de 1 a 200 caracteres; el tope evita hashear entradas enormes). Busca el responsable por `correo`, compara el hash y exige `activo = true`. Si el correo no existe, compara igualmente contra un hash ficticio fijo para igualar el tiempo de respuesta. Devuelve `null` en cualquier fallo, de modo que el login muestra un solo mensaje (spec: "Los errores no revelan datos"). Un error de base se captura y se muestra como mensaje genérico sin el texto del error (ADR 0006).

**4. Hash de contraseñas con `bcryptjs` (`bcryptjs@3.0.3`, 12 rondas).**
Es JavaScript puro, funciona en el runtime Node de Vercel sin binarios nativos (el repo ya tuvo un problema de arquitectura de binarios con `esbuild`) y está probado para el volumen de ~3 usuarios. Alternativa descartada: `argon2`, más moderno pero con módulo nativo y riesgo de fallos de instalación en Vercel y en el entorno local. Alternativa descartada: `node:crypto.scrypt`, que no necesita dependencia pero deja el formato del hash y su verificación a cargo del código propio.

**5. `requireResponsableActivo()` en `lib/private-access.ts`, con el núcleo en `lib/responsable-activo.ts`.**
- `verificarResponsableActivo(db, id)` (`lib/responsable-activo.ts`, sin `server-only`): lee la fila por id y lanza `ResponsableNoActivoError` si el id no es válido, no existe o `activo = false`; devuelve `{ id, nombre }`. No conoce Auth.js, así que las pruebas lo ejercitan con la base de pruebas.
- `requireResponsableActivo()` (`lib/private-access.ts`, con `server-only`): llama a `auth()`; sin sesión o con un id no numérico lanza el mismo error sin consultar la base; si no, delega al núcleo. Nunca usa `"use cache"` ni guarda el resultado entre peticiones (ADR 0005, ADR 0009); `React.cache` solo evita repetir la consulta dentro de una misma renderización.
Al error lo atrapa la página que llama y redirige al login.

**6. Zona privada bajo `app/(privado)/panel/` con un único dato real.**
La página `panel` llama a `getPanel()` de `lib/private-queries.ts`, que es `crearConsultasPrivadas(requireResponsableActivo).getPanel`. La fábrica (`lib/private-queries-core.ts`, sin `server-only`) recibe la comprobación de responsable activo y cada consulta la ejecuta primero. Las pruebas pasan a la fábrica una comprobación contra la base de pruebas y recorren **todas** las funciones que devuelve, de modo que una consulta privada nueva queda cubierta sin registrarla en ninguna lista. Cerrar sesión es una Server Action que llama a `signOut({ redirectTo: "/login" })`.

**7. `proxy.ts` solo mira la cookie; no toca la base.**
`proxy.ts` usa `auth` de Auth.js (lectura del JWT, sin consultar Postgres) y redirige a `/login` si no hay sesión, solo en `/panel` y sus subrutas (la decisión vive en `lib/proxy-redireccion.ts` para probarla sin Next). La guía de Next recomienda no consultar la base en el proxy porque corre también en los prefetch. La seguridad real es la decisión 5. El proxy **no** lleva a `/panel` a quien abre `/login`: con solo la cookie, un responsable desactivado rebotaría sin fin entre `/login` y `/panel`. Esa redirección la hace la página de login comprobando al responsable en la base.

**8. Verificación estructural de que lo privado no consulta tablas.**
Una prueba lee los archivos de `app/(privado)/` y falla si importan `lib/db`, `lib/db-client` o `lib/schema`, o si algún módulo del acceso privado contiene `"use cache"`. Es la comprobación mecánica del ADR 0009 ("un componente que consulte tablas directamente se salta la comprobación") hasta que exista una regla de lint.

**9. Se quitan `cacheComponents` y `partialPrefetching` de `next.config.ts`; las rutas con sesión son dinámicas.**
Ambas opciones contradicen el ADR 0005 (páginas sin caché) y nada del proyecto las necesita. Se eliminan en este cambio, a pedido del usuario, porque el login es la primera página que lee la sesión y de lo contrario habría que construirla con `<Suspense>` y rehacerla. Las páginas de login y panel llevan `export const dynamic = "force-dynamic"` para que el ADR 0005 quede explícito en el código. Se conservan las reglas de `turbopack` del archivo. Alternativa descartada: mantener las opciones y usar `Suspense` o `instant = false` por ruta, que añade complejidad sin beneficio.

**10. Seed del responsable inicial en `scripts/seed-responsable.ts`, separado de `db:seed`.**
`db:seed` carga proyectos y su spec `initial-project-data` prohíbe crear responsables, así que el responsable inicial va en un script propio (`npm run db:seed-responsable`). Lee `RESPONSABLE_INICIAL_NOMBRE`, `RESPONSABLE_INICIAL_CORREO` y `RESPONSABLE_INICIAL_PASSWORD`, las valida con Zod (contraseña de al menos 12 caracteres), calcula el hash con la misma función que usa el login (`lib/password.ts`) e inserta con `ON CONFLICT (correo) DO NOTHING`, informando si ya existía. El script nunca imprime las variables. Sigue el mismo patrón de `scripts/seed.ts`. Alternativa descartada: variables leídas por la app al arrancar y creación implícita, porque cualquier despliegue podría recrear una cuenta desactivada.

**11. Variables de entorno.**
`AUTH_SECRET` (secreto de firma del JWT, generado con `openssl rand -base64 32`, distinto en local y en Vercel) y las tres del responsable inicial. Se añaden vacías a `.env.example`, junto con `DATABASE_URL_UNPOOLED` y `DATABASE_URL_TEST`, que ya usan los scripts existentes y faltaban. En Vercel no hace falta `AUTH_URL`; en local se define `AUTH_TRUST_HOST` solo si Auth.js lo pide.

**12. Pruebas con `node:test` contra la rama de pruebas, como en `esquema-base-datos`.**
El login se prueba en su núcleo (`authorize` extraído a `lib/auth-credentials.ts`, función que recibe `db` y devuelve el responsable o `null`) para no levantar Next: credenciales correctas, contraseña incorrecta, correo inexistente, desactivado, entrada mal formada y el mismo resultado en los fallos. `verificarResponsableActivo` se prueba con activo, desactivado, inexistente y reactivado. El contenido del JWT se prueba sobre los callbacks `jwt` y `session` exportados. La redirección del `proxy` se verifica con una prueba que llama a la función con un `NextRequest` sin cookie. La caducidad de 7 días se verifica en la configuración exportada.

## Risks / Trade-offs

- [Auth.js v5 sigue en beta] → Versión exacta fijada, uso solo de la API de credenciales y JWT, y la lógica de negocio (`authorize`, núcleo de verificación) vive fuera de la librería. Si falla la compatibilidad con Next 16.4, el plan alternativo es `next-auth@4.24.15` con `getServerSession`; solo cambian `lib/auth.ts`, `proxy.ts` y el cierre de sesión.
- [Sin límite de intentos de login] → Decisión del usuario para esta versión. Con 12 rondas de bcrypt cada intento cuesta unos cientos de milisegundos, lo que frena en parte la fuerza bruta, pero no la sustituye. Queda como pendiente obligatorio de #14 (A5) antes de usar datos reales.
- [Una consulta extra a Neon por petición privada] → Aceptado en el ADR 0009; con ~3 usuarios es trivial. Se suma al arranque en frío de Neon free.
- [La lista `private-routes.ts` depende de la disciplina] → La prueba estructural impide importar tablas desde lo privado y la revisión de código verifica que cada ruta nueva se registre. No hay garantía mecánica de que una ruta nueva llame a `requireResponsableActivo()`.
- [Quitar `cacheComponents` cambia el comportamiento de todo el sitio] → Hoy solo existe la portada "En construcción", sin datos; se verifica con `npm run build` que sigue compilando y que la portada se sirve igual.
- [Hash ficticio para igualar tiempos] → Protege contra enumeración por tiempo en un caso simple; no es una defensa completa y no sustituye al límite de intentos.
- [Contraseña inicial viaja por variables de entorno] → Solo en la máquina de quien ejecuta el seed; se recomienda quitarla de `.env.local` después y cambiarla cuando exista el cambio de contraseña (fuera de alcance).

## Migration Plan

1. Instalar `next-auth`, `bcryptjs` y `zod`; añadir las variables a `.env.local` y `.env.test` (sin versionarlas) y a `.env.example` (vacías).
2. Implementar y correr `npm run db:test` y `npm run build` en local.
3. Con confirmación del usuario, ejecutar `npm run db:seed-responsable` contra `production` (escribe una fila en `responsables`) y configurar `AUTH_SECRET` en Vercel.
4. Reversión: quitar la fila del responsable con una consulta explícita, que no tiene registros asociados mientras no se haya usado el sistema; el código se revierte con git. No hay migración de esquema.

## Open Questions

- Cuándo se carga la contraseña definitiva del responsable inicial en Vercel y quién la define: pertenece al despliegue y no cambia el diseño.
