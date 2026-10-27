# Lista de verificación antes de publicar

Lo que el código no puede resolver por sí solo. Mientras haya puntos sin marcar, el sitio **no se despliega** y la
base de producción **no se migra** (decisión del usuario, ítem #14). Ninguna sección de este archivo lleva cuentas,
contraseñas ni cadenas de conexión: esos valores van solo en `.env.local` y en Vercel.

## A. Decisiones de la ONG

| # | Decisión | Quién decide | Qué cambia en el sistema al resolverla | Estado |
|---|---|---|---|---|
| 1 | Texto legal definitivo del consentimiento del formulario de voluntariado (finalidad, quién ve los datos, plazo de conservación) revisado con la ley peruana de protección de datos personales | La ONG, con asesoría legal | Se edita `CONSENTIMIENTO_VOLUNTARIADO` en `lib/sitio-contenido.ts` (texto y `version`) y se quita el aviso de "provisional". Las inscripciones nuevas guardan la versión nueva | Pendiente |
| 2 | Canal de contacto para que una persona pida corregir o dar de baja sus datos (correo o WhatsApp) | La ONG | Se incorpora al texto del punto 1. Hoy dice "a través de los responsables de La FAZ" | Pendiente |
| 3 | Qué se hace cuando alguien pide la baja de sus datos (hoy el sistema no borra ni anonimiza apoyantes) | La ONG; si se quiere automatizar, actualizar el PRD primero | Si se decide borrar o anonimizar, es un cambio nuevo con su propio change | Pendiente |
| 4 | Términos vigentes de Vercel Hobby para una web que pide donaciones (A10), incluido el uso no comercial | La ONG (leer los términos en vercel.com/legal) | Si no encaja, se elige otro plan o alojamiento antes de desplegar | Pendiente |
| 5 | Datos de la sección "Cómo donar": hoy son de demostración con aviso visible. Poner cuentas reales es una decisión aparte (el repositorio no debe contener cuentas reales) | La ONG | Si se usan cuentas reales, cambia la política de datos de cuenta y hay que actualizar el TDD primero | Pendiente |
| 6 | Quién mantiene la web y la base después del curso (riesgo abierto del PRD) | La ONG | Define quién recibe los avisos y quién ejecuta `RESPALDO.md` | Pendiente |
| 7 | Quiénes serán los responsables con acceso y cómo se crean sus cuentas (hoy se siembra uno con `db:seed-responsable`) | La ONG | Gestionar más responsables hoy no tiene pantalla (A5 completa, fuera del PRD) | Pendiente |

## B. Orden de publicación

Cada paso que escribe en producción se confirma antes con quien lo ejecuta. No saltar pasos ni cambiar el orden: si
la aplicación se publica antes de las tablas y las conexiones, el formulario y las páginas públicas fallan.

1. [ ] Puntos 1, 2 y 4 de la sección A resueltos (o aceptado conscientemente el riesgo).
2. [ ] Pruebas verdes en la rama de pruebas: `npm run db:test`, `npm run build`, `npm run lint`.
3. [ ] Respaldo ensayado y `RESPALDO.md` completo (ver ese archivo).
4. [ ] Comprobar que `voluntarios_inscritos` está vacía en producción (la migración agrega una columna `NOT NULL`).
5. [ ] Migrar producción con `npm run db:migrate` (aplica la columna de consentimiento del #13 y la tabla de intentos).
6. [ ] Crear el rol público en producción: `PUBLICO_LECTURA_PASSWORD=… npm run db:rol-publico -- --confirmar-produccion`
   (contraseña de 24 o más caracteres, solo en el entorno de ese comando).
7. [ ] Crear al primer responsable con `npm run db:seed-responsable`; quitar su contraseña de `.env.local` después.
8. [ ] Commit y push del repositorio (decidir rama y qué archivos se incluyen; `.env*` nunca).
9. [ ] En Vercel (proyecto Hobby enlazado al repositorio), variables de Production: `DATABASE_URL`,
   `DATABASE_URL_PUBLICO` (cadena *pooled* del rol `publico_lectura`) y `AUTH_SECRET` (distinto del local).
10. [ ] Comprobar que `DATABASE_URL_PUBLICO` es de verdad el rol de solo lectura: conectar con esa cadena y ejecutar
    `select current_user` (debe decir `publico_lectura`) y `select count(*) from apoyantes` (debe fallar con "permission denied").
    Si en Vercel se pone la cadena del propietario, todo funciona pero el aislamiento queda anulado sin avisar.
11. [ ] Desplegar y probar en la URL pública: inicio, proyectos (barras), "Cómo donar" con su aviso, enviar el
    formulario de voluntariado, entrar a la zona privada, ver la lista de voluntarios y comprobar que el contacto solo
    sale en el detalle del apoyante.
12. [ ] Probar el bloqueo de login con un correo inexistente (5 intentos fallidos) y anotar la fecha de la prueba.

## C. Lo que queda abierto aun después de publicar

- Sin captcha: el spam del formulario solo está limitado por IP y el campo trampa.
- Una inscripción repetida crea un apoyante repetido; no hay pantalla para anular o borrar inscripciones.
- El formulario escribe con la conexión de la aplicación, no con un rol que solo inserte.
- Cumplimiento legal completo (derechos de acceso, cancelación y retención) más allá del consentimiento.
