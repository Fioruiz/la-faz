import { z } from "zod";
import { casilla, texto, textoOpcional } from "./esquemas-formulario";

// Datos mínimos del formulario público: nombre, contacto, mensaje opcional y consentimiento.
// El contacto es obligatorio aquí (en apoyantes es opcional). La versión del consentimiento NO viene del
// formulario: la fija el servidor. `sitio_web` es el campo trampa y lo revisa la escritura, no este esquema.
export const inscripcionVoluntarioEsquema = z.object({
  nombre: texto(100, "Escribe tu nombre"),
  contacto: texto(200, "Escribe un contacto (teléfono o correo)"),
  mensaje: textoOpcional(500),
  consentimiento: casilla.refine((v) => v === true, "Debes aceptar el uso de tus datos para inscribirte"),
});
