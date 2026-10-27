import { z } from "zod";
import { casilla, id, texto, textoOpcional } from "./esquemas-formulario";

// Datos personales mínimos: nombre, un contacto de texto libre, los roles y la marca de anonimato.
// Nada más (ni documento de identidad ni dirección). Falta revisión legal; ver CLAUDE.md.
const campos = {
  nombre: texto(100, "Escribe el nombre"),
  contacto: textoOpcional(200),
  esDonante: casilla,
  esVoluntario: casilla,
  anonimoPublico: casilla,
};

const tieneRol = (d: { esDonante: boolean; esVoluntario: boolean }) => d.esDonante || d.esVoluntario;
const sinRol = { path: ["roles"], message: "Elige al menos un rol" };

export const crearApoyanteEsquema = z.object(campos).refine(tieneRol, sinRol);

export const editarApoyanteEsquema = z.object({ apoyanteId: id("Apoyante"), ...campos }).refine(tieneRol, sinRol);
