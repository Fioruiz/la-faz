# Proposal

## Why

El PRD exige que cada cambio en los registros deje "quién y cuándo", y que nada se borre sino que se anule. Los ítems #5 a #8 (proyectos, apoyantes, donaciones, ediciones y anulaciones) son todos escrituras de la zona privada, y sin un patrón común cada uno decidiría por su cuenta cómo validar, comprobar al responsable, guardar el historial y mostrar errores. Los ADR 0003, 0006 y 0009 ya fijan las reglas (validar con Zod, comprobar al responsable activo, guardar el cambio y su `audit_log` en una sola transacción, mensajes de error sin detalles internos), pero hoy no existe código que las cumpla. Con #3 ya hecho (`requireResponsableActivo()`), este es el momento de construir el patrón una vez y probarlo, antes de que haya una sola escritura de negocio que pueda olvidar el historial o dejar un cambio sin su registro.

## What Changes

Alcance estricto del ítem #4 del backlog ("Patrón de escritura auditada"):

- Un ejecutor de escrituras auditadas que toda Server Action privada usa: comprueba al responsable activo, valida la entrada con Zod, y ejecuta el cambio y su fila en `audit_log` dentro de una sola transacción. Si falla cualquier paso, no queda ni el cambio ni un historial parcial.
- Una convención de resultado para las acciones: éxito, error de validación (con los mensajes por campo y lo que la persona escribió, sin perderlo), regla de negocio incumplida (mensaje claro, sin guardar nada) y error inesperado (mensaje genérico; el detalle va al log de Vercel).
- Un responsable desactivado o sin sesión que invoca una acción es llevado al login y no se escribe nada.
- La escritura de historial es obligatoria: una acción que no declara qué registró en `audit_log` es rechazada y revertida.
- La documentación del patrón y una plantilla de ejemplo para que los ítems #5 a #8 la copien, más pruebas contra Postgres real que demuestran cada garantía.

El historial se guarda pero no tiene pantalla (decisión del backlog): es solo auditoría.

Fuera de alcance (pertenecen a otros ítems): cualquier Server Action de negocio y cualquier pantalla (#5 a #8), el aviso blando de duplicados (#7), el honeypot y la acción pública del formulario de voluntariado (#13), pantalla o consulta del historial, el contenido de las instantáneas de datos personales de apoyantes en `audit_log` (#6, hallazgo A8), cambios al esquema de `audit_log` y nuevas migraciones.

## Capabilities

### New Capabilities
- `audited-writes`: toda escritura de la zona privada comprueba al responsable activo, valida su entrada y guarda el cambio junto con su registro en `audit_log` en una sola transacción, atribuido al responsable de la sesión; una escritura sin historial o con un fallo a medias no deja nada.
- `action-results`: las acciones privadas devuelven un resultado uniforme para éxito, validación, regla de negocio y error inesperado; los errores de validación conservan lo escrito y los fallos internos no revelan detalles al usuario.

### Modified Capabilities
<!-- Ninguna: los specs `responsable-access` y `database-schema` pertenecen a cambios aún no archivados y no cambian sus requisitos. -->

## Impact

- **Código nuevo:** módulo núcleo del patrón (sin dependencias de Next, para probarlo), módulo que lo une a Next (`requireResponsableActivo`, redirección al login, log), plantilla documentada y pruebas.
- **Código existente:** ninguno se modifica en su comportamiento. `CLAUDE.md` gana una nota sobre el patrón. `lib/schema.ts` y las migraciones no cambian: `audit_log` ya tiene `entidad`, `entidad_id`, `accion`, `antes`, `despues`, `responsable_id` y `creado_en`.
- **Dependencias nuevas:** ninguna; se reutilizan `zod` y `drizzle-orm`.
- **Sistemas externos:** ninguno. No se escribe en `production` ni hace falta migrar.
- **Pendientes del TDD que se tocan:** A8 se toca solo en lo que le corresponde al patrón (qué datos entran al historial lo decide cada acción; #6 fija la regla para datos personales). A6 (duplicados) queda para #7.
