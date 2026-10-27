# Respaldo y restauración de la base de producción

La base vive en Neon (Postgres). No hay copias propias: la recuperación depende del historial de Neon (ADR 0011).
Este documento no lleva cadenas de conexión ni contraseñas; esos valores están en `.env.local` y en Vercel.

## Qué tan atrás se puede volver

**6 horas.** Es el historial (`history_retention_seconds` = 21600) del proyecto de Neon de La FAZ, medido el
2026-10-27 en la cuenta real. Lo que se borre o se dañe y se descubra después de 6 horas **no se puede recuperar**
con este procedimiento. Es una ventana corta: si la ONG quiere más margen, decide una de estas dos cosas (fuera de
este ítem): un plan de Neon con más historial, o un volcado manual propio guardado fuera de Neon.

## Quién decide restaurar

Cualquier responsable avisa, pero decide la persona que mantiene la base (ver la decisión 6 de
`CHECKLIST-PUBLICACION.md`). Restaurar **descarta todo lo registrado después del instante elegido**: antes de
hacerlo se anota qué se registró desde entonces (donaciones, inscripciones) para volver a cargarlo a mano.

## Pasos

1. **Parar los registros.** Pedir a los responsables que no registren nada mientras se restaura.
2. **Elegir el instante** (hora UTC, dentro de las últimas 6 horas) justo antes del daño.
3. **Crear una instantánea de la rama `production`** en ese instante (consola de Neon: Backups/Snapshots, o la
   herramienta `create_snapshot` con `timestamp`). Ponle un nombre claro y una fecha de vencimiento.
4. **Restaurarla en una rama nueva, sin mover los cómputos** (consola de Neon, o `restore_snapshot` con
   `finalize: false`). Así `production` no se toca mientras se revisa.
5. **Comprobar la rama restaurada** con conteos (se puede hacer en el editor SQL de Neon, solo lectura):

   ```sql
   select (select count(*) from proyectos) as proyectos,
          (select count(*) from apoyantes) as apoyantes,
          (select count(*) from donaciones) as donaciones,
          (select count(*) from voluntarios_inscritos) as voluntarios,
          (select count(*) from responsables) as responsables,
          (select count(*) from audit_log) as audit_log;
   ```

   Los números deben ser los de antes del daño. Si no lo son, borrar esa rama y repetir con otro instante.
6. **Ponerla en producción.** Dos caminos, el primero es el recomendado:
   - En la consola de Neon, hacer que la rama restaurada sea la principal (por ejemplo, restaurar con el cómputo
     movido: `finalize`), y **guardar el nombre de la rama anterior** hasta confirmar que todo funciona; o
   - dejar la rama nueva y cambiar `DATABASE_URL`, `DATABASE_URL_UNPOOLED` y `DATABASE_URL_PUBLICO` en Vercel por las
     cadenas de la rama nueva y volver a desplegar.
7. **Volver a aplicar los permisos del rol público** en la base restaurada (es repetible y no cambia nada si ya
   están): `npm run db:rol-publico -- --confirmar-produccion`. Después, `npm run db:check`.
8. **Probar** la web pública (proyectos con su avance), el login, la lista de donaciones y `/voluntarios`.
9. **Limpiar:** borrar la instantánea y la rama anterior solo cuando todo esté confirmado.

## Ensayo realizado

- **Fecha:** 2026-10-27.
- **Qué se hizo:** instantánea de `production` con `timestamp` de una hora antes; restauración en una rama temporal
  con `finalize: false`; conteos en producción y en la rama restaurada; borrado de la rama y de la instantánea.
- **Resultado:** los conteos coincidieron (4 proyectos, 0 apoyantes, 0 donaciones, 0 voluntarios inscritos, 1
  responsable, 0 registros de historial). `production` siguió siendo la rama principal y no cambió.
- **Tiempo:** la restauración quedó lista en unos segundos (con una base de ~32 MB).
- **Observación:** pedí el instante 14:06 UTC y Neon restauró al punto que figura como 13:21 UTC (`parent_timestamp`
  de la rama). **Compara siempre el instante real de la rama restaurada con el que pediste** antes de darla por buena.
- **Limitación del ensayo:** la base tenía casi solo los datos iniciales; no se ensayó con donaciones reales.
- **Hecho aparte, no ensayado:** el paso 6 (poner la rama restaurada en producción) no se ejecutó para no tocar
  producción. Antes de depender de este procedimiento, ensáyalo una vez en la rama de pruebas.
