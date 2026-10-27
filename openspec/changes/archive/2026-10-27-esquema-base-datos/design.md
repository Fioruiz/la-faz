# Design

## Context

Estado observado: el repositorio tiene `lib/db-client.ts` (Drizzle sobre `Pool` de Neon con `ws`, `DATABASE_URL` perezosa), `lib/db.ts` (`server-only`), `scripts/db-check.ts` y `drizzle-kit` y `tsx` instalados. No hay esquema, `drizzle.config.ts` ni migraciones. `.env.local` trae `DATABASE_URL` (pooled) y `DATABASE_URL_UNPOOLED` (directa). La base de Neon está vacía. El cambio `andamiaje-despliegue-base` sigue sin archivar.

Fuentes de verdad: TDD v2 (sección "Modelo de datos"), ADR 0002 y ADR 0008 (que reemplaza parcialmente la definición de `donaciones` del 0002). Motivación en `proposal.md`; requisitos en `specs/`.

## Goals / Non-Goals

**Goals:**
- Un solo archivo de esquema Drizzle que sea la definición de las siete tablas, con FK compuesta y `CHECK` explícitos.
- Una migración inicial SQL versionada, aplicable de forma repetible.
- Pruebas que ejerciten las restricciones contra Postgres real, no contra mocks.

