# Tasks

## 1. Cálculo puro

- [x] 1.1 Crear `lib/dinero.ts` con `aCentimos(texto)` (de "150.50" a `BigInt`), `deCentimos(valor)` (a "150.50") y `sumar`, sin coma flotante; escribir `tests/dinero.test.ts`: "0.10" + "0.20" = "0.30", enteros y dos decimales, cero, valores de 10 dígitos, y rechazo de texto inválido; verificar que pasa
- [x] 1.2 Crear `lib/avance.ts` con los tipos y `calcularAvance(entrada)`: por ítem `recibido`, `porcentaje` real hacia abajo, `excedente`, `falta` y `cumplida`; por proyecto `metasTotal`, `metasCumplidas`, `totalDinero`, `faltaSoles` y `estimacion` (completa, parcial o no-disponible con `faltaSoles` nulo), sin porcentaje del proyecto; verificar con `npx tsc --noEmit`
- [x] 1.3 Escribir `tests/avance.test.ts` (sin base): caso base (meta 2000, costo 13, recibido 1200, dinero 5000 da falta 5400), dinero mayor que el costo restante da 0, excedente de un ítem que no compensa a otro con costo, ítems sin costo da parcial, ningún ítem con costo o sin ítems da no disponible, metas cumplidas, 3 unidades a 13,33 da 39,99, valores grandes sin desbordar, porcentaje 99, 60 y 107, y proyecto informativo con solo dinero; verificar que pasa

## 2. Consultas de avance

- [x] 2.1 Crear `lib/avance-consulta.ts` con `consultarAvance(db, { proyectoIds? })` (tres consultas SQL fijas: recibido por ítem, dinero por proyecto y resumen de sin asignar, sin cargar donaciones en memoria) y su resultado vía `calcularAvance`; verificar con `npx tsc --noEmit`
- [x] 2.2 Escribir `tests/avance-consulta.test.ts` contra la rama de pruebas: suma de varias donaciones por ítem, las anuladas no suman, el dinero no suma a ninguna barra, un producto sin asignar no suma, ítem sin donaciones en 0, total en soles exacto, proyecto informativo con dinero, proyecto finalizado conserva su avance, y el resumen de sin asignar (dinero y producto vigentes, sin las anuladas); verificar que `npm run db:test` las pasa
- [x] 2.3 Escribir las pruebas de cambios de donaciones del #8: editar la cantidad cambia el recibido, reasignar a otro ítem baja uno y sube el otro, reasignar dinero a otro proyecto mueve el total, asignar una sin asignar sale del resumen de sin asignar y entra al proyecto, anular quita del avance y del total, y registrar una nueva suma, todo en la siguiente lectura dentro de la misma prueba; verificar que pasan
- [x] 2.4 Escribir la prueba de número fijo de consultas (envolviendo la conexión para contarlas, con 5 y con 500 donaciones) y la prueba estructural `tests/avance-estructura.test.ts`: `lib/avance.ts`, `lib/dinero.ts` y `lib/avance-consulta.ts` no importan `next`, `server-only` ni módulos privados, no usan `parseFloat` ni `Number()` sobre montos, y las páginas de proyectos no calculan el avance por su cuenta; verificar que pasan y que fallan al añadir temporalmente un `parseFloat` (revertirlo)

## 3. Lecturas privadas

- [x] 3.1 Añadir `getAvanceProyectos()` (resumen de cada proyecto y bloque sin asignar) y el campo `avance` de `getProyecto(id)` (ítems con recibido y resumen) a `lib/private-queries-core.ts`, exportar la nueva lectura desde `lib/private-queries.ts` y mantener intacta la forma de `listarProyectos()`; verificar con `npx tsc --noEmit` y que `tests/proyectos-lecturas.test.ts` y `tests/private-access.test.ts` siguen pasando
- [x] 3.2 Escribir `tests/avance-lecturas.test.ts`: `getAvanceProyectos` con varios proyectos (con meta, informativo con dinero, finalizado) y sin asignar, `getProyecto` con `avance` por ítem, id inexistente devuelve `null`, ningún resultado trae nombres ni contactos, y ambas lecturas rechazan a un responsable desactivado; verificar que `npm run db:test` las pasa

## 4. Pantallas

- [x] 4.1 Crear el componente `BarraAvance` y el resumen del proyecto (`role="progressbar"` con valores, texto "1200 de 2000 packs · 60%", excedente en texto, relleno limitado al 100% solo en el ancho, falta en soles con "estimado parcial" o "no se puede estimar") bajo `app/(privado)/proyectos/`; verificar con `npx tsc --noEmit`
- [x] 4.2 Mostrar en `/proyectos` el resumen de cada proyecto y el bloque "Sin asignar" con el enlace a `/donaciones?filtro=sin-asignar`, y en `/proyectos/[id]` la sección "Avance" antes de los ítems, para proyectos con meta, informativos y finalizados; verificar con `npm run build` que las rutas siguen siendo dinámicas
- [x] 4.3 Verificación manual en el navegador contra la rama de pruebas de Neon (nunca producción): con un proyecto con dos ítems (uno con costo y otro sin), donaciones en producto y dinero, una sin asignar y un proyecto informativo con dinero, comprobar las barras, el excedente, "1 de 2 metas cumplidas", el total y la falta con "estimado parcial", el bloque "Sin asignar" y su enlace, que anular o reasignar una donación cambia el avance al recargar, y que un proyecto finalizado muestra su avance; después borrar los datos de prueba; verificar que cada paso se comporta como indica la spec

## 5. Documentación e integración

- [x] 5.1 Añadir a `CLAUDE.md` una nota de avance: una sola función (`lib/avance-consulta.ts` y `lib/avance.ts`) que #12 debe reutilizar sin copiar la lógica, definición de recibido y de falta en soles (con `max(0, …)` por ítem), `estimacion` completa, parcial o no disponible, sin porcentaje del proyecto (A3), dinero en céntimos con `BigInt` y sin `float`, bloque sin asignar, y que no hay contadores guardados; verificar que coincide con el código
- [x] 5.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `progress-calculation` y `progress-display` tiene al menos una prueba o una verificación manual anotada
- [x] 5.3 Ejecutar `openspec validate avance-proyectos --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- #12 (proyectos públicos con barra) debe leer el avance con `consultarAvance()`, limitar a 100% solo al presentar y añadir una prueba de que la barra pública coincide con la privada.
- #10 (reporte) reutiliza el total en soles por proyecto; la decisión C3 (si el dinero avanza la barra pública) sigue pendiente para #12.
