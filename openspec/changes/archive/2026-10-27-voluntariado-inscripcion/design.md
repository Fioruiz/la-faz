# Design

## Context

Ver `proposal.md` para el motivo. Estado actual observado en el código:

- `voluntarios_inscritos` ya existe en `lib/schema.ts` (`id`, `apoyante_id` obligatorio, `mensaje`, `creado_en`) pero nada escribe en ella. `apoyantes` tiene `contacto` opcional y el CHECK `apoyantes_con_rol`. Quitar el rol de voluntario a quien tiene inscripciones ya está prohibido (`lib/apoyantes-escrituras.ts`).
- Toda escritura privada pasa por `crearAccionPrivada()`, que exige responsable activo y una fila en `audit_log`. `audit_log.responsable_id` es `NOT NULL`, así que **no sirve para una persona que no es responsable**. El ADR 0003 ya exceptúa expresamente a la acción pública del formulario de voluntariado de la comprobación de responsable.
- La zona pública hoy solo lee, y solo por `lib/public-queries.ts` (ADR 0007). `tests/public-estructura.test.ts` prohíbe que los archivos de `app/(publico)` importen la base, el esquema, Auth.js o lo privado, y que `lib/public-queries*.ts` lean `apoyantes`/`voluntariosInscritos` o escriban. `tests/sitio-publico-estructura.test.ts` exige que `voluntariado/page.tsx` no tenga `<form>`/`<input>` y que `como-donar` y el inicio no tengan formularios ni botones.
- La zona privada lee solo con las funciones de `lib/private-queries-core.ts`, y las páginas no importan la base (ADR 0009). El contacto no va a `audit_log` ni a los logs, no aparece en listas y solo se ve en `/apoyantes/[id]`.
- La zona horaria de fechas de negocio es `America/Lima` (`lib/fechas.ts`); aquí la fecha de inscripción es solo un `timestamptz` de auditoría (`creado_en`), que se muestra formateada en Lima.

## Goals / Non-Goals

**Goals:**
- Una única vía pública de escritura, pequeña y vigilada por una prueba estructural, separada de las lecturas públicas.
- Guardar apoyante e inscripción de forma atómica, con la evidencia del consentimiento (versión del texto + `creado_en`).
- Que ni la respuesta del envío ni ninguna página pública revele datos de otras personas.
- Reutilizar lo existente: `lib/esquemas-formulario.ts`, el patrón de núcleo sin Next + envoltorio, el estilo de formularios y errores.

