# Design

## Context

Estado observado: `lib/avance-consulta.ts` (`consultarAvance(db, { proyectoIds? })`) hace 3 consultas SQL fijas (ítems con lo recibido, dinero por proyecto, "Sin asignar") y `lib/avance.ts` calcula el resultado, incluidos dinero y "falta en soles"; la regla de donación vigente vive en `lib/donaciones-condiciones.ts`. `proyectos` ya tiene `descripcion`, `tieneMeta`, `estado` y `resultado`. Las lecturas privadas siguen el patrón núcleo sin Next (`lib/private-queries-core.ts`) más capa con `server-only` (`lib/private-queries.ts`). `app/(privado)/proyectos/` ya ocupa la URL `/proyectos` (el `proxy.ts` la protege). El sitio público (#11) vive en `app/(publico)/` con `lib/sitio-contenido.ts`, y su prueba estructural exige que el menú no tenga "Proyectos" ni importe la base. `lib/apoyantes-publico.ts` tiene `nombrePublico()`. Requisitos en `specs/`; decisiones y supuestos en `proposal.md`.

## Goals / Non-Goals

**Goals:**
- Un único punto de lectura pública cuya salida, por su tipo, no pueda contener datos personales, dinero ni "sin asignar".
- La misma función de avance para lo público y lo privado; el tope del 100% solo al presentar.
- Páginas claras que digan qué se puede donar, y fallo visible si la base no responde.

**Non-Goals:**
- Total en soles o donantes en público, conversión de dinero a unidades, escrituras, caché, rol de Postgres de solo lectura, cambios de esquema.

## Decisions

**1. Rutas `/nuestros-proyectos` y `/nuestros-proyectos/[id]`.**
`/proyectos` ya es la lista privada y los grupos `(publico)` y `(privado)` comparten el espacio de URL. El menú dice "Proyectos". Alternativa descartada: mover la lista privada a otra ruta, que rompería enlaces, `proxy.ts` y pruebas de #5 por un tema de nombres.

**2. `lib/public-queries-core.ts` + `lib/public-queries.ts`.**
Mismo patrón que lo privado: el núcleo `crearLecturasPublicas(obtenerDb)` no importa Next (se prueba con `tsx` contra Postgres real) y `lib/public-queries.ts` añade `server-only` y lo instancia con `getDb()`. Exporta `listarProyectosPublicos()` y `getProyectoPublico(id)`. Es el único archivo fuera de `lib/` de avance que las páginas importan para datos. Lectura sin `requerir()`: no hay responsable.

**3. Una consulta de proyectos más `consultarAvance`.**
Las lecturas hacen (1) los proyectos (`id, nombre, descripcion, tieneMeta, estado, resultado`; en el detalle, con `WHERE id`) y luego `consultarAvance(db, { proyectoIds })` (3 consultas fijas), en total 4, sin importar la cantidad de donaciones. Con `proyectoIds` vacío (no hay proyectos) no se consulta nada más. La lectura pública **proyecta** el resultado a su propio tipo y descarta `totalDinero`, `faltaSoles`, `estimacion`, `costoReferencial`, `sinAsignar`, `porcentaje` real y `excedente`. Alternativa descartada: consulta pública aparte, que podría diferir de la privada (A2). Trade-off aceptado: la base calcula una suma de dinero que se descarta; es una agregación barata.

**4. Tipo de salida pública explícito y mínimo.**
```
ProyectoPublico { id, nombre, descripcion: string | null, estado: "activo" | "finalizado",
  conMeta: boolean, resultado: string | null,
  items: ItemPublico[], metasTotal, metasCumplidas }
ItemPublico { id, nombre, unidad, meta: number, recibido: number, porcentaje: number (0..100), cumplida: boolean }
```
`recibido` ya viene con el tope (`min(recibido real, meta)`) y `porcentaje` es `floor(recibido·100/meta)` limitado a 100 (misma fórmula de la barra privada, que ya trunca hacia abajo). `resultado` solo se devuelve si el estado es `finalizado`. No hay campos de dinero, ids de donaciones ni de responsables, y el módulo **no lee `apoyantes`**: si algún día se muestra un nombre, pasa por `nombrePublico()` (comentario y prueba). Una prueba compara las claves del resultado con una lista cerrada.

**5. Presentación según el estado del proyecto.**
- Informativo (`tieneMeta = false`): nombre y descripción; sin ítems ni barras.
- Con meta, activo, con ítems: ítems con barra y enlace a `/como-donar`; "N de M metas cumplidas".
- Con meta, activo, sin ítems: aviso "Pronto publicaremos qué se necesita"; sin barras.
- Finalizado: etiqueta "Finalizado", `resultado` y sus ítems con lo recibido; sin enlace a donar.
Si la descripción es nula no se escribe nada, nunca un texto inventado (Casa del Buen Samaritano hoy no la tiene).

**6. Página dinámica, error y no encontrado.**
`export const dynamic = "force-dynamic"` en ambas páginas (ADR 0005). `error.tsx` (componente cliente) en `app/(publico)/nuestros-proyectos/` muestra un mensaje amable y un botón "Reintentar" (`reset`), sin renderizar el error ni datos; el error se registra solo con su tipo (como en las acciones privadas). `not-found.tsx` para el detalle; `getProyectoPublico` devuelve `null` si el id no es un entero válido o no existe y la página llama a `notFound()`. Así una caída de la base nunca se confunde con "0 recibido".

**7. Barra pública accesible.**
Componente `_componentes/barra-publica.tsx` (Server Component): texto "1200 de 2000 packs", `role="progressbar"` con `aria-valuenow/max` y `aria-valuetext`, y la etiqueta "Meta cumplida" cuando corresponde; el color no es la única señal. Reutiliza `formatearCantidad` de `lib/formato.ts`. No muestra "faltan N" (se evita una cifra negativa de ánimo; el progreso ya lo dice la barra). Alternativa descartada: reutilizar `BarraAvance` privada, que muestra excedente real, falta y porcentaje con colores internos.

**8. Cambios en lo existente.**
- `lib/sitio-contenido.ts`: `MENU` gana `{ href: "/nuestros-proyectos", texto: "Proyectos" }` (después de "Quiénes somos") y `DONACION_PRODUCTOS` remite a la sección de proyectos con enlace.
- `tests/sitio-publico-estructura.test.ts` (de #11): la regla "el menú no incluye Proyectos" pasa a "el menú incluye Proyectos y apunta a una página existente", y la regla "las páginas públicas no importan módulos de datos" se ajusta para permitir **solo** `@/lib/public-queries` en `app/(publico)/nuestros-proyectos/` (las demás páginas siguen sin importar nada de datos); el chequeo de `cookies/headers/force-dynamic` se limita a las páginas estáticas.
- Formulario privado de proyectos: texto de ayuda junto a descripción y resultado ("Se muestra en la web pública").
Estos ajustes son consecuencia declarada en #11 ("#12 añade Proyectos al menú"), no una contradicción.

**9. Pruebas.**
`tests/public-queries.test.ts` (Postgres real): igualdad ítem por ítem con `consultarAvance` (meta igual y recibido público = `min(privado, meta)`), excedente (2150 de 2000 → 2000 y 100%), anuladas, "Sin asignar" y dinero que no suman, ítems con el mismo nombre en dos proyectos, finalizado (con resultado y sin invitación), informativo, con meta sin ítems, proyecto sin descripción, id inválido o inexistente, número fijo de consultas con 5 y 500 donaciones, claves del resultado en una lista cerrada, el JSON del resultado sin nombre, contacto ni montos del apoyante (incluido uno anónimo), y reflejo de editar, reasignar y anular con las escrituras de #8. `tests/public-estructura.test.ts`: solo el módulo público importa datos, el módulo no lee `apoyantes` ni escribe, sin `"use cache"`, `revalidate` ni `unstable_cache`, páginas con `force-dynamic`, existe `error.tsx` y no renderiza el error, la ruta pública no choca con `/proyectos`. Verificación manual contra la rama de pruebas de Neon, con una "base caída" simulada (cadena inválida), en celular y escritorio.

## Risks / Trade-offs

- [Una consulta pública mal escrita expone datos] → Tipo de salida cerrado y probado, módulo único sin `apoyantes`, pruebas sobre el JSON y el HTML; la misma conexión con permisos completos sigue siendo el riesgo del ADR 0007 (el rol de solo lectura se evalúa en #14).
- [La descripción y el resultado se vuelven públicos sin que los responsables lo sepan] → Aviso en el formulario y nota en la propuesta; revisar los textos existentes antes de publicar.
- [Pico de visitas llega directo a Neon (ADR 0005)] → Aceptado por el ADR; 4 consultas por visita, el arranque en frío de ~1 s se acepta.
- [Una barra pública que no coincida con la privada] → Misma `consultarAvance`, prueba de igualdad con datos reales y sin caché.
- [Mostrar solo hasta la meta puede esconder que se superó] → Es lo que pide el PRD para lo público; el real se ve en la zona privada.
- [`/proyectos` y `/nuestros-proyectos` pueden confundir] → Se documenta; el menú público dice "Proyectos".

## Migration Plan

Sin migración ni escritura en `production`: solo lecturas. Reversión: revertir el commit. Antes de publicar con visitantes reales, el responsable revisa las descripciones y los resultados de los proyectos (ahora públicos) y carga los ítems de cada meta desde la zona privada.

## Open Questions

- Si, con un proyecto muy grande, la lista debe paginarse: con unos pocos proyectos no hace falta.
- Si algún día se muestran donantes o el total en soles en público: requiere actualizar el PRD y reabrir el ADR 0010; fuera de este cambio.
