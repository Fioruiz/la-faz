---
title: "Sistema de donaciones y control de proyectos – ONG La FAZ"
---

# PRD: Sistema de donaciones y control de proyectos – ONG La FAZ

## Problema

La ONG La FAZ no tiene un canal oficial para recibir donaciones ni un control centralizado de lo que recibe. Los donantes depositan en cuentas personales de responsables y el registro vive en un cuaderno o en un WhatsApp personal. Esto ocurre en cada proyecto de la ONG (los 10 Derechos en noviembre, apoyo alimentario, música, Casa del Buen Samaritano).

Las donaciones llegan en dinero (transferencia, Yape, Plin; el efectivo casi no se usa) y en especie (agua, cereal, fruta, etc.), con metas concretas: por ejemplo, 2000 niños requieren 2000 packs. Hoy nadie sabe con certeza cuánto se recaudó ni cuánto falta; el registro puede olvidarse o perderse. La captación de voluntarios (colegios, pasacalle, carro alegórico) tampoco tiene un lugar donde ordenarse.

Además, al no existir una web oficial, la ONG no inspira confianza a donantes potenciales, en especial a los del extranjero, y recibe pocas donaciones por ese lado.

Se plantea como **dolor concreto**: pérdida de visibilidad y control de lo recaudado, que impide saber cuánto falta para cada meta.

## Usuario objetivo

- **Responsable de la ONG** (perfil principal): unas 3 personas que hoy llevan las donaciones en cuaderno o WhatsApp. Usan computadora. Necesitan registrar donaciones, ver el avance de cada meta y llevar el registro de quienes apoyan.
- **Donante**: familiares, amigos y seguidores en redes, en Perú y en el extranjero. En Perú usa Yape, Plin y transferencia, y también dona productos. Necesita saber cómo donar y confiar en que la ONG es seria.
- **Voluntario**: persona que quiere ayudar en actividades (colegios, pasacalle). Solo se apunta mediante un formulario; no tiene cuenta.

## Objetivo / resultado esperado

La ONG sabe en cada momento cuánto ha recibido, en dinero y en productos, y cuánto falta para la meta de cada proyecto, sin depender de cuadernos ni de WhatsApp. Los donantes, también los extranjeros, ven un canal oficial donde consultan públicamente el avance de las metas (por ejemplo, "1200 de 2000 packs").

Prioridad: primero el control interno (registrar y ver avance); la web pública es el canal que muestra esos mismos datos. Es una sola aplicación y una sola base de datos, con una zona pública y una zona privada.

## Alcance (qué sí incluye esta versión)

**Zona pública**
- Presentación de la ONG.
- Lista de proyectos. 10 Derechos y apoyo alimentario con meta y barra de avance; Música y Casa del Buen Samaritano solo informativos.
- Sección "Cómo donar": Yape, Plin y transferencia (datos de cuenta). Para el extranjero, datos de transferencia internacional <!-- REVISAR: se asumió que no hay pago con tarjeta; en esta versión la cuenta es una simulación (demo) -->.
- Formulario de voluntariado.

**Zona privada** (login para ~3 responsables)
- Crear y editar proyectos con metas por ítem (por ejemplo, 2000 packs; 2000 botellas de agua; etc.).
- Costo referencial opcional por ítem (por ejemplo, 24 botellas = S/ 13) para estimar cuánto falta en soles.
- Registrar donaciones en dinero o en producto: donante, proyecto, medio, fecha y monto o cantidad. <!-- REVISAR: se asumió que solo el responsable registra la donación; el donante no se autorregistra -->
- Ver el avance de cada meta y de cada proyecto.
- Reporte en pantalla de las donaciones registradas por cada responsable y por proyecto.
- Registro de apoyantes (donantes y voluntarios) y lista de voluntarios inscritos.
- Historial de cambios en los registros (quién y cuándo).

## No alcance (qué explícitamente no incluye esta versión)

- Pago con tarjeta o pasarela de pagos en línea.
- Inventario completo con compras y precios (solo existe el costo referencial opcional).
- Exportar reportes a Excel o PDF.
- Aplicación móvil (solo web).
- Cuentas de usuario para donantes o voluntarios (no inician sesión).
- Logística de las actividades (pasacalle, carro alegórico, asignación de voluntarios).
- Recibos de donación con validez tributaria.
- Seguimiento de promesas de donación (solo cuenta lo ya recibido).

## Criterios de éxito

- Un responsable registra una donación en menos de 2 minutos.
- Un responsable ve cuánto falta de la meta de un proyecto en menos de 30 segundos.
- El 100% de las donaciones de los proyectos 10 Derechos y apoyo alimentario están en el sistema, ninguna solo en cuaderno o WhatsApp.
- La barra de avance pública coincide exactamente con lo registrado en la zona privada.
- Al menos 1 donación recibida por la web en el primer mes. <!-- REVISAR: criterio suave de captación, propuesto por el agente; el usuario indicó que la captación no es prioridad -->

## Casos borde a contemplar

<!-- REVISAR: las soluciones de esta sección fueron propuestas por el agente a pedido del usuario -->

- **Donación sin proyecto**: se guarda como "Sin asignar" y un responsable la asigna después; no cuenta en ninguna barra hasta entonces.
- **Se pasa de la meta**: la barra pública muestra 100%; la zona privada muestra el excedente real. No se rechaza nada.
- **Error en un registro**: se puede editar y cada cambio guarda quién y cuándo; nada se borra definitivamente, solo se anula.
- **Donante anónimo**: se muestra como "Anónimo"; el nombre real puede quedar solo en la zona privada.
- **Donación mixta** (dinero y productos): se registra como dos donaciones vinculadas a la misma persona.
- **Registro duplicado**: el sistema avisa si ya existe una donación igual (mismo donante, monto, fecha y proyecto) antes de guardar.
- **Un responsable deja la ONG**: se desactiva su acceso sin borrar sus registros.
- **Proyecto terminado**: queda visible como "Finalizado" con su resultado y ya no recibe donaciones nuevas.

## Supuestos y riesgos abiertos

**Supuestos**
- Los 3 responsables tienen computadora e internet estable.
- Una web oficial aumenta la confianza de donantes extranjeros, aunque solo muestre datos de transferencia. <!-- REVISAR: no verificado -->
- El proyecto es de prueba: la cuenta bancaria y la recepción de pagos internacionales se resuelven como demo/simulación.
- Las metas por ítem (por ejemplo, 2000 packs) se pueden definir antes de iniciar cada campaña.

**Riesgos**
- **Adopción**: si los responsables siguen anotando en cuaderno o WhatsApp, el sistema queda desactualizado y la barra pública pierde sentido.
- **Datos personales**: se guardan datos de donantes y voluntarios; hay que proteger el acceso y considerar la ley de protección de datos personales del Perú. <!-- REVISAR: agente no verificó requisitos legales específicos -->
- **Plazo**: se necesita funcionando de inmediato, con el proyecto de los 10 Derechos en noviembre; el tiempo es muy corto y obliga a priorizar el control interno.
- **Mantenimiento**: no está definido quién mantiene la web y la base de datos después del curso. <!-- REVISAR -->
