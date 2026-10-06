---
title: "ONG La Faz"
---

# PRD: ONG La Faz

## Problema

La Faz es una asociación sin fines de lucro que acompaña a personas, familias y comunidades en situación de vulnerabilidad, promoviendo sus derechos, fortaleciendo sus capacidades y construyendo redes de solidaridad.

Hoy recibe donaciones solo por transferencia y WhatsApp, y su única presencia en línea es una página de Facebook. Sin un sitio propio, la ONG se ve menos creíble y llega a menos gente: quien quiere donar, dentro o fuera del país, no tiene un lugar donde conocer lo que hace y donar. Internamente tampoco tiene un sistema para registrar donaciones y voluntarios ni para sacar reportes de sus proyectos, que son anuales y mensuales.

<!-- REVISAR: asumo que hoy el registro de donaciones y voluntarios es manual (Excel, cuadernos o ninguno); no lo confirmaste -->

## Usuario objetivo

- **Donante / visitante:** persona, dentro o fuera del país, que llega a la web, conoce lo que hace La Faz, elige un proyecto y hace una donación única. <!-- REVISAR: no definiste si es conocido de la ONG, desconocido que llega por redes o empresa; asumo que es principalmente persona natural -->
- **Voluntario:** se inscribe por la web. El administrador también puede registrarlo desde el panel. No tiene login.
- **Administrador (acceso total):** un único usuario que gestiona proyectos, testimonios, aliados, voluntarios, donaciones y reportes.
- **Usuario de solo lectura:** inicia sesión únicamente para ver reportes de voluntarios y donaciones. <!-- REVISAR: asumo que puede haber varios -->

## Objetivo / resultado esperado

Que La Faz **capte donantes y voluntarios** a través de la web para poder financiar y realizar más proyectos. Las donaciones se asignan por proyecto, y hay proyectos mensuales y anuales.

La señal de que funciona es la **cantidad de donaciones recibidas por mes**, y se espera ver cambios en los **primeros 3 meses** desde que exista la pasarela real.

<!-- REVISAR: no hay cifra objetivo; la línea base es de 3 donaciones al mes -->
<!-- REVISAR: capturar voluntarios es un objetivo, pero no definiste cómo se mide (no hay meta de inscripciones) -->

## Alcance (qué sí incluye esta versión)

**Web pública**

- Header con logo y nombre de La Faz, menú (Quiénes somos · Proyectos · Testimonios · Voluntarios · Aliados · Donar) y botón CTA "Donar ahora".
- Footer con información de contacto.
- Secciones: Quiénes somos, Proyectos, Testimonios, Voluntarios (inscripción), Aliados y Donar.
- Proyectos en cards pequeñas; al hacer clic se muestra información detallada.
- Sitio en **español e inglés**. El administrador carga el contenido en ambos idiomas.
- Flujo de donación **simulado y completo**: el donante elige un proyecto, deja sus datos y pulsa Donar, ve el mensaje de "donación exitosa", y el registro se guarda con estado `simulada`.
- Inscripción de voluntarios, validada por número de documento único.

**Panel admin**

- Login con dos roles: administrador (acceso total) y solo lectura (solo ve reportes).
- Recuperación de contraseña por correo.
- Gestión (crear, editar y desactivar) de proyectos, testimonios y aliados, y alta manual de voluntarios.
- Reportes exportables: donaciones por proyecto con filtro de fecha, y lista de voluntarios.
- Envío de correos automáticos en tres casos: recuperación de contraseña, confirmación de inscripción al voluntario y confirmación de donación al donante.

**Dependencias externas:** pasarela de pago, en espera; se define al final, después de cerrar el trabajo de la web.

## No alcance (qué explícitamente no incluye esta versión)

- No incluye pasarela de pago real: la donación es simulada.
- No incluye donaciones recurrentes ni cuentas de donante con historial.
- No incluye gestión de proyectos más allá de crear, editar y desactivar (sin metas de recaudación ni seguimiento de avance).
- No incluye login con Google ni con redes sociales.
- No incluye galería de fotos, ni blog ni noticias.

## Criterios de éxito

**Funcionales (v1)**

