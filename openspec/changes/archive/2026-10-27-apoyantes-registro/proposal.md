# Proposal

## Why

Registrar una donación (#7) exige elegir un donante, y el voluntariado (#13) necesita apoyantes a los que vincular las inscripciones. Hoy la tabla `apoyantes` existe pero no hay forma de llenarla desde la zona privada, y el PRD pide "registro de apoyantes (donantes y voluntarios)" y que un donante anónimo se muestre como "Anónimo" en lo público. Es además el primer dato personal real del sistema: nombre y contacto de personas. Conviene fijar ahora, antes de que existan donaciones, cuánta información se guarda, quién la ve y qué queda en el historial, con criterios mínimos de minimización mientras no haya revisión legal.

## What Changes

Alcance estricto del ítem #6 del backlog ("Apoyantes"):

- Crear y editar apoyantes desde la zona privada: nombre, contacto opcional, rol (donante, voluntario o ambos) y la marca de anonimato público.
- Lista de apoyantes con búsqueda por nombre (sin distinguir mayúsculas ni tildes) y filtro por rol, que #7 reutiliza para elegir donante y que sirve de registro de voluntarios.
- La regla de anonimato público: un apoyante marcado como anónimo se presenta como "Anónimo" en cualquier dato público. Aquí se fija la marca y una función única de nombre público que usarán las lecturas públicas de #12; las páginas públicas no se construyen en este cambio.
- Minimización de datos personales: solo nombre y un contacto de texto libre; ningún documento de identidad, dirección ni otros datos.
- Historial (`audit_log`) de cada creación y edición **sin datos de contacto**: guarda nombre, roles y anonimato, y solo si hay contacto y si cambió, nunca su valor.
- Todas las escrituras usan `crearAccionPrivada()` y las lecturas pasan por el acceso privado (ADR 0009).
- Pantallas privadas mínimas: lista, nuevo apoyante y detalle con edición, y un enlace desde el panel.
- Pruebas contra Postgres real de cada regla.

Decisiones del usuario para este ítem:
- No hay documentación legal de La FAZ sobre datos personales: se aplican criterios mínimos y queda **pendiente una revisión legal** (ley peruana de protección de datos; el PRD ya señala que no se verificó).
- El historial no guarda el contacto.
- No se borra ni se anonimiza un apoyante a pedido de la persona en esta versión; solo se crea, se edita y se marca como anónimo público. Si hace falta, se actualiza el PRD primero.

Reglas asumidas (el PRD no las contradice): nombres de apoyante **no** son únicos (dos personas pueden llamarse igual); no se puede quitar el rol de donante a quien ya tiene donaciones ni el de voluntario a quien ya tiene inscripciones; el detalle de un apoyante muestra el contacto, la lista no.

Fuera de alcance (otros ítems): registrar donaciones y el aviso de duplicados de donantes (#7, A6), formulario público de voluntariado, consentimiento e inscripciones (#13), páginas públicas y lecturas públicas (#11, #12), borrar o anonimizar a pedido, exportar datos de una persona, retención y respaldo (#14), cambios de esquema y migraciones.

## Capabilities

### New Capabilities
- `supporter-registry`: un responsable crea, edita, lista y busca apoyantes (donantes y voluntarios), con al menos un rol, sin borrado y con cada cambio en el historial.
- `supporter-privacy`: los datos personales del apoyante se limitan a nombre y contacto, el contacto no pasa al historial, y un apoyante anónimo se presenta como "Anónimo" en cualquier dato público.

### Modified Capabilities
<!-- Ninguna: los specs existentes pertenecen a cambios aún no archivados y no cambian sus requisitos. -->

## Impact

- **Código nuevo:** esquemas Zod, lógica de escritura sin Next, función de nombre público, lecturas privadas, acciones, pantallas bajo `app/(privado)/apoyantes/` y pruebas.
- **Código existente:** `lib/private-queries-core.ts` gana `listarApoyantes()` y `getApoyante()`; `proxy.ts` cubre `/apoyantes`; el panel gana un enlace; `CLAUDE.md` gana una nota.
- **Dependencias nuevas:** ninguna.
- **Sistemas externos:** ninguno. No hay migración ni escritura en `production` al implementar; los apoyantes reales los crea el responsable desde la interfaz.
- **Pendientes del TDD que se tocan:** A8 (datos personales en el historial) se resuelve para apoyantes con la decisión de no guardar contacto; el consentimiento queda para #13. A6 (duplicados de apoyantes) sigue abierto.
