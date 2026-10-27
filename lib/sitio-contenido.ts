// Contenido de la zona pública estática, tal como lo entregó la ONG. Las páginas solo lo presentan.
// Sin dependencias de Next ni de la base: una prueba lo importa directamente.

export const NOMBRE_ONG = "La FAZ";

export const DESCRIPCION_ONG =
  "Somos una asociación sin fines de lucro trabajando para acompañar a personas, familias y comunidades en situación de vulnerabilidad. Lo hacemos promoviendo sus derechos, fortaleciendo sus capacidades y construyendo redes de solidaridad que permitan recuperar oportunidades y dignidad.";

// Solo enlaces a páginas que existen (una prueba lo comprueba). "Proyectos" va a /nuestros-proyectos: /proyectos
// es la lista privada.
export const MENU = [
  { href: "/", texto: "Inicio" },
  { href: "/quienes-somos", texto: "Quiénes somos" },
  { href: "/nuestros-proyectos", texto: "Proyectos" },
  { href: "/como-donar", texto: "Cómo donar" },
  { href: "/voluntariado", texto: "Voluntariado" },
] as const;

export const QUIENES_SOMOS = {
  etiqueta: "QUIÉNES SOMOS",
  titular: "Nacimos de un amor que se convierte en acción.",
  parrafos: [
    "En 2004, nuestra fundadora Jessica Cabanillas y seis socios decidieron unir esfuerzos para responder a las necesidades de personas y familias de su comunidad. Así nació La Faz.",
    "Más de dos décadas después, aquella primera decisión sigue siendo el corazón de nuestro trabajo: estar cerca de los más vulnerables y construir, junto a ellos, caminos hacia una vida con más oportunidades y dignidad.",
    "Hoy, estamos presentes en tres regiones del país: Ventanilla (Callao), Chepén e Ica, desarrollando programas y proyectos sociales que buscan promover la educación en derechos, el deporte y la música en niños y jóvenes, así como la atención a migrantes, damnificados y casos sociales.",
  ],
} as const;

// Solo lo que menciona el texto de la ONG; no se añaden actividades.
export const LINEAS_DE_TRABAJO = [
  "Educación en derechos",
  "Deporte y música en niños y jóvenes",
  "Atención a migrantes, damnificados y casos sociales",
] as const;

export const HISTORIA = {
  etiqueta: "NUESTRA HISTORIA",
  titular: "Un camino de más de 21 años",
} as const;

export const HITOS = [
  {
    anio: "2004",
    frase: "Todo comenzó con una decisión: estar al lado del otro.",
    descripcion:
      "Nace La Faz, fruto de la iniciativa de su fundadora Jessica Cabanillas y seis socios que decidieron responder juntos a las necesidades de su comunidad.",
  },
  {
    anio: "2004",
    frase: "Una vocación se convirtió en compromiso.",
    descripcion:
      "La Faz queda formalmente constituida y establece una misión centrada en el bienestar, los derechos humanos, la dignidad y el desarrollo integral de las personas.",
  },
  {
    anio: "2004 - 2024",
    frase: "El compromiso creció.",
    descripcion:
      "La acción de La Faz se extendió a nuevos ámbitos y territorios, acompañando a niños, familias, adultos mayores, personas migrantes y otras poblaciones en situación de necesidad.",
  },
  {
    anio: "2025",
    frase: "Un nuevo capítulo comienza.",
    descripcion: "La Faz es reconocida como ONGD ante APCI, fortaleciendo su camino institucional.",
  },
  {
    anio: "2026",
    frase: "Más de 21 años después, seguimos presentes.",
    descripcion:
      "Hoy La Faz continúa transformando su vocación de servicio en acciones concretas, a través de programas sociales y redes de solidaridad.",
  },
] as const;

export const VOLUNTARIOS = {
  etiqueta: "VOLUNTARIOS",
  titular: "Son el corazón de todo esto.",
  texto:
    "Más de 50 voluntarios activos dedican su tiempo y energía a acompañar a niños, adultos mayores, familias y migrantes en Ventanilla (Callao), Chepén e Ica. Personas comprometidas con una misma vocación: servir con caridad, solidaridad y justicia.",
  boton: "Ser voluntario",
  href: "/voluntariado",
} as const;

