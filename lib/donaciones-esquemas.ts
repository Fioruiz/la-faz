import { z } from "zod";
import { casilla, id, textoOpcional } from "./esquemas-formulario";
import { esFechaValida } from "./fechas";

export const MEDIOS = ["yape", "plin", "transferencia"] as const;
export const FECHA_MINIMA = "2020-01-01";
export const SIN_ASIGNAR = "sin-asignar";

// Monto en soles: "150", "150.5" o "150,50"; hasta 10 enteros y 2 decimales (numeric(12,2)); mayor que cero.
const monto = z
  .string({ error: "Escribe el monto" })
  .trim()
  .transform((valor, ctx) => {
    if (!/^\d{1,10}([.,]\d{1,2})?$/.test(valor)) {
      ctx.addIssue({ code: "custom", message: "Escribe un monto válido, como 150 o 150,50" });
      return z.NEVER;
    }
    const numero = Number(valor.replace(",", "."));
    if (numero <= 0) {
      ctx.addIssue({ code: "custom", message: "El monto debe ser mayor que cero" });
      return z.NEVER;
    }
    return numero.toFixed(2);
  });

const cantidad = z.coerce
  .number({ error: "Escribe la cantidad como número" })
  .int("La cantidad debe ser un número entero")
  .min(1, "La cantidad debe ser al menos 1")
  .max(1_000_000, "La cantidad máxima es 1.000.000");

// Id opcional de un formulario: vacío o ausente es "no vino".
export const idOpcional = (campo: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((valor, ctx) => {
      if (valor === undefined || valor === "") return undefined;
      const numero = Number(valor);
      if (!Number.isInteger(numero) || numero < 1) {
        ctx.addIssue({ code: "custom", message: `${campo} inválido` });
        return z.NEVER;
      }
      return numero;
    });

// "sin-asignar" -> null (sin proyecto); un id -> ese proyecto; vacío -> error. Del formulario llega texto.
export const campoProyecto = z
  .union([z.string(), z.number()], { error: "Elige un proyecto o Sin asignar" })
  .transform((valor, ctx) => {
    const texto = String(valor).trim();
    if (texto === "") {
      ctx.addIssue({ code: "custom", message: "Elige un proyecto o Sin asignar" });
      return z.NEVER;
    }
    if (texto === SIN_ASIGNAR) return null;
    if (!/^\d+$/.test(texto) || Number(texto) < 1) {
      ctx.addIssue({ code: "custom", message: "Proyecto inválido" });
      return z.NEVER;
    }
    return Number(texto);
  });

const fecha = z
  .string({ error: "Escribe la fecha" })
  .trim()
  .refine(esFechaValida, "Fecha inválida")
  .refine((f) => f >= FECHA_MINIMA, `La fecha no puede ser anterior a ${FECHA_MINIMA}`);

const comunes = {
  apoyanteId: id("Donante"),
  proyectoId: campoProyecto,
  fecha,
  donacionVinculadaId: idOpcional("Donación vinculada"),
  confirmarDuplicado: casilla,
};

const dinero = z.object({
  tipo: z.literal("dinero"),
  ...comunes,
  monto,
  medio: z.enum(MEDIOS, { error: "Elige el medio de pago" }),
});

const producto = z.object({
  tipo: z.literal("producto"),
  ...comunes,
  cantidad,
  itemId: idOpcional("Ítem"),
  descripcionProducto: textoOpcional(200),
});

// Un producto asignado necesita ítem; uno sin asignar necesita una descripción de lo recibido.
export const registrarDonacionEsquema = z
  .discriminatedUnion("tipo", [dinero, producto], { error: "Elige dinero o producto" })
  .superRefine((d, ctx) => {
    if (d.tipo !== "producto") return;
    if (d.proyectoId !== null && d.itemId === undefined) {
      ctx.addIssue({ code: "custom", path: ["itemId"], message: "Elige el ítem" });
    }
    if (d.proyectoId === null && !d.descripcionProducto) {
      ctx.addIssue({ code: "custom", path: ["descripcionProducto"], message: "Describe lo que se recibió" });
    }
  });

export type DonacionValidada = z.output<typeof registrarDonacionEsquema>;
