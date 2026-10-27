# ADR 0006: Aviso blando de duplicados, honeypot en formulario público y errores transaccionales

## Estado

Aceptado. Reemplazado en parte por el [ADR 0011](0011-endurecimiento-antes-de-datos-reales.md): el formulario público ahora tiene un límite de envíos por IP, además del honeypot.

## Contexto

El PRD define casos borde que son requisitos de integridad: aviso de duplicados antes de guardar
(mismo donante, monto, fecha y proyecto), nada se borra sino que se anula, y cada cambio deja
quién y cuándo ([ADR 0002](0002-modelo-de-datos.md)). El formulario de voluntariado es público y
recibe entradas de cualquiera. El riesgo operativo es bajo (~3 responsables, proyecto de prueba),
pero la base en Neon free tier puede tardar en despertar o fallar ([ADR 0005](0005-manejo-de-estado.md)).

## Decisión

- **Duplicados (6a-A):** aviso blando en la aplicación. Antes de guardar, la Server Action busca
  una donación igual (mismo donante, monto, fecha y proyecto); si existe, devuelve una advertencia
  y el responsable puede confirmar "Guardar de todos modos". No hay restricción `UNIQUE` en la
  base.
- **Formulario público de voluntariado (6b-A):** validación en servidor con un esquema (Zod),
  campo trampa (honeypot) y límites de longitud. Sin captcha ni límite por IP.
- **Convenciones por defecto** (propuestas por el agente y no objetadas por el usuario):
  - los errores de validación se devuelven como mensajes en el formulario sin perder lo escrito;
  - los fallos de la base muestran un mensaje genérico al usuario y el detalle va al log de
    Vercel;
  - cada escritura y su registro en `audit_log` ocurren en una sola transacción;
  - si la base no responde, la zona pública muestra una página de error amable, nunca un avance
    en cero.

## Alternativas consideradas

- **Restricción `UNIQUE` en Postgres para duplicados** — imposible duplicar por accidente, pero
  bloquea donaciones legítimas idénticas (dos packs del mismo donante el mismo día) y el PRD dice
  "avisa", no "impide". No se eligió.
- **Honeypot más captcha (por ejemplo, Cloudflare Turnstile)** — protege mejor del spam, pero
  añade una dependencia externa y fricción para el voluntario; desproporcionado para un proyecto
  de prueba. No se eligió.
- **Honeypot más límite de envíos por IP** — frena abusos repetidos, pero añade lógica y una tabla
  o servicio extra (por ejemplo, Upstash). No se eligió.

## Consecuencias

- Las donaciones idénticas legítimas no se bloquean y el comportamiento coincide con el PRD
  ("avisa").
- Costo: el aviso de duplicados depende de que el responsable lo lea; dos registros iguales
  pueden quedar guardados por descuido. Tampoco cubre dos envíos simultáneos, porque la
  comprobación no es atómica.
- Costo: el honeypot detiene bots básicos pero no a un atacante decidido; el formulario público
  puede recibir spam o inscripciones falsas, que un responsable tendría que anular a mano.
- La transacción única evita estados a medias (donación guardada sin historial).
- Las convenciones de error son sencillas y no incluyen reintentos automáticos ni monitoreo más
  allá del log de Vercel; un fallo de la base se ve como página de error hasta que se recupere.
