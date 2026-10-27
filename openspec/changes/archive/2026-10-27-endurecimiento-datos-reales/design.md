# Design

## Context

Ver `proposal.md` para el motivo. Estado actual observado:

- Una sola conexión de plena autoridad (`lib/db-client.ts`, `DATABASE_URL`) sirve a las zonas pública y privada. `lib/public-queries.ts` la usa con `getDb()`. El ADR 0007 dejó el rol de solo lectura como "paso siguiente si hubiera datos reales".
- La consulta pública llama a `consultarAvance()`, que lee de `items_meta` y `donaciones` solo las columnas `id`, `proyecto_id`, `item_id`, `tipo`, `cantidad`, `monto` y `anulada`, más `proyectos` (nombre, descripción, `tiene_meta`, estado, resultado). No toca `apoyantes`, `voluntarios_inscritos`, `responsables` ni `audit_log`.
- El login valida en `autenticarResponsable(db, entrada)` (`lib/auth-credentials.ts`), llamado desde `authorize` de Auth.js (`lib/auth.ts`). El servicio `/api/auth` está expuesto (`app/api`), así que hay dos vías de entrada: el formulario (`app/login/actions.ts`) y la llamada directa. Un límite solo en la acción se saltaría llamando directo.
- La inscripción pública (`lib/voluntariado-inscripcion-core.ts`) recibe `db` y la entrada; no conoce la IP. La Server Action puede leer `headers()` de Next.
- Las migraciones usan `DATABASE_URL_UNPOOLED` (`drizzle.config.ts`) y la rama de pruebas se migra con `npm run db:test:migrate`. Hay un patrón de scripts con `tsx --env-file-if-exists=.env.local` (`scripts/seed-responsable.ts`, `scripts/db-check.ts`).
- Las pruebas corren contra la rama de pruebas de Neon con `DATABASE_URL_TEST`, y abortan si apunta al endpoint de producción.

## Goals / Non-Goals

**Goals:**
- Que un error de código en lo público no pueda entregar datos personales: lo impide la base, no la disciplina.
- Mantener una sola función de avance (A2): la zona pública sigue llamando a `consultarAvance()` con otra conexión, sin copiar la consulta.
- Límites de intentos que no se puedan saltar entrando por otra vía y que no revelen qué correos existen.
- Un procedimiento de restauración que se haya ejecutado de verdad una vez.

**Non-Goals:**
- Un rol que solo inserte para el formulario público, o roles por responsable.
- Captcha, Redis o cualquier servicio externo (decisión del usuario).
- Un respaldo periódico propio (volcados `pg_dump`).
- Resolver el texto legal, el canal de contacto ni los términos de Vercel Hobby; solo se listan.
- Aplicar nada en producción: eso queda a la lista de verificación y a la confirmación del usuario.

## Decisions

### 1. Rol `publico_lectura` con permisos por columna
`GRANT SELECT` solo sobre `proyectos` (todas sus columnas), `items_meta` (todas) y `donaciones` limitada a `(id, proyecto_id, item_id, tipo, cantidad, monto, anulada)`. Sin permisos sobre `apoyantes`, `voluntarios_inscritos`, `responsables`, `audit_log`, ni sobre `donaciones.apoyante_id`, `medio`, `registrado_por`, `descripcion_producto`, `donacion_vinculada_id`, `fecha` y `creado_en`. Sin `INSERT/UPDATE/DELETE`, sin permisos de esquema (`CREATE`) y sin acceso a secuencias.

*Por qué columnas y no vistas:* el avance público debe seguir saliendo de `consultarAvance()` (única función, cierra A2). Con vistas habría que reescribir esa consulta contra ellas o duplicarla, y la barra pública y la privada podrían desincronizarse. El costo aceptado: `donaciones.monto` es legible para el rol (el avance lo suma para el total en soles que la capa pública descarta); el tipo `ProyectoPublico` y la prueba estructural siguen impidiendo que salga.

*Alternativa descartada:* vistas públicas (`vista_proyectos_publicos`, etc.). Más aislamiento de `monto`, pero duplica lógica de avance. *Alternativa descartada:* Row-Level Security: añade complejidad a todas las tablas sin una ganancia sobre los permisos por columna aquí.

### 2. Creación del rol: script idempotente fuera de las migraciones
`scripts/crear-rol-publico.ts` (`npm run db:rol-publico`, `tsx --env-file-if-exists=.env.local`). Lee `PUBLICO_LECTURA_PASSWORD` (≥ 24 caracteres) de la variable de entorno; no hay contraseñas en migraciones (que viven en el repo). Hace `CREATE ROLE ... LOGIN PASSWORD` si no existe (si existe, `ALTER ROLE` de la contraseña solo con `--rotar`), `REVOKE ALL` sobre todo y luego los `GRANT` anteriores. Usa `DATABASE_URL_UNPOOLED`. Contra la base real exige `--confirmar-produccion` (la rama de pruebas se reconoce por `DATABASE_URL_TEST`, por el mismo criterio de host de `tests/test-db.ts`). Los permisos están como constantes en un módulo (`lib/rol-publico.ts`) que usa el script y las pruebas, de modo que una columna nueva en `donaciones` es "denegada por omisión" salvo que se añada ahí.

