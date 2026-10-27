# ADR 0011: Rol de solo lectura para lo público y límites de intentos antes de usar datos reales

## Estado

Aceptado. Reemplaza en parte el [ADR 0007](0007-separacion-datos-publicos.md) (la conexión única, sin roles
separados) y el [ADR 0006](0006-resiliencia-y-errores.md) (que descartó el límite de envíos por IP en el formulario
público). Resuelve las preguntas A1 y A5 (límite de intentos) del TDD.

## Contexto

El proyecto es real (A1): el sistema guarda datos personales de donantes y voluntarios, y el formulario público de
voluntariado (#13) escribe sin cuenta. Tres decisiones tomadas con "proyecto de prueba" dejan de sostenerse:
la zona pública lee con la misma conexión de plena autoridad que la privada, así que un error de código podría
filtrar apoyantes o contactos; el login no limita intentos; y el formulario solo tiene un honeypot.

## Decisión

1. **Rol de Postgres `publico_lectura` de solo lectura para la zona pública.** `SELECT` únicamente sobre
   `proyectos`, `items_meta` y las columnas `id, proyecto_id, item_id, tipo, cantidad, monto, anulada` de
   `donaciones` (las que usa `consultarAvance()`). Sin acceso a `apoyantes`, `voluntarios_inscritos`,
   `responsables`, `audit_log`, `intentos_limitados` ni a las columnas personales de `donaciones`. Los permisos
   viven en `lib/rol-publico.ts`; `npm run db:rol-publico` los aplica de forma repetible y la contraseña sale de
   `PUBLICO_LECTURA_PASSWORD`, nunca del repositorio.
2. **Conexión pública obligatoria y separada** (`lib/db-publico.ts`, `DATABASE_URL_PUBLICO`). Sin esa variable la
   zona pública falla de forma visible; no cae a `DATABASE_URL`.
3. **Límite de intentos con contadores en Postgres** (`lib/limite-intentos.ts`, tabla `intentos_limitados`):
   - login: máximo 5 intentos por correo en 15 minutos; el sexto se rechaza sin comprobar la contraseña, y los
     intentos rechazados también cuentan. Se registra el intento ANTES de comprobar (si se comprobara primero, peticiones
     en paralelo se saltarían el tope); un acierto borra los intentos del correo;
   - formulario de voluntariado: 5 envíos por hora por IP; una IPv6 cuenta por su prefijo /64.
   La clave es un HMAC con `AUTH_SECRET` del correo o de la IP, nunca el valor en claro. El límite del login está en
   `autenticarResponsable()` (la función que usa Auth.js), para cubrir también las llamadas directas a `/api/auth`.
   Si el contador falla, el acceso y el guardado se rechazan.
4. **Respaldo por la restauración de Neon**, con un procedimiento escrito y ensayado (`RESPALDO.md`). Sin volcados
   propios.

## Alternativas consideradas

- **Vistas públicas en lugar de permisos por columna** — ocultarían `donaciones.monto`, pero obligan a duplicar o
  reescribir `consultarAvance()` y la barra pública y la privada podrían desincronizarse (A2). No se eligió.
- **Row-Level Security** — más complejidad en todas las tablas sin ganancia sobre los permisos por columna aquí.
- **Upstash/Redis o Turnstile para los límites** — más robusto, pero añade una dependencia y datos de terceros. No se
  eligió (decisión del usuario).
- **Contadores en memoria** — en Vercel cada instancia es distinta y se reinicia; no limitan nada.
- **Un rol que solo inserte para el formulario público** — reduciría el permiso de esa escritura, pero queda fuera
  de este ítem (el formulario escribe con la conexión de la aplicación).
- **Volcados `pg_dump` periódicos** — una copia fuera del proveedor; no se eligió en esta versión.

## Consecuencias

- Aunque una lectura pública se escribiera mal, la base rechaza leer apoyantes, contactos, historial y responsables.
- Costo: `donaciones.monto` es legible para el rol público; solo lo impiden el tipo `ProyectoPublico` y una prueba.
- Costo: una columna nueva en `donaciones` que el avance necesite exige añadirla a `lib/rol-publico.ts` y volver a
  ejecutar el script; una prueba de igualdad del avance con el rol lo detecta.
- Costo: dos cadenas de conexión que configurar en Vercel (`DATABASE_URL` y `DATABASE_URL_PUBLICO`).
- Costo: alguien puede bloquear a propósito el login de un responsable durante 15 minutos; se acepta con ~3
  responsables y un bloqueo corto.
- Costo: `X-Forwarded-For` solo es fiable donde lo fija la plataforma (Vercel); varios voluntarios tras una misma
  IP (un colegio) comparten el límite.
- Costo: una consulta y una escritura extra por intento de login y por envío del formulario.
- Costo: `DATABASE_URL_PUBLICO` mal puesta con la cadena del propietario no da error y anula el aislamiento; el
  paso se verifica en `CHECKLIST-PUBLICACION.md`.
- La restauración depende de la ventana de recuperación del plan de Neon y de un solo proveedor.