**Non-Goals:**
- Consultas de aplicación (avance, reportes, lecturas públicas), tipos de dominio para formularios y esquemas Zod: los crean los ítems que los usan.
- Escribir en `audit_log`, crear responsables o contraseñas, crear ítems con meta.
- Zona horaria `America/Lima`, rol de solo lectura y respaldo (#14).

## Decisions

**1. Un único `lib/schema.ts`; migraciones SQL en `drizzle/`.**
Se genera la migración con `drizzle-kit generate` y se revisa a mano antes de aplicarla. Alternativa descartada: `drizzle-kit push`, porque no deja historial versionado y el ítem pide migraciones. `lib/db-client.ts` pasa `{ schema }` a `drizzle()` para tener tipos en consultas futuras; su comportamiento no cambia.

**2. Las migraciones usan `DATABASE_URL_UNPOOLED`; la aplicación sigue con la pooled.**
Las migraciones son DDL en una sesión larga y conviene la conexión directa de Neon. `drizzle.config.ts` lee `DATABASE_URL_UNPOOLED` y, si falta, falla nombrando la variable. Alternativa: usar una sola cadena; se descarta por el riesgo conocido de DDL a través del pooler.

**3. Valores cerrados como `text` + `CHECK`, no `pgEnum`.**
`estado` (`activo`|`finalizado`), `tipo` (`dinero`|`producto`) y `medio` (`yape`|`plin`|`transferencia`) usan `CHECK ... IN (...)`. Un `pgEnum` exige `ALTER TYPE` para cambiar y sus valores no se pueden quitar con facilidad; el `CHECK` se reemplaza con una migración simple. El ADR 0002 ya usa `CHECK` como mecanismo de integridad.

**4. Tipos.** Claves `integer` generadas como identidad (el JWT del ítem #3 solo lleva el id). `monto` y `costo_referencial` como `numeric(12,2)` en soles, nunca `float`; Drizzle los devuelve como `string` y las capas posteriores convierten. `cantidad` y `cantidad_meta` como `integer`. `fecha` de la donación como `date` (la fecha en que se recibió, declarada por el responsable) y las marcas de creación como `timestamptz` con `now()` por defecto. Esto resuelve de A7 solo lo necesario para definir columnas; la zona horaria queda en #14.

**5. Tabla `donaciones` según el ADR 0008, sin cambios.**
- `UNIQUE (id, proyecto_id)` en `items_meta`.
- FK compuesta `(item_id, proyecto_id) → items_meta (id, proyecto_id)`.
- Un `CHECK` con la disyunción de los tres estados válidos, escrito en una sola expresión nombrada (`donaciones_estado_valido`) para que el mensaje de error de Postgres la identifique.
- FK simple `proyecto_id → proyectos`, `apoyante_id → apoyantes` (obligatoria), `registrado_por → responsables` (obligatoria), `donacion_vinculada_id → donaciones` (autorreferencia, nula).
- Todas las FK sin `ON DELETE CASCADE`: nada se borra (el PRD solo permite anular).

**6. `apoyantes`: dos booleanos `es_donante` y `es_voluntario` con `CHECK (es_donante OR es_voluntario)`.**
El TDD dice "rol (donante y/o voluntario)". Dos booleanos permiten las dos cosas a la vez sin tabla puente. Alternativa: columna `rol` con tres valores; se descarta porque obliga a una fila duplicada o un valor `ambos` y complica las consultas.

**7. `responsables` incluye `correo` único y `password_hash`.**
El ítem #3 los necesita y añadirlos después exigiría otra migración sobre una tabla ya usada. No se crea ninguna fila: el responsable inicial es de #3.

**8. `voluntarios_inscritos` mínima: `apoyante_id`, `mensaje` opcional y `creado_en`.**
El TDD no enumera los campos del formulario. Se deja lo mínimo para cumplir "vinculado a un apoyante"; el ítem #13 añade columnas con una migración aditiva cuando defina el formulario y el consentimiento (A8).

**9. `audit_log`: `entidad`, `entidad_id`, `accion`, `antes` y `despues` (`jsonb`, nulos), `responsable_id` (obligatorio), `creado_en`.**
Sin escritura en este cambio (ADR 0003 y 0006 la definen en #4). Índice por `(entidad, entidad_id)` para el historial futuro.

**10. Índices solo donde una consulta ya prevista los usa.**
`donaciones (item_id)` filtrado por `tipo = 'producto' AND NOT anulada` (la consulta de avance del ADR 0008), `donaciones (proyecto_id)`, `donaciones (apoyante_id)` y `items_meta (proyecto_id)`. No se añaden más hasta medirlos.

**11. Datos iniciales con `INSERT ... ON CONFLICT (nombre) DO NOTHING`.**
Requiere `UNIQUE` en `proyectos.nombre`. Es repetible y no sobrescribe ediciones posteriores. Se ejecuta con un script propio (`db:seed`), separado de la migración, porque los datos iniciales son datos de la ONG y no estructura. Sin ítems: sus metas dependen de cada campaña y las define el responsable en #5.

**12. Pruebas con `node:test` ejecutadas con `tsx`, contra una rama descartable de Neon.**
Una rama `test-esquema` creada desde `production` (sin copiar datos reales, porque la base está vacía), con su cadena en `.env.test` (ignorado por git, patrón `.env*` ya cubre). El script `db:test` aplica las migraciones a esa rama y ejecuta las pruebas; cada prueba de rechazo corre en una transacción que se revierte, para no dejar filas. Alternativa: pruebas contra `production`, descartada porque mezcla datos de prueba con los reales. Alternativa: Postgres local o `pglite`, descartada porque no reproduce Neon ni añadir un motor distinto para una sola suite.

## Risks / Trade-offs

- [Migrar directamente `production`, sin entorno intermedio] → La base está vacía y la migración es solo aditiva; se revisa el SQL generado antes de aplicarlo y las pruebas corren primero en la rama descartable.
- [Esquema que no refleja el SQL generado] → Una tarea ejecuta `drizzle-kit generate` y exige que no produzca una migración nueva (spec "Esquema y migración alineados").
- [`CHECK` de tres estados mal escrito acepta una combinación inválida] → Un caso de prueba por cada combinación del ADR 0008, aceptadas y rechazadas.
- [Columnas de `voluntarios_inscritos` insuficientes para #13] → Se acepta; #13 añade columnas con migración aditiva.
- [`medio` solo admite tres valores; el TDD menciona "transferencia internacional" en la sección de pagos simulados] → Se sigue el criterio de aceptación de registrar una donación (Yape, Plin o transferencia). Ampliarlo es un cambio de `CHECK` en una migración.
- [`medio` se deja opcional para productos] → El TDD pide medio para dinero y no lo define para productos; no se añade una regla que el TDD no fija.
- [Las pruebas dependen de crear una rama en Neon con credenciales del usuario] → Es una acción del usuario o del CLI de Neon con su confirmación; sin ella la suite no corre y se informa.

## Migration Plan

1. Generar y revisar la migración inicial; aplicarla a la rama `test-esquema` y correr las pruebas.
2. Aplicar la misma migración a `production` y ejecutar `db:seed`.
3. Reversión: la base de `production` no tiene datos al aplicarla, por lo que se puede restablecer la rama desde su estado anterior en Neon o eliminar las tablas. Una vez que existan datos reales, las correcciones van como migraciones nuevas, no como reversión.

## Open Questions

- Campos definitivos del formulario de voluntariado y consentimiento: se resuelven en #13 sin afectar a este esquema.
- Si "transferencia internacional" debe ser un `medio` aparte: se decide al construir la pantalla de registro (#7) con una migración de `CHECK`.
