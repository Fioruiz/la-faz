# Design

## Context

Estado observado: `app/page.tsx` es un marcador "En construcción"; `app/layout.tsx` es el layout raíz (fuentes Geist, `lang="es"`, título "en construcción"); `app/globals.css` solo define `--background`/`--foreground` con modo oscuro por `prefers-color-scheme`; Tailwind v4 sin librería de componentes. `/login` y `app/(privado)/` tienen su propia presentación. `proxy.ts` solo protege las rutas privadas, así que las públicas no necesitan cambios. No hay `lib/public-queries.ts` todavía (es #12). No hay logotipo ni fotos. Requisitos en `specs/`; decisiones y puntos a señalar en `proposal.md`. El ADR 0005 manda dinámico lo que consulta la base; estas páginas no la consultan.

## Goals / Non-Goals

**Goals:**
- Un sitio público cálido y fácil de leer, que funcione bien en celular, con navegación y pie compartidos que #12 y #13 reutilicen.
- Que el contenido institucional y los datos legales vivan en un solo módulo, fácil de corregir y de probar.
- Que sea imposible, sin que una prueba falle, que "Cómo donar" parezca un canal real o que entre un SDK de pago.

**Non-Goals:**
- Datos de la base, barras de avance, proyectos, formulario de voluntariado, imágenes, logotipo, internacionalización, modo claro/oscuro manual, animaciones pesadas, analítica.

## Decisions

**1. Grupo de rutas `app/(publico)/` con su propio layout.**
Contiene `layout.tsx` (cabecera, `main`, pie, enlace para saltar), `page.tsx` (inicio), `quienes-somos/page.tsx`, `como-donar/page.tsx` y `voluntariado/page.tsx`. `app/page.tsx` se elimina (la ruta `/` pasa al grupo). El layout raíz se queda con fuentes, `lang="es"` y un título por defecto sin "en construcción". Los layouts de `/login` y de `(privado)` no cambian, de modo que cabecera y pie públicos no aparecen en la zona privada. Alternativa descartada: poner la cabecera en el layout raíz y ocultarla en las rutas privadas, porque mezcla las dos zonas.

**2. Contenido en un módulo de datos: `lib/sitio-contenido.ts`.**
Exporta constantes tipadas: descripción, texto de Quiénes somos (párrafos), `HITOS` (año, frase, descripción), bloque de voluntarios, líneas de trabajo, `DATOS_LEGALES` (nombre, razón social, descripción corta, RUC) y `MEDIOS_DONACION` (con los datos ficticios). Las páginas solo presentan. Sin dependencias de Next ni de la base, de modo que una prueba lo importa con `tsx`. Alternativa descartada: texto incrustado en el JSX, que dificulta comprobar "el contenido coincide con el aportado" y corregir un dato en un solo sitio.

**3. Componentes de presentación en `app/(publico)/_componentes/`.**
`cabecera.tsx` (cliente solo si hace falta para la página actual), `pie.tsx`, `linea-de-tiempo.tsx`, `aviso-simulacion.tsx` y `seccion.tsx` (etiqueta + titular + contenido). La página actual del menú usa `usePathname`, por lo que solo la cabecera es componente de cliente (pequeño); el resto son Server Components. Alternativa descartada: marcar la página actual con CSS `:has` o pasar la ruta por props desde cada página; el hook es lo más simple y accesible (`aria-current="page"`).

**4. Menú sin "Proyectos" y botón de voluntarios a página provisional.**
Los enlaces salen de una lista en `lib/sitio-contenido.ts`; #12 añade "Proyectos" cuando exista su ruta, y una prueba comprueba que cada enlace del menú corresponde a una carpeta `page.tsx` existente (evita enlaces rotos). `/voluntariado` es una página sin campos que #13 sustituirá por el formulario. El botón "Ser voluntario" apunta a `/voluntariado`. Alternativa descartada: apuntar a `#voluntarios` (ya se está ahí) o dejar `href="#"`, que no lleva a ninguna parte.

**5. Línea de tiempo como lista ordenada semántica.**
`<ol>` con un `<li>` por hito: año en una etiqueta destacada, frase en `h3` y descripción en `p`. En escritorio se dibuja con una línea vertical y puntos con Tailwind (pseudo-elementos y bordes); en celular es una columna con la línea a la izquierda. Es solo estilo: sin JavaScript. El orden de los hitos es el aportado por el usuario (dos hitos en 2004; el rango "2004 - 2024" va tercero).

**6. Diseño visual: cálido, legible, sin imágenes.**
Un color de marca definido como variable en `globals.css` (`--marca`, con su versión clara y oscura) y un tono de fondo suave; tipografía Geist ya cargada, texto base de 18 px en celular, ancho de lectura de ~65 caracteres, tarjetas con bordes redondeados y espacio generoso. Sin imágenes ni logotipo (no se han entregado); el nombre "La FAZ" hace de marca tipográfica. Contraste mínimo 4,5:1 en ambos modos y `focus-visible` con anillo grueso. Como la ONG no dio colores, el color de marca es una propuesta cambiable en un solo sitio. Alternativa descartada: usar un kit de plantillas o librería de UI, que el proyecto no usa (sin librería de componentes).

**7. Cómo donar: datos ficticios y aviso triple.**
`MEDIOS_DONACION` contiene valores de relleno evidentes (`000 000 000`, "Banco de Demostración", cuenta `000-0000000000-0-00`, CCI `000-000-000000000000-00`, SWIFT `DEMOXXPE`, titular "Asociación La Faz (demostración)"). El aviso (`AvisoSimulacion`) va antes de los medios, y cada medio lleva su etiqueta "Datos de demostración"; el acceso desde el inicio no promete cobro. Ni botones ni formularios. Las instrucciones por medio son pasos genéricos ("abre tu app, elige pagar a un número, revisa el nombre"), no promesas operativas. La donación de productos dice que se coordina con la ONG sin inventar teléfono, lugar ni fecha.

**8. Páginas estáticas (prerenderizadas) y ADR 0005.**
Las páginas no usan `cookies`, `headers`, `searchParams` ni la base, así que Next las prerenderiza en el build; no se fuerza `force-dynamic`. El ADR 0005 busca que el avance no quede viejo; estas páginas no muestran avance. La página de proyectos de #12 será dinámica. Se anota en `CLAUDE.md`.

**9. Títulos y descripciones con `metadata` por página.**
Cada `page.tsx` exporta `metadata` con título "<Página> – ONG La FAZ" y descripción propia; el layout raíz pasa a "ONG La FAZ" con la descripción de la ONG. El inicio usa "ONG La FAZ – Acompañando a quienes más lo necesitan"? No: se evita un eslogan que la ONG no dio; el título del inicio es "Inicio – ONG La FAZ".

**10. Pruebas estructurales (sin base).**
`tests/sitio-publico-estructura.test.ts` lee archivos y el módulo de contenido:
- las páginas y componentes públicos no importan `db`, `schema`, `drizzle`, `neon`, `next-auth`, `auth`, `private-queries` ni nada de `app/(privado)`;
- `package.json` y el código no tienen SDK de pago (`stripe`, `culqi`, `izipay`, `mercadopago`, `paypal`, `niubiz`) ni credenciales;
- "Cómo donar" no contiene `<form`, `<input`, `type="submit"` ni `<button`;
- el aviso de simulación aparece antes de los medios en `como-donar/page.tsx` y cada medio trae su etiqueta;
- los datos de cuenta de `MEDIOS_DONACION` son de relleno reconocible (sin dígitos distintos de cero en números de cuenta);
- el contenido aportado está presente: titular de Quiénes somos, los cinco hitos en orden, el bloque de voluntarios, el RUC y la razón social completa;
- el menú no tiene enlaces rotos y no incluye "Proyectos";
- cada página exporta `metadata` con título y descripción distintos; `h1` único por página;
- ningún texto menciona "recibo" ni "deducible" en "Cómo donar".
No hace falta Postgres. Además `npm run build` debe mostrar las cuatro rutas como estáticas.

## Risks / Trade-offs

- [Un visitante real toma los datos de demostración por una cuenta verdadera] → Aviso triple (arriba, por medio, en el acceso del inicio), valores evidentemente falsos, sin botones; riesgo reputacional hasta que haya datos reales (a decidir fuera de este cambio).
- [Texto legal o cifras incorrectas] → Se transcriben tal cual del usuario (que las confirmó) y viven en un solo módulo, fácil de corregir.
- [Sin imágenes ni logo, el sitio puede sentirse sobrio] → Diseño cálido con color y tipografía; las imágenes se añaden después sin cambiar la estructura.
- [Mover `app/page.tsx` rompe la ruta `/`] → La prueba de build y la verificación manual comprueban `/`; el grupo `(publico)` no cambia la URL.
- [Enlaces rotos al añadir #12/#13] → La prueba de menú compara enlaces con las rutas existentes.

## Migration Plan

No hay migración ni escritura en `production`: solo contenido estático. Reversión: revertir el commit. Antes de publicar con visitantes reales, el responsable de la ONG revisa los textos y datos legales; los datos de cuenta de demostración se reemplazan solo cuando se decida (con un cambio aparte y actualizando el PRD/TDD).

## Open Questions

- Si la ONG tiene logotipo, colores o fotos que usar: se añadirán después sin cambiar la estructura.
