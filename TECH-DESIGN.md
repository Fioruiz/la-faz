# Technical Design Document (v2): Sistema de donaciones y control de proyectos – ONG La FAZ

**Versión:** 2. Reemplaza en vigencia a `TECH-DESIGN.md` (v1), que se conserva sin cambios para
versionamiento. Los ADR 0001–0007 tampoco se modifican; los cambios de esta versión viven en los ADR
0008–0010.
**Tipo de proyecto:** Greenfield.
**Design.md disponible:** No. El modelo de datos se derivó solo del PRD.

**Restricciones obligatorias (dadas por el usuario):** debe poder desplegarse en Vercel free tier
desde un repositorio, y la persistencia es PostgreSQL en Neon.

**Restricción de pagos (aclarada por el usuario en la v2):** el proyecto es real, con personas y
datos reales, pero **no hay ningún cobro ni transacción bancaria desde el sistema**. Los medios de
pago (Yape, Plin, transferencia, transferencia internacional) se presentan como simulación (demo) y el
sistema no se conecta a bancos ni a pasarelas. Las donaciones en dinero que se registran en la zona
privada son un **registro** de lo que el responsable declara haber recibido, no una operación de
cobro. Consecuencias de diseño:

- No se incluye ningún SDK, webhook ni credencial de pago o de banco.
- Los datos de cuenta de "Cómo donar" son ficticios y se identifican como demostración.
- No se almacenan números de cuenta, tarjeta ni credenciales bancarias de donantes.
- Al ser un proyecto real, **los datos de donantes y voluntarios sí son reales**: no se puede justificar
  una decisión de seguridad con "es solo una prueba" (ver A1 en pendientes).

## Cambios respecto a la v1

Esta versión corrige solo los tres hallazgos **críticos** de la revisión adversarial. Los hallazgos de
nivel Advertencia y Sugerencia **siguen abiertos** (ver "Pendientes de la revisión").

| Hallazgo | Qué cambia | ADR |
|---|---|---|
| C1 | `donaciones` ya no admite combinaciones incoherentes de proyecto e ítem; se define qué es "Sin asignar" para productos | [0008](adrs/0008-integridad-proyecto-item-y-sin-asignar.md) |
| C2 | La comprobación de responsable activo se hace en la capa de datos privada, para lecturas y escrituras | [0009](adrs/0009-autorizacion-en-capa-de-datos-privada.md) |
| C3 | "Falta en soles" descuenta el dinero recibido del proyecto | [0010](adrs/0010-falta-en-soles-descuenta-dinero-recibido.md) |

## Resumen

Se construye una única aplicación web para la ONG La FAZ, con una zona pública (presentación,
proyectos con barra de avance, "Cómo donar", formulario de voluntariado) y una zona privada con
login para ~3 responsables (proyectos con metas por ítem, donaciones en dinero o en producto,
avance, apoyantes y voluntarios, reporte en pantalla e historial de cambios). Ambas zonas leen la
misma base PostgreSQL en Neon, de modo que la barra pública coincide exactamente con lo registrado,
como pide `PRD.md`. La prioridad es el control interno; la web pública muestra esos mismos datos.

## Arquitectura de componentes

Un solo componente desplegable (sin repos ni API separados):

- **Aplicación Next.js (App Router, TypeScript, Tailwind)** en Vercel, con dos zonas:
  - **Zona pública:** Server Components que leen únicamente a través de un módulo de lecturas
    públicas ([ADR 0007](adrs/0007-separacion-datos-publicos.md)). Único punto de escritura: el
    formulario de voluntariado (Server Action pública con honeypot).
  - **Zona privada:** protegida por Auth.js con credenciales. **Toda lectura y escritura pasa por un
    módulo de acceso privado cuya primera operación es comprobar en la base que el responsable existe
    y está activo** ([ADR 0009](adrs/0009-autorizacion-en-capa-de-datos-privada.md)). Las escrituras
    son Server Actions que validan con Zod y escriben el cambio más `audit_log` en una transacción.
    El `proxy`/middleware solo redirige al login a quien no tiene sesión; no es la barrera de
    seguridad.
