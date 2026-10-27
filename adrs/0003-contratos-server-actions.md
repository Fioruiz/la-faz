# ADR 0003: Server Actions y Server Components como contrato entre interfaz y servidor

## Estado

Aceptado

## Contexto

Con una sola aplicación Next.js ([ADR 0001](0001-aplicacion-unica-nextjs.md)) no hay una API entre
componentes separados. Hay que definir cómo la interfaz habla con el servidor para las
operaciones del PRD: escrituras privadas (registrar, editar y anular donaciones; crear proyectos;
gestionar apoyantes), la escritura pública del formulario de voluntariado, y las lecturas de la
barra de avance pública y los reportes privados. El PRD no menciona ningún consumidor externo de
datos y la app móvil está en "No alcance".

## Decisión

Todas las escrituras se hacen con Server Actions y todas las lecturas con consultas directas a
Postgres desde Server Components. No se expone una API REST. Cada Server Action:

- valida su entrada con un esquema (por ejemplo, Zod);
- comprueba dentro de la acción que quien llama es un responsable activo (salvo la acción pública
  del formulario de voluntariado);
- ejecuta el cambio y su registro en `audit_log` en una misma transacción
  (ver [ADR 0002](0002-modelo-de-datos.md)).

## Alternativas consideradas

- **Route Handlers REST (`/api/...`) para todo** — contrato explícito, probable con curl o
  Postman y abierto a otros clientes. No se eligió porque exige más código repetitivo (rutas,
  validación, serialización, estado de carga) y mantener tipos sincronizados para ~3 usuarios y
  sin consumidores externos.
- **Híbrido: Server Actions más un `GET /api/avance` público de solo lectura** — daría un punto
  estable para incrustar el avance en otro sitio, pero son dos mecanismos que mantener y el PRD
  no pide ningún consumidor externo. No se eligió; podría añadirse después si surge la necesidad.

## Consecuencias

- Menos código y sin contrato REST que documentar ni versionar; las acciones son funciones
  tipadas.
- Costo: no hay una API que otro cliente pueda consumir, y probar las acciones con herramientas
  externas es más difícil; las pruebas deben hacerse sobre las funciones o desde la interfaz.
- Costo: la autorización debe comprobarse dentro de cada Server Action, no solo ocultando botones
  en la interfaz; olvidarla en una acción deja esa operación abierta.
- Las Server Actions quedan acopladas a Next.js, lo que refuerza la dependencia señalada en el
  ADR 0001.
