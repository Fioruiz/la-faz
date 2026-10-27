# ADR 0001: Aplicación única Next.js (App Router) desplegada en Vercel

## Estado

Aceptado

## Contexto

El PRD pide "una sola aplicación, una sola base de datos", con una zona pública (presentación,
proyectos, barra de avance, "Cómo donar", formulario de voluntariado) y una zona privada (login
para ~3 responsables). El criterio de éxito "la barra de avance pública coincide exactamente con
lo registrado en la zona privada" exige que ambas zonas lean los mismos datos.

Restricciones obligatorias dadas por el usuario:

- Proyecto greenfield.
- Debe poder desplegarse en Vercel free tier desde un repositorio.
- La persistencia debe ser PostgreSQL, alojado en Neon.

Restricciones prácticas: un solo desarrollador, plazo corto (10 Derechos es en noviembre), ~3
usuarios internos. La web pública también debe poder compartirse en redes para generar confianza
en donantes. El plan Hobby de Vercel es para uso no comercial; encaja con una ONG de prueba.

## Decisión

Un único proyecto Next.js (App Router) en un solo repositorio y un solo despliegue en Vercel. Las
páginas públicas se renderizan en el servidor leyendo de Neon Postgres, y la zona privada usa
Server Actions / Route Handlers sobre la misma base de datos. No hay API ni repo separados.

## Alternativas consideradas

- **Vite + React (SPA) con funciones serverless en `/api` del mismo repo** — respeta el stack
  previsto en `CLAUDE.md` y separa frontend y backend, pero la zona pública sería una SPA (peor
  SEO y previsualización de enlaces) y obliga a definir y mantener un contrato de API y reglas de
  rutas en `vercel.json`. No se eligió por tener más piezas sin beneficio claro para este alcance.
- **Dos repos y dos despliegues (frontend y API separados)** — viable, pero duplica configuración,
  CORS y entornos para un equipo de una persona y ~3 usuarios internos. No se eligió por
  sobreingeniería.

## Consecuencias

- Una sola base de código y un solo despliegue: la barra pública y la zona privada salen de las
  mismas consultas, lo que facilita cumplir el criterio de coincidencia exacta.
- Páginas públicas renderizadas en servidor: mejor SEO y previsualización de enlaces en redes.
- Se aparta del stack previsto en `CLAUDE.md` (React + Vite), que estaba marcado `REVISAR`; habrá
  que actualizar ese archivo (sección de stack y comandos) cuando se cree el proyecto.
- Costo: más conceptos que dominar (Server Components, Server Actions, caché de Next.js) y
  acoplamiento a Next.js; migrar a otro hosting sería más trabajo que con una SPA estática.
- Las funciones serverless de Vercel free tier tienen límites de tiempo y ejecución; la carga
  esperada (~3 responsables y tráfico público bajo) los respeta, pero conviene vigilarlo.