- **Neon Postgres**, accedido con Drizzle y el driver `@neondatabase/serverless`, con una sola
  conexión y un solo rol.

```
Visitante ──▶ Zona pública (Server Components) ──▶ lib/public-queries ──────────┐
                                                                                 ├──▶ Neon Postgres
Responsable ─▶ Zona privada ──▶ lib/private-queries / private-actions ──────────┘
                      ▲            └─ requireResponsableActivo() (consulta a la base)
                      └ Auth.js (credenciales, JWT con solo el id del responsable)
```

## Decisiones de arquitectura

| # | Decisión | Estado |
|---|---|---|
| [ADR-0001](adrs/0001-aplicacion-unica-nextjs.md) | Aplicación única Next.js (App Router) desplegada en Vercel | Aceptado |
| [ADR-0002](adrs/0002-modelo-de-datos.md) | Modelo de datos: donaciones en una tabla, avance calculado e historial en `audit_log` | Aceptado, parcialmente reemplazado por ADR-0008 |
| [ADR-0003](adrs/0003-contratos-server-actions.md) | Server Actions y Server Components como contrato entre interfaz y servidor | Aceptado, complementado por ADR-0009 |
| [ADR-0004](adrs/0004-stack-tecnologico.md) | Stack: TypeScript, Tailwind, Drizzle + Neon serverless y Auth.js con credenciales | Aceptado |
| [ADR-0005](adrs/0005-manejo-de-estado.md) | Postgres como única fuente de verdad y páginas dinámicas sin caché | Aceptado |
| [ADR-0006](adrs/0006-resiliencia-y-errores.md) | Aviso blando de duplicados, honeypot en formulario público y errores transaccionales | Aceptado |
| [ADR-0007](adrs/0007-separacion-datos-publicos.md) | Módulo único de lecturas públicas para separar datos públicos y privados | Aceptado |
| [ADR-0008](adrs/0008-integridad-proyecto-item-y-sin-asignar.md) | Integridad proyecto–ítem en `donaciones` y significado de "Sin asignar" | Aceptado (nuevo en v2) |
| [ADR-0009](adrs/0009-autorizacion-en-capa-de-datos-privada.md) | Autorización en la capa de datos privada, para lecturas y escrituras | Aceptado (nuevo en v2) |
| [ADR-0010](adrs/0010-falta-en-soles-descuenta-dinero-recibido.md) | "Falta en soles" descuenta el dinero recibido del proyecto | Aceptado (nuevo en v2) |

## Modelo de datos

Derivado solo del PRD (ver [ADR-0002](adrs/0002-modelo-de-datos.md) y
[ADR-0008](adrs/0008-integridad-proyecto-item-y-sin-asignar.md)).

- `responsables` — usuario con login; `activo` para desactivar sin borrar registros.
- `proyectos` — nombre, descripción, `tiene_meta`, estado (`activo` | `finalizado`), resultado.
- `items_meta` — proyecto, nombre, unidad, `cantidad_meta`, `costo_referencial` opcional.
  **`UNIQUE (id, proyecto_id)`** para la clave foránea compuesta de `donaciones`.
