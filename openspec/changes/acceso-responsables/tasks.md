# Tasks

## 1. Dependencias y variables de entorno

- [x] 1.1 Instalar `next-auth@5.0.0-beta.32` (versión exacta, sin `^`), `bcryptjs@3.0.3` y `zod`; verificar con `npm ls next-auth bcryptjs zod` que las tres aparecen y con `npx tsc --noEmit` que el proyecto sigue compilando
- [x] 1.2 Añadir a `.env.example`, vacías y con un comentario, `AUTH_SECRET`, `RESPONSABLE_INICIAL_NOMBRE`, `RESPONSABLE_INICIAL_CORREO` y `RESPONSABLE_INICIAL_PASSWORD`, más `DATABASE_URL_UNPOOLED` y `DATABASE_URL_TEST` que ya usan los scripts; verificar con `git diff .env.example` que no hay valores reales y con `git check-ignore .env.local .env.test` que los archivos con valores siguen ignorados
- [x] 1.3 Quitar `cacheComponents` y `partialPrefetching` de `next.config.ts`, conservando las reglas de `turbopack`; verificar con `npm run build` que compila y con `npm run dev` que la portada se sirve igual

## 2. Hash de contraseñas y credenciales

- [x] 2.1 Crear `lib/password.ts` con `hashPassword()` y `verificarPassword()` sobre `bcryptjs` (12 rondas) y un hash ficticio fijo para igualar tiempos; escribir `tests/password.test.ts` (el hash difiere del texto, verifica la contraseña correcta, rechaza la incorrecta, produce hashes distintos para la misma contraseña) y verificar que la prueba pasa
- [x] 2.2 Crear `lib/auth-credentials.ts` con el esquema Zod del login (correo válido recortado, contraseña de 1 a 200 caracteres) y `autenticarResponsable(db, entrada)`, que devuelve `{ id }` o `null` sin distinguir correo inexistente, contraseña incorrecta ni responsable desactivado, y compara contra el hash ficticio cuando el correo no existe; verificar con `npx tsc --noEmit`
- [x] 2.3 Escribir `tests/auth-credentials.test.ts` contra la rama de pruebas, cada caso en una transacción que se revierte: activo con credenciales correctas, contraseña incorrecta, correo inexistente, desactivado con credenciales correctas, correo en mayúsculas o con espacios, entrada vacía o sin formato de correo (sin consultar la base) y contraseña de más de 200 caracteres; verificar que `npm run db:test` pasa y que una variante sin el filtro `activo` hace fallar la prueba del desactivado

## 3. Autorización en la capa de datos privada

- [x] 3.1 Crear `lib/private-access.ts` (con `import "server-only"`) con `ResponsableNoActivoError`, el núcleo `verificarResponsableActivo(db, id)` y `requireResponsableActivo()` que lee el id de `auth()`; sin sesión lanza el mismo error sin consultar la base; sin `"use cache"`; verificar con `npx tsc --noEmit`
- [x] 3.2 Escribir `tests/private-access.test.ts` contra la rama de pruebas: responsable activo devuelve id y nombre, desactivado rechazado, id inexistente rechazado, reactivado vuelve a pasar, nombre cambiado se ve en la siguiente llamada; verificar que `npm run db:test` pasa
- [x] 3.3 Crear `lib/private-queries.ts` con `getPanel()`, que llama primero a `requireResponsableActivo()` y devuelve `{ id, nombre }`, y `lib/private-routes.ts` con la lista de rutas privadas y su función ejecutable; escribir la prueba "cada ruta privada rechaza a un responsable desactivado" que recorre esa lista y verificar que pasa
- [x] 3.4 Escribir `tests/privado-estructura.test.ts` que falla si algún archivo de `app/(privado)/` importa `lib/db`, `lib/db-client` o `lib/schema`, o si algún módulo de acceso privado contiene `"use cache"`; verificar que pasa y que falla al añadir temporalmente un import prohibido (revertirlo)

## 4. Auth.js, login y zona privada

