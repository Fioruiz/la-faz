# Tasks

## 1. Esquema y migración

- [x] 1.1 Añadir `consentimientoVersion` (`text`, `NOT NULL`, sin valor por defecto) a `voluntariosInscritos` en `lib/schema.ts` y generar la migración con `npm run db:generate`; verificar que el SQL generado solo agrega esa columna y que `npx tsc --noEmit` pasa
- [x] 1.2 Corregir las pruebas existentes que insertan en `voluntariosInscritos` sin la columna (`tests/apoyantes-escrituras.test.ts`, `tests/apoyantes-lecturas.test.ts` y las que resulten); verificar con `npx tsc --noEmit`
- [x] 1.3 Aplicar la migración a la rama de pruebas con `npm run db:test:migrate` (nunca producción); verificar que termina sin error y que `npm run db:test` sigue pasando

## 2. Escritura pública

- [x] 2.1 Añadir `CONSENTIMIENTO_VOLUNTARIADO` (`version`, texto provisional con finalidad, quién ve los datos, que no se muestran en la web y cómo pedir cambios o baja, y el aviso de pendiente de revisión legal) a `lib/sitio-contenido.ts`; verificar con `npx tsc --noEmit` y una prueba que la versión no esté vacía
- [x] 2.2 Crear `lib/voluntariado-esquemas.ts` con el esquema Zod (nombre 1–100, contacto 1–200, mensaje 0–500 recortado y vacío → `null`, consentimiento que debe ser `true`); verificar con `tests/voluntariado-esquemas.test.ts` (límites 100/101, 200/201, 500/501, espacios, vacíos, sin consentimiento, `"on"` y `true`)
- [x] 2.3 Crear `lib/voluntariado-inscripcion-core.ts` con `inscribirVoluntario(db, entrada)`: honeypot → éxito sin tocar la base; validación (devuelve `errores` y `valores`); transacción con el apoyante (voluntario, no donante, no anónimo) y la inscripción con la versión fijada por el servidor; fallo → mensaje genérico y log solo con tipo y código; verificar con `npx tsc --noEmit`
- [x] 2.4 Escribir `tests/voluntariado-inscripcion.test.ts` contra la rama de pruebas: envío válido (roles, contacto, versión, `creado_en`), mensaje opcional, dos envíos iguales → dos apoyantes, contacto igual al de un donante existente (no se toca), honeypot lleno (no guarda y responde éxito), campos fuera de límite, sin consentimiento, la versión no se toma de la entrada, atomicidad (falla la segunda inserción → no queda apoyante), ninguna fila en `audit_log`, log sin nombre, contacto ni mensaje; verificar con `npm run db:test`
- [x] 2.5 Crear `lib/voluntariado-inscripcion.ts` (`server-only`, enlaza el núcleo con `getDb()`) y `app/(publico)/voluntariado/actions.ts` (`"use server"`, solo llama al envoltorio); verificar con `npm run build`

## 3. Formulario público

- [x] 3.1 Crear el formulario cliente en `app/(publico)/voluntariado/formulario.tsx` (`useActionState`): nombre, contacto, mensaje, casilla de consentimiento con el texto y su aviso de provisional, campo trampa `sitio_web` oculto (`aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`), errores por campo, conserva lo escrito, estado de envío y confirmación; verificar con `npm run build` y `npm run lint`
- [x] 3.2 Reemplazar el aviso "Muy pronto" de `app/(publico)/voluntariado/page.tsx` por el formulario y ajustar el texto de `metadata` y el comentario de `VOLUNTARIOS.href` en `lib/sitio-contenido.ts`; verificar con `npm run build` (la página sigue sin importar base ni lo privado)
- [x] 3.3 Ajustar `tests/sitio-publico-estructura.test.ts`: reemplazar "la página provisional no recoge datos" por la regla de que solo `voluntariado/` tiene formulario y `como-donar`/inicio no; verificar que esa prueba pasa

## 4. Lista privada

