# Proposal

## Why

La base ya guarda los 4 proyectos iniciales, pero solo se pueden cambiar con SQL, y ninguno tiene ítems con meta. Sin ítems no existe "1200 de 2000 packs": todo lo que sigue (registrar donaciones en producto, avance, "falta en soles", barra pública) depende de que un responsable pueda definir las metas de cada campaña desde la zona privada. El PRD pide crear y editar proyectos con metas por ítem, costo referencial opcional y cerrar un proyecto como "Finalizado" con su resultado. Con el patrón de escritura auditada ya construido (#4), este es el primer ítem que lo usa: cada cambio de proyecto o ítem deja su historial sin trabajo extra.

## What Changes

Alcance estricto del ítem #5 del backlog ("Proyectos e ítems con meta"):

- Crear un proyecto (nombre, descripción opcional y si tiene meta) y editarlo.
- Crear y editar ítems con meta de un proyecto que tiene meta: nombre, unidad, cantidad meta y costo referencial opcional por unidad.
- Finalizar un proyecto con su resultado. Un proyecto finalizado queda visible como "Finalizado", con su resultado, y deja de poder editarse.
- Pantallas privadas mínimas para hacerlo: lista de proyectos, formulario de proyecto nuevo, y la página de un proyecto con su edición, sus ítems y el cierre. Un enlace desde el panel.
- Lecturas privadas de proyectos e ítems por el módulo de acceso privado (ADR 0009).
- Todas las escrituras usan `crearAccionPrivada()` (ADR 0003, 0006): validación con Zod, responsable activo y cambio más `audit_log` en una transacción.
- Pruebas contra Postgres real de cada regla y de cada escritura.

Reglas decididas para esta versión (el PRD no las contradice; se anotan por si el usuario quiere cambiarlas):
- Un proyecto o un ítem **no se borra** en esta versión (el PRD dice que nada se borra definitivamente, y el esquema no tiene anulación para ítems). Un error se corrige editando.
- Un proyecto finalizado **no se reabre ni se edita**, y tampoco sus ítems. Reabrir no está en el PRD.
- Solo los proyectos con meta pueden tener ítems, y un proyecto con ítems no puede pasar a "sin meta".
- Los nombres de proyecto y, dentro de un proyecto, los de ítem no se repiten, sin distinguir mayúsculas.
- Se puede bajar la meta de un ítem por debajo de lo ya recibido: el excedente lo muestra #9.

Fuera de alcance (pertenecen a otros ítems): avance, excedente y "falta en soles" (#9), registrar donaciones y rechazar las de un proyecto finalizado (#7), páginas públicas y barras (#11, #12), pantalla del historial, borrar o reabrir proyectos e ítems, cambios al esquema y migraciones.

## Capabilities

### New Capabilities
- `project-management`: un responsable crea y edita proyectos, y finaliza un proyecto con su resultado, quedando este de solo lectura; los nombres no se repiten y cada cambio deja su historial.
- `goal-items`: un responsable define los ítems con meta de un proyecto con meta (cantidad, unidad y costo referencial opcional), los edita mientras el proyecto está activo, y las reglas de integridad entre proyecto e ítems se cumplen.

### Modified Capabilities
<!-- Ninguna: los specs existentes pertenecen a cambios aún no archivados y no cambian sus requisitos. -->

## Impact

- **Código nuevo:** esquemas Zod de proyecto e ítem, lógica de escritura (sin Next, para probarla), acciones privadas, lecturas privadas, pantallas bajo `app/(privado)/proyectos/` y pruebas.
- **Código existente:** `lib/private-queries-core.ts` recibe la base para leer (la fábrica de consultas gana un parámetro) y sus pruebas se ajustan; el panel gana un enlace a Proyectos; `CLAUDE.md` gana una nota breve.
- **Dependencias nuevas:** ninguna.
- **Sistemas externos:** ninguno. No hay migración ni escritura en `production` al implementar; los datos reales los crea el responsable desde la interfaz.
- **Pendientes del TDD que se tocan:** S3 (concurrencia) se atiende solo en lo necesario: cada escritura bloquea la fila del proyecto para que finalizar y agregar un ítem no se crucen. A3 (avance con varios ítems) no se toca.
