# Tasks

## 1. Lecturas públicas

- [x] 1.1 Crear `lib/public-queries-core.ts` con `crearLecturasPublicas(obtenerDb)`: `listarProyectosPublicos()` y `getProyectoPublico(id)` (1 consulta de proyectos más `consultarAvance`, proyección al tipo cerrado `ProyectoPublico`/`ItemPublico` con recibido y porcentaje ya limitados a la meta, sin dinero, costo, sin asignar ni `apoyantes`; `resultado` solo si está finalizado; id inválido o inexistente → `null`); verificar con `npx tsc --noEmit`
- [x] 1.2 Crear `lib/public-queries.ts` (`server-only`, instancia con `getDb()`); verificar con `npx tsc --noEmit` y `npm run build`
- [x] 1.3 Escribir `tests/public-queries.test.ts` contra la rama de pruebas: igualdad con `consultarAvance` ítem por ítem, excedente al 100%, anuladas, "Sin asignar" y dinero que no suman, mismo nombre de ítem en dos proyectos, finalizado, informativo, con meta sin ítems, sin descripción, id inválido o inexistente, claves del resultado en lista cerrada, JSON sin nombre, contacto ni montos (donante anónimo y no anónimo); verificar con `npm run db:test`
- [x] 1.4 Añadir a esas pruebas el número fijo de consultas (5 y 500 donaciones) y el reflejo de editar, reasignar y anular con las escrituras de #8; verificar que pasan

## 2. Páginas

- [x] 2.1 Crear `app/(publico)/_componentes/barra-publica.tsx` (texto "N de M unidad", `role="progressbar"`, "Meta cumplida", sin color como única señal); verificar con `npm run build` y `npm run lint`
- [x] 2.2 Crear `app/(publico)/nuestros-proyectos/page.tsx` (lista: activos primero, descripción opcional, resumen "N de M metas cumplidas", enlace al detalle, mensaje sin proyectos) con `force-dynamic` y `metadata`; verificar con `npm run build` (ruta dinámica)
- [x] 2.3 Crear `app/(publico)/nuestros-proyectos/[id]/page.tsx` (ítems con barra y enlace a "Cómo donar" para activos con meta; informativo sin barras; con meta sin ítems con aviso; finalizado con resultado y sin invitación; `notFound()`) y `not-found.tsx`; verificar con `npm run build`
- [x] 2.4 Crear `app/(publico)/nuestros-proyectos/error.tsx` (mensaje amable, "Reintentar", sin mostrar el error ni cifras) y registrar solo el tipo del error; verificar con `npm run build`
- [x] 2.5 Añadir "Proyectos" al `MENU` de `lib/sitio-contenido.ts` y el enlace en `DONACION_PRODUCTOS`/`como-donar/page.tsx`; ajustar `tests/sitio-publico-estructura.test.ts` según el diseño (menú con Proyectos, `public-queries` permitido solo en `nuestros-proyectos`); verificar que esa prueba pasa
- [x] 2.6 Añadir al formulario privado de proyectos la ayuda "Se muestra en la web pública" junto a descripción y resultado; verificar con `npm run build` y las pruebas de proyectos

## 3. Pruebas estructurales

- [x] 3.1 Escribir `tests/public-estructura.test.ts`: solo `lib/public-queries` se importa para datos desde `app/(publico)`; el módulo no lee `apoyantes`, no escribe y no usa caché (`use cache`, `revalidate`, `unstable_cache`); las páginas son `force-dynamic`; existe `error.tsx` que no renderiza el error; `/nuestros-proyectos` no coincide con `/proyectos`; verificar que pasa
- [x] 3.2 Comprobar que falla con mutaciones temporales (importar `db` en una página pública, leer `apoyantes` en el módulo, añadir `revalidate`, exponer `totalDinero`, quitar el tope del 100%) y revertirlas; verificar que cada una la hace fallar

## 4. Verificación manual

- [x] 4.1 Con la rama de pruebas de Neon (nunca producción) y datos de ejemplo (con meta con ítems, excedente, informativo, con meta sin ítems, finalizado, descripción vacía, dinero y "Sin asignar"), en celular y escritorio: recorrer la lista y los detalles, comprobar barras, "N de M metas cumplidas", excedente al 100%, ausencia de donantes y de dinero, finalizado sin invitación, id inexistente, simular base caída (cadena inválida) y ver la página de error sin avance; después borrar los datos de prueba; verificar que cada paso se comporta como indican las specs

## 5. Documentación e integración

- [x] 5.1 Añadir a `CLAUDE.md` una nota de proyectos públicos: `/nuestros-proyectos`, `lib/public-queries*.ts` como única lectura pública, tipo de salida cerrado, tope solo al presentar, sin dinero ni donantes, error de base sin avance, descripción y resultado públicos; verificar que coincide con el código
- [ ] 5.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `public-projects` y `public-data-boundary` tiene al menos una prueba o una verificación manual anotada
- [ ] 5.3 Ejecutar `openspec validate proyectos-publicos --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- #13 (voluntariado) sigue; #14 cierra el endurecimiento (rol de solo lectura en Postgres para lo público, revisión legal de datos personales) antes de usar datos reales.
