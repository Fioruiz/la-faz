# ADR 0009: Autorización en la capa de datos privada, para lecturas y escrituras

## Estado

Aceptado. Complementa al [ADR 0003](0003-contratos-server-actions.md) (que solo exigía la comprobación
en las Server Actions) y al [ADR 0004](0004-stack-tecnologico.md) (sesiones JWT).

## Contexto

La revisión adversarial del TDD v1 (hallazgo C2) encontró que:

- El ADR 0004 admite que el proveedor de credenciales de Auth.js obliga a sesiones JWT, que no tienen
  estado en el servidor.
- El criterio de acceso solo exigía comprobar `activo` en cada Server Action. Las lecturas privadas
  (donantes, contactos, reportes) son Server Components con consultas directas, sin ninguna
  comprobación exigida.
- Un responsable desactivado conservaría su cookie hasta 7 días y podría seguir leyendo datos
  personales. "Un responsable deja la ONG" es un caso borde explícito del PRD.
- Comprobar en el layout no basta: los layouts de Next.js no se vuelven a ejecutar en cada
  navegación.

## Decisión

1. El JWT contiene solo el identificador del responsable; no se usa para decidir permisos.
2. Toda lectura y escritura de la zona privada pasa por un módulo de acceso (por ejemplo,
   `lib/private-queries.ts` y `lib/private-actions.ts`). Su primera operación es
   `requireResponsableActivo()`: lee el responsable en Postgres y lanza un error si no existe o tiene
   `activo = false`. Los componentes de la zona privada no consultan tablas directamente.
3. El `proxy`/middleware de Next.js solo redirige al login a quien no tiene sesión (filtro grueso y
   rápido); no es la barrera de seguridad.
4. Desactivar a un responsable surte efecto en su siguiente petición, no al caducar el JWT.
5. La caducidad del JWT a 7 días (⚖️ del TDD v1) se mantiene, pero ya no es el mecanismo de revocación.

## Alternativas consideradas

- **Sesiones en base de datos (adapter de Auth.js)** — revocación inmediata y estándar, pero el
  proveedor de credenciales no las admite de forma nativa y habría que sortear esa limitación. No se
  eligió.
- **Reducir la caducidad del JWT a minutos** — acota la ventana, pero obliga a iniciar sesión muy a
  menudo y no elimina la ventana. No se eligió.
- **Comprobar solo en el layout de la zona privada** — una sola comprobación, pero el layout no se
  reevalúa en cada navegación y no cubre las Server Actions. No se eligió.

## Consecuencias

- Una persona desactivada pierde acceso a lecturas y escrituras en la siguiente petición.
- Costo: una consulta extra a Neon por petición privada. Con ~3 usuarios es trivial, pero se suma al
  arranque en frío de Neon free tier.
- Costo: la regla depende de la disciplina del código, como el [ADR 0007](0007-separacion-datos-publicos.md).
  Un componente que consulte tablas directamente se salta la comprobación. Se necesita una prueba que
  intente cada ruta privada con un responsable desactivado.
- Queda sin resolver la limitación de intentos de login y la gestión de responsables (hallazgo A5 de
  la revisión), que siguen abiertas.
