# ADR 0008: Integridad entre proyecto e ítem en `donaciones` y significado de "Sin asignar"

## Estado

Aceptado. Reemplaza parcialmente al [ADR 0002](0002-modelo-de-datos.md) (definición de `donaciones`, su
`CHECK` y la consulta de avance). El resto del ADR 0002 sigue vigente.

## Contexto

La revisión adversarial del TDD v1 (hallazgo C1) encontró que `donaciones` guarda `proyecto_id`
(nulo = "Sin asignar") y también `item_id`, que ya pertenece a un proyecto:

- Una fila con `item_id` y `proyecto_id = NULL` sumaba al avance por ítem y, a la vez, debía contar
  como "Sin asignar" (que no suma en ninguna barra).
- Una fila con `proyecto_id = A` e ítem del proyecto B era posible, porque un `CHECK` no valida
  entre tablas.
- El `CHECK` exigía `item_id` para productos, por lo que una donación en producto no podía quedar
  realmente sin asignar.

Esto amenaza el criterio de éxito del PRD "la barra de avance pública coincide exactamente con lo
registrado en la zona privada".

## Decisión

1. `items_meta` añade `UNIQUE (id, proyecto_id)`.
2. `donaciones` añade una clave foránea compuesta `(item_id, proyecto_id) → items_meta (id, proyecto_id)`.
   Así un ítem solo puede combinarse con su propio proyecto.
3. Como una FK compuesta con columnas nulas no se comprueba (`MATCH SIMPLE`), un `CHECK` fija los
   únicos estados válidos:
   - **Dinero:** `monto > 0`, `item_id` y `cantidad` nulos. `proyecto_id` puede ser nulo (Sin asignar).
   - **Producto asignado:** `cantidad > 0`, `item_id` y `proyecto_id` ambos no nulos.
   - **Producto sin asignar:** `cantidad > 0`, `item_id` y `proyecto_id` ambos nulos, y
     `descripcion_producto` no nula (qué se recibió, en texto libre).
   - Cualquier otra combinación se rechaza.
4. Asignar una donación sin asignar actualiza `proyecto_id` (y `item_id` en productos) en una sola
   operación, con su fila en `audit_log` ([ADR 0003](0003-contratos-server-actions.md)).
5. La consulta de avance de un ítem es `SUM(cantidad)` de donaciones `tipo = 'producto'`,
   `anulada = false` y `item_id = <ítem>`. Una donación sin asignar no tiene `item_id`, así que no
   puede sumar a ninguna barra.

## Alternativas consideradas

- **No guardar `proyecto_id` en donaciones en producto y derivarlo siempre del ítem** — elimina la
  redundancia, pero obliga a consultas distintas según el tipo, y el dinero necesita `proyecto_id`
  de todas formas. Tampoco resuelve cómo representar un producto sin asignar. No se eligió.
- **Trigger que valide la coherencia** — la lógica queda en la base y es más difícil de probar
  (mismo motivo del ADR 0002 contra triggers). No se eligió.
- **Validar solo en la Server Action** — una acción olvidada o una edición directa en la consola de
  Neon podría romper la coherencia sin que la base lo impida. No se eligió.

## Consecuencias

- La base impide por sí sola las combinaciones incoherentes; el avance no puede contar una donación
  sin asignar.
- Costo: el modelo añade una columna (`descripcion_producto`) que el PRD no menciona y una restricción
  compuesta más difícil de leer. La columna cubre un caso borde que el PRD sí exige ("Donación sin
  proyecto").
- Costo: asignar un producto sin asignar obliga a elegir el ítem concreto en ese momento; si el
  proyecto no tiene un ítem equivalente, hay que crearlo antes.
- Costo: las migraciones y el esquema de Drizzle deben declarar la FK compuesta y el `CHECK`
  explícitamente.
