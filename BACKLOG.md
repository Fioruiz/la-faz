# Backlog: Sistema de donaciones y control de proyectos – ONG La FAZ

| # | Item | Alcance | Depende de | Contexto extra requerido |
|---|---|---|---|---|
| 1 | Andamiaje y despliegue base | Next.js (App Router), TypeScript, Tailwind, Drizzle y conexión a Neon. Variables de entorno, `npm run build` y despliegue en Vercel Hobby. Se actualizan los comandos de `CLAUDE.md`. | — | — |
| 2 | Esquema de base de datos | Todas las tablas del TDD con la FK compuesta `(item_id, proyecto_id)` y el `CHECK` de tres estados (ADR 0008). Migraciones y datos iniciales de los 4 proyectos. | #1 | — |
| 3 | Acceso de responsables | Login con Auth.js (JWT solo con el id) y `requireResponsableActivo()` en la capa privada. `proxy` que redirige al login. Un responsable inicial se crea por seed/script en la base (contraseña desde variable de entorno, nunca en el repo); no hay pantalla de gestión de responsables. Prueba de que un responsable desactivado es rechazado en cada ruta privada. | #2 | — |
| 4 | Patrón de escritura auditada | Plantilla de Server Action: Zod, responsable activo, cambio más `audit_log` en una transacción, y manejo de errores (ADR 0006). El historial se guarda pero no tiene pantalla: es solo auditoría. | #3 | — |
| 5 | Proyectos e ítems con meta | Crear y editar proyectos, ítems con meta y costo referencial opcional. Finalizar un proyecto con su resultado. | #4 | — |
| 6 | Apoyantes | Registro de donantes y voluntarios, con anonimato público. | #4 | Datos personales (ley peruana de protección de datos) |
| 7 | Registrar donación | Dinero o producto, "Sin asignar" (con `descripcion_producto`), donación mixta vinculada y aviso de duplicados. Rechazo de proyectos finalizados. Formulario de una pantalla para cumplir "menos de 2 minutos". | #5, #6 | — |
| 8 | Editar, anular y asignar donaciones | Edición con registro en `audit_log`, anulación sin borrado y asignación de "Sin asignar" a proyecto o ítem en una sola operación. | #7 | — |
| 9 | Avance y "falta en soles" (privado) | Función de avance compartida (`SUM` de producto no anulado), excedente real, total en soles por proyecto y fórmula del ADR 0010. Cierra A2 y A3. | #7, #8 | — |
| 10 | Reporte en pantalla | Donaciones por responsable y por proyecto, con totales. Sin exportar. | #8 | — |
| 11 | Sitio público estático | Presentación de la ONG y "Cómo donar" (Yape, Plin, transferencia) marcado como simulado. Sin SDK ni datos reales de cuentas. | #1 | — |
| 12 | Proyectos públicos con barra de avance | `lib/public-queries.ts`, barra limitada a 100%, "Anónimo", proyectos informativos sin barra y página de error si la base falla. Cada proyecto con meta lista **qué se puede donar** (sus ítems: nombre, unidad, meta y recibido) y enlaza a "Cómo donar"; el menú gana "Proyectos". | #9, #11 | Decisión abierta de C3: si el dinero avanza la barra pública |
| 13 | Voluntariado | Formulario público (Zod, honeypot, límites de longitud) y lista de voluntarios inscritos en la zona privada. | #6, #11 | Datos personales y consentimiento (A8; ley peruana de protección de datos) |
| 14 | Endurecimiento antes de usar datos reales | Cierre de lo que se decida de A1, A5 (límite de intentos de login), A6, A7, A9 y A10: rol de solo lectura, respaldo, zona horaria `America/Lima`, términos de Vercel Hobby. | #12, #13 | Decisiones previas sobre esos pendientes |

## Cómo usar este backlog

Cada ítem es una spec independiente. Al implementarlo, arrancá un ciclo de Spec-Driven
Development (`sdd-new` o el flujo equivalente de tu harness) usando este ítem como el
"change" — no el proyecto completo. Si la columna "Contexto extra requerido" tiene algo,
compartilo como contexto al generar la spec de ese ítem.

Antes de generar la spec de los ítems #6 y #13, comparte tu documentación de reglas de
negocio de ese dominio (protección de datos personales) como contexto, si la tienes.

Los ítems #11 y #12 se pueden hacer en paralelo con #5–#10 una vez que existe lo que cada uno requiere.