- [x] 4.1 Crear `lib/auth.ts` con la configuración de Auth.js: proveedor de credenciales que usa `autenticarResponsable`, sesión JWT con `maxAge` de 7 días, callbacks `jwt` y `session` que guardan y exponen solo el id, página de login propia, y mensaje genérico ante errores de base; exportar `handlers`, `auth`, `signIn` y `signOut`; verificar con `npx tsc --noEmit`
- [x] 4.2 Escribir `tests/auth-config.test.ts` sobre los callbacks y la configuración exportados: el token y la sesión contienen el id y no correo, hash ni `activo`, y `maxAge` es 7 días; verificar que pasa
- [x] 4.3 Crear la ruta `app/api/auth/[...nextauth]/route.ts` que expone los `handlers`; verificar con `npm run build` que compila y que `/api/auth/session` responde sin sesión
- [x] 4.4 Crear `app/login/page.tsx` con el formulario de correo y contraseña en español, una Server Action que llama a `signIn` y muestra un único mensaje ante credenciales inválidas y otro ante entrada mal formada o error de base; con `export const dynamic = "force-dynamic"`; verificar manualmente en `npm run dev` que el mensaje es el mismo para contraseña incorrecta, correo inexistente y responsable desactivado
- [x] 4.5 Crear `app/(privado)/panel/page.tsx` con `export const dynamic = "force-dynamic"` que muestra el nombre devuelto por `getPanel()`, redirige a `/login` si el acceso es rechazado, y un botón "Cerrar sesión" que usa una Server Action con `signOut({ redirectTo: "/login" })`; verificar con `npm run build` y manualmente que tras cerrar sesión `/panel` redirige al login
- [x] 4.6 Crear `proxy.ts` que redirige a `/login` a quien no tiene sesión en `/panel` y rutas privadas, lleva a `/panel` a quien ya tiene sesión y abre `/login`, no consulta la base y excluye `_next` y archivos estáticos; escribir `tests/proxy.test.ts` con peticiones sin cookie y verificar que pasa, y que la portada `/` no se redirige

## 5. Responsable inicial

- [x] 5.1 Crear `scripts/seed-responsable.ts` y el script `npm run db:seed-responsable`: valida las tres variables con Zod (correo válido, contraseña de al menos 12 caracteres), inserta con `ON CONFLICT (correo) DO NOTHING`, informa si ya existía, no imprime ningún valor secreto y no escribe en otras tablas; verificar que sin una variable termina con error que la nombra y que no crea filas
- [x] 5.2 Escribir `tests/seed-responsable.test.ts` contra la rama de pruebas sobre la función exportada del script: crea un responsable activo con hash distinto de la contraseña, segunda ejecución no duplica, no sobrescribe contraseña ni `activo` de un existente, rechaza contraseña corta y correo inválido sin escribir, y no toca otras tablas; verificar que `npm run db:test` pasa
- [x] 5.3 Verificar que el responsable creado por el seed puede iniciar sesión con `autenticarResponsable` en la rama de pruebas y que el repositorio no contiene la contraseña ni el hash (`git grep` de la contraseña de prueba sin resultados)

## 6. Documentación e integración

- [x] 6.1 Actualizar `CLAUDE.md` con `db:seed-responsable`, las variables nuevas, la regla de que `db:seed-responsable` escribe en producción y requiere confirmación, y la regla de que lo privado pasa por `requireResponsableActivo()`; verificar que cada comando documentado se ejecuta como está escrito y que el archivo no contiene valores reales
- [x] 6.2 Con confirmación del usuario, ejecutar `npm run db:seed-responsable` contra `production` y verificar con una consulta de solo lectura que existe una fila en `responsables` y que ninguna otra tabla cambió
- [x] 6.3 Desde la instalación actual, ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `responsable-access` e `initial-responsable` tiene al menos una prueba o una verificación manual anotada
- [x] 6.4 Verificación manual de punta a punta en `npm run dev`: iniciar sesión, desactivar a ese responsable directamente en la rama de pruebas o en una base local, recargar `/panel` y confirmar que se pierde el acceso sin esperar la caducidad; reactivar y confirmar que vuelve a entrar
- [x] 6.5 Ejecutar `openspec validate acceso-responsables --strict`; verificar que no reporta errores

## Workflow follow-up

- Archivar el cambio cuando se cumplan los requisitos de revisión del proyecto.
- Pasar el cambio por el `code-reviewer` antes de archivar.
- El ítem #4 (Patrón de escritura auditada) depende de este cambio y reutiliza `requireResponsableActivo()`.
- El límite de intentos de login queda para el ítem #14 (A5).