- `apoyantes` — nombre, contacto, rol (donante y/o voluntario), `anonimo_publico`.
- `donaciones` — apoyante, `proyecto_id` (nulo = "Sin asignar"), `tipo` (`dinero` | `producto`),
  `monto` (dinero), `item_id` y `cantidad` (producto), **`descripcion_producto`** (solo producto sin
  asignar), medio, fecha, `registrado_por`, `anulada`, `donacion_vinculada_id` (donación mixta).
  - **FK compuesta** `(item_id, proyecto_id) → items_meta (id, proyecto_id)`: un ítem solo se combina
    con su propio proyecto.
  - **`CHECK`** con tres estados válidos, y se rechaza cualquier otra combinación:
    - dinero: `monto > 0`, `item_id` y `cantidad` nulos (`proyecto_id` puede ser nulo);
    - producto asignado: `cantidad > 0`, `item_id` y `proyecto_id` no nulos;
    - producto sin asignar: `cantidad > 0`, `item_id` y `proyecto_id` nulos y `descripcion_producto`
      no nula.
- `voluntarios_inscritos` — datos del formulario público, vinculados a un apoyante.
- `audit_log` — entidad, id, acción, valores antes/después (JSON), responsable, fecha.

Relaciones: un proyecto tiene muchos ítems y muchas donaciones; una donación pertenece a un
apoyante y a un proyecto (o ninguno); una donación en producto asignada apunta a un ítem de ese mismo
proyecto.

**Regla de avance (decidida por el usuario):** el dinero va aparte de las unidades. El avance de un
ítem es el `SUM(cantidad)` de las donaciones **en producto**, no anuladas, con `item_id` igual a ese
ítem. Una donación sin asignar no tiene `item_id`, así que no suma a ninguna barra. Las donaciones en
dinero no suman a ninguna barra de unidades; alimentan un total en soles por proyecto. La conversión
de dinero a unidades mediante el costo referencial se evaluó y se descartó para esta versión.

**Falta en soles** ([ADR-0010](adrs/0010-falta-en-soles-descuenta-dinero-recibido.md)), solo en la zona
privada y a nivel de proyecto:
`max(0, Σ ítems con costo (cantidad_meta − recibido_producto) × costo_referencial − total_dinero_proyecto)`.

## Criterios de aceptación por flujo

Los marcados con ⚖️ fueron supuestos del agente y no se confirmaron uno a uno con el usuario.
Los marcados con 🆕 son nuevos o cambiaron en la v2.

### Acceso de responsables

- [ ] Un responsable activo inicia sesión con correo y contraseña y llega a la zona privada.
- [ ] Un responsable con `activo = false` no puede iniciar sesión, y sus donaciones y registros
  siguen visibles.
- [ ] 🆕 Toda lectura y toda escritura de la zona privada comprueba en la base que el responsable
  existe y está activo. Esto incluye las páginas, los reportes y las Server Actions, no solo estas
  últimas.
- [ ] 🆕 Un responsable desactivado con una sesión aún vigente recibe rechazo en su siguiente petición
  (página o acción), sin esperar a que caduque el JWT. Hay una prueba que lo verifica en cada ruta
  privada.
- [ ] 🆕 Ningún componente de la zona privada consulta tablas directamente; todo pasa por el módulo de
  acceso privado.
- [ ] ⚖️ Las sesiones caducan a los 7 días. La caducidad ya no es el mecanismo de revocación.

### Registrar una donación

- [ ] Una donación en dinero guarda donante, proyecto, medio (Yape, Plin o transferencia), fecha y
  monto. Una en producto guarda ítem y cantidad en lugar de monto.
- [ ] 🆕 La base rechaza, mediante el `CHECK` y la clave foránea compuesta:
  - una donación en dinero sin monto positivo o con ítem o cantidad;
  - una donación en producto con cantidad no positiva;
  - un producto con ítem pero sin proyecto, o con proyecto pero sin ítem;
  - un producto sin asignar sin `descripcion_producto`;
  - un ítem combinado con un proyecto distinto del suyo.
- [ ] ⚖️ Registrar una donación requiere un formulario de una sola pantalla, con la fecha de hoy y
  el último proyecto usado como valores por defecto, para cumplir "menos de 2 minutos".
- [ ] Si ya existe una donación no anulada con mismo donante, monto, fecha y proyecto, se muestra
  la advertencia y se guarda solo tras confirmar. (La regla para productos, donantes anónimos y
  apoyantes repetidos sigue abierta; ver pendientes.)
