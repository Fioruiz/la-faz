# Tasks

## 1. Regla compartida y cálculo puro

- [x] 1.1 Crear `lib/donaciones-condiciones.ts` con las condiciones SQL de donación vigente (`esDineroVigente`, `esProductoVigente`, `esVigente`) y hacer que `lib/avance-consulta.ts` las use en lugar de repetir el filtro, sin cambiar su comportamiento; verificar con `npx tsc --noEmit` y que `tests/avance-consulta.test.ts` y `tests/avance-lecturas.test.ts` siguen pasando sin cambios
- [x] 1.2 Crear `lib/reporte.ts` con `validarRango(desde, hasta, hoy)` (formato real, desde 2020-01-01, hasta como máximo un año después de hoy, desde no posterior a hasta, vacío significa sin límite, mensajes en español) y `armarReporte(entrada)` (puro: grupos por responsable y por proyecto con cantidades, dinero con subtotales por medio exactos en céntimos y "sin medio", productos por ítem sin mezclar unidades, productos sin asignar en un renglón, anuladas aparte, totales generales, sin grupos vacíos); verificar con `npx tsc --noEmit`
- [x] 1.3 Escribir `tests/reporte.test.ts` (sin base): subtotales por Yape, Plin y transferencia que suman el total, 0,10 + 0,20 = 0,30, dinero sin medio, dos ítems que no se mezclan, mismo nombre de ítem en dos proyectos, productos sin asignar sin sumar cantidades, grupo con solo anuladas, orden por total, suma de grupos igual al total general en ambas vistas, y las validaciones del rango (2026-02-30, formato 03/11/2026, desde posterior a hasta, antes de 2020, más de un año adelante, vacíos, solo un extremo); verificar que pasa

## 2. Consultas del reporte

- [x] 2.1 Crear `lib/reporte-consulta.ts` con `consultarReporte(db, { desde?, hasta? })`: seis consultas SQL fijas (dinero por responsable, proyecto y medio; productos por responsable, proyecto e ítem; anuladas por responsable y proyecto; nombres de responsables, proyectos e ítems), con el rango inclusivo en el `WHERE`, sin tocar `apoyantes`, y el armado con `armarReporte`; verificar con `npx tsc --noEmit`
- [x] 2.2 Escribir `tests/reporte-consulta.test.ts` contra la rama de pruebas: agrupación por responsable y por proyecto con el grupo "Sin asignar", responsable desactivado que sigue apareciendo, totales y subtotales por medio exactos, productos por ítem y unidad, productos sin asignar en un renglón, anuladas fuera de los totales con su conteo, rango inclusivo en ambos extremos, solo desde y solo hasta, y rango que acota las anuladas; verificar que `npm run db:test` las pasa
- [x] 2.3 Escribir las pruebas de coherencia: sin filtro, el total en soles de cada proyecto y lo recibido por ítem del reporte igualan a `consultarAvance`; la suma de los grupos de responsables y de proyectos iguala al total general; y con las escrituras de #8 (editar monto y cantidad, reasignar a otro proyecto o ítem, asignar una "Sin asignar", anular) el reporte se mueve en la siguiente lectura; verificar que pasan
- [x] 2.4 Escribir la prueba de número fijo de consultas (con 5 y con 500 donaciones se hacen las mismas 6) y de privacidad (el resultado, con un donante de nombre y contacto conocidos, no contiene ninguno de los dos y sí el nombre del responsable); verificar que pasan

## 3. Lectura privada

- [x] 3.1 Añadir `getReporte({ desde, hasta })` a `lib/private-queries-core.ts` (`requerir()` primero, validación del rango y `consultarReporte`; devuelve `{ ok: true, reporte }` o `{ ok: false, error }`) y exportarla desde `lib/private-queries.ts`; verificar con `npx tsc --noEmit` y que `tests/private-access.test.ts` sigue pasando
- [x] 3.2 Escribir `tests/reporte-lecturas.test.ts`: reporte con datos y con rango válido, rango inválido devuelve el error sin consultar la base, y rechazo a un responsable desactivado antes de cualquier consulta; verificar que `npm run db:test` las pasa

## 4. Página y navegación

- [x] 4.1 Crear `/reportes` (página `force-dynamic` sin importar la base): formulario `GET` de fechas que funciona sin JavaScript, "Quitar rango", bloque de totales generales y las secciones "Por responsable" y "Por proyecto" con tarjetas por grupo (cantidad, total en soles con subtotales por medio, productos por ítem, "N anuladas" con enlace a `/donaciones?filtro=anuladas`, responsable desactivado marcado y proyecto finalizado con su estado), mensaje de rango inválido y de reporte vacío; verificar con `npm run build` que la ruta es dinámica
- [x] 4.2 Añadir un enlace "Reportes" en el panel y `/reportes/:path*` al `matcher` de `proxy.ts` con su aserción en `tests/proxy.test.ts`; verificar con `npm run build` y las pruebas del proxy
- [x] 4.3 Escribir `tests/reporte-estructura.test.ts`: `package.json` sin librerías de Excel, PDF ni CSV, sin `route.ts` bajo `app/(privado)/reportes/`, sin `text/csv`, `Content-Disposition`, `download` ni `Blob` en esa carpeta, los módulos del reporte no importan `apoyantes` ni usan `anulada, false` por su cuenta, y no usan `parseFloat` ni `toFixed`; verificar que pasa y que falla al añadir temporalmente `"xlsx"` a un `package.json` de prueba o un `route.ts` en esa carpeta (revertirlo)
- [x] 4.4 Verificación manual en el navegador contra la rama de pruebas de Neon (nunca producción): con dos responsables (uno desactivado), dos proyectos (uno finalizado), donaciones en dinero por los tres medios, productos en dos ítems, una donación sin asignar y una anulada, comprobar los dos grupos de vistas, los subtotales por medio, el "Sin asignar", el conteo de anuladas y su enlace, el rango de fechas (válido, `desde` posterior a `hasta` y una fecha inexistente), "Quitar rango", que anular una donación cambia el reporte al recargar y que no hay ningún botón de exportar; después borrar los datos de prueba; verificar que cada paso se comporta como indica la spec

## 5. Documentación e integración

- [x] 5.1 Añadir a `CLAUDE.md` una nota del reporte: las dos vistas, que la regla de donación vigente vive en `lib/donaciones-condiciones.ts` y la comparten avance y reporte, productos por ítem sin mezclar unidades y "sin asignar" en un renglón, subtotales por medio en céntimos, anuladas fuera con conteo, rango de fechas por GET validado, sin datos de donantes y sin exportar (PRD: No alcance); verificar que coincide con el código
- [x] 5.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `donation-report` y `report-filters` tiene al menos una prueba o una verificación manual anotada
- [x] 5.3 Ejecutar `openspec validate reporte-donaciones --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- #11 (sitio público estático), #12 (proyectos públicos, que reutiliza `consultarAvance`) y #13 (voluntariado) siguen; #14 cierra el endurecimiento antes de usar datos reales.
