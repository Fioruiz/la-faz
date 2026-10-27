# Proposal

## Why

El PRD pide que los donantes, también los extranjeros, "ven un canal oficial donde consultan públicamente el avance de las metas (por ejemplo, '1200 de 2000 packs')" y que "la barra de avance pública coincide exactamente con lo registrado en la zona privada". El usuario pidió además una sección de proyectos donde se diga **qué cosas se pueden donar**, para que el donante sepa qué puede dar. El sitio estático (#11) ya presenta a la ONG y explica cómo donar, pero no muestra los proyectos ni sus metas. Este es el ítem #12 del backlog, y es la primera vez que la zona pública lee la base, por lo que fija la frontera de datos públicos del ADR 0007.

## What Changes

Alcance estricto del ítem #12 ("Proyectos públicos con barra de avance") con las decisiones del usuario:

- **Módulo único de lecturas públicas** (`lib/public-queries.ts`, con su núcleo sin Next): la única vía por la que las páginas públicas leen la base. Devuelve solo proyectos, ítems, cantidades y avance, y **nunca** nombres ni contactos de apoyantes, ni dinero, ni donaciones "Sin asignar". Reutiliza `consultarAvance()` y la regla única de donación vigente (no copia la lógica de avance, cierra A2).
- **`/nuestros-proyectos`** (lista): todos los proyectos, activos primero y finalizados después, cada uno con su nombre, su descripción (si la hay), su estado y, si tiene meta, el resumen "N de M metas cumplidas" y un enlace al detalle.
- **`/nuestros-proyectos/[id]`** (detalle): el proyecto con **qué se puede donar**: cada ítem con su nombre, unidad, meta, recibido y una barra de avance limitada al 100%.
- **Proyectos informativos** (Música, Casa del Buen Samaritano: sin meta): solo nombre y descripción, sin barra ni ítems.
- **Proyectos finalizados**: visibles como "Finalizado" con su resultado y sus cifras finales, **sin invitar a donar**.
- **Donantes: ninguno en público** (decisión del usuario). Se mantiene `nombrePublico()` como única vía por si algún día se muestra un nombre, y una prueba garantiza que la salida pública no lleva nombres ni contactos de apoyantes.
- **Dinero: no mueve ninguna barra ni se muestra en público** (decisión del usuario sobre C3; ADR 0010 sin cambios): el total en soles y la "falta en soles" siguen siendo solo de la zona privada.
- **Dinámico y sin caché** (ADR 0005): cada visita consulta Postgres. Si la base no responde, una página de error clara, **nunca un avance en cero** ni cifras viejas.
- **Menú y enlaces**: "Proyectos" se añade al menú público y "Cómo donar" enlaza a la sección de proyectos (la página provisional de voluntariado no cambia).
- **Aviso en el formulario privado**: la descripción y el resultado de un proyecto ahora se publican; el formulario de proyectos dice que ese texto se muestra en la web pública (hoy nadie lo ve fuera de la zona privada).

Decisiones registradas para revisión:
- **Ruta `/nuestros-proyectos`, no `/proyectos`**: `/proyectos` ya es la lista **privada** (`app/(privado)/proyectos/`, protegida por `proxy.ts`), y los grupos de rutas comparten la misma URL. El texto del menú sigue siendo "Proyectos".
- **Barra y texto muestran lo recibido hasta la meta**: con 2150 de 2000 se muestra "2000 de 2000 · Meta cumplida" y la barra al 100%. El excedente real queda solo en la zona privada ("la barra pública muestra 100%; la zona privada muestra el excedente real", PRD). Es una lectura del PRD; si prefieres mostrar 2150 en público, se cambia en un solo sitio.
- **Descripción pública**: ya existe `proyectos.descripcion` (opcional, hasta 1000 caracteres) y `proyectos.resultado` para los finalizados; no hay cambios de esquema ni migración. Si un proyecto no tiene descripción (hoy "Casa del Buen Samaritano" no la tiene en los datos iniciales), la página muestra solo su nombre y **no se inventa texto**: un responsable la escribe desde la zona privada.
- **Una sola función de avance**: la lectura pública llama a `consultarAvance()`, que también calcula el dinero y lo que falta en soles; la capa pública los descarta y su tipo de salida **no tiene campos de dinero**, de modo que no hay forma de que lleguen a la página. Alternativa descartada: una consulta pública aparte (riesgo de desincronizar la barra, A2).
- **Identificador en la URL**: el id numérico del proyecto; un id inexistente o inválido da la página 404, no un error.
- **Un proyecto con meta pero sin ítems todavía**: se muestra con su descripción y el aviso "Pronto publicaremos qué se necesita", sin barra y sin porcentaje.

Fuera de alcance (otros ítems o el PRD): lista o nombres de donantes; total en soles o dinero en público; conversión de dinero a unidades; formulario de voluntariado (#13); gráficos, fotos, noticias; escrituras de cualquier tipo; caché con invalidación (ADR 0005); rol de Postgres de solo lectura (ADR 0007: paso siguiente si hubiera datos reales, se evalúa en #14); cambios de esquema.

## Capabilities

### New Capabilities
- `public-projects`: la zona pública muestra los proyectos y, para los que tienen meta, qué se puede donar con su avance por ítem (barra limitada a 100%), los informativos solo con su descripción y los finalizados con su resultado.
- `public-data-boundary`: la zona pública lee únicamente por un módulo de lecturas públicas que no expone datos personales, dinero ni donaciones sin asignar, coincide exactamente con el avance privado y falla de forma visible si la base no responde.

### Modified Capabilities
<!-- Ninguna: los specs del sitio público (#11) y del avance (#9) pertenecen a cambios aún no archivados; aquí se les añade un enlace y un ítem de menú, pero sus requisitos no cambian. -->

## Impact

- **Código nuevo**: `lib/public-queries-core.ts` y `lib/public-queries.ts`, las rutas `app/(publico)/nuestros-proyectos/` (lista, detalle, `error.tsx`, `not-found`), un componente de barra pública y las pruebas.
- **Código existente**: `lib/sitio-contenido.ts` (menú y texto de "Cómo donar"), `app/(publico)/como-donar/page.tsx` (enlace), el formulario privado de proyectos (aviso de que descripción y resultado son públicos), `CLAUDE.md` y la prueba de menú de #11 (que prohibía "Proyectos" hasta ahora).
- **Dependencias nuevas**: ninguna.
- **Sistemas externos**: ninguno. Solo lectura de Postgres; no hay migración ni escritura en `production`.
- **Pendientes del TDD que se tocan**: cierra la decisión abierta de C3 para lo público (el dinero no mueve la barra ni se muestra) y deja a #14 el rol de solo lectura y la revisión legal de datos personales.
