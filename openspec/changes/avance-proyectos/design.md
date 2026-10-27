# Design

## Context

Estado observado: `donaciones` guarda `tipo`, `cantidad`, `item_id`, `monto` (`numeric(12,2)`), `proyecto_id` (nulo = sin asignar) y `anulada`; `items_meta` guarda `cantidad_meta` y `costo_referencial` (`numeric(12,2)`, nulo). El ADR 0008 fija la regla de avance (`SUM(cantidad)` de producto no anulado por ítem) y el ADR 0010 la de "falta en soles". Las lecturas privadas viven en `crearConsultasPrivadas(requerir, obtenerDb)`; `getProyecto` ya devuelve el proyecto con sus ítems y `listarProyectos` la lista con la cantidad de ítems. Las páginas `/proyectos` y `/proyectos/[id]` existen y son `force-dynamic`. No existe `lib/public-queries.ts` (llega en #12). La base devuelve `numeric` como `string` y los totales de una suma como `string`. Requisitos en `specs/`; decisiones del usuario en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Una sola definición de "lo recibido" y "lo que falta" que la zona pública pueda reutilizar sin copiar lógica (A2).
- Que el avance siempre se calcule al leer y sea exacto en dinero.
- Ver cuánto falta desde la pantalla del proyecto, sin pasos adicionales.

**Non-Goals:**
- La barra pública, su tope del 100% y el nombre "Anónimo" (#12), el reporte (#10), cualquier cambio de esquema, caché o contador.
- Mezclar unidades en un porcentaje único del proyecto (decisión del usuario).
- Decidir si el dinero avanza la barra pública (C3).

## Decisions

**1. Dos piezas, ninguna depende de Next ni de lo privado.**
- `lib/avance.ts` (puro): tipos y `calcularAvance(entrada)`, que recibe las filas ya agregadas y devuelve el avance por ítem y el resumen del proyecto. No toca la base.
- `lib/avance-consulta.ts`: `consultarAvance(db, { proyectoIds? })`, que hace las agregaciones SQL y llama a `calcularAvance`. Recibe una `LectorDb`, igual que las demás lecturas, así sirve a la zona privada y, en #12, a `lib/public-queries.ts`.
La función es la misma para las dos zonas; lo único que #12 añade es el tope del 100% al presentar. Una prueba estructural comprueba que ninguno de los dos módulos importa `next`, `server-only` ni módulos privados, y que las pantallas no calculan ellas mismas. Alternativa descartada: calcular en cada lectura (privada y pública) con su propia consulta, que es el riesgo A2.

**2. Tres consultas fijas, sin importar el volumen.**
(a) Por ítem: `items_meta` con `LEFT JOIN donaciones` filtrado a producto no anulado y `GROUP BY item`, con `COALESCE(SUM(cantidad), 0)`. (b) Por proyecto: `SUM(monto)` y `COUNT(*)` de dinero no anulado con proyecto, `GROUP BY proyecto_id`. (c) Sin asignar: `SUM(monto)` de dinero y `COUNT(*)` de las no anuladas con `proyecto_id IS NULL`. Un filtro opcional por `proyectoIds` recorta (a) y (b) para el detalle de un proyecto. Una prueba cuenta las consultas y comprueba que son las mismas con 5 y con 500 donaciones. Alternativa descartada: una sola consulta con subconsultas, más difícil de leer y de probar por partes.

**3. Dinero en céntimos enteros con `BigInt`.**
`lib/dinero.ts` convierte el `numeric` de la base ("150.50") a céntimos (`BigInt`), suma, multiplica por una cantidad entera y formatea de vuelta a texto con dos decimales. `cantidad × costo` es un entero por un entero de céntimos, así que el resultado es exacto y no hay redondeo; con `BigInt` no se desborda ni con 1.000.000 de unidades a S/ 9.999.999,99. Se prohíbe `parseFloat` y `Number()` sobre montos en esos módulos (prueba estructural). Los porcentajes sí son números pequeños: `Math.floor(recibido × 100 / meta)` con enteros.

**4. Reglas del cálculo.**
- **Ítem:** `recibido`, `meta`, `porcentaje` (real, sin tope, hacia abajo), `excedente = max(0, recibido − meta)`, `falta = max(0, meta − recibido)`, `cumplida = recibido >= meta`.
- **Proyecto:** `metasTotal`, `metasCumplidas`, `totalDinero` (texto "0.00"), `faltaSoles` y `estimacion`.
- **Falta en soles:** `max(0, Σ_ítems_con_costo (falta_i × costo_i) − totalDinero)`. Se usa `falta_i` por ítem (no `meta − recibido` sin tope): el excedente de un ítem **no** compensa lo que falta de otro, que es lo que el ADR 0010 deja ambiguo con `(cantidad_meta − recibido)` sin tope. Se registra la decisión aquí.
- **Estimación:** `completa` si todos los ítems tienen costo; `parcial` si hay alguno sin costo (literal del ADR 0010); `no-disponible` si ningún ítem tiene costo o el proyecto no tiene ítems, y entonces `faltaSoles` es `null` en vez de "S/ 0".
- **Sin asignar:** `totalDinero` y `cantidad` de donaciones no anuladas sin proyecto (dinero y producto).
No hay un porcentaje del proyecto (decisión A3 del usuario).

**5. Lecturas privadas.**
`crearConsultasPrivadas` gana `getAvanceProyectos()` (resumen de todos los proyectos y el bloque sin asignar, para la lista) y `getProyecto(id)` incluye `avance` (ítems con recibido y resumen), ambos tras `requerir()`. `listarProyectos()` conserva su forma (arreglo) para no romper a quien ya lo usa. Sin nombres ni contactos en ningún resultado.

**6. Pantallas.**
- `/proyectos`: cada fila muestra "N de M metas cumplidas", el total en soles y la falta (con "estimado parcial" o "no se puede estimar"), y arriba el bloque "Sin asignar" con el enlace a `/donaciones?filtro=sin-asignar`. Los informativos muestran solo el total en soles si hay.
- `/proyectos/[id]`: una sección "Avance" antes de los ítems con el resumen y una barra por ítem. Los proyectos finalizados la muestran igual.
- Componente `BarraAvance` (servidor): `role="progressbar"` con `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, texto "1200 de 2000 packs · 60%" y el excedente en texto ("+150 sobre la meta"); el relleno se limita a 100% solo en la presentación del ancho, y no depende solo del color.
- Las páginas siguen `force-dynamic` (ADR 0005): el avance cambia en la siguiente carga tras registrar, editar, reasignar o anular.

**7. Pruebas.**
Cálculo puro sin base (los casos del ADR 0010: dinero mayor que el costo, ítems sin costo, excedente de producto que no compensa a otro ítem, `13,33 × 3`, valores grandes, ningún ítem con costo, sin ítems). Contra Postgres real: sumas por ítem y por proyecto, anuladas, sin asignar, dinero que no suma a unidades, donaciones editadas, reasignadas a otro ítem o proyecto y anuladas, el resumen de sin asignar, número fijo de consultas, y "cambiar una donación cambia el avance en la siguiente lectura". Las pantallas se verifican a mano contra la rama de pruebas.

## Risks / Trade-offs

- [Mezcla de unidades y soles en la falta] → Es una estimación (ADR 0010); la pantalla la rotula como estimación y como "parcial" cuando falta un costo.
- [`estimado parcial` también por ítems sin costo ya cumplidos] → Sigue el ADR al pie de la letra; puede marcar parcial una estimación que no lo es. Se anota como pregunta abierta (afinar a "ítems sin costo con falta").
- [Una consulta por ítem crece con el número de ítems] → Son tres consultas fijas con `GROUP BY`; el volumen de La FAZ (decenas de ítems) es trivial.
- [El porcentaje real baja cuando se corrige una meta o se anula una donación] → Es lo esperado; el historial permite saber por qué.
- [`BigInt` y `numeric` como texto] → Más código que un `number`, pero evita errores de redondeo con dinero; las pruebas cubren los bordes.
- [A2 solo se cierra del todo en #12] → Aquí queda la función única y la prueba estructural que impide duplicarla; #12 debe usarla y tendrá su propia prueba de igualdad privada–pública.

## Migration Plan

No hay migración ni escritura en `production`: el avance se calcula al leer. La reversión es revertir el commit.

## Open Questions

- Afinar "estimado parcial" a "hay ítems sin costo que aún faltan": cambio pequeño de `calcularAvance` si el usuario lo prefiere.
- Si el dinero debe avanzar la barra pública (C3): se decide con el PRD en #12 y no cambia este diseño.