*Alternativa descartada:* crear el rol desde una migración de Drizzle. Obligaría a meter la contraseña en el SQL del repositorio o a depender de un `ALTER` posterior; además la rama de pruebas y producción tendrían contraseñas distintas.

*Nota Neon:* un rol creado por SQL con `CREATE ROLE` funciona dentro de la rama; también puede crearse desde la consola de Neon. El script soporta el primer caso; si Neon exigiera la consola, la lista de verificación lo indica (Open Questions).

### 3. Conexión pública separada, obligatoria y sin respaldo
`lib/db-publico.ts` (`server-only`): `getDbPublico()` con su propio `Pool` perezoso sobre `DATABASE_URL_PUBLICO` (cadena *pooled* del rol). Si la variable no está, lanza un error; **no** hay caída a `DATABASE_URL`. Así el `error.tsx` de `/nuestros-proyectos` muestra el error y nunca un avance en cero (ADR 0005 y spec). `lib/public-queries.ts` pasa a `crearLecturasPublicas(() => getDbPublico())`. El núcleo sin Next no cambia.

Una prueba estructural fija que `app/(publico)/**` y `lib/public-queries*.ts` solo obtienen la base por `db-publico`, y que `lib/db-publico.ts` no se importa desde nada privado ni de la inscripción.

### 4. Límite por contadores en Postgres
Tabla nueva `intentos_limitados` (`id`, `tipo` text con CHECK en `('login','formulario')`, `clave` text, `creado_en` timestamptz; índice `(tipo, clave, creado_en)`). `lib/limite-intentos.ts` (núcleo sin Next, recibe `db`):
- `estaBloqueado(db, tipo, clave, ventana, maximo)`: cuenta filas del `tipo` y `clave` con `creado_en > now() - ventana`.
- `registrarIntento(db, tipo, clave)`: inserta y, de paso, borra las de más del doble de la ventana (limpieza sin tarea programada).
- `limpiarIntentos(db, tipo, clave)`: tras un acierto de login.

*Clave del login:* el correo normalizado (`trim().toLowerCase()`) pasado por HMAC-SHA256 con una clave derivada de `AUTH_SECRET` (`HMAC(AUTH_SECRET, "limite:" + valor)`), así la tabla no guarda correos en claro. *Clave del formulario:* el primer valor de `x-forwarded-for` (en Vercel lo fija la plataforma) con el mismo HMAC. Sin IP disponible (por ejemplo `next dev`), la clave es un valor fijo (`sin-ip`): fail-closed contra todos, razonable en local.

*Alternativa descartada:* contador en memoria. En Vercel cada instancia es distinta y se reinicia; no limita nada. *Alternativa descartada:* Upstash/Turnstile (decisión del usuario por dependencia y datos de terceros).

### 5. Dónde se aplica cada límite
- **Login:** en `autenticarResponsable()` (la misma función que usa `authorize`), antes de leer al responsable: si `estaBloqueado` → lanza `LoginBloqueadoError` (subclase de `CredentialsSignin` con código propio) que la acción traduce al mensaje "Demasiados intentos. Espera 15 minutos…". Si las credenciales son inválidas (incluido correo inexistente o desactivado) → `registrarIntento`; si son correctas → `limpiarIntentos`. 5 intentos en 15 minutos, bloqueo mientras haya ≥ 5 dentro de la ventana (la ventana móvil ya es el bloqueo). Con el límite dentro de la función compartida, la llamada directa a `/api/auth` queda cubierta.
- **Formulario:** en `inscribirVoluntario()`, **antes** del campo trampa (así los envíos de bots también cuentan): `registrarIntento` primero y, si `estaBloqueado` (≥ 5 en una hora, contando el actual), devuelve un resultado `limite` con el mensaje y `valores`. Registrar antes de decidir hace que los envíos con errores de validación también cuenten, como pide la spec. El núcleo recibe la clave ya calculada (`opciones.claveIp`), sin conocer cabeceras; la Server Action la calcula con `headers()`.

*Orden en el formulario:* límite → trampa → validación → transacción. Un envío limitado no revela si el campo trampa estaba lleno.

### 6. Base caída en el contador: falla cerrada
Si `estaBloqueado` o `registrarIntento` lanzan, el login responde el error genérico existente y el formulario el mensaje genérico con `valores`; nunca se omite el contador. El log lleva solo tipo de error y código (patrón existente).

### 7. Respaldo: procedimiento ensayado, sin código
`RESPALDO.md`: restauración por rama de Neon en un instante anterior (instant restore / branch from past), verificación con conteos clave (proyectos, apoyantes, donaciones, voluntarios), cómo apuntar `DATABASE_URL` (y las conexiones sin pooler y del rol público) a la rama restaurada o promoverla, qué se pierde (todo lo posterior al instante) y la ventana real. La tarea de ensayo crea una rama temporal desde producción (lectura, no modifica), comprueba conteos y la borra. Requiere confirmación del usuario y la consola o las herramientas de Neon.

