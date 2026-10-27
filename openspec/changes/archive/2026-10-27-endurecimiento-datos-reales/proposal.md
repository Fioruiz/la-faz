# Proposal

## Why

El ítem #13 hizo que el sistema reciba datos personales reales de personas sin cuenta, y los ítems #5–#12 ya guardan donaciones y apoyantes reales. Varias decisiones del TDD se tomaron con "proyecto de prueba" y el usuario confirmó después (A1) que **el proyecto es real**: la zona pública lee con la misma conexión de plena autoridad que la privada (ADR 0007), el login no limita intentos (A5), el formulario público solo tiene honeypot (ADR 0006) y no hay respaldo ni restauración probados (A9). Por eso el usuario decidió **no migrar producción ni desplegar hasta cerrar este ítem**. Este es el ítem #14 del backlog, "Endurecimiento antes de usar datos reales".

## What Changes

Alcance estricto del ítem #14, con las decisiones del usuario:

- **Rol de solo lectura en Postgres para la zona pública** (cierra la alternativa que el ADR 0007 dejó como "paso siguiente si hubiera datos reales"): un rol `publico_lectura` con `SELECT` solo sobre las tablas y **columnas** que necesitan las lecturas públicas (`proyectos`, `items_meta` y las columnas de `donaciones` que usa el avance), sin acceso a `apoyantes`, `responsables`, `voluntarios_inscritos`, `audit_log` ni a las columnas personales de `donaciones`. `lib/public-queries.ts` pasa a leer con una conexión de ese rol (`DATABASE_URL_PUBLICO`). Un script idempotente crea el rol y sus permisos (la contraseña nunca va al repositorio).
- **Límite de intentos de login**: tras 5 intentos fallidos por correo en 15 minutos, el login se bloquea 15 minutos. Se cuenta por correo, exista o no, para no revelar qué correos son de responsables. Se aplica en la autorización de Auth.js (no solo en la acción del formulario, que se puede saltar llamando directo a `/api/auth`).
- **Límite del formulario público de voluntariado**: máximo 5 envíos por hora por dirección IP (guardada solo como hash con clave, nunca en claro) y los envíos que superen el límite se rechazan con un mensaje claro. Se suma al honeypot, sin servicios externos.
- **Contadores en Postgres** (decisión del usuario, sin Upstash ni captcha): una tabla `intentos_limitados` con limpieza de filas viejas, una migración nueva.
- **Respaldo y restauración**: un procedimiento escrito (`RESPALDO.md`) para restaurar la base de producción con la restauración de Neon, ensayado una vez en una rama de Neon y con el resultado anotado (qué ventana de recuperación ofrece el plan real). Sin código nuevo.
- **Lista de verificación para el usuario** (`CHECKLIST-PUBLICACION.md`): lo que el código no puede resolver y decide la ONG antes de publicar: texto legal definitivo del consentimiento y canal de contacto para pedir cambios o baja, términos vigentes de Vercel Hobby para una web que pide donaciones (A10), y los pasos de despliegue pendientes.
- **ADR nuevo (0011)** que registra el rol de solo lectura y los límites, y anota que reemplaza lo que el ADR 0006 descartó (límite por IP) y el "una sola conexión" del ADR 0007.

