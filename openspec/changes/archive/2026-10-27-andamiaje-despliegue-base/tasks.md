# Tasks

## 1. Andamiaje de Next.js

- [x] 1.1 Generar el proyecto con `create-next-app` (App Router, TypeScript, Tailwind, ESLint, sin `src/` si el valor por defecto lo permite) en el directorio temporal de la sesión; verificar que contiene `package.json`, `app/` y la configuración de TypeScript y Tailwind
- [x] 1.2 Copiar los archivos generados a la raíz sin sobrescribir `CLAUDE.md`, `PRD.md`, `TECH-DESIGN.md`, `BACKLOG.md`, `adrs/`, `openspec/`, `.claude/`, `.agents/` ni `old/`; verificar con `git status` que ninguno de esos archivos aparece modificado
- [x] 1.3 Reemplazar el `.gitignore` vacío por el de Next.js más `.env*` con excepción de `!.env.example`; verificar con `git check-ignore .env.local` que queda ignorado y que `.env.example` no
- [x] 1.4 Declarar `engines.node >= 20` en `package.json` y dejar los scripts `dev`, `build` y `start`; verificar que `npm install` termina sin errores
- [x] 1.5 Reemplazar la página inicial generada por una página provisional estática ("ONG La FAZ – en construcción") sin consultas a datos; verificar con `npm run dev` que `/` responde 200 y no muestra contenido de plantilla de Next.js
- [x] 1.6 Ejecutar `npm run build` y `npm run start` sin variables de entorno de base de datos; verificar que el build termina con código 0 y `/` responde 200

## 2. Conexión a Neon

- [x] 2.1 Instalar `drizzle-orm`, `@neondatabase/serverless`, `ws`, `server-only` y, como dependencias de desarrollo, `drizzle-kit`, `tsx` y `@types/ws`; verificar que `package.json` no contiene ninguna dependencia de pagos o bancos
- [x] 2.2 Crear `lib/db-client.ts` con la fábrica del cliente Drizzle sobre `Pool` de Neon (`drizzle-orm/neon-serverless`), con `neonConfig.webSocketConstructor` asignado a `ws` y lectura perezosa de `DATABASE_URL` que lanza un error con el nombre de la variable y sin imprimir valores; verificar con una invocación sin la variable que el mensaje nombra `DATABASE_URL`
- [x] 2.3 Crear `lib/db.ts` con `import "server-only"` que reexporta el cliente; verificar que `npm run build` sigue pasando sin `DATABASE_URL` y que importar `lib/db.ts` desde un componente cliente falla en compilación (comprobación manual puntual, sin dejar el código de prueba)
- [x] 2.4 Crear `.env.example` con `DATABASE_URL` y un marcador de formato sin host, usuario ni contraseña reales; verificar con una búsqueda que el repositorio no contiene ninguna cadena de conexión real
- [x] 2.5 El usuario crea el proyecto en Neon (free tier), elige la región y copia la cadena de conexión *pooled* a `.env.local`; verificar que `.env.local` existe, está ignorado por git y no se muestra en el chat
- [x] 2.6 Crear `scripts/db-check.ts` y el script `npm run db:check` (`tsx --env-file=.env.local`) que ejecuta `select 1`, una transacción confirmada y una revertida sobre una tabla efímera que el propio script crea y borra, e informa el resultado; verificar que con `.env.local` correcto termina con código 0 y que sin la variable termina con error que nombra `DATABASE_URL`
- [x] 2.7 Verificar que la transacción revertida de `db:check` no deja filas y que la confirmada sí (salida del script) y que el script no imprime la cadena de conexión en ningún caso

## 3. Despliegue en Vercel Hobby

- [ ] 3.1 Confirmar con el usuario antes de hacer commit y push de los archivos del andamiaje a `origin/main` (o a una rama); verificar con `git status` y `git log` que no se versionó ningún `.env*` salvo `.env.example` **PARCIAL (2026-10-27): el commit existe en la rama `mvp-donaciones-la-faz`; el push a `origin` queda pendiente de que el usuario lo pida. Aplazada a la publicación (`CHECKLIST-PUBLICACION.md`).**
- [ ] 3.2 El usuario enlaza el repositorio `Fioruiz/la-faz` a un proyecto de Vercel Hobby y define `DATABASE_URL` para Production y Preview; verificar en la configuración del proyecto que la variable existe y que el framework detectado es Next.js **APLAZADA a la publicación (decisión del usuario, 2026-10-27): ver `CHECKLIST-PUBLICACION.md`.**
- [ ] 3.3 Lanzar el despliegue desde el repositorio; verificar que el build en Vercel termina correctamente y que la URL pública responde 200 con la página provisional **APLAZADA a la publicación (decisión del usuario, 2026-10-27): ver `CHECKLIST-PUBLICACION.md`.**
- [ ] 3.4 Probar la conexión con `ws` en el entorno de Vercel con una comprobación puntual y temporal (por ejemplo, una ejecución de `db:check` contra la base de preview desde local con la misma cadena y la revisión del log de la función); verificar que no queda ninguna ruta de diagnóstico en el código desplegado **APLAZADA a la publicación (decisión del usuario, 2026-10-27): ver `CHECKLIST-PUBLICACION.md`.**

## 4. Documentación

- [x] 4.1 Actualizar la sección de comandos de `CLAUDE.md` con los scripts reales (`npm install`, `npm run dev`, `npm run build`, `npm run start`, `npm run db:check`), eliminar las marcas `REVISAR` sobre ellos y la nota de que no existe `package.json`; verificar que cada comando documentado se ejecuta como está escrito
- [x] 4.2 Anotar en `CLAUDE.md` la variable `DATABASE_URL` y la regla de que no se versiona; verificar que `CLAUDE.md` no contiene ningún valor real

## 5. Verificación de integración

- [x] 5.1 En un clon limpio del repositorio (o con `git stash` y carpeta nueva), ejecutar `npm install` y `npm run build`; verificar código de salida 0 y que los requisitos de `specs/app-deployment` y `specs/database-connection` se cumplen uno a uno
- [x] 5.2 Ejecutar `openspec validate andamiaje-despliegue-base --strict`; verificar que no reporta errores

## Workflow follow-up

- Revisar los artefactos y los resultados antes de archivar el cambio con `/opsx:archive`.
- El ítem #2 (esquema de base de datos) no se inicia en este cambio.
