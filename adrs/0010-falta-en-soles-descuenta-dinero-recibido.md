# ADR 0010: "Falta en soles" descuenta el dinero recibido del proyecto

## Estado

Aceptado. Precisa la regla de avance del [ADR 0002](0002-modelo-de-datos.md) y del TDD v1. Deja abierta
una decisión de producto (ver Consecuencias).

## Contexto

La revisión adversarial del TDD v1 (hallazgo C3) señaló que las donaciones en dinero no mueven
ninguna barra de unidades y que el criterio ⚖️ "falta en soles = (meta − recibido en producto) ×
costo" ignoraba el dinero ya recibido. El PRD dice que la ONG debe saber "cuánto ha recibido, en
dinero y en productos, y cuánto falta para la meta", y que las donaciones llegan sobre todo por
transferencia, Yape y Plin. La regla de que el dinero va aparte de las unidades la decidió el
usuario, y la conversión de dinero a unidades con el costo referencial se evaluó y se descartó.

## Decisión

Se mantiene que el dinero no suma a ninguna barra de unidades. Cambia la cuenta de "falta en soles"
en la zona privada, a nivel de proyecto:

```
falta_soles = max(0, Σ_items_con_costo (cantidad_meta − recibido_producto) × costo_referencial − total_dinero_proyecto)
```

- `total_dinero_proyecto` es el `SUM(monto)` de donaciones en dinero no anuladas del proyecto.
- Solo entran los ítems con `costo_referencial`. Si el proyecto tiene ítems sin costo, la pantalla
  muestra el monto como "estimado parcial" y lo indica.
- La zona pública no muestra este monto (decisión del TDD v1, sin cambios).
- Todos los montos se tratan como soles hasta resolver la moneda (hallazgo A7, abierto).

## Alternativas consideradas

- **Dejar la fórmula del TDD v1** — sobreestima lo que falta justo cuando más dinero entró. No se
  eligió.
- **Convertir el dinero a unidades con el costo referencial y sumarlo a la barra** — responde mejor al
  objetivo del PRD, pero el usuario ya lo descartó y exige ampliar el PRD. No se eligió.
- **Mostrar un total en soles público** — daría visibilidad a donantes del extranjero, pero el PRD no
  dice si se muestra. No se eligió.

## Consecuencias

- La zona privada responde "cuánto falta" de forma coherente con lo recibido en dinero y en productos.
- Costo: se mezclan dos magnitudes (unidades y soles) en una estimación aproximada. El costo
  referencial es solo una referencia.
- **Sigue abierto:** la barra pública seguirá baja aunque entre mucho dinero. Si los responsables
  registran sobre todo dinero, "1200 de 2000 packs" no reflejará los fondos. Hay que decidir con el PRD
  si el dinero debe avanzar la barra pública (por ejemplo, mostrando también el total en soles). Hasta
  entonces, esta decisión solo corrige la zona privada.
- Se necesita una prueba con casos: dinero mayor que el costo restante, ítems sin costo, y excedente
  de producto.
