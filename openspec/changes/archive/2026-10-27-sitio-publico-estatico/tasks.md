# Tasks

## 1. Contenido y estructura base

- [x] 1.1 Crear `lib/sitio-contenido.ts` con el contenido transcrito del usuario (descripción, texto de Quiénes somos, `HITOS` en orden, bloque de voluntarios, líneas de trabajo, `DATOS_LEGALES`, enlaces del menú sin "Proyectos") y `MEDIOS_DONACION` con datos de relleno evidentes; verificar con `npx tsc --noEmit`
- [x] 1.2 Definir el color de marca y los tonos en `app/globals.css` (claro y oscuro, contraste ≥ 4,5:1, anillo de foco visible) y ajustar `app/layout.tsx` (título y descripción por defecto sin "en construcción"); verificar con `npm run build`
- [x] 1.3 Crear `app/(publico)/layout.tsx` con enlace para saltar al contenido, cabecera, `main` y pie, y los componentes `_componentes/cabecera.tsx` (menú con `aria-current` y usable en celular), `pie.tsx`, `seccion.tsx`; verificar con `npm run build` y `npm run lint`

## 2. Páginas

- [x] 2.1 Mover el inicio a `app/(publico)/page.tsx` (eliminar `app/page.tsx`): descripción, accesos a "Cómo donar" y "Ser voluntario", resumen de Quiénes somos con enlace, líneas de trabajo y bloque de voluntarios con el botón a `/voluntariado`; verificar con `npm run build` que `/` es estática
- [x] 2.2 Crear `app/(publico)/quienes-somos/page.tsx` con el titular, los tres párrafos y la sección "Nuestra historia" (`id="historia"`) con `_componentes/linea-de-tiempo.tsx` como lista ordenada; verificar con `npm run build` y revisando el HTML (cinco `li`, en orden)
- [x] 2.3 Crear `app/(publico)/como-donar/page.tsx` y `_componentes/aviso-simulacion.tsx`: aviso destacado antes de los medios, bloques de Yape, Plin, transferencia nacional e internacional con su etiqueta "Datos de demostración", donación de productos sin inventar contacto, sin formularios ni botones; verificar con `npm run build`
- [x] 2.4 Crear `app/(publico)/voluntariado/page.tsx` provisional (invitación, aviso de que el formulario llegará pronto, sin campos); verificar con `npm run build`
- [x] 2.5 Añadir `metadata` (título y descripción propios) a las cuatro páginas y comprobar un solo `h1` por página; verificar con `npm run build` y `npm run lint`

## 3. Pruebas

- [x] 3.1 Escribir `tests/sitio-publico-estructura.test.ts`: sin importar base, esquema, Drizzle, Auth.js ni lecturas privadas; sin SDK de pago en `package.json` ni en el código; "Cómo donar" sin `form`, `input` ni `button`; aviso antes de los medios y etiqueta en cada medio; datos de cuenta de relleno; contenido clave presente (titular, cinco hitos en orden, voluntarios, RUC, razón social completa); menú sin enlaces rotos y sin "Proyectos"; `metadata` distinta por página; sin "recibo" ni "deducible"; verificar que pasa
- [x] 3.2 Comprobar que la prueba falla con mutaciones temporales (añadir `"stripe"` a un `package.json` de prueba, un `<form` en "Cómo donar", un número de cuenta con dígitos reales, un enlace a una ruta inexistente) y revertirlas; verificar que cada una la hace fallar
- [x] 3.3 Comprobar que `tests/proxy.test.ts` y las pruebas de acceso siguen pasando sin cambios (las rutas públicas no se protegen y `/` abre sin sesión); verificar con `npm run db:test`

## 4. Verificación manual

- [x] 4.1 Con `npm run dev` y el navegador, en ancho de celular y de escritorio: recorrer `/`, `/quienes-somos#historia`, `/como-donar` y `/voluntariado` sin sesión; comprobar menú, página actual, línea de tiempo, aviso de simulación, botón "Ser voluntario", pie con datos legales, "Acceso responsables", navegación solo con teclado (salto al contenido y foco visible), sin desplazamiento horizontal ni errores en consola; verificar que cada paso se comporta como indican las specs

## 5. Documentación e integración

- [x] 5.1 Añadir a `CLAUDE.md` una nota del sitio público: grupo `app/(publico)/`, contenido en `lib/sitio-contenido.ts`, páginas estáticas sin base (la de proyectos de #12 será dinámica), "Cómo donar" con datos ficticios y sin cobro, ubicación Ventanilla (Callao), Chepén e Ica (confirmada por el usuario), datos legales transcritos del usuario; verificar que coincide con el código
- [x] 5.2 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `public-site` y `donation-info` tiene al menos una prueba o una verificación manual anotada
- [x] 5.3 Ejecutar `openspec validate sitio-publico-estatico --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- #12 (proyectos públicos, añade "Proyectos" al menú y será dinámica) y #13 (voluntariado, reemplaza la página provisional) siguen; antes de publicar con visitantes reales, la ONG revisa los textos.