Decisiones registradas para revisión:
- **Permisos por columna, no vistas**: así `consultarAvance()` (única función de avance, compartida con la zona privada) sigue siendo la misma consulta y no se duplica la lógica (A2). El costo: la columna `donaciones.monto` queda legible para el rol público (el avance la usa para el total en soles que la capa pública descarta). Una vista que la oculte obligaría a duplicar la consulta; se descarta por el riesgo de que la barra pública y la privada se desincronicen.
- **El formulario de voluntariado sigue escribiendo con la conexión de la aplicación**, no con el rol público: ese rol es de **solo lectura**. Reducir el permiso de esa escritura (un rol que solo inserte) queda fuera de alcance y se anota como riesgo.
- **El bloqueo de login también aplica a un correo inexistente** y se muestra con un mensaje propio ("demasiados intentos, espera 15 minutos"); eso no revela quién es responsable porque se cuenta igual para cualquier correo. Riesgo aceptado: alguien podría bloquear a propósito el correo de un responsable durante 15 minutos (con ~3 responsables y bloqueo corto, se acepta).
- **Texto legal, canal de contacto y términos de Hobby no se resuelven en código**: quedan en la lista de verificación. Cuando el usuario entregue el texto legal, cambiar `CONSENTIMIENTO_VOLUNTARIADO` (texto y versión) es una edición de una constante, fuera de este change.
- **A6, A7 y A9 fuera de la parte de código**: duplicados de apoyantes (A6) no se tratan; la zona horaria `America/Lima` (A7) ya está resuelta en #7; de A9 solo se hace el procedimiento de restauración, no un respaldo propio periódico (decisión del usuario: restauración de Neon más prueba documentada).

Fuera de alcance: captcha o Turnstile; Upstash/Redis; un rol que solo inserte para el formulario público; roles distintos por responsable; gestión de responsables (A5 completa); volcados `pg_dump` periódicos; anular o borrar inscripciones y apoyantes; texto legal definitivo; cumplimiento legal (derechos de acceso, cancelación y retención); monitoreo y alertas; ejecutar la migración o el despliegue en producción (eso lo decide el usuario después, ver la lista de verificación).

## Capabilities

### New Capabilities
- `public-read-isolation`: la zona pública lee la base solo con un rol de Postgres de solo lectura limitado a lo que muestra; aunque el código falle, la base no entrega datos personales, contactos, historial ni responsables.
- `rate-limiting`: los intentos de login por correo y los envíos del formulario público por IP tienen un límite con bloqueo temporal, guardado en Postgres, sin guardar IP en claro ni revelar qué correos existen.
- `disaster-recovery`: existe un procedimiento escrito y ensayado para restaurar la base de producción, y una lista de verificación de lo que debe decidir la ONG antes de publicar.

### Modified Capabilities
<!-- Ninguna: openspec/specs/ está vacío (los specs de los cambios anteriores aún no se archivan). Los requisitos del login (#3), del formulario (#13) y de las lecturas públicas (#12) se extienden desde las specs nuevas de este change; si se archivan antes, se convierten en deltas MODIFIED. -->

## Impact

- **Código nuevo**: `scripts/crear-rol-publico.ts` (comando `npm run db:rol-publico`), `lib/db-publico.ts` (conexión del rol público), `lib/limite-intentos.ts` (núcleo sin Next) y su uso, `RESPALDO.md`, `CHECKLIST-PUBLICACION.md`, `adrs/0011-…md` y las pruebas.
- **Código existente**: `lib/public-queries.ts` (conexión del rol público), `lib/auth.ts` y `lib/auth-credentials.ts` (límite en la autorización), `app/login/actions.ts` (mensaje de bloqueo), `lib/voluntariado-inscripcion-core.ts` y `app/(publico)/voluntariado/actions.ts` (límite por IP), `lib/schema.ts` y una migración en `drizzle/`, `.env.example`, `CLAUDE.md`, `tests/public-estructura.test.ts` y las pruebas de login y de voluntariado.
- **Dependencias nuevas**: ninguna.
- **Sistemas externos**: Neon (un rol nuevo con su contraseña, y una rama temporal para ensayar la restauración) y Vercel (variable `DATABASE_URL_PUBLICO` al desplegar). **Todo lo que escribe en producción (crear el rol, migrar) se confirma con el usuario antes**; el desarrollo y las pruebas usan la rama de pruebas.
- **Pendientes del TDD que se tocan**: cierra A1 (rol de solo lectura), A5 (límite de intentos de login; no incluye gestión de responsables), A9 (respaldo y restauración, solo por Neon) y deja anotado A10 en la lista de verificación. Avanza A8 (consentimiento) solo con la lista.
