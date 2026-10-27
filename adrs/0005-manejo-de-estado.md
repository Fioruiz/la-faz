# ADR 0005: Postgres como única fuente de verdad y páginas dinámicas sin caché

## Estado

Aceptado

## Contexto

Por el [ADR 0003](0003-contratos-server-actions.md), las lecturas se hacen en el servidor y la
fuente de verdad es Postgres ([ADR 0002](0002-modelo-de-datos.md)). Hay que decidir qué pasa con
lo ya renderizado tras una escritura. Los criterios de éxito del PRD exigen que "la barra de
avance pública coincide exactamente con lo registrado en la zona privada" y que un responsable
vea cuánto falta de una meta en menos de 30 segundos. El caché de Next.js podría mostrar un avance
viejo si se cachean las páginas públicas.

## Decisión

Las páginas públicas y privadas se renderizan de forma dinámica, sin caché: cada visita consulta
Postgres. No hay lógica de invalidación. En el cliente solo vive estado local de interfaz
(formularios, filtros); tras cada Server Action se refresca la vista con los datos del servidor.
No se usa una librería de estado global.

## Alternativas consideradas

- **Páginas públicas en caché con revalidación bajo demanda (`revalidatePath`/`revalidateTag`)** —
  rápido y con pocas consultas, pero cada acción que cambia el avance debe acordarse de invalidar,
  y olvidarlo deja la barra desactualizada sin aviso. No se eligió por el riesgo de romper la
  coincidencia exacta.
- **Caché con revalidación por tiempo (por ejemplo, 60 s)** — simple y reduce consultas, pero la
  barra pública puede ir hasta 60 segundos atrasada, lo que contradice "coincide exactamente". No
  se eligió.

## Consecuencias

- El avance público es exacto en cada visita y no hay invalidación que mantener ni olvidar.
- Costo: cada visita pública ejecuta consultas a Neon; con el tráfico esperado de una ONG pequeña
  es trivial, pero un pico (por ejemplo, una difusión viral) llega directo a la base y a las
  funciones de Vercel free tier.
- Costo: en Neon free tier la base se suspende por inactividad y la primera visita tras un periodo
  sin uso paga un arranque en frío de aproximadamente un segundo.
- Si el tráfico creciera, habría que reabrir esta decisión e introducir caché con invalidación.