// Texto de consentimiento del formulario de voluntariado. PROVISIONAL: falta la revisión legal de la ley
// peruana de protección de datos personales. La versión se guarda con cada inscripción (la fija el servidor);
// al cambiar el texto, cambia también la versión.
// Nombre del campo trampa del formulario (el núcleo de lib/voluntariado-inscripcion-core.ts usa el mismo).
export const CAMPO_TRAMPA_NOMBRE = "sitio_web";

export const CONSENTIMIENTO_VOLUNTARIADO = {
  version: "provisional-2026",
  aviso: "Texto provisional, pendiente de revisión legal.",
  texto:
    "Autorizo a La FAZ a guardar mi nombre, mi contacto y mi mensaje para organizar la participación de voluntarios. Solo los responsables de La FAZ podrán verlos: no se publican en esta web. Puedo pedir a través de los responsables de La FAZ que se corrijan o se eliminen mis datos.",
} as const;

export const DATOS_LEGALES = {
  nombre: "Asociación La Faz",
  razonSocial: "Asociación La Faz – Lineamiento de Apoyo en Fraternidad: Adonai Zarza Ardiente",
  descripcion:
    "Asociación Civil sin fines de lucro. RUC: 20554014039. Perceptora de donaciones (IPREDA). Registrada como ONGD ante APCI desde 2025.",
} as const;

// Datos de DEMOSTRACIÓN: valores de relleno evidentes. No hay cuentas reales en el repositorio y el sitio
// no cobra ni se conecta a bancos (TECH-DESIGN). Una prueba exige que sean de relleno.
export const MEDIOS_DONACION = [
  {
    id: "yape",
    nombre: "Yape",
    pasos: [
      "Abre tu app de Yape y elige yapear a un número.",
      "Escribe el número de la ONG y revisa que el nombre del titular sea el correcto.",
      "Indica el monto que deseas donar y confirma.",
    ],
    datos: [
      { etiqueta: "Número", valor: "000 000 000" },
      { etiqueta: "Titular", valor: "Asociación La Faz (demostración)" },
    ],
  },
  {
    id: "plin",
    nombre: "Plin",
    pasos: [
      "Abre la app de tu banco con Plin y elige enviar a un número.",
      "Escribe el número de la ONG y revisa que el nombre del titular sea el correcto.",
      "Indica el monto que deseas donar y confirma.",
    ],
    datos: [
      { etiqueta: "Número", valor: "000 000 000" },
      { etiqueta: "Titular", valor: "Asociación La Faz (demostración)" },
    ],
  },
  {
    id: "transferencia",
    nombre: "Transferencia bancaria (Perú)",
    pasos: [
      "Desde tu banca por internet o app, elige transferir a una cuenta de otro banco o del mismo.",
      "Ingresa el número de cuenta o el CCI de la ONG y revisa el nombre del titular.",
      "Indica el monto que deseas donar y confirma.",
    ],
    datos: [
      { etiqueta: "Banco", valor: "Banco de Demostración" },
      { etiqueta: "Cuenta en soles", valor: "000-0000000000-0-00" },
      { etiqueta: "CCI", valor: "000-000-000000000000-00" },
      { etiqueta: "Titular", valor: "Asociación La Faz (demostración)" },
    ],
  },
  {
    id: "internacional",
    nombre: "Transferencia internacional",
    pasos: [
      "Desde tu banco, elige enviar una transferencia internacional.",
      "Ingresa el código SWIFT y la cuenta de la ONG, y revisa el nombre del titular.",
      "Indica el monto y la moneda de envío y confirma.",
    ],
    datos: [
      { etiqueta: "Banco", valor: "Banco de Demostración" },
      { etiqueta: "SWIFT", valor: "DEMOXXPE" },
      { etiqueta: "Cuenta", valor: "000-0000000000-0-00" },
      { etiqueta: "Titular", valor: "Asociación La Faz (demostración)" },
    ],
  },
] as const;

export const AVISO_SIMULACION = {
  titulo: "Datos de demostración",
  texto:
    "Los datos de esta página son de demostración. Este sitio todavía no es un canal real de donación: no envíes dinero a estos números ni cuentas.",
  etiquetaMedio: "Datos de demostración",
} as const;

export const DONACION_PRODUCTOS = {
  titulo: "Donar productos",
  texto:
    "También puedes apoyar con productos, como agua, cereal o fruta. La entrega se coordina con la ONG.",
  enlaceTexto: "Mira qué se necesita en cada proyecto",
  enlaceHref: "/nuestros-proyectos",
} as const;