- Un donante completa el flujo de donación simulada de punta a punta (elegir proyecto, datos, Donar, mensaje de éxito) y la donación aparece en el panel con estado `simulada`.
- El administrador puede, sin ayuda, administrar proyectos, testimonios y aliados (crear y editar) y sacar reportes exportables de donaciones por proyecto con filtro de fecha y de voluntarios.
- Un voluntario puede inscribirse por la web, y el administrador puede darlo de alta desde el panel. Un documento ya registrado se rechaza.
- Un usuario de solo lectura puede ver los reportes y no puede modificar nada.
- El sitio se puede cambiar entre español e inglés y muestra el contenido cargado en cada idioma.

**De negocio (solo medibles cuando exista la pasarela real)**

- **Línea base:** 3 donaciones al mes (transferencia y WhatsApp).
- **Resultado esperado:** mejora visible en las donaciones mensuales dentro de los primeros 3 meses con pasarela activa.
- **Meta numérica:** no se define; no es prioritaria para La Faz. La comparación se hace contra la línea base de 3 donaciones al mes. <!-- REVISAR: sin meta, "mejora visible" es subjetivo -->
- **Voluntarios:** sin meta por ahora.

**Anti-métrica:** no se evalúa el éxito con las donaciones simuladas, porque no representan dinero real. <!-- REVISAR: lo añadí yo por la consecuencia de la donación simulada -->

<!-- REVISAR: no hay tiempo máximo para completar una donación ni para sacar un reporte; solo el criterio "sin ayuda" -->

## Casos borde a contemplar

- **Montos:** todo valor de dinero se valida: no puede ser vacío, cero, negativo, con letras ni con formato inválido.
- **Proyectos:** un proyecto se **desactiva y nunca se elimina**, para conservar el historial de donaciones y de reportes.
- **Permisos:** el usuario de solo lectura no puede acceder a pantallas de edición, ni por URL. Quien no tenga sesión no entra al panel. <!-- REVISAR: no me indicaste este caso; es el que asumo por la regla de los dos roles -->
- **Voluntarios:** el **número de documento** es único. Si alguien ya está inscrito, se rechaza el duplicado con un mensaje claro, tanto desde la web como desde el panel.
- **Edición simultánea:** descartada, porque solo hay un administrador con acceso total.
- **Donación abandonada:** si el donante cierra la página antes de pulsar Donar, no se registra nada. <!-- REVISAR: lo asumí yo -->
- **Contenido bilingüe:** si falta la descripción en inglés, se muestra la de español.

## Supuestos y riesgos abiertos

**Supuestos**

- El proyecto se levanta primero **en local**. La pasarela de pago y el alojamiento se definen después. <!-- REVISAR: no hay fecha ni proveedor definido para ninguno de los dos -->
- Los donantes llegan a la web desde Facebook, WhatsApp y recomendaciones, y la web les da suficiente credibilidad para donar. <!-- REVISAR: no lo validaste con donantes reales -->
- Un solo administrador total puede gestionar todo el contenido y las donaciones, sin carga excesiva.
- Quien administre puede redactar el contenido en español e inglés, o cuenta con alguien que lo traduzca. <!-- REVISAR -->
- La Faz puede recibir donaciones del exterior sin problema.
- El volumen de correos será bajo, por lo que el costo de un servicio de envío no debería ser significativo. <!-- REVISAR: no está validado; depende del proveedor y de qué correos se envíen -->

**Riesgos**

- **Donación simulada visible al público:** si el sitio se publica antes de integrar la pasarela, un donante podría creer que donó y no se cobró nada. Mitigación: no publicar así, o mostrar un aviso de modo demo.
- **Pasarela de pago:** la preocupación principal del dueño del proyecto. Se decidió no bloquear el avance por ella: primero se cierra el trabajo de la web y al final se evalúan proveedores. Su integración puede cambiar el flujo de donación y depende de un proveedor externo y de requisitos de la ONG. <!-- REVISAR: no sé qué proveedor ni qué documentos exigirá -->
- **Correo automático:** la recuperación de contraseña y las confirmaciones de voluntarios y donaciones necesitan un servicio de envío. En local no llegarán correos reales hasta configurarlo, y tiene un costo posible.
- **Administrador único:** si pierde el acceso a su correo, también pierde la recuperación de clave. Falta decidir quién respalda ese acceso.
- **Contenido bilingüe:** se duplica el trabajo de carga del administrador.
- **Línea base baja** (3 donaciones al mes): las mejoras serán difíciles de leer estadísticamente, y sin meta numérica no se puede declarar éxito de forma objetiva.
