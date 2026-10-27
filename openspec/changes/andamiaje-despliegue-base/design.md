# Design

## Context

El repositorio (`Fioruiz/la-faz`, rama `main`) solo tiene documentación y carpetas de herramientas (`.claude/`, `.agents/`, `openspec/`, `old/`); no hay `package.json`. El stack ya está decidido en los ADR 0001, 0004 y 0005: Next.js App Router, TypeScript, Tailwind, Drizzle con `@neondatabase/serverless`, páginas dinámicas sin caché. Entorno local: Node 20.20.0 y npm 10.8.2. Los ADR 0003 y 0006 exigen que un cambio y su `audit_log` se guarden en una transacción, lo que condiciona el driver (pendiente A4 del TDD). Ver `proposal.md` para la motivación y `specs/` para los requisitos.

## Goals / Non-Goals

**Goals:**
- Dejar una base que compile, se conecte a Neon con transacciones y se despliegue en Vercel Hobby.
- Que los ítems #2 a #14 puedan añadir tablas, auth y pantallas sin retocar el andamiaje.

**Non-Goals:**
- Esquema, migraciones y `drizzle.config` con tablas (ítem #2).
- Auth.js, Zod, `audit_log` y módulos `lib/public-queries.ts` y `lib/private-queries.ts` (ítems #3, #4 y siguientes).
- Diseño visual, navegación o contenido real de la zona pública.
- Pruebas automatizadas de producto: no hay lógica de negocio todavía. La verificación es el build, el script de conexión y el despliegue.

## Decisions

**1. Next.js en la raíz del repositorio, creado fuera de la carpeta y copiado.**
`create-next-app` se niega a trabajar en una carpeta con archivos previos. Se genera en el directorio temporal de la sesión y se copian los archivos a la raíz sin sobrescribir `CLAUDE.md`, `PRD.md`, `TECH-DESIGN.md`, `BACKLOG.md`, `adrs/`, `openspec/`, `.claude/`, `.agents/` ni `old/`. El `.gitignore` existente está vacío, así que se reemplaza por el de Next.js más `.env*` con excepción de `.env.example`.
Alternativa: subcarpeta `web/`. Se descarta porque el ADR 0001 pide un solo proyecto y Vercel funciona sin configurar un directorio raíz si el proyecto está en la raíz.

**2. Driver `drizzle-orm/neon-serverless` con `Pool` (WebSocket), no `neon-http`.**
El driver HTTP no admite transacciones interactivas, y los ADR 0003 y 0006 las necesitan. `Pool` de `@neondatabase/serverless` sí. Resuelve A4. En Node 20 no existe `WebSocket` global, por lo que el módulo asigna `neonConfig.webSocketConstructor` con el paquete `ws` (dependencia explícita), y funciona igual en el script local y en las funciones de Vercel.
Alternativa: `neon-http` para lecturas y `Pool` solo para escrituras. Se descarta por tener dos conexiones y dos rutas de código, contra el "una sola conexión y un solo rol" del TDD.

**3. Un módulo `lib/db.ts` marcado `server-only`.**
Exporta el cliente Drizzle. Lee `DATABASE_URL` perezosamente al usarse, no al importarse, para que `npm run build` no falle por la ausencia de la variable en rutas que no consultan la base. Si falta, lanza `Error("Falta la variable de entorno DATABASE_URL")` sin imprimir valores. `import "server-only"` evita que un componente cliente lo importe. El script de verificación lo salta construyendo el cliente por una función compartida sin `server-only` (`lib/db-client.ts`), y `lib/db.ts` solo reexporta con `server-only`.
Alternativa: leer la variable al importar. Se descarta porque rompe el build en Vercel si la variable solo existe en runtime.

**4. Verificación de conexión con un script de terminal, `npm run db:check`.**
`scripts/db-check.ts` ejecuta `select 1` y una transacción de prueba que se revierte a propósito (para demostrar commit y rollback usa una tabla efímera `zz_db_check`, creada y borrada por el propio script; una tabla `temp` no sirve porque el Pool puede cambiar de conexión entre consultas). Se ejecuta con `tsx` y `--env-file=.env.local` (Node 20 lo soporta). Así no hay ruta pública que toque la base, coherente con el ADR 0007.
Alternativa: un endpoint `/api/health`. Se descarta porque crea una lectura pública fuera del módulo de lecturas públicas y es superficie de ataque sin necesidad.

**5. Variable única `DATABASE_URL` con la cadena *pooled* de Neon.**
Una variable y un rol. `.env.example` documenta el nombre y el formato con un marcador, sin host ni usuario reales. En Vercel se define para Production y Preview.

**6. Página inicial provisional estática de contenido neutro.**
Solo confirma que la app se sirve ("ONG La FAZ – en construcción"). No usa datos. Las páginas dinámicas sin caché del ADR 0005 se aplican cuando haya lecturas; marcar esta página como dinámica no aporta nada ahora.

**7. Versiones y runtime.**
Se usan las versiones estables actuales de Next.js (con App Router), React, TypeScript y Tailwind al momento de instalar, fijadas por `package-lock.json`. Se declara `engines.node >= 20` y no se fija la región de funciones. Si `create-next-app` ofrece Turbopack para dev/build se acepta el valor por defecto.

**8. Despliegue: acciones del usuario con sus cuentas.**
Crear el proyecto en Neon y enlazar el repositorio en Vercel requiere sus cuentas. Las tareas indican qué hacer y cómo comprobarlo; el agente no crea recursos externos ni sube la cadena de conexión sin confirmación.

## Risks / Trade-offs

- [Plan Hobby de Vercel es de uso no comercial y la web pide donaciones (A10)] → Fuera de este ítem; queda en #14. El despliegue de este ítem no procesa ni solicita pagos.
- [`ws` en funciones de Vercel] → Se verifica en el despliegue con el script local y una prueba en preview antes de dar el ítem por cerrado. Si falla, se reevalúa el driver antes del ítem #2.
- [Copiar el andamiaje sobre una carpeta con contenido puede pisar archivos] → Lista explícita de rutas protegidas y revisión con `git status` antes de confirmar.
- [Neon free suspende la base por inactividad; el primer `db:check` puede tardar ~1 s] → Se documenta; el script usa un tiempo de espera razonable.
- [La cadena de conexión pasa por el chat o la terminal] → Se guarda solo en `.env.local` y en Vercel, nunca se imprime ni se versiona; `.gitignore` se configura antes del primer `git add`.
- [Versiones nuevas de Next.js pueden cambiar convenciones (`proxy`, caché)] → Se leen las notas de la versión instalada antes de escribir código y se ajusta la plantilla, sin cambiar el alcance.

## Open Questions

- Región de la base en Neon y de las funciones en Vercel (conviene cercana a Perú, p. ej. us-east-1/gru1 si hay opción). No cambia specs ni tareas; se elige al crear los recursos.
