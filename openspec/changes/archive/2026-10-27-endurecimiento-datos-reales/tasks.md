# Tasks

## 1. Rol de solo lectura (módulo y script)

- [x] 1.1 Crear `lib/rol-publico.ts` (sin Next) con el nombre del rol y las constantes de permisos: `SELECT` sobre `proyectos`, `items_meta` y las columnas `id, proyecto_id, item_id, tipo, cantidad, monto, anulada` de `donaciones`; verificar con `npx tsc --noEmit`
- [x] 1.2 Crear `scripts/crear-rol-publico.ts` y el script `npm run db:rol-publico` (`tsx --env-file-if-exists=.env.local --env-file-if-exists=.env.test`): lee `PUBLICO_LECTURA_PASSWORD` (≥ 24 caracteres, error claro si falta, nunca la imprime), usa `DATABASE_URL_UNPOOLED` (o `DATABASE_URL_TEST` con `--prueba`), crea el rol si no existe, `REVOKE ALL` y los `GRANT` de `lib/rol-publico.ts`, `ALTER` de la contraseña solo con `--rotar`, y exige `--confirmar-produccion` si el destino es la base real; verificar ejecutándolo dos veces contra la rama de pruebas (sin error la segunda vez) y que sin la variable termina con mensaje claro y sin crear nada
- [x] 1.3 Ejecutar el script contra la **rama de pruebas** y añadir `DATABASE_URL_TEST_PUBLICO` a `.env.test` y a `.env.example`; verificar que una conexión con ese rol ejecuta `select 1`

## 2. Conexión pública separada

- [x] 2.1 Crear `lib/db-publico.ts` (`server-only`, `Pool` perezoso sobre `DATABASE_URL_PUBLICO`, error claro si falta y sin caída a `DATABASE_URL`) y cambiar `lib/public-queries.ts` a `crearLecturasPublicas(() => getDbPublico())`; verificar con `npx tsc --noEmit` y `npm run build`
- [x] 2.2 Escribir `tests/rol-publico.test.ts` contra la rama de pruebas con una conexión del rol (`DATABASE_URL_TEST_PUBLICO`): el avance y los proyectos públicos coinciden con los de la conexión plena; `42501` al leer `apoyantes`, `voluntarios_inscritos`, `responsables` y `audit_log`, al seleccionar `apoyante_id`, `medio`, `registrado_por` y `descripcion_producto` de `donaciones`, y al insertar, actualizar y borrar; falla con un mensaje claro si la variable no está definida; verificar con `npm run db:test`
- [x] 2.3 Actualizar `tests/public-estructura.test.ts`: lo público obtiene la base solo por `db-publico`, `lib/db-publico.ts` no se importa desde lo privado ni desde `voluntariado-inscripcion`, `lib/public-queries*.ts` no usa `getDb`, y falta de `DATABASE_URL_PUBLICO` no cae a `DATABASE_URL`; verificar que pasa
- [x] 2.4 Probar con mutaciones temporales (volver `public-queries` a `getDb()`, conceder `SELECT` de `apoyantes` en `lib/rol-publico.ts`, añadir caída a `DATABASE_URL`) y revertirlas; verificar que cada una hace fallar una prueba

## 3. Contadores de intentos

- [x] 3.1 Añadir `intentosLimitados` (`tipo` con CHECK en `login`/`formulario`, `clave`, `creado_en`, índice `(tipo, clave, creado_en)`) a `lib/schema.ts`, generar la migración con `npm run db:generate` y aplicarla a la rama de pruebas con `npm run db:test:migrate`; verificar que el SQL solo crea esa tabla y que `npm run db:test` sigue pasando
- [x] 3.2 Crear `lib/limite-intentos.ts` (sin Next, recibe `db`): `claveHmac(valor)` con clave derivada de `AUTH_SECRET`, `estaBloqueado`, `registrarIntento` (con limpieza de filas de más del doble de la ventana) y `limpiarIntentos`; verificar con `tests/limite-intentos.test.ts` (ventana móvil con `creado_en` pasado, claves distintas independientes, limpieza, la tabla no guarda valores en claro, tipo inválido rechazado por el CHECK)

## 4. Límite de intentos de login

