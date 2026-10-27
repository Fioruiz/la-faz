# Proposal

## Why

El PRD incluye en la zona pública un "formulario de voluntariado" y en la privada la "lista de voluntarios inscritos", porque hoy la captación de voluntarios (colegios, pasacalle, carro alegórico) "tampoco tiene un lugar donde ordenarse". La página `/voluntariado` del sitio estático (#11) es provisional: no tiene campos ni envío. Este es el ítem #13 del backlog. Es la **primera escritura pública** del sistema y recoge datos personales reales de personas que no tienen cuenta, por lo que fija cómo se acepta una escritura anónima (honeypot, límites, sin historial de responsable) y cómo se guarda el consentimiento (A8 del TDD).

## What Changes

Alcance estricto del ítem #13 ("Voluntariado") con las decisiones del usuario:

- **Formulario público en `/voluntariado`** (reemplaza el aviso "Muy pronto"): nombre y contacto obligatorios (texto libre), mensaje opcional y una casilla de consentimiento obligatoria con un texto provisional. Sin edad, documento de identidad, dirección, ciudad ni proyecto de interés.
- **Server Action pública de inscripción** (excepción prevista en el ADR 0003 a "comprueba responsable activo"): valida con Zod, aplica el campo trampa (honeypot) y los límites de longitud, y en **una sola transacción** crea un apoyante con rol voluntario y su fila en `voluntarios_inscritos`. Decisión del usuario: **cada envío crea un apoyante nuevo**, sin buscar ni reutilizar apoyantes existentes por contacto.
- **Consentimiento con evidencia**: la inscripción guarda la versión del texto aceptado (la fecha ya la da `creado_en`). El texto vive en `lib/sitio-contenido.ts`, marcado como provisional y pendiente de revisión legal.
- **Cambio de esquema**: una columna nueva `consentimiento_version` (obligatoria) en `voluntarios_inscritos`, con su migración.
- **Lista de voluntarios inscritos en la zona privada** (`/voluntarios`): nombre, fecha de inscripción y mensaje, de lo más reciente a lo más antiguo, con enlace al detalle del apoyante (donde ya se ve el contacto). El contacto **no** aparece en la lista. Se añade un acceso desde el panel.
- **Respuesta al envío**: mensaje de confirmación sin perder lo escrito si hay errores de validación; error genérico si falla la base (el log solo lleva tipo de error y código).

Decisiones registradas para revisión:
- **Sin fila en `audit_log` para la inscripción pública**: `audit_log.responsable_id` es obligatorio y quien se inscribe no es un responsable. La propia fila (`creado_en`, `consentimiento_version`) es el registro. El ADR 0003 ya exceptúa a esta acción de la comprobación de responsable; esta es su consecuencia sobre el historial. Se propone anotarlo en el ADR 0003 al archivar.
- **Honeypot lleno = misma respuesta de éxito, sin guardar nada**: el bot no aprende que fue detectado. El TDD pide "se rechaza sin guardarse"; se cumple (no se guarda), solo cambia lo que ve el bot.
- **Repetidos**: la misma persona puede inscribirse dos veces y quedar como dos apoyantes (consecuencia de la decisión "siempre crea uno nuevo"; cercano a A6). No hay unicidad ni alerta; el responsable los ve en la lista.
- **Spam o inscripciones falsas** (ADR 0006): sin captcha ni límite por IP. No se añade anular/borrar inscripciones en este ítem (el PRD y el backlog solo piden la lista; los apoyantes no se borran por decisión previa).
- **Límites propuestos**: nombre 100, contacto 200 (iguales a los de apoyantes) y mensaje 500 caracteres.
- **Lectura privada**: la lista se añade a `lib/private-queries-core.ts` (ADR 0009), tras `requireResponsableActivo()`; las páginas privadas no importan la base.

Fuera de alcance (otros ítems o el PRD): rol de solo lectura de Postgres, límite de intentos o captcha, respaldo (#14); texto legal definitivo y revisión legal de la ley peruana de protección de datos; derechos de acceso, cancelación y retención; anular, borrar o editar inscripciones; asignar voluntarios a actividades o logística (PRD: No alcance); correos de confirmación; exportar la lista; campos extra (edad, ciudad, proyecto de interés).

## Capabilities

### New Capabilities
- `volunteer-signup`: la zona pública permite inscribirse como voluntario sin cuenta, con consentimiento obligatorio y registrado, protección con honeypot y límites de longitud, y guardado atómico de apoyante e inscripción.
- `volunteer-roster`: la zona privada lista a los voluntarios inscritos (sin contacto en la lista) y lleva al detalle del apoyante.

### Modified Capabilities
<!-- Ninguna: openspec/specs/ está vacío (los specs de los cambios anteriores aún no se archivan). El sitio público (#11) cambia su página provisional de voluntariado, pero esa página era provisional por diseño y su único requisito era no tener campos hasta #13. -->

## Impact

- **Código nuevo**: `lib/voluntariado-esquemas.ts`, `lib/voluntariado-inscripcion.ts` (núcleo sin Next, escritura pública) y su envoltorio con Next, la Server Action y el formulario en `app/(publico)/voluntariado/`, la página `app/(privado)/voluntarios/` y la consulta `listarVoluntarios` en `lib/private-queries-core.ts`, más las pruebas.
- **Código existente**: `lib/schema.ts` (columna nueva) y una migración en `drizzle/`; `lib/sitio-contenido.ts` (texto del consentimiento y de la página); `app/(publico)/voluntariado/page.tsx`; el panel privado (enlace); `lib/private-queries.ts`; pruebas estructurales de #11 y de lo público, que hoy asumen la página sin campos y una zona pública de solo lectura; `CLAUDE.md`.
- **Dependencias nuevas**: ninguna.
- **Sistemas externos**: base de datos. La migración escribe en `production` (Neon): se confirma con el usuario antes de aplicarla, y antes se comprueba que `voluntarios_inscritos` esté vacía.
- **Pendientes del TDD que se tocan**: avanza A8 (consentimiento con versión y sin contacto en el historial) y A11 (el formulario público escribe en `apoyantes`); deja a #14 el endurecimiento y la revisión legal.
