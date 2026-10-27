# Technical Design Document: Sistema de donaciones y control de proyectos – ONG La FAZ

**Tipo de proyecto:** Greenfield.
**Design.md disponible:** No. El modelo de datos se derivó solo del PRD.

**Restricciones obligatorias (dadas por el usuario):** debe poder desplegarse en Vercel free tier
desde un repositorio, y la persistencia es PostgreSQL en Neon.

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
  - **Zona privada:** protegida por Auth.js con credenciales. Las escrituras son Server Actions
    que validan con Zod, comprueban que el responsable esté activo y escriben el cambio más
    `audit_log` en una transacción.
- **Neon Postgres**, accedido con Drizzle y el driver `@neondatabase/serverless`, con una sola
  conexión y un solo rol.

```
Visitante ──▶ Zona pública (Server Components) ──▶ lib/public-queries ──┐
                                                                         ├──▶ Neon Postgres
Responsable ─▶ Zona privada (Server Components + Server Actions) ───────┘
                      ▲ Auth.js (credenciales, sesión en cookie)
```

## Decisiones de arquitectura

| # | Decisión | Estado |
|---|---|---|
| [ADR-0001](adrs/0001-aplicacion-unica-nextjs.md) | Aplicación única Next.js (App Router) desplegada en Vercel | Aceptado |
| [ADR-0002](adrs/0002-modelo-de-datos.md) | Modelo de datos: donaciones en una tabla, avance calculado e historial en `audit_log` | Aceptado |
| [ADR-0003](adrs/0003-contratos-server-actions.md) | Server Actions y Server Components como contrato entre interfaz y servidor | Aceptado |
| [ADR-0004](adrs/0004-stack-tecnologico.md) | Stack: TypeScript, Tailwind, Drizzle + Neon serverless y Auth.js con credenciales | Aceptado |
| [ADR-0005](adrs/0005-manejo-de-estado.md) | Postgres como única fuente de verdad y páginas dinámicas sin caché | Aceptado |
| [ADR-0006](adrs/0006-resiliencia-y-errores.md) | Aviso blando de duplicados, honeypot en formulario público y errores transaccionales | Aceptado |
| [ADR-0007](adrs/0007-separacion-datos-publicos.md) | Módulo único de lecturas públicas para separar datos públicos y privados | Aceptado |

No hay decisiones heredadas, porque el proyecto es greenfield.

## Modelo de datos

Derivado solo del PRD (ver [ADR-0002](adrs/0002-modelo-de-datos.md)).

- `responsables` — usuario con login; `activo` para desactivar sin borrar registros.
- `proyectos` — nombre, descripción, `tiene_meta`, estado (`activo` | `finalizado`), resultado.
- `items_meta` — proyecto, nombre, unidad, `cantidad_meta`, `costo_referencial` opcional.
- `apoyantes` — nombre, contacto, rol (donante y/o voluntario), `anonimo_publico`.
- `donaciones` — apoyante, proyecto (nulo = "Sin asignar"), `tipo` (`dinero` | `producto`),
  `monto` (dinero) o `item_id` y `cantidad` (producto), medio, fecha, `registrado_por`,
  `anulada`, `donacion_vinculada_id` (donación mixta). Un `CHECK` impone los campos según el tipo.
- `voluntarios_inscritos` — datos del formulario público, vinculados a un apoyante.
- `audit_log` — entidad, id, acción, valores antes/después (JSON), responsable, fecha.

Relaciones: un proyecto tiene muchos ítems y muchas donaciones; una donación pertenece a un
apoyante y a un proyecto (o ninguno); una donación en producto apunta a un ítem.

**Regla de avance (decidida por el usuario):** el dinero va aparte de las unidades. El avance de un
ítem es el `SUM` de las donaciones **en producto** no anuladas de ese ítem. Las donaciones en dinero
no suman a ninguna barra de unidades; alimentan un total en soles por proyecto. La conversión de
dinero a unidades mediante el costo referencial se evaluó y se descartó para esta versión.

## Criterios de aceptación por flujo

Los marcados con ⚖️ fueron supuestos del agente y no se confirmaron uno a uno con el usuario.

### Acceso de responsables

- [ ] Un responsable activo inicia sesión con correo y contraseña y llega a la zona privada.
- [ ] Un responsable con `activo = false` no puede iniciar sesión, y sus donaciones y registros
  siguen visibles.
