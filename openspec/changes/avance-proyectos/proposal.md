# Proposal

## Why

Ya se pueden crear metas (#5), registrar donaciones (#7) y corregirlas (#8), pero el sistema todavía no responde la pregunta central del PRD: "¿cuánto se recaudó y cuánto falta para cada meta?". El objetivo del PRD es que la ONG sepa "en cada momento cuánto ha recibido, en dinero y en productos, y cuánto falta", y el criterio de éxito dice que un responsable ve cuánto falta de la meta de un proyecto en menos de 30 segundos. Además, la barra pública (#12) debe coincidir exactamente con la privada; la revisión adversarial lo señaló como el hallazgo A2 (dos rutas de lectura que pueden desincronizarse), y la forma de cerrarlo es una única función de avance que las dos zonas usen. El hallazgo A3 (qué es el avance de un proyecto con varios ítems de unidades distintas) lo decide el usuario en este cambio.

## What Changes

Alcance estricto del ítem #9 del backlog ("Avance y 'falta en soles' (privado)"):

- Una **única función de avance**, sin dependencias de Next ni de la zona privada o pública, en dos piezas: consultas SQL que agregan lo recibido por ítem y el dinero por proyecto, y un cálculo puro que deriva porcentaje, excedente, metas cumplidas, total en soles y "falta en soles". #12 la reutilizará desde `lib/public-queries.ts` y solo aplicará el tope del 100% en la presentación pública.
- **Avance por ítem**: lo recibido es la suma de la cantidad de las donaciones en producto no anuladas con ese ítem; se muestra con su meta, su porcentaje real y su **excedente real** (2150 de 2000 packs, excedente 150).
- **Total en soles por proyecto**: suma del monto de las donaciones en dinero no anuladas del proyecto. El dinero no suma a ninguna barra de unidades.
- **"Falta en soles"** según el ADR 0010, con las reglas precisadas más abajo, y la marca "estimado parcial".
- **Avance de un proyecto con varios ítems (A3, decisión del usuario)**: se muestra por ítem, más un resumen que no mezcla unidades ("N de M metas cumplidas", total recibido en soles y falta en soles). No hay un porcentaje único del proyecto.
- **Bloque "Sin asignar"** (decisión del usuario): total en soles y cantidad de donaciones pendientes de asignar, con enlace a la lista filtrada; no cuenta en ninguna barra.
- Pantallas: la lista `/proyectos` muestra el resumen de cada proyecto y el bloque "Sin asignar"; `/proyectos/[id]` muestra el avance por ítem y el resumen, sin pasos adicionales. Los proyectos finalizados muestran su avance final; los informativos no muestran barras pero sí el total en soles si recibieron dinero.
- Lecturas por el acceso privado, con agregaciones en SQL (no se cargan todas las donaciones en memoria), y pruebas contra Postgres real con donaciones editadas, reasignadas y anuladas.

Reglas decididas (registradas para revisión):
- Lo que falta de cada ítem se calcula con `max(0, meta − recibido)`: el **excedente de un ítem no compensa lo que falta de otro** (si sobran 150 packs, no se descuentan de las botellas que faltan).
- Si el proyecto no tiene ningún ítem con costo, la falta en soles **no se puede estimar** y se muestra así, en vez de mostrar "S/ 0" engañoso.
- "Estimado parcial" sigue el ADR 0010 al pie de la letra: se marca cuando el proyecto tiene algún ítem sin costo.
- Los montos se calculan en céntimos enteros (sin `float`); como el costo y los montos tienen dos decimales y las cantidades son enteras, el resultado es exacto y no hay redondeo.

Fuera de alcance (otros ítems): `lib/public-queries.ts`, la barra pública, el tope del 100% y "Anónimo" (#12), el reporte por responsable y proyecto (#10), exportar, decidir si el dinero avanza la barra pública (decisión abierta de C3, #12), cambios de esquema y migraciones.

## Capabilities

### New Capabilities
- `progress-calculation`: una sola función calcula el avance por ítem (recibido, porcentaje, excedente), el resumen del proyecto (metas cumplidas, total en soles, falta en soles y su grado de estimación) y el resumen de lo sin asignar, a partir de agregaciones SQL, excluyendo anuladas y sin mezclar unidades.
- `progress-display`: la zona privada muestra ese avance en la lista de proyectos y en el detalle de cada proyecto, incluido el bloque "Sin asignar", sin pasos adicionales y con el mismo dato en la misma carga de página.

### Modified Capabilities
<!-- Ninguna: los specs de proyectos (#5) y donaciones (#7, #8) pertenecen a cambios aún no archivados y no cambian sus requisitos; el avance solo los lee. -->

## Impact

- **Código nuevo:** cálculo puro y consultas de avance, utilidades de céntimos, componentes de barra y resumen, lecturas privadas y pruebas.
- **Código existente:** `lib/private-queries-core.ts` (lectura de avance; `getProyecto` gana el campo `avance`, sin romper a quien ya lo usa), `app/(privado)/proyectos/page.tsx` y `[id]/page.tsx`; `CLAUDE.md` gana una nota.
- **Dependencias nuevas:** ninguna.
- **Sistemas externos:** ninguno. No hay migración ni escritura en `production`; el avance se calcula al leer, sin contadores guardados (ADR 0002).
- **Pendientes del TDD que se tocan:** cierra A2 (una función de avance compartida) y A3 (avance con varios ítems); C3 (si el dinero avanza la barra pública) sigue abierto para #12.