- [x] 4.1 Aplicar el límite en `lib/auth-credentials.ts` (`autenticarResponsable`): bloqueado → `LoginBloqueadoError` antes de leer al responsable; fallo (incluidos correo inexistente y desactivado) → `registrarIntento`; acierto → `limpiarIntentos`; falla de la base → error genérico, nunca acceso; la clave es el correo normalizado con HMAC; verificar con `npx tsc --noEmit`
- [x] 4.2 Traducir `LoginBloqueadoError` en `app/login/actions.ts` a "Demasiados intentos. Espera 15 minutos…" (mismo texto para correos existentes e inexistentes) sin tocar los demás mensajes; verificar con `npm run build`
- [x] 4.3 Ampliar `tests/auth-credentials.test.ts`: 5 fallos bloquean aunque la contraseña sea correcta, correo inexistente bloquea igual y con el mismo error, acierto limpia los fallos, el bloqueo termina a los 15 minutos, base caída → no accede; y una prueba de que `lib/auth.ts` usa `autenticarResponsable` (cubre la llamada directa); verificar con `npm run db:test`

## 5. Límite del formulario público

- [x] 5.1 Añadir `opciones.claveIp` a `inscribirVoluntario()` (`lib/voluntariado-inscripcion-core.ts`) con el orden límite → campo trampa → validación → transacción: registra el intento antes de decidir, 5 por hora, resultado `limite` con mensaje y `valores`, y falla de la base del contador → error genérico con `valores`; verificar con `npx tsc --noEmit`
- [x] 5.2 En `app/(publico)/voluntariado/actions.ts` calcular la clave con `headers()` (`x-forwarded-for`, primer valor, HMAC; sin IP → clave fija) y mostrar el mensaje de límite en `formulario.tsx` conservando lo escrito; verificar con `npm run build` y `npm run lint`
- [x] 5.3 Ampliar `tests/voluntariado-inscripcion.test.ts`: sexto envío de una IP no guarda nada, otra IP pasa, el envío del campo trampa y el inválido cuentan, la tabla no tiene IP legible ni datos del formulario, base caída en el contador no guarda; y actualizar `tests/voluntariado-estructura.test.ts` para el nuevo orden; verificar con `npm run db:test`
- [x] 5.4 Probar con mutaciones temporales (quitar `registrarIntento` en el login, guardar el correo o la IP en claro, mover el límite después de la validación) y revertirlas; verificar que cada una hace fallar una prueba

## 6. Respaldo y lista de verificación

- [x] 6.1 Con la confirmación del usuario y en una **rama aparte** de Neon (nunca modificando producción), ensayar la restauración a un instante anterior: crear la rama, comprobar conteos de proyectos, apoyantes, donaciones y voluntarios, medir el tiempo, borrar la rama y anotar la ventana real de recuperación del plan; verificar que la rama de ensayo ya no existe y que producción no cambió
- [x] 6.2 Escribir `RESPALDO.md` con los pasos, la ventana real, qué se pierde, quién decide y el resultado del ensayo con su fecha, sin cadenas de conexión; verificar leyéndolo contra los escenarios de `disaster-recovery`
- [x] 6.3 Escribir `CHECKLIST-PUBLICACION.md`: decisiones de la ONG (texto legal definitivo y canal de contacto para baja, términos de Vercel Hobby), con dueño, efecto en el sistema y estado, y el orden de publicación (migrar producción, crear el rol público, variables de Vercel, desplegar); verificar que no contiene secretos y que el orden coincide con el diseño

## 7. Documentación e integración

- [x] 7.1 Escribir `adrs/0011-endurecimiento-antes-de-datos-reales.md` (rol de solo lectura por columnas, conexión pública sin respaldo, contadores en Postgres, límites y riesgos) y marcar el 0006 y el 0007 como parcialmente reemplazados con un enlace; verificar que los enlaces existen
- [x] 7.2 Actualizar `CLAUDE.md` (rol público y `DATABASE_URL_PUBLICO`, `db:rol-publico`, límites y sus constantes, la regla de que la conexión pública no cae a la plena, y que publicar espera la lista de verificación) y `.env.example` (`DATABASE_URL_PUBLICO`, `PUBLICO_LECTURA_PASSWORD`, `DATABASE_URL_TEST_PUBLICO`); verificar que coincide con el código
- [x] 7.3 Ejecutar `npm run build`, `npm run lint`, `npx tsc --noEmit` y `npm run db:test`; verificar código de salida 0 y que cada requisito de `public-read-isolation`, `rate-limiting` y `disaster-recovery` tiene al menos una prueba o una verificación manual anotada
- [x] 7.4 Ejecutar `openspec validate endurecimiento-datos-reales --strict`; verificar que no reporta errores

## Workflow follow-up

- Pasar el cambio por el `code-reviewer` antes de archivar y archivarlo cuando se cumplan los requisitos de revisión del proyecto.
- Nada se aplica en producción en este change. Con la lista de verificación resuelta por el usuario, publicar es: `db:migrate` (incluye la migración pendiente de #13), `db:rol-publico`, variables de Vercel y despliegue, cada paso con su confirmación.