- [ ] Cada Server Action de la zona privada rechaza la llamada si no hay sesión de un responsable
  activo.
- [ ] ⚖️ Las sesiones caducan a los 7 días y se invalidan al desactivar al responsable.

### Registrar una donación

- [ ] Una donación en dinero guarda donante, proyecto, medio (Yape, Plin o transferencia), fecha y
  monto. Una en producto guarda ítem y cantidad en lugar de monto.
- [ ] El `CHECK` de la base rechaza una donación en dinero sin monto o una en producto sin ítem y
  cantidad.
- [ ] ⚖️ Registrar una donación requiere un formulario de una sola pantalla, con la fecha de hoy y
  el último proyecto usado como valores por defecto, para cumplir "menos de 2 minutos".
- [ ] Si ya existe una donación no anulada con mismo donante, monto, fecha y proyecto, se muestra
  la advertencia y se guarda solo tras confirmar.
- [ ] Una donación sin proyecto se guarda como "Sin asignar" y no suma a ninguna barra hasta que se
  asigna.
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

- [ ] El avance de cada ítem es el `SUM` de las donaciones en producto no anuladas de ese ítem.
- [ ] Las donaciones en dinero no suman a la barra de ningún ítem; se muestran como total en soles
  por proyecto en la zona privada.
- [ ] La zona privada muestra el avance real, incluyendo el excedente (por ejemplo, 2150 de 2000).
  La barra pública se limita a 100%.
- [ ] ⚖️ Si un ítem tiene costo referencial, la zona privada muestra "lo que falta en soles" como
  (meta − recibido en producto) × costo por unidad; si no lo tiene, no muestra ese monto.
- [ ] Un responsable ve cuánto falta de la meta de un proyecto desde la pantalla de ese proyecto,
  sin pasos adicionales.

### Zona pública

- [ ] La barra de un proyecto en la zona pública coincide con el avance de la zona privada (hasta
  el tope de 100%) en la misma carga de página.
- [ ] Solo 10 Derechos y Apoyo alimentario muestran barra; Música y Casa del Buen Samaritano se
  muestran como informativos.
- [ ] Un donante anónimo aparece como "Anónimo" en cualquier dato público; el nombre real solo en
  la zona privada.
- [ ] Las páginas públicas obtienen datos solo del módulo de lecturas públicas.
- [ ] Si la base no responde, la zona pública muestra una página de error y nunca un avance en
  cero.

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

## Riesgos técnicos abiertos

- **Datos personales:** la separación público/privado depende de la disciplina del código
  ([ADR-0007](adrs/0007-separacion-datos-publicos.md)) y no se verificó la ley peruana de
  protección de datos personales. Si el sistema pasara a datos reales, habría que migrar a un rol
  de solo lectura con vistas públicas.
- **Avisos de duplicados:** no son atómicos ni bloquean ([ADR-0006](adrs/0006-resiliencia-y-errores.md)).
- **Límites de free tier:** Vercel Hobby (uso no comercial, límites de funciones) y Neon free
  (suspensión por inactividad, arranque en frío de ~1 s). Un pico de tráfico público llega directo
  a la base ([ADR-0005](adrs/0005-manejo-de-estado.md)).
- **Dinero y metas:** el dinero no avanza la barra de unidades. Si los responsables registran sobre
  todo dinero, las barras podrían quedar bajas aunque haya fondos. Conviene verificarlo con el uso
  real. Convertir dinero a unidades requeriría una nueva decisión y ampliar el PRD, que hoy solo
  usa el costo referencial para estimar cuánto falta en soles.
- **Total en soles en público:** el PRD no dice si se muestra públicamente; en esta versión solo se
  muestra en la zona privada.
- **Stack en `CLAUDE.md`:** menciona React + Vite y comandos previstos; hay que actualizarlo a
  Next.js al crear el proyecto ([ADR-0001](adrs/0001-aplicacion-unica-nextjs.md)).
- **Mantenimiento:** no está definido quién mantiene la web y la base después del curso (riesgo
  abierto del PRD).
- **Adopción:** si los responsables siguen anotando en cuaderno o WhatsApp, el sistema queda
  desactualizado (riesgo abierto del PRD).