- [x] 4.1 Añadir `listarVoluntarios()` a `lib/private-queries-core.ts` (tras `requerir()`, `join` con `apoyantes` solo con `id` y `nombre`, orden `creado_en desc, id desc`, límite 200 y total) y exportarla en `lib/private-queries.ts`; verificar con `npx tsc --noEmit`
- [x] 4.2 Escribir `tests/voluntariado-lecturas.test.ts`: orden, mensaje presente y ausente, sin la clave `contacto`, total mayor que 200, lista vacía, y rechazo de un responsable desactivado (como en las demás lecturas privadas); verificar con `npm run db:test`
- [x] 4.3 Crear `app/(privado)/voluntarios/page.tsx` (`force-dynamic`, `oAlLogin`, filas con nombre, fecha en Lima y mensaje como texto con `whitespace-pre-line`, enlace a `/apoyantes/{id}`, mensaje de lista vacía, aviso de "se muestran las primeras N de M") y el enlace en el panel; verificar con `npm run build`
- [x] 4.4 Añadir a `tests/privado-estructura.test.ts` (o a una prueba nueva `tests/voluntariado-estructura.test.ts`) que `app/(privado)/voluntarios/` no importa la base ni el esquema y no usa `dangerouslySetInnerHTML`; verificar que pasa

## 5. Pruebas estructurales de la escritura pública

- [x] 5.1 Escribir en `tests/voluntariado-estructura.test.ts`: la acción pública es la única `"use server"` bajo `app/(publico)` y vive en `voluntariado/`; importa solo `@/lib/voluntariado-inscripcion`; el módulo escribe solo en `apoyantes` y `voluntariosInscritos`, no importa `audit_log`, `escritura-auditada` ni lo privado, y no usa caché; `lib/public-queries*.ts` sigue sin leer `apoyantes`; el formulario tiene el campo trampa oculto; verificar que pasa y que `tests/public-estructura.test.ts` también
- [x] 5.2 Comprobar que las pruebas fallan con mutaciones temporales (leer `apoyantes` en `public-queries-core`, importar `db-client` en el formulario, quitar el honeypot del núcleo, dejar que el cliente envíe la versión, seleccionar `contacto` en `listarVoluntarios`, usar `dangerouslySetInnerHTML` en la lista) y revertirlas; verificar que cada una hace fallar al menos una prueba

## 6. Verificación manual

- [x] 6.1 Con la rama de pruebas de Neon (nunca producción), en celular y escritorio: enviar el formulario completo y ver la confirmación; enviarlo vacío, con textos demasiado largos y sin consentimiento y ver los mensajes sin perder lo escrito; llenar el campo trampa desde las herramientas del navegador y comprobar que no se guarda; simular base caída (cadena inválida) y ver el mensaje genérico; entrar como responsable, ver la lista, abrir una fila y ver el contacto solo en el detalle; enviar un mensaje con `<script>` y ver que sale como texto; después borrar los datos de prueba; verificar que cada paso se comporta como indican las specs

## 7. Documentación e integración

- [x] 7.1 Añadir a `CLAUDE.md` una nota de voluntariado (`app/(publico)/voluntariado/`, `lib/voluntariado-*.ts`): única escritura pública, honeypot lleno = éxito sin guardar, cada envío crea un apoyante, sin `audit_log`, versión del consentimiento fijada en el servidor y texto provisional con revisión legal pendiente, `/voluntarios` sin contacto, y la actualización de la nota de "Sitio público estático" (la página ya no es provisional); verificar que coincide con el código
- [ ] 7.2 Comprobar con una consulta de solo lectura que `voluntarios_inscritos` está vacía en producción, **pedir confirmación al usuario** y aplicar la migración con `npm run db:migrate`; verificar que la columna existe y que `npm run db:check` pasa **APLAZADA a la publicación** (decisión del usuario, 2026-10-27): se ejecuta junto con la migración del #14, siguiendo `CHECKLIST-PUBLICACION.md`; la tabla estaba vacía en producción al comprobarlo.
- [x] 7.3 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `volunteer-signup` y `volunteer-roster` tiene al menos una prueba o una verificación manual anotada
- [x] 7.4 Ejecutar `openspec validate voluntariado-inscripcion --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto. Al archivar, anotar en el ADR 0003 que la acción pública de voluntariado tampoco escribe en `audit_log`.
- #14 cierra el endurecimiento antes de usar datos reales: rol de solo lectura, límite de intentos o captcha, respaldo, y revisión legal del texto de consentimiento y de los derechos de acceso, cancelación y retención.
