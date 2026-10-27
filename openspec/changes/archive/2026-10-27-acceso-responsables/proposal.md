# Proposal

## Why

La base ya tiene la tabla `responsables` (ítem #2), pero nadie puede entrar a la zona privada: no hay login, ni forma de saber quién llama, ni barrera que impida a un responsable desactivado seguir leyendo datos personales. Todos los ítems siguientes (escritura auditada, proyectos, apoyantes, donaciones, reportes) dependen de saber quién es el responsable y de que esté activo. El TDD v2 (hallazgo C2, ADR 0009) exige que esa comprobación se haga en la capa de datos y no solo en la sesión, porque el JWT de Auth.js no puede revocarse y "un responsable deja la ONG" es un caso borde explícito del PRD. Hacerlo ahora evita que cada ítem posterior invente su propia versión de la autorización.

## What Changes

Alcance estricto del ítem #3 del backlog ("Acceso de responsables"):

- Login con Auth.js (proveedor de credenciales, correo y contraseña) con sesión JWT que contiene solo el id del responsable y caduca a los 7 días.
- `requireResponsableActivo()` en un módulo de acceso privado: lee el responsable en Postgres y rechaza si no existe o tiene `activo = false`. Es la primera operación de toda lectura o escritura privada (ADR 0009).
- `proxy` de Next.js que redirige al login a quien no tiene sesión en las rutas privadas. Es un filtro grueso; no es la barrera de seguridad.
- Una zona privada mínima (una página de panel con el nombre del responsable y un botón de cerrar sesión) que sirve de ruta real para demostrar el acceso y para las pruebas. No contiene funciones de negocio.
- Un responsable inicial creado por un script de seed en la base. El correo, el nombre y la contraseña vienen de variables de entorno; la contraseña se guarda con hash y nunca está en el repositorio. No hay pantalla de gestión de responsables.
- Pruebas contra la rama de pruebas de Neon: un responsable activo entra, uno desactivado o inexistente es rechazado en cada ruta privada, y ningún componente privado consulta tablas directamente.

Fuera de alcance (pertenecen a otros ítems o al PRD): crear, editar, desactivar o cambiar la contraseña de responsables desde la interfaz (A5, requiere decidirlo con el PRD), límite de intentos de login (#14), plantilla de Server Action con Zod y `audit_log` (#4), cualquier lectura o escritura de proyectos, apoyantes o donaciones, rol de solo lectura en la base (#14), segundo factor y recuperación de contraseña.

## Capabilities

### New Capabilities
- `responsable-access`: un responsable activo inicia sesión con correo y contraseña y accede a la zona privada; un responsable desactivado o inexistente no puede iniciar sesión y, aunque conserve una sesión vigente, es rechazado en su siguiente petición a cualquier ruta privada; quien no tiene sesión es redirigido al login; las sesiones caducan a los 7 días.
- `initial-responsable`: existe un responsable inicial creado por un script repetible a partir de variables de entorno, con la contraseña guardada solo como hash y sin secretos en el repositorio.

### Modified Capabilities
<!-- Ninguna: no existen specs principales en openspec/specs/. La tabla `responsables` ya la define el cambio esquema-base-datos y no se modifica. -->

## Impact

- **Código nuevo:** configuración de Auth.js, módulo de acceso privado con `requireResponsableActivo()`, `proxy.ts`, página de login, página de panel, acción de cierre de sesión, script de seed del responsable inicial y pruebas.
- **Código existente:** `package.json` (dependencias y scripts), `.env.example` (variables nuevas), `CLAUDE.md` (comandos y variables nuevas). `lib/schema.ts` no cambia: `responsables` ya tiene `correo` único, `password_hash` y `activo`.
- **Dependencias nuevas:** `next-auth` (Auth.js), una librería de hash de contraseñas y `zod` para validar la entrada del login. La elección concreta se justifica en `design.md`.
- **Variables de entorno nuevas:** el secreto de sesión y los datos del responsable inicial. Ninguna se versiona; en Vercel se configuran como variables de entorno.
- **Sistemas externos:** la base `production` recibe una fila en `responsables` cuando el usuario confirme ejecutar el seed.
- **Documentación:** `CLAUDE.md` gana el comando del seed del responsable; PRD, TDD y ADR no cambian.
- **Pendientes del TDD que se tocan:** A5 se resuelve solo en lo que el backlog fija (sin gestión de responsables en pantalla). El usuario decidió no bloquear cuentas en esta primera versión; el límite de intentos queda para #14.
