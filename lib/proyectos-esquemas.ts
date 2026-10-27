import { z } from "zod";
import { casilla, id, texto, textoOpcional } from "./esquemas-formulario";

const nombreProyecto = texto(100, "Escribe el nombre del proyecto");
const descripcion = textoOpcional(1000);

// Costo por UNA unidad del ítem, en soles. Acepta "13", "13.5" y "13,50"; vacío = sin costo.
const costoReferencial = z
  .string()
  .trim()
  .optional()
  .transform((valor, ctx) => {
    if (!valor) return null;
    if (!/^\d{1,7}([.,]\d{1,2})?$/.test(valor)) {
      ctx.addIssue({ code: "custom", message: "Escribe un monto válido, como 13 o 13,50" });
      return z.NEVER;
    }
    const monto = Number(valor.replace(",", "."));
    if (monto <= 0) {
      ctx.addIssue({ code: "custom", message: "El costo debe ser mayor que cero" });
      return z.NEVER;
    }
    return monto.toFixed(2);
  });

const cantidadMeta = z.coerce
  .number({ error: "Escribe la meta como número" })
  .int("La meta debe ser un número entero")
  .min(1, "La meta debe ser al menos 1")
  .max(1_000_000, "La meta máxima es 1.000.000");

const camposItem = {
  nombre: texto(100, "Escribe el nombre del ítem"),
  unidad: texto(30, "Escribe la unidad (por ejemplo, pack)"),
  cantidadMeta,
  costoReferencial,
};

export const crearProyectoEsquema = z.object({ nombre: nombreProyecto, descripcion, tieneMeta: casilla });

export const editarProyectoEsquema = z.object({
  proyectoId: id("Proyecto"),
  nombre: nombreProyecto,
  descripcion,
  tieneMeta: casilla,
});

export const finalizarProyectoEsquema = z.object({
  proyectoId: id("Proyecto"),
  resultado: texto(2000, "Escribe el resultado del proyecto"),
});

export const crearItemEsquema = z.object({ proyectoId: id("Proyecto"), ...camposItem });

export const editarItemEsquema = z.object({ proyectoId: id("Proyecto"), itemId: id("Ítem"), ...camposItem });