- [ ] 🆕 Una donación sin proyecto se guarda como "Sin asignar" y no suma a ninguna barra hasta que se
  asigna. Un producto sin asignar se guarda con `descripcion_producto` y sin ítem.
- [ ] 🆕 Asignar una donación sin asignar actualiza proyecto (y, en productos, ítem) en una sola
  operación, con su fila en `audit_log`. El ítem elegido debe pertenecer al proyecto elegido.
- [ ] Una donación mixta se registra como dos filas vinculadas con `donacion_vinculada_id` y el
  mismo apoyante.
- [ ] Un proyecto "Finalizado" no aparece como opción al registrar una donación y la acción lo
  rechaza.

### Editar y anular

- [ ] Editar o anular una donación crea una fila en `audit_log` con responsable, fecha y valores
  antes y después, en la misma transacción.
- [ ] Anular pone `anulada = true`; la fila no se elimina y ya no suma al avance.
- [ ] Si la transacción falla, no queda ni la donación modificada ni un registro de historial
  parcial.

### Avance y metas

- [ ] 🆕 El avance de cada ítem es el `SUM(cantidad)` de las donaciones en producto, no anuladas, con
  ese `item_id`. Una prueba verifica que una donación sin asignar no suma a ningún ítem.
- [ ] Las donaciones en dinero no suman a la barra de ningún ítem; se muestran como total en soles
  por proyecto en la zona privada.
- [ ] La zona privada muestra el avance real, incluyendo el excedente (por ejemplo, 2150 de 2000).
  La barra pública se limita a 100%.
- [ ] 🆕 ⚖️ La zona privada muestra "lo que falta en soles" por proyecto como
  `max(0, Σ (meta − recibido en producto) × costo − total en dinero del proyecto)`, solo con los ítems
  que tienen costo referencial. Si el proyecto tiene ítems sin costo, lo marca como "estimado
  parcial". Con pruebas para: dinero mayor que el costo restante (resultado 0), ítems sin costo y
  excedente de producto.
- [ ] Un responsable ve cuánto falta de la meta de un proyecto desde la pantalla de ese proyecto,
  sin pasos adicionales.

### Zona pública

- [ ] La barra de un proyecto en la zona pública coincide con el avance de la zona privada (hasta
  el tope de 100%) en la misma carga de página. (La definición de la barra de un proyecto con varios
  ítems y la función de avance compartida siguen abiertas; ver pendientes.)
- [ ] Solo 10 Derechos y Apoyo alimentario muestran barra; Música y Casa del Buen Samaritano se
  muestran como informativos.
- [ ] Un donante anónimo aparece como "Anónimo" en cualquier dato público; el nombre real solo en
  la zona privada.
- [ ] Las páginas públicas obtienen datos solo del módulo de lecturas públicas.
- [ ] Si la base no responde, la zona pública muestra una página de error y nunca un avance en
  cero.

### Pagos simulados

- [ ] 🆕 La sección "Cómo donar" muestra los datos de Yape, Plin y transferencia como demostración,
  con una indicación visible de que son simulados. No hay botón ni flujo que cobre o inicie una
  transacción.
- [ ] 🆕 El código y las dependencias del proyecto no incluyen SDK, webhooks ni credenciales de bancos
  o pasarelas de pago, y el repositorio no contiene datos de cuentas reales.
- [ ] 🆕 El sistema no guarda números de cuenta, tarjeta ni credenciales de donantes. De un donante solo
  se guardan los campos de `apoyantes`.

### Voluntariado

- [ ] El formulario público guarda un voluntario inscrito sin crear cuenta.
- [ ] Un envío con el campo trampa lleno o con campos fuera de los límites de longitud se rechaza
  sin guardarse.
- [ ] La zona privada lista a los voluntarios inscritos.

