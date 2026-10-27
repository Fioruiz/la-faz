# Proposal

## Why

El repositorio solo contiene documentación (PRD, TDD, ADR, backlog); no existe `package.json` ni código. Todos los demás ítems del backlog (#2 a #14) dependen de una aplicación que compile, se conecte a Neon y se despliegue en Vercel Hobby. Hacerlo primero fija el stack decidido en los ADR 0001 y 0004 y detecta pronto problemas de despliegue, con el proyecto de 10 Derechos en noviembre como plazo.

## What Changes

Alcance estricto del ítem #1 del backlog ("Andamiaje y despliegue base"):

- Crear el proyecto Next.js (App Router) con TypeScript y Tailwind CSS en la raíz del repositorio, con `package.json` y scripts `dev`, `build` y `start`.
- Instalar Drizzle ORM y el driver `@neondatabase/serverless`, y dejar un único módulo de conexión a Neon que admita transacciones interactivas (las exigen los ADR 0003 y 0006 para guardar un cambio y su `audit_log` juntos).
- Definir las variables de entorno: la cadena de conexión a Neon va en `.env.local` (no versionado), se documenta una plantilla `.env.example` sin valores reales, y en Vercel se configura como variable de entorno.
- Añadir un comando de verificación de la conexión a la base que se ejecuta desde la terminal, sin exponer ninguna ruta pública que consulte tablas.
- Una página inicial mínima y provisional para comprobar que la aplicación compila y se sirve; no es la zona pública del PRD.
- Desplegar la aplicación en Vercel Hobby desde el repositorio de GitHub y comprobar que `npm run build` pasa también allí.
- Actualizar `CLAUDE.md` (sección de comandos y marcas `REVISAR`) con los comandos reales del proyecto creado.

Fuera de alcance (pertenecen a otros ítems): tablas y migraciones (#2), login y autorización (#3), `audit_log` y patrón de escritura (#4), cualquier pantalla de la zona pública o privada, y el endurecimiento (#14).

## Capabilities

### New Capabilities
- `app-deployment`: la aplicación compila con `npm run build`, se despliega en Vercel Hobby desde el repositorio, no contiene secretos ni credenciales de pago o banco, y toma su configuración de variables de entorno.
- `database-connection`: la aplicación se conecta a Postgres en Neon mediante un único módulo con Drizzle y el driver serverless, soporta transacciones interactivas y falla con un error claro si falta la cadena de conexión.

### Modified Capabilities
<!-- Ninguna: no existen specs previos en openspec/specs/. -->

## Impact

- **Código nuevo:** estructura de Next.js en la raíz (`app/`, configuración de TypeScript, Tailwind y Next), módulo de conexión a la base, script de verificación de conexión.
- **Dependencias nuevas:** `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` y herramientas de desarrollo mínimas para ejecutar el script de verificación. No se añade ningún SDK de pagos ni bancos.
- **Sistemas externos:** proyecto en Vercel Hobby enlazado al repositorio `Fioruiz/la-faz` y una base en Neon (free tier); ambos requieren acciones del usuario con sus cuentas.
- **Documentación:** `CLAUDE.md` se actualiza; el PRD, el TDD y los ADR no cambian.
- **Pendientes del TDD que se tocan:** A4 (driver con transacciones interactivas) se resuelve aquí; A10 (términos de Vercel Hobby) queda para el ítem #14.
