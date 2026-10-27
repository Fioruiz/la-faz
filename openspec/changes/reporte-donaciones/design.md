# Design

## Context

Estado observado: `donaciones` guarda `registrado_por` (nunca cambia, ni al editar ni al anular), `proyecto_id` (nulo = sin asignar), `tipo`, `monto`, `medio`, `cantidad`, `item_id`, `fecha` (`date`) y `anulada`. `lib/avance-consulta.ts` (#9) agrega lo recibido por ítem y el dinero por proyecto con la regla "no anulada", y `lib/dinero.ts` ofrece céntimos con `BigInt`. `listarDonaciones` (#8) ya lee por GET (`filtro`, `q`) y enlaza a "anuladas". Los responsables desactivados siguen en `responsables`. Las lecturas privadas pasan por `crearConsultasPrivadas`. `lib/fechas.ts` tiene `esFechaValida` y `hoyEnLima`. No hay página de reportes. Requisitos en `specs/`; decisiones del usuario y supuestos en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Ver por responsable y por proyecto cuánto entró, en dinero (con medio) y en productos, con totales que cuadren entre vistas y con el avance.
- Que la regla de qué donación cuenta esté en un solo sitio.
- Una página que se pueda enlazar y recargar con su rango de fechas, sin datos personales de donantes.

**Non-Goals:**
- Exportar, gráficos, reporte por donante o por voluntario, avance contra metas (#9), zona pública.
- Cambios de esquema, caché o tablas de resumen: se calcula al leer.

## Decisions

**1. Una sola regla de "donación vigente": `lib/donaciones-condiciones.ts`.**
Exporta las condiciones SQL `esDineroVigente`, `esProductoVigente` y `esVigente` (no anulada). `lib/avance-consulta.ts` las usa en lugar de repetir `tipo = ... AND anulada = false`, y el reporte también. Sin cambiar el comportamiento del avance (sus pruebas lo comprueban). Una prueba estructural comprueba que ni el avance ni el reporte escriben `anulada, false` por su cuenta. Alternativa descartada: copiar el filtro en el reporte, que es exactamente el riesgo de desincronización que A2 señaló.

**2. Cálculo puro en `lib/reporte.ts` y consultas en `lib/reporte-consulta.ts`.**
- `lib/reporte-consulta.ts`: `consultarReporte(db, { desde?, hasta? })` hace seis consultas SQL fijas: (1) dinero por `(registrado_por, proyecto_id, medio)` con `SUM(monto)` y `COUNT(*)`; (2) productos por `(registrado_por, proyecto_id, item_id)` con `SUM(cantidad)` y `COUNT(*)`; (3) anuladas por `(registrado_por, proyecto_id)` con `COUNT(*)`; (4) responsables (id, nombre, activo); (5) proyectos (id, nombre, estado); (6) ítems (id, nombre, unidad, proyecto). Todas con el rango de fechas en `WHERE` (`fecha >= desde`, `fecha <= hasta`, inclusivo). Los grupos se arman en memoria sobre filas ya agregadas (a lo sumo responsables × proyectos × medios), no sobre donaciones.
- `lib/reporte.ts`: `armarReporte(entrada)` (puro) suma céntimos con `BigInt` por responsable, por proyecto y en total, y `validarRango(desde, hasta, hoy)`. Sin Next ni módulos privados, como el avance.
Una consulta con un solo `GROUP BY` sobre ambas dimensiones evita dos recorridos de la tabla, y los totales de las dos vistas salen del mismo conjunto de filas, así que cuadran por construcción.

**3. Qué muestra cada grupo.**
`{ id, nombre, estado/activo, donaciones, dinero: { total, porMedio: { yape, plin, transferencia, sinMedio }, donaciones }, productos: { items: [{ itemId, nombre, unidad, proyecto, cantidad, donaciones }], sinAsignar: { donaciones } }, anuladas }`. Los subtotales por medio siempre suman el total (el dinero sin medio va a `sinMedio`, que solo se muestra si no es cero). Los productos sin asignar no tienen ítem ni unidad comparable, así que se cuentan en un renglón aparte sin sumar cantidades. Los grupos sin ninguna donación (vigente ni anulada) no se devuelven. El grupo "Sin asignar" de la vista por proyecto agrupa `proyecto_id IS NULL`. Orden: por total en soles descendente y luego por nombre.

**4. Rango de fechas: `validarRango`.**
Acepta texto `YYYY-MM-DD` real (`esFechaValida`), `desde >= 2020-01-01`, `hasta <= hoy + 1 año` (para pedir "todo noviembre" a mitad de mes) y `desde <= hasta`. Devuelve `{ ok: true, desde?, hasta? }` o `{ ok: false, error }` con un mensaje en español. Vacío o ausente significa sin límite. La página lee `searchParams` (primer valor de cada parámetro, el resto se ignora) y, si el rango es inválido, muestra el mensaje y no consulta. La lectura privada también valida (defensa en profundidad) y devuelve el mismo error.

**5. Lectura privada: `getReporte({ desde, hasta })`.**
En `crearConsultasPrivadas`: `requerir()` primero, luego validación y `consultarReporte`. Devuelve `{ ok: true, reporte }` o `{ ok: false, error }`. Sin nombres ni contactos de apoyantes: la consulta no toca `apoyantes`. El nombre del responsable sí se devuelve.

**6. Página `/reportes`.**
`force-dynamic` (ADR 0005), sin importar la base. Un formulario `GET` con dos campos de fecha (`type="date"`, funciona sin JavaScript), el botón "Ver" y el enlace "Quitar rango"; un bloque de totales generales; la sección "Por responsable" y la sección "Por proyecto". Cada grupo es una tarjeta con la cantidad de donaciones, el total en soles con los subtotales por medio, la lista de productos por ítem y, si las hay, "N anuladas" con enlace a `/donaciones?filtro=anuladas`. El dinero se presenta con `formatearSoles` (texto exacto). El panel gana un enlace y `proxy.ts` cubre `/reportes`. No hay botones de exportación.

**7. Sin exportación: prueba estructural.**
`tests/reporte-estructura.test.ts` falla si `package.json` trae librerías de Excel, PDF o CSV (`xlsx`, `exceljs`, `pdfkit`, `jspdf`, `csv`, `papaparse`, etc.), si bajo `app/(privado)/reportes/` hay un `route.ts` o aparecen `text/csv`, `Content-Disposition`, `download` o `Blob`, y si los módulos del reporte importan `apoyantes` o `contacto`. Alternativa descartada: confiar en la revisión, porque el PRD lo declara fuera de alcance y una exportación es fácil de añadir sin querer.

**8. Pruebas.**
Contra Postgres real: agrupación por responsable y por proyecto (incluido "Sin asignar" y responsable desactivado), totales y subtotales por medio exactos, dinero sin medio, productos por ítem sin mezclar unidades y mismo nombre de ítem en dos proyectos, productos sin asignar en un renglón, anuladas fuera de los totales y con su conteo, rango inclusivo en ambos extremos, solo desde, solo hasta, y que el rango acote las anuladas; consistencia entre vistas (suma de grupos igual al total general) y con el avance de #9 sin filtro; donaciones editadas, reasignadas y anuladas con las escrituras de #8; número fijo de consultas con 5 y con 500 donaciones; sin nombres de donantes en el resultado; rechazo a responsable desactivado. Cálculo y validación del rango sin base. Verificación manual en el navegador contra la rama de pruebas.

## Risks / Trade-offs

- [Los totales por responsable mezclan proyectos y unidades] → Por eso los productos van por ítem y el dinero por medio; solo el dinero tiene un total en soles.
- [La fecha del reporte es la de recepción, no la de registro] → Es lo que el responsable declara y lo que acota una campaña; si registró tarde, la donación cae en el periodo en que se recibió. Se documenta.
- [Un rango grande con muchos grupos] → Las filas agregadas son responsables × proyectos × medios (decenas); trivial.
- [El reporte puede mostrar un responsable desactivado con un nombre ya inactivo] → Es lo que pide el PRD (se conservan sus registros); se marca como desactivado.
- [Una librería de exportación podría colarse más adelante] → La prueba estructural la detecta; añadir exportación exige antes actualizar el PRD.
- [El total del reporte y del avance podrían divergir si alguien cambia una de las dos consultas] → Regla compartida y una prueba de igualdad sin filtro.

## Migration Plan

No hay migración ni escritura en `production`: el reporte se calcula al leer. La reversión es revertir el commit.

## Open Questions

- Si hará falta un reporte por donante o por medio de pago independiente del responsable: no está en el PRD; sería otro cambio.
- Si al rango se le añade un atajo ("este mes"): mejora de uso, fuera de este alcance.
