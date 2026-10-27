# Spec Delta

## Purpose

Da a La FAZ una presencia pública oficial: presenta a la ONG, su historia y su equipo de voluntarios con un diseño amigable y accesible, y ofrece la navegación y los datos legales compartidos por toda la zona pública, sin depender de la base de datos.

## ADDED Requirements

### Requirement: Cabecera y menú de la zona pública
Todas las páginas públicas SHALL mostrar una cabecera con el nombre de la ONG y un menú con enlaces a Inicio, Quiénes somos, Cómo donar y Voluntariado, e indicar cuál es la página actual. El menú MUST NOT enlazar a rutas que no existan.

#### Scenario: Menú completo
- **WHEN** se abre cualquier página pública
- **THEN** la cabecera muestra los cuatro enlaces y cada uno lleva a una página existente

#### Scenario: Página actual
- **WHEN** se está en Quiénes somos
- **THEN** su enlace del menú se distingue de los demás y está marcado como página actual para lectores de pantalla

#### Scenario: Sin Proyectos todavía
- **WHEN** aún no existe la página pública de proyectos
- **THEN** el menú no tiene el enlace "Proyectos"

#### Scenario: Celular
- **WHEN** el ancho de pantalla es de un celular
- **THEN** el menú sigue siendo usable (todos los enlaces alcanzables sin desplazamiento horizontal de la página)

### Requirement: Pie de página con datos legales
Todas las páginas públicas SHALL mostrar un pie de página con el nombre legal "Asociación La Faz", su razón social completa ("Asociación La Faz – Lineamiento de Apoyo en Fraternidad: Adonai Zarza Ardiente") y la descripción "Asociación Civil sin fines de lucro. RUC: 20554014039. Perceptora de donaciones (IPREDA). Registrada como ONGD ante APCI desde 2025.", más un enlace discreto "Acceso responsables" al login.

#### Scenario: Datos legales
- **WHEN** se abre cualquier página pública
- **THEN** el pie muestra el nombre legal, la razón social completa y la descripción con RUC, IPREDA y APCI

#### Scenario: Acceso de responsables
- **WHEN** un responsable busca entrar a la zona privada
- **THEN** encuentra el enlace "Acceso responsables" en el pie y lleva al login

### Requirement: Inicio
La página de inicio SHALL presentar la descripción de la ONG, ofrecer accesos claros a "Cómo donar" y a "Ser voluntario", resumir Quiénes somos con un enlace a la página completa, listar las líneas de trabajo que menciona el texto de la ONG y mostrar el bloque de voluntarios.

#### Scenario: Descripción y accesos
- **WHEN** se abre la página de inicio
- **THEN** se lee que La FAZ es una asociación sin fines de lucro que acompaña a personas, familias y comunidades en situación de vulnerabilidad, y hay accesos a "Cómo donar" y "Ser voluntario"

#### Scenario: Líneas de trabajo
- **WHEN** se revisa el inicio
- **THEN** aparecen la educación en derechos, el deporte y la música en niños y jóvenes, y la atención a migrantes, damnificados y casos sociales, sin añadir actividades que el texto de la ONG no mencione

#### Scenario: Sin datos de la base
- **WHEN** se abre el inicio
- **THEN** no muestra avances, montos, nombres de donantes ni ningún dato leído de la base

### Requirement: Quiénes somos
La página Quiénes somos SHALL mostrar el titular "Nacimos de un amor que se convierte en acción." y el texto de la ONG: su fundación en 2004 por Jessica Cabanillas y seis socios, su vocación y su presencia en Ventanilla (Callao), Chepén e Ica.

#### Scenario: Texto de la ONG
- **WHEN** se abre Quiénes somos
- **THEN** se leen el titular y los tres párrafos del texto aportado por la ONG, sin cambios de contenido

### Requirement: Nuestra historia como línea de tiempo
La página Quiénes somos SHALL incluir la sección "Nuestra historia" con el titular "Un camino de más de 21 años" y una línea de tiempo en orden cronológico con los cinco hitos de la ONG (2004, 2004, 2004 - 2024, 2025 y 2026), cada uno con su año, su frase destacada y su descripción, y la sección MUST ser alcanzable por el ancla `#historia`.

#### Scenario: Hitos en orden
- **WHEN** se revisa la línea de tiempo
- **THEN** hay cinco hitos en el orden 2004, 2004, 2004 - 2024, 2025, 2026, cada uno con año, frase y descripción

#### Scenario: Ancla
- **WHEN** se abre `/quienes-somos#historia`
- **THEN** la página se posiciona en la sección Nuestra historia

#### Scenario: Lectura en celular y por lector de pantalla
- **WHEN** la línea de tiempo se ve en un celular o la lee un lector de pantalla
- **THEN** se presenta como una lista ordenada legible, con el año asociado a cada hito

### Requirement: Bloque de voluntarios y página provisional
El inicio SHALL mostrar el bloque "Son el corazón de todo esto." con el texto de la ONG y un botón "Ser voluntario". Mientras el formulario no exista, el botón MUST llevar a la página `/voluntariado`, que invita a ser voluntario, avisa que el formulario estará disponible pronto, no recoge ningún dato y no tiene campos de entrada.

#### Scenario: Ubicación coherente
- **WHEN** se lee el texto del bloque de voluntarios
- **THEN** dice que acompañan en Ventanilla (Callao), Chepén e Ica, igual que Quiénes somos

#### Scenario: Botón
- **WHEN** se pulsa "Ser voluntario" en el inicio
- **THEN** se abre `/voluntariado`, nunca una página de error

#### Scenario: Página provisional
- **WHEN** se abre `/voluntariado`
- **THEN** se ve el aviso de que el formulario llegará pronto y no hay campos ni botón de envío

### Requirement: Accesibilidad básica
La zona pública SHALL tener puntos de referencia (cabecera, navegación, contenido principal y pie), un enlace para saltar al contenido, un solo título de primer nivel por página, un foco visible en todo elemento interactivo y colores con contraste suficiente en modo claro y oscuro.

#### Scenario: Teclado
- **WHEN** se navega solo con el teclado
- **THEN** el primer elemento enfocable es el enlace para saltar al contenido y cada elemento enfocado se ve resaltado

#### Scenario: Estructura
- **WHEN** se revisa cualquier página pública
- **THEN** tiene exactamente un `h1`, una navegación, un contenido principal y un pie

### Requirement: Título y descripción por página
Cada página pública SHALL tener un título y una descripción propios, en español, que identifiquen a la ONG y la página.

#### Scenario: Títulos
- **WHEN** se revisan las cuatro páginas públicas
- **THEN** cada una tiene un título distinto que termina en el nombre de la ONG y una descripción no vacía

### Requirement: Páginas sin base de datos ni caché propia
Las páginas públicas de este cambio MUST NOT consultar la base de datos ni importar módulos de la zona privada, y no necesitan sesión.

#### Scenario: Sin acceso a datos
- **WHEN** se revisa el código de la zona pública de este cambio
- **THEN** no importa la base, el esquema, Drizzle, Auth.js ni las lecturas privadas

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre cualquiera de las cuatro páginas
- **THEN** la ve completa, sin redirección al login

### Requirement: Contenido sin invenciones
El contenido institucional (nombres, años, cifras, datos legales) MUST coincidir con el texto aportado por la ONG, y el sitio MUST NOT añadir cifras, logros, testimonios ni datos de contacto que la ONG no haya entregado.

#### Scenario: Cifras
- **WHEN** se revisan las páginas
- **THEN** las únicas cifras institucionales son las del texto aportado (2004, "más de 21 años", "más de 50 voluntarios", el RUC y los años de los hitos)
