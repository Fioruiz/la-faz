# ADR 0004: Stack: TypeScript, Tailwind, Drizzle + Neon serverless y Auth.js con credenciales

## Estado

Aceptado

## Contexto

Ya están fijados Next.js (App Router), el despliegue en Vercel free tier y PostgreSQL en Neon
([ADR 0001](0001-aplicacion-unica-nextjs.md)). Faltan el acceso a la base de datos y la
autenticación de los ~3 responsables, que el PRD exige con posibilidad de desactivar a una
persona sin borrar sus registros. Un solo desarrollador y plazo corto. `CLAUDE.md` prevé Tailwind
por consistencia con otros proyectos del curso.

## Decisión

- **Lenguaje y estilos:** TypeScript y Tailwind CSS. Se propusieron como valores por defecto y el
  usuario no pidió cambiarlos.
- **Acceso a datos (4a-A):** Drizzle ORM con el driver `@neondatabase/serverless`. El esquema y
  las migraciones viven en TypeScript dentro del repo.
- **Autenticación (4b-A):** Auth.js (NextAuth) con proveedor de credenciales (correo y contraseña)
  y sesión en cookie. Los usuarios viven en la tabla `responsables`
  ([ADR 0002](0002-modelo-de-datos.md)); desactivar a alguien es poner `activo = false`.

## Alternativas consideradas

- **Prisma** — muy conocido y con buen tooling, pero más pesado en serverless y con configuración
  extra para transacciones con el driver de Neon. No se eligió.
- **SQL directo con `@neondatabase/serverless`, sin ORM** — lo más simple y transparente, pero sin
  tipos automáticos ni migraciones; riesgoso con un esquema que cambia. No se eligió.
- **Sesión propia ligera (hash de contraseñas + cookie firmada con `jose`)** — muy poco código y
  sin dependencias grandes, pero la seguridad (expiración, cookies seguras, límite de intentos)
  quedaría a cargo del desarrollador. No se eligió.
- **Servicio externo de autenticación (Clerk, Neon Auth)** — rápido y seguro, pero los usuarios
  vivirían fuera de nuestra tabla, habría que sincronizar la desactivación y añade una dependencia
  externa desproporcionada para 3 usuarios. No se eligió.

## Consecuencias

- Consultas y esquema tipados de punta a punta, y las transacciones del `audit_log`
  ([ADR 0003](0003-contratos-server-actions.md)) se escriben con la misma herramienta.
- Los usuarios están en nuestra base, así que la desactivación sin borrado es directa.
- Costo: hay que aprender la sintaxis de Drizzle y sus migraciones.
- Costo: el proveedor de credenciales de Auth.js obliga a sesiones JWT y es menos "plug and play"
  que los proveedores sociales; la creación de responsables, el hash de contraseñas y el cambio de
  contraseña hay que construirlos.
- Los datos personales de donantes y voluntarios quedan protegidos solo por la calidad de este
  login; no hay segundo factor en esta versión.
