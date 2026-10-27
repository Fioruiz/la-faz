# Proposal

## Why

El PRD dice que, al no existir una web oficial, la ONG "no inspira confianza a donantes potenciales, en especial a los del extranjero". Hoy la raíz del sitio (`app/page.tsx`) solo dice "En construcción". El ítem #11 del backlog pide la parte de la zona pública que no depende de la base de datos: presentar a La FAZ y explicar cómo donar. Es lo que un visitante necesita para saber quiénes son y dar el primer paso, y deja listos el menú y el pie de página que usarán #12 (proyectos con barra) y #13 (voluntariado).

## What Changes

Alcance estricto del ítem #11 ("Sitio público estático") con el contenido que aportó el usuario:

- **Estructura compartida de la zona pública**: una cabecera con menú (Inicio, Quiénes somos, Cómo donar, Voluntariado), un pie de página con los datos legales y un enlace discreto "Acceso responsables"; amigable, adaptable a celular y accesible (saltar al contenido, puntos de referencia, contraste, foco visible).
- **Inicio (`/`)**: descripción de la ONG, accesos a "Cómo donar" y "Ser voluntario", resumen de "Quiénes somos", las líneas de trabajo que el propio texto menciona (educación en derechos, deporte y música, atención a migrantes, damnificados y casos sociales) y el bloque de voluntarios.
- **Quiénes somos (`/quienes-somos`)**: el texto "Nacimos de un amor que se convierte en acción" y, en la misma página, la sección **Nuestra historia** como línea de tiempo (2004 a 2026). Ubicación decidida: la historia va *dentro* de Quiénes somos, con ancla `#historia`, no como entrada propia del menú (el usuario no sabía dónde ubicarla).
- **Cómo donar (`/como-donar`)**: Yape, Plin, transferencia nacional y transferencia internacional, con **datos ficticios de demostración** y un aviso visible de que son simulados. Sin botones de pago, sin formularios, sin SDK.
- **Voluntariado (`/voluntariado`)**: página provisional que invita a ser voluntario y avisa que el formulario llegará pronto. El botón "Ser voluntario" del inicio apunta aquí, para no dejar un enlace roto hasta que #13 lo reemplace por el formulario.
- **Pie de página**: nombre legal "Asociación La Faz" con su razón social completa, y "Asociación Civil sin fines de lucro. RUC: 20554014039. Perceptora de donaciones (IPREDA). Registrada como ONGD ante APCI desde 2025."
- **Título y descripción** propios por página y pruebas estructurales (sin base de datos, sin SDK de pago, sin formularios en "Cómo donar", contenido clave y aviso de simulación presentes).

Decisiones registradas para revisión:
- **Menú sin "Proyectos"** hasta #12: enlazar a una ruta que no existe dejaría un enlace roto. #12 lo añade.
- **Historia dentro de Quiénes somos** (ver arriba).
- **Botón "Ser voluntario" → página provisional `/voluntariado`**, que #13 reemplaza por el formulario con consentimiento.
- **Páginas estáticas, sin consultas a la base**: el ADR 0005 manda páginas dinámicas "porque cada visita consulta Postgres"; estas páginas no leen datos, así que no hay avance que pueda quedar viejo. No lo contradice; sí queda anotado que la página de proyectos de #12 sí debe ser dinámica y que el inicio **no** mostrará avance (si #12 quiere un resumen en el inicio, tendrá que volverlo dinámico).
- **Datos del usuario transcritos**: RUC, IPREDA, APCI, "más de 50 voluntarios", el nombre de la fundadora y los hitos son afirmaciones públicas de la ONG; el usuario confirmó que son correctos (el sistema no los comprueba por su cuenta).
- **Datos de cuenta ficticios y obviamente falsos** (ceros, "Banco de Demostración"), para cumplir TECH-DESIGN ("el repositorio no contiene datos de cuentas reales").

- **Sección de proyectos con "qué se puede donar"** (pedida por el usuario): es el ítem #12, porque los ítems donables (packs, agua, etc.) son las metas que el responsable crea en la base y hay que leerlos por `lib/public-queries.ts` (ADR 0007), no escribirlos a mano. Este cambio no la incluye; en "Cómo donar" la donación de productos remite a esa sección cuando exista. #12 debe añadir "Proyectos" al menú y enlazar desde "Cómo donar".

Puntos que se señalan al usuario:
- **Ubicación confirmada por el usuario**: la ONG está en Ventanilla (Callao), Chepén e Ica. `CLAUDE.md` se corrigió (decía "Lima, Chepén, Ica") y el bloque de voluntarios usa la misma redacción ("en Ventanilla (Callao), Chepén e Ica") en lugar de "Ventanilla, Lima e Ica/Chepén".
- **Datos legales y cifras confirmados por el usuario** como correctos (RUC, IPREDA, APCI, "más de 50 voluntarios", hitos).
- **Aclaración del usuario sobre "Cómo donar"**: la información es de simulación y no hay transacción bancaria alguna. El usuario también mencionó que "podrá ingresar información desde la página y grabar en BD"; eso sería un formulario público que escribe en la base, que este cambio NO incluye (el PRD asume que solo el responsable registra donaciones y que el donante no se autorregistra, y el único formulario público previsto es el de voluntariado, #13). Queda pendiente de decisión del usuario; no se implementa ni a medias.
- El PRD marca con `REVISAR` que la cuenta de "Cómo donar" es una simulación; mientras sea así, el aviso es obligatorio y el visitante real no debe poder confundirlo con un canal de donación verdadero.

Fuera de alcance (otros ítems o el PRD): lista de proyectos y barras de avance (#12); formulario de voluntariado y su consentimiento (#13); pago con tarjeta o pasarela, recibos tributarios, galería de fotos, noticias, preguntas frecuentes, contacto y redes sociales (no están en el PRD: se necesita actualizar el PRD primero); cualquier lectura de la base; imágenes o logotipo (la ONG no ha entregado ninguno; se usa solo tipografía y color, y el logo se añade cuando exista).

## Capabilities

### New Capabilities
- `public-site`: estructura de la zona pública (cabecera, menú, pie de página con datos legales, accesibilidad, títulos y descripciones) y sus páginas de contenido: inicio, quiénes somos con la historia, y la página provisional de voluntariado.
- `donation-info`: la página "Cómo donar" con los medios Yape, Plin, transferencia nacional e internacional como demostración, siempre con aviso visible y sin ninguna función de cobro.

### Modified Capabilities
<!-- Ninguna: no existen specs principales de la zona pública. -->

## Impact

- **Código nuevo**: grupo de rutas `app/(publico)/` con su layout, las cuatro páginas, componentes de cabecera, pie y línea de tiempo, un módulo con el contenido textual y los datos de demostración, y las pruebas estructurales.
- **Código existente**: `app/page.tsx` ("En construcción") se mueve al grupo público; `app/layout.tsx` ajusta el título y la descripción por defecto (ya no "en construcción"); `app/globals.css` define los colores de marca; `CLAUDE.md` gana una nota.
- **Dependencias nuevas**: ninguna (ni librería de componentes, ni SDK de pago, ni íconos).
- **Sistemas externos**: ninguno. No toca la base de datos ni `proxy.ts` (las rutas públicas no se protegen).
- **Pendientes del TDD que se tocan**: ninguno; deja explícito el aviso de simulación de TECH-DESIGN y no adelanta A8 (consentimiento, #13).
