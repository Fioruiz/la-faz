# Proposal

## Why

El PRD pide un "reporte en pantalla de las donaciones registradas por cada responsable y por proyecto", y el objetivo del sistema es que la ONG sepa "en cada momento cuánto ha recibido, en dinero y en productos". Hoy se puede ver el avance de cada meta (#9) y la lista de donaciones (#8), pero nadie puede responder dos preguntas del día a día: ¿cuánto registró cada responsable? (para conciliar con cada cuenta de Yape, Plin o transferencia) y ¿cuánto entró por proyecto en un periodo? (por ejemplo, la campaña de noviembre). El riesgo principal que el PRD señala (la adopción: que los responsables sigan anotando en cuaderno) se mitiga cuando el reporte sirve para cuadrar cuentas con lo que cada uno tiene.

## What Changes

Alcance estricto del ítem #10 del backlog ("Reporte en pantalla"):

- Una página privada `/reportes` con dos vistas en la misma pantalla: **por responsable** (quién registró cada donación) y **por proyecto** (con un grupo "Sin asignar" para las donaciones sin proyecto), y un bloque de totales generales.
- Cada grupo muestra: cantidad de donaciones vigentes; **total en soles con subtotales por medio** (Yape, Plin, transferencia); y los **productos agrupados por ítem y unidad**, sin sumar unidades distintas entre sí.
- Las donaciones **anuladas** quedan fuera de los totales; cada grupo muestra aparte "N anuladas" con un enlace a la lista de donaciones anuladas.
- Un **rango de fechas opcional** (desde–hasta) sobre la fecha de la donación (America/Lima), por GET en la URL, validado. Sin filtro, todo.
- Los totales coinciden con #9: sin filtro de fechas, el total en soles de un proyecto es igual al del avance, y lo recibido por ítem también. Ambos usan la misma regla de "donación vigente", definida en un solo lugar.
- Sin exportar (Excel, PDF, CSV): está en "No alcance" del PRD y una prueba lo garantiza.
- Sin datos personales del donante: solo agregados. El nombre del **responsable** que registró sí se muestra, también si fue desactivado (el PRD pide conservar sus registros).
- Lecturas por el acceso privado, con agregaciones SQL en un número fijo de consultas, dinero en céntimos con `BigInt` y pruebas contra Postgres real con donaciones editadas, reasignadas y anuladas (#8).

Decisiones del usuario: (1) rango de fechas opcional; (2) anuladas fuera de los totales, con conteo aparte y enlace; (3) subtotales por medio además del total en soles.

Decisiones registradas para revisión:
- **Productos "Sin asignar"** (sin ítem ni unidad comparable): se muestran en un solo renglón "Productos sin asignar: N donaciones", sin sumar cantidades, porque "20 cajas de cereal" y "50 botellas" no se pueden sumar.
- **Fecha de un rango:** se acepta `hasta` hasta un año adelante de hoy (para pedir "todo noviembre" a mitad de mes) y `desde` desde 2020-01-01; `desde` no puede ser posterior a `hasta`.
- **Dinero sin medio** (no debería ocurrir porque la acción lo exige, pero la base lo permite): suma al total y aparece como "sin medio", para que los subtotales siempre sumen el total.
- Los grupos sin ninguna donación (vigente ni anulada) en el rango no se muestran.

Fuera de alcance (otros ítems o el PRD): exportar a Excel, PDF o CSV; reporte por donante o por voluntario; avance contra metas (es #9); páginas públicas (#11, #12); gráficos; cambios de esquema y migraciones.

## Capabilities

### New Capabilities
- `donation-report`: la zona privada muestra las donaciones agrupadas por responsable y por proyecto con cantidades, total en soles con subtotales por medio, productos por ítem y conteo de anuladas, coherentes con el avance de #9.
- `report-filters`: el reporte se acota con un rango de fechas validado leído de la URL, se lee por el acceso privado sin datos personales de donantes y no se puede exportar.

### Modified Capabilities
<!-- Ninguna: los specs de avance (#9) y donaciones (#7, #8) pertenecen a cambios aún no archivados y no cambian sus requisitos. La regla de "vigente" se comparte, no se modifica. -->

## Impact

- **Código nuevo:** regla compartida de "donación vigente", cálculo puro del reporte y validación del rango, consultas SQL del reporte, lectura privada, página `/reportes` y pruebas.
- **Código existente:** `lib/avance-consulta.ts` pasa a usar la regla compartida de "vigente" (sin cambiar su comportamiento; sus pruebas lo comprueban); `lib/private-queries-core.ts` gana `getReporte`; el panel gana un enlace; `proxy.ts` cubre `/reportes`; `CLAUDE.md` gana una nota.
- **Dependencias nuevas:** ninguna (en particular, ninguna librería de exportación).
- **Sistemas externos:** ninguno. No hay migración ni escritura en `production`.
- **Pendientes del TDD que se tocan:** ninguno; reutiliza la moneda en soles (A7) y deja la zona horaria global para #14.