**Non-Goals:**
- Reutilizar `crearAccionPrivada()` o `audit_log` para lo público; ampliar `ACCIONES_AUDITORIA`.
- Captcha, límite por IP o cola de moderación (ADR 0006); anular o borrar inscripciones.
- Texto legal definitivo; derechos de acceso, cancelación y retención (#14 y revisión legal).
- Cualquier lectura pública de voluntarios, como "nuestros voluntarios" o un contador.

## Decisions

### 1. Escritura pública en su propio módulo, con núcleo sin Next
`lib/voluntariado-inscripcion-core.ts` (sin Next, recibe `db`) exporta `inscribirVoluntario(db, entrada)`; `lib/voluntariado-inscripcion.ts` (`server-only`) lo enlaza con `getDb()`. La Server Action `app/(publico)/voluntariado/actions.ts` (`"use server"`) llama al envoltorio. Mismo patrón que `escritura-auditada-core` / `escritura-auditada`, para probar contra la rama de pruebas de Neon sin levantar Next.

*Alternativa descartada:* meter la inscripción en `lib/public-queries*.ts`. Esa capa es de **solo lectura** y una prueba lo garantiza (no `.insert(`, no `apoyantes`); mezclar escritura rompería esa garantía y la lectura del ADR 0007.

*Alternativa descartada:* un Route Handler `POST /api/voluntarios`. El ADR 0003 decide Server Actions sin API REST.

### 2. Resultado tipado igual que las acciones privadas
Devuelve `ResultadoAccion<{}>` (`ok`, `validacion` con `errores` y `valores`, `error` genérico), de modo que el formulario reutilice la lógica de `useCampos`/`Mensajes`. No hay `regla` ni `advertencia`: no hay reglas de negocio que rechazar. Las funciones de ayuda de formularios hoy viven en `app/(privado)/formulario-comun.tsx`; como la zona pública no puede importar lo privado, el formulario público tendrá sus propios campos mínimos (pocas líneas) en vez de mover ese archivo.

### 3. Orden fijo: honeypot → validación → transacción
1. Si el campo trampa (`sitio_web`) llega con cualquier texto, se devuelve éxito sin tocar la base ni validar el resto.
2. Zod valida: `nombre` = `texto(100)`, `contacto` = `texto(200)` (obligatorio, a diferencia de `apoyantes`), `mensaje` = `textoOpcional(500)`, `consentimiento` = `casilla` que debe ser `true`.
3. Transacción: `insert apoyantes` (`esVoluntario: true`, `esDonante: false`, `anonimoPublico: false`) y `insert voluntarios_inscritos` (`apoyanteId`, `mensaje`, `consentimientoVersion`).

El honeypot va primero para no gastar validación ni base en bots y para que el bot reciba la misma respuesta que un envío válido (spec `volunteer-signup`). Se hace en el núcleo, no en la capa Next, para que las pruebas lo cubran.

*Alternativa descartada:* rechazar con error visible. Enseña al bot que fue detectado; el TDD solo pide que no se guarde.

### 4. Sin `audit_log` para lo público
No hay `responsable_id` que atribuir, y la columna es obligatoria. La inscripción es en sí el registro: `creado_en` y `consentimiento_version` dicen cuándo y qué se aceptó. Los cambios posteriores del responsable sobre ese apoyante (`editarApoyante`) siguen auditándose como siempre. Se deja una nota para archivar en el ADR 0003: la excepción pública incluye no escribir historial.

*Alternativa descartada:* un "responsable sistema" en la tabla `responsables` para firmar estas filas. Crea una cuenta que aparecería en reportes (`registrado_por`) y en la desactivación, y mezcla identidades humanas con una técnica.

*Alternativa descartada:* hacer `audit_log.responsable_id` nulable. Debilita una garantía de todo el historial para un caso aislado.

### 5. Consentimiento: versión en la inscripción, texto en el contenido del sitio
Columna nueva `voluntarios_inscritos.consentimiento_version text NOT NULL`. El texto y su versión viven en `lib/sitio-contenido.ts` (`CONSENTIMIENTO_VOLUNTARIADO = { version, texto }`), junto con el resto del contenido público. La versión **la fija el servidor** a partir de esa constante, nunca el formulario: el cliente solo dice "acepto". La versión inicial es `"provisional-2026"` (convención `<estado>-AAAA`); pasar a un texto revisado legalmente es cambiar la constante.

La fecha de aceptación es `creado_en` (misma transacción que la inscripción), por lo que no se añade una columna de fecha aparte.

*Alternativa descartada:* guardar el texto completo en cada fila. Más evidencia, pero duplica texto largo por inscripción; la versión más el historial de git de `sitio-contenido.ts` basta para reconstruir qué se aceptó.

El texto provisional dice: finalidad (organizar la participación de voluntarios), quién ve los datos (los responsables de La FAZ), que no se muestran en la web, y a qué correo o canal pedir cambios o baja. **El canal de contacto de La FAZ para ese fin no está definido en el repositorio** (ver Preguntas abiertas); hasta entonces el texto lo marca con un aviso visible de "texto provisional, pendiente de revisión legal".

### 6. Migración
`drizzle-kit generate` produce una migración que agrega `consentimiento_version text NOT NULL` sin valor por defecto. Funciona solo si la tabla está vacía; la tabla nunca se ha escrito (ninguna escritura la usa), pero se **comprueba con un `select count(*)`** antes de migrar, y si hubiera filas se detiene la tarea y se consulta al usuario. `db:migrate` escribe en producción: se confirma con el usuario antes (CLAUDE.md). La rama de pruebas se migra con `npm run db:test`.

### 7. Lista privada: una consulta nueva en `private-queries-core`
`listarVoluntarios()` en `lib/private-queries-core.ts`: tras `requerir()`, un `select` de `voluntarios_inscritos` con `join` a `apoyantes` (solo `apoyantes.id`, `apoyantes.nombre`), `mensaje` y `creado_en`, orden `creado_en desc, id desc`, `limit 200` y un `count` total para el aviso. **No selecciona `contacto`**; una prueba revisa que el resultado no tenga esa clave. La página `app/(privado)/voluntarios/page.tsx` (`force-dynamic`, ADR 0005) solo presenta; cada fila enlaza a `/apoyantes/{id}`. Un enlace nuevo en el panel.

El nombre se muestra tal como está en `apoyantes.nombre`: es la zona privada y ahí el nombre real es correcto.

### 8. Presentación del mensaje
Se renderiza como texto de React (escapado por defecto); está prohibido `dangerouslySetInnerHTML` en esta página (una prueba estructural lo vigila). Se respetan los saltos de línea con CSS (`whitespace-pre-line`), sin convertir a HTML.

### 9. Qué cambia en las pruebas estructurales existentes
- `tests/sitio-publico-estructura.test.ts`: la prueba "la página provisional de voluntariado no recoge datos" se reemplaza por la regla nueva: solo `voluntariado/` puede tener formulario público; `page.tsx` de `como-donar` y el inicio siguen sin formularios.
- `tests/public-estructura.test.ts`: se mantiene la prohibición de importar base/esquema desde `app/(publico)`; la acción pública importa solo `@/lib/voluntariado-inscripcion`. Se añade una prueba nueva que fija que **esa es la única escritura pública**: `app/(publico)` con `"use server"` solo existe en `voluntariado/`, el módulo no lee tablas distintas de las dos que escribe, no usa caché y no importa lo privado.
- `lib/public-queries*.ts` no cambia y sigue sin leer `apoyantes`.

## Risks / Trade-offs

- [Spam o inscripciones falsas llenan `apoyantes`] → Aceptado por el ADR 0006 (honeypot sin captcha ni límite por IP). La lista privada es acotada a 200; la limpieza queda para #14 (no hay anular/borrar por decisión previa). Se documenta como riesgo conocido.
- [La misma persona queda duplicada como varios apoyantes] → Consecuencia de la decisión del usuario; el responsable los ve por nombre en la lista. No se mitiga en este ítem.
- [Un honeypot lleno devuelve éxito y un voluntario real con autocompletado raro "se inscribe" sin guardarse] → El campo se oculta con `aria-hidden`, `tabIndex={-1}` y `autocomplete="off"` con nombre no sugerente para gestores de contraseñas; riesgo bajo y aceptado.
- [Texto de consentimiento no revisado legalmente] → Visible como provisional en el formulario y en `CLAUDE.md`; #14 y la revisión legal lo cierran antes de datos reales. Datos reales ya se guardarán desde este ítem, y el CLAUDE.md lo dice.
- [Escritura sin auditoría de responsable] → Mitigado con `creado_en` + `consentimiento_version`; los cambios posteriores sí se auditan.
- [Migración con columna `NOT NULL` falla si la tabla tuviera filas] → Verificación previa con `count`; sin valor por defecto inventado.
- [Una Server Action pública es invocable por cualquiera, sin límite de frecuencia] → Límites de longitud en el servidor y transacción corta; el abuso volumétrico es el riesgo del ADR 0006 y de A5/#14.
- [El log podría filtrar datos personales por el mensaje de error de Postgres] → Se registra solo `name` y `code`, como el patrón privado.

## Migration Plan

1. Agregar la columna al esquema y generar la migración (`npm run db:generate`); revisar el SQL.
2. Aplicarla a la rama de pruebas (`npm run db:test`).
3. Comprobar con un `select count(*)` de solo lectura que `voluntarios_inscritos` está vacía en producción.
4. **Pedir confirmación al usuario** y recién entonces `npm run db:migrate` contra producción.
5. Reversión: antes de usarse, `ALTER TABLE voluntarios_inscritos DROP COLUMN consentimiento_version` (la columna es nueva y el código nuevo es el único que la usa). Si ya hubiera inscripciones reales, no se revierte: se corrige hacia adelante.

## Open Questions

- **Canal de contacto de La FAZ en el texto de consentimiento** (correo o WhatsApp para pedir cambios o baja): no está en el repositorio. Para el texto provisional se usa una redacción sin dato inventado ("a través de los responsables de La FAZ") y un marcador visible de pendiente; se completa con el dato real cuando la ONG lo entregue. No cambia specs, enfoque ni tareas.