*Alternativa descartada:* volcado `pg_dump` propio periódico (decisión del usuario: restauración de Neon más prueba documentada). El riesgo de depender de un solo proveedor queda en el documento.

### 8. Documentos y ADR
`CHECKLIST-PUBLICACION.md` (decisiones de la ONG, orden de publicación) y `adrs/0011-endurecimiento-antes-de-datos-reales.md` que registra los puntos 1, 3, 4 y 5 y enlaza al 0006 y 0007 como parcialmente reemplazados. `CLAUDE.md` se actualiza con las reglas nuevas.

### 9. Pruebas
- **Rol público contra la rama de pruebas:** una conexión con el rol (necesita `DATABASE_URL_TEST_PUBLICO`, la misma rama con el rol creado por el script) para comprobar permisos: lecturas de avance iguales a las de la conexión plena; `42501` (permiso denegado) al leer `apoyantes`, `voluntarios_inscritos`, `responsables`, `audit_log` y las columnas personales de `donaciones`, y al escribir. Hay un guardia: las pruebas del rol se omiten con un aviso claro si la variable no está, pero `db:test` documenta crearlo; una prueba estructural verifica que el script y las pruebas comparten `lib/rol-publico.ts`.
- **Límites:** pruebas de `limite-intentos` con un reloj controlable (se pasa `ahora` o se inserta `creado_en` pasado), de `autenticarResponsable` (5 fallos → bloqueo aunque la contraseña sea correcta, correo inexistente bloquea igual, acierto limpia, base caída → error) y de `inscribirVoluntario` (sexto envío, trampa y validación cuentan, otra IP libre).
- **Estructurales:** lo público solo usa `db-publico`; `intentos_limitados` no guarda contraseñas ni datos del formulario; el HMAC se usa para claves.

## Risks / Trade-offs

- [Alguien bloquea a propósito el login de un responsable (DoS de 15 minutos)] → Aceptado: ~3 responsables, bloqueo corto y sin bloqueo permanente; el ADR lo registra.
- [`X-Forwarded-For` falsificable fuera de Vercel] → En Vercel lo establece la plataforma; fuera de ahí no hay garantía. Se documenta; el límite es defensa en profundidad, no un control de identidad.
- [Varios voluntarios legítimos detrás de una misma IP (un colegio) superan 5 por hora] → Mensaje claro de reintentar más tarde; el límite se puede subir en una constante.
- [El rol público lee `donaciones.monto`] → La base no lo oculta; el tipo cerrado y la prueba estructural impiden que salga. Una vista lo ocultaría a costa de duplicar el avance (descartado).
- [El formulario sigue escribiendo con la conexión plena] → Un error en la inscripción podría abusar de ella; el riesgo se limita porque el módulo solo inserta en dos tablas (prueba estructural). Un rol que solo inserte queda fuera de alcance.
- [Un cambio de esquema en `donaciones` deja al rol público sin una columna que el avance necesite] → Las constantes del rol están en un solo módulo, y la prueba de igualdad de avance con el rol falla si falta un permiso.
- [`DATABASE_URL_PUBLICO` mal puesta en Vercel rompe lo público] → Falla visible (página de error) y paso explícito en la lista de verificación.
- [La restauración de Neon tiene ventana corta en el plan gratuito] → Se mide y se escribe en `RESPALDO.md`; es un riesgo de proveedor que la ONG acepta o resuelve con un volcado propio más adelante.
- [Crecimiento de `intentos_limitados`] → Limpieza oportunista en cada registro y un índice por `(tipo, clave, creado_en)`.

## Migration Plan

1. Añadir `intentos_limitados` al esquema y generar la migración (`npm run db:generate`); aplicarla a la rama de pruebas (`npm run db:test:migrate`).
2. Crear el rol en la **rama de pruebas** con `npm run db:rol-publico` y poner `DATABASE_URL_TEST_PUBLICO` en `.env.test`; correr `npm run db:test`.
3. Nada de lo siguiente se hace sin confirmación del usuario, y todo queda en `CHECKLIST-PUBLICACION.md` en este orden: `db:migrate` en producción (junto con la migración pendiente de #13), `db:rol-publico` en producción, variables `DATABASE_URL_PUBLICO` y `AUTH_SECRET` en Vercel, despliegue.
4. Reversión antes de usarse: `DROP TABLE intentos_limitados`; `DROP OWNED BY publico_lectura; DROP ROLE publico_lectura`; volver `lib/public-queries.ts` a `getDb()` (commit anterior). Con datos reales ya recibidos, no se revierte: se corrige hacia adelante.

## Open Questions

- **¿Permite Neon crear el rol con `CREATE ROLE` por SQL desde la cadena de conexión del propietario?** Se comprueba en la rama de pruebas al ejecutar el script. Si no, se crea el rol desde la consola de Neon y el script solo aplica los permisos; no cambia specs, enfoque ni tareas (el script ya separa crear el rol de otorgar permisos).
- **Ventana de recuperación real del plan de Neon** y si el plan permite *instant restore*: se averigua en la tarea del ensayo y se escribe en `RESPALDO.md`; no cambia las tareas.