### Reportes

- [ ] El reporte en pantalla muestra las donaciones agrupadas por responsable y por proyecto, con
  totales; no hay exportación a Excel ni PDF.

### Despliegue

- [ ] ⚖️ El proyecto compila (`npm run build`) y se despliega en Vercel Hobby desde el repositorio,
  con la cadena de conexión a Neon como variable de entorno y sin secretos en el código.

## Pendientes de la revisión adversarial

Los hallazgos de nivel Advertencia y Sugerencia no se corrigieron en esta versión. Siguen abiertos:

- **A1** Confirmado por el usuario: el proyecto es real, sin cobros. Por tanto, las decisiones que se
  justificaron con "proyecto de prueba" deben revisarse con datos reales en mente: ADR 0007 (sin rol de
  solo lectura), ADR 0006 (sin límite de intentos ni captcha) y la falta de respaldo (A9). Está pendiente
  decidir cuáles se endurecen.
- **A2** Dos rutas de lectura del avance (público y privado) que pueden desincronizarse; falta una
  función de avance compartida.
- **A3** No se define el avance de un proyecto con varios ítems.
- **A4** Elegir el driver de Drizzle/Neon que soporte transacciones interactivas.
- **A5** Autenticación: límite de intentos, creación y desactivación de responsables, roles. La gestión
  de responsables podría quedar fuera del alcance del PRD y requiere decidirlo.
- **A6** Duplicados: productos, donantes anónimos y apoyantes repetidos.
- **A7** Moneda, tipo numérico del monto y zona horaria `America/Lima`.
- **A8** Cobertura del `audit_log` y datos personales en el historial; consentimiento en el formulario.
- **A9** Respaldo, restauración y estrategia de pruebas.
- **A10** Encaje de Vercel Hobby con una web que solicita donaciones. Que el sistema no procese pagos
  puede ayudar, pero hay que verificar los términos vigentes, porque la web igualmente pide donaciones.
- **A11** El formulario público escribe en `apoyantes`.
- **Sugerencias S1–S8** (anonimato, donación mixta, concurrencia, inconsistencias menores entre ADR,
  Auth.js, costo referencial, medición del criterio web, nota obsoleta sobre `CLAUDE.md`).
- **Decisión de producto abierta de C3:** la barra pública seguirá baja aunque entre mucho dinero. Hay
  que decidir con el PRD si el dinero debe avanzar la barra pública o mostrarse como total en soles.

## Riesgos técnicos abiertos

- **Datos personales:** la separación público/privado depende de la disciplina del código
  ([ADR-0007](adrs/0007-separacion-datos-publicos.md) y [ADR-0009](adrs/0009-autorizacion-en-capa-de-datos-privada.md))
  y no se verificó la ley peruana de protección de datos personales. Si el sistema pasara a datos
  reales, habría que migrar a un rol de solo lectura con vistas públicas.
- **Avisos de duplicados:** no son atómicos ni bloquean ([ADR-0006](adrs/0006-resiliencia-y-errores.md)).
- **Límites de free tier:** Vercel Hobby (uso no comercial, límites de funciones) y Neon free
  (suspensión por inactividad, arranque en frío de ~1 s). Un pico de tráfico público llega directo
  a la base ([ADR-0005](adrs/0005-manejo-de-estado.md)). La comprobación de responsable activo añade
  una consulta por petición privada.
- **Dinero y metas:** el dinero no avanza la barra de unidades; ver la decisión abierta de C3 arriba.
- **Total en soles en público:** el PRD no dice si se muestra públicamente; en esta versión solo se
  muestra en la zona privada.
- **Mantenimiento:** no está definido quién mantiene la web y la base después del curso (riesgo
  abierto del PRD).
- **Adopción:** si los responsables siguen anotando en cuaderno o WhatsApp, el sistema queda
  desactualizado (riesgo abierto del PRD).
