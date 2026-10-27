import { z } from "zod";

// Ayudantes de validación de formularios, compartidos por proyectos y apoyantes.

// Texto recortado y con tope; el mensaje de "vacío" lo pone cada campo.
export const texto = (max: number, vacio: string) =>
  z.string({ error: vacio }).trim().min(1, vacio).max(max, `Máximo ${max} caracteres`);

// Opcional: lo vacío se guarda como null, no como "".
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

// Casilla de formulario: "on" cuando está marcada, ausente cuando no.
export const casilla = z.union([z.string(), z.boolean()]).optional().transform((v) => v === "on" || v === "true" || v === true);

export const id = (campo: string) =>
  z.coerce.number({ error: `${campo} inválido` }).int(`${campo} inválido`).positive(`${campo} inválido`);
