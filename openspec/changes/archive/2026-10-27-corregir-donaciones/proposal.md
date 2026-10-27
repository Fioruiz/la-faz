# Proposal

## Why

Desde #7 un responsable puede registrar donaciones, pero no corregirlas: un monto mal escrito, un proyecto equivocado o una donación "Sin asignar" que por fin se sabe a qué proyecto va solo se arreglarían tocando la base a mano. El PRD pide que un error en un registro se pueda editar, que cada cambio guarde quién y cuándo, y que nada se borre sino que se anule; el caso borde de "Donación sin proyecto" exige poder asignarla después. Además, como el avance de las barras (#9) y el total en soles se calculan siempre sobre las donaciones no anuladas, la corrección es lo que mantiene honesto "la barra pública coincide exactamente con lo registrado".

## What Changes

Alcance estricto del ítem #8 del backlog ("Editar, anular y asignar donaciones"):

- **Editar** una donación: monto, medio, fecha, cantidad, descripción y proyecto o ítem. El **tipo** (dinero o producto) y el **donante** no cambian: si estaban mal, se anula y se registra de nuevo. Cada edición vuelve a aplicar las reglas de #7 y guarda en el historial los valores anteriores y nuevos.
- **Reasignar** una donación que ya tiene proyecto a otro proyecto o ítem, siempre dentro de proyectos activos y con ítem del proyecto elegido.
- **Asignar** una donación "Sin asignar" a un proyecto (y, si es producto, a un ítem) en una sola operación, con su fila de historial.
- **Anular** una donación sin borrarla, con un motivo obligatorio de hasta 200 caracteres que queda solo en el historial. La anulación no se revierte.
- Una **lista mínima de donaciones** (más recientes primero, con filtros todas, "Sin asignar" y anuladas, y búsqueda por nombre del donante) como punto de entrada para llegar a cada donación, y su página de detalle. Sin totales ni reporte.
- Todas las escrituras usan `crearAccionPrivada()` y bloquean las filas implicadas (la donación con `for update`, los proyectos con `for share`), con pruebas de concurrencia contra Postgres real.

Decisiones del usuario: (1) se edita todo menos el tipo y el donante; (2) se puede reasignar una donación con proyecto a otro proyecto o ítem, dentro de proyectos activos; (3) el motivo de anulación es obligatorio y va solo al historial.

Supuestos registrados:
- La anulación no se revierte (el PRD no menciona restaurar).
- Una donación anulada no se edita, ni se asigna, ni cuenta como duplicado ni se puede vincular a una donación mixta nueva.
- Anular una parte de una donación mixta no anula la otra; el vínculo se conserva.
- Una donación que pertenece a un proyecto **finalizado** no se edita, no se reasigna ni se anula: el proyecto es de solo lectura (#5) y su resultado se escribió con esas cifras. Para corregirla habría que decidir reabrir el proyecto, que el PRD no contempla. Se deja como pregunta abierta.
- Al asignar un producto "Sin asignar", se borra su descripción de texto libre (el ítem ya dice qué es); el historial conserva la descripción anterior.
- Las ediciones no cambian `registrado_por`: la donación sigue atribuida a quien la registró; el historial dice quién la editó.

Fuera de alcance (otros ítems): totales, reporte por responsable y por proyecto (#10), avance y "falta en soles" (#9), páginas públicas (#11, #12), restaurar una donación anulada, cambiar el tipo o el donante, borrar donaciones, cambios de esquema y migraciones.

## Capabilities

### New Capabilities
- `donation-editing`: un responsable activo edita, reasigna y asigna donaciones aplicando las reglas del registro, con aviso blando de duplicados y cada cambio en el historial.
- `donation-voiding`: un responsable activo anula una donación con motivo obligatorio, sin borrarla, y la anulada deja de contar en avance, totales y duplicados.
- `donation-list`: la zona privada lista las donaciones con filtros mínimos y muestra el detalle de cada una como punto de entrada a editar, asignar y anular.

### Modified Capabilities
<!-- Ninguna: los specs de #7 pertenecen a un cambio aún no archivado y no cambian sus requisitos. Las reglas de registro se reutilizan, no se modifican. -->

## Impact

- **Código nuevo:** esquemas Zod de editar, asignar y anular; lógica de escritura sin Next; lecturas de lista y detalle; acciones; páginas `/donaciones` y `/donaciones/[id]`; pruebas.
- **Código existente:** las reglas de `lib/donaciones-escrituras.ts` (proyecto activo, ítem del proyecto, fecha, duplicados) se extraen a un módulo compartido que usan `registrar`, `editar` y `asignar`, sin cambiar el comportamiento de #7 (sus pruebas lo comprueban). `lib/private-queries-core.ts` gana lecturas; el panel gana un enlace; `CLAUDE.md` gana una nota.
- **Dependencias nuevas:** ninguna.
- **Sistemas externos:** ninguno. No hay migración ni escritura en `production` al implementar.
- **Pendientes del TDD que se tocan:** A6 (duplicados) se aplica también a las ediciones; el motivo de anulación y los valores editados van al historial sin datos personales del donante.
