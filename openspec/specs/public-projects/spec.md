# public-projects Specification

## Purpose

Permite a un visitante conocer los proyectos de La FAZ, ver qué cosas se pueden donar en cada uno y cuánto se lleva recibido de cada meta, para que decida con confianza qué aportar.

## Requirements

### Requirement: Lista pública de proyectos
La zona pública SHALL tener una página de proyectos (`/nuestros-proyectos`) que liste todos los proyectos, los activos primero y los finalizados después, cada uno con su nombre, su estado, su descripción si la tiene y un enlace a su detalle, y SHALL estar enlazada desde el menú como "Proyectos".

#### Scenario: Orden
- **WHEN** hay proyectos activos y finalizados
- **THEN** la lista muestra primero los activos y luego los finalizados

#### Scenario: Menú y ruta
- **WHEN** se abre cualquier página pública
- **THEN** el menú tiene "Proyectos" y lleva a `/nuestros-proyectos`, sin chocar con la lista privada `/proyectos`

#### Scenario: Sin descripción
- **WHEN** un proyecto no tiene descripción
- **THEN** se muestra solo su nombre y no se inventa ningún texto

#### Scenario: Sin proyectos
- **WHEN** la base no tiene ningún proyecto
- **THEN** se muestra un mensaje de que pronto habrá proyectos, no una página rota

### Requirement: Qué se puede donar
Cada proyecto activo con meta SHALL mostrar en su detalle sus ítems donables, cada uno con su nombre, su unidad, su meta, lo recibido y una barra de avance, y SHALL invitar a donar con un enlace a "Cómo donar".

#### Scenario: Ítems con avance
- **WHEN** un proyecto tiene 2000 packs de meta y 1200 recibidos
- **THEN** muestra "1200 de 2000 packs" y una barra al 60%

#### Scenario: Ítems distintos no se mezclan
- **WHEN** un proyecto tiene packs y botellas de agua
- **THEN** cada ítem tiene su propia barra y su propia unidad, y no se muestra un porcentaje único del proyecto

#### Scenario: Resumen de metas
- **WHEN** un proyecto tiene varios ítems
- **THEN** muestra cuántas metas se han cumplido de cuántas ("1 de 2 metas cumplidas")

#### Scenario: Mismo nombre en otro proyecto
- **WHEN** dos proyectos tienen un ítem llamado "Pack"
- **THEN** cada proyecto muestra el avance de su propio ítem

#### Scenario: Invitación a donar
- **WHEN** el proyecto está activo y tiene meta
- **THEN** ofrece un enlace a "Cómo donar" y no ofrece ningún botón de pago

### Requirement: La barra pública se limita al 100%
La barra y las cantidades públicas MUST NOT superar la meta: con más recibido que la meta se muestra la meta cumplida al 100%. El excedente real MUST NOT mostrarse en público y sigue visible en la zona privada.

#### Scenario: Excedente
- **WHEN** un ítem recibió 2150 de 2000
- **THEN** la página pública muestra "2000 de 2000", la barra al 100% y "Meta cumplida", sin la cifra 2150

#### Scenario: Meta justa
- **WHEN** un ítem recibió exactamente su meta
- **THEN** se muestra como meta cumplida al 100%

#### Scenario: Sin recibido
- **WHEN** un ítem no ha recibido nada
- **THEN** se muestra "0 de N" con la barra vacía, no se oculta

### Requirement: Proyectos informativos
Un proyecto sin meta SHALL mostrar solo su nombre y su descripción, sin barra, sin ítems y sin invitación a donar con meta.

#### Scenario: Música
- **WHEN** se abre un proyecto sin meta
- **THEN** no hay barras ni ítems, y se muestra su descripción si existe

### Requirement: Proyectos finalizados
Un proyecto finalizado SHALL mostrarse como "Finalizado" con su resultado y las cifras finales de sus ítems, y MUST NOT invitar a donar.

#### Scenario: Finalizado
- **WHEN** un proyecto con meta está finalizado
- **THEN** se ve marcado "Finalizado", con su resultado y sus ítems con lo recibido, y sin enlace para donar

### Requirement: Proyecto con meta sin ítems
Un proyecto con meta sin ítems todavía SHALL mostrarse con su descripción y un aviso de que pronto se publicará qué se necesita, sin barra ni cifras.

#### Scenario: Sin ítems
- **WHEN** un proyecto tiene meta pero ningún ítem
- **THEN** se muestra el aviso, sin barras ni "0 de 0"

### Requirement: Detalle inexistente
Un identificador de proyecto inexistente o inválido SHALL mostrar la página de "no encontrado".

#### Scenario: Id inválido
- **WHEN** se abre `/nuestros-proyectos/abc` o un id que no existe
- **THEN** se muestra "no encontrado", no un error del servidor

### Requirement: Enlace desde Cómo donar
La página "Cómo donar" SHALL remitir a la sección de proyectos para saber qué se necesita en cada uno, sin prometer fechas, lugares ni contactos que la ONG no haya entregado.

#### Scenario: Enlace
- **WHEN** se lee la sección de productos de "Cómo donar"
- **THEN** hay un enlace a `/nuestros-proyectos`

### Requirement: Aviso de que la descripción y el resultado son públicos
El formulario privado de proyectos SHALL indicar que la descripción y el resultado se muestran en la web pública.

#### Scenario: Formulario
- **WHEN** un responsable edita un proyecto
- **THEN** ve junto a la descripción y al resultado que ese texto es público
