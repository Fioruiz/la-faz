import "server-only";

import { redirect } from "next/navigation";
import type { z } from "zod";
import { getDb } from "./db-client";
import {
  ejecutarEscrituraAuditada,
  type EscrituraAuditada,
  type ResultadoAccion,
} from "./escritura-auditada-core";
import { requireResponsableActivo } from "./private-access";

export { ReglaDeNegocioError, type RegistroAuditoria, type ResultadoAccion } from "./escritura-auditada-core";

// Toda escritura de la zona privada pasa por aquí (ADR 0003, 0006 y 0009). Orden fijo:
// responsable activo -> validación con Zod -> transacción con el cambio y su historial.
//
// Cómo escribir una acción nueva (por ejemplo, en app/(privado)/proyectos/actions.ts):
//
//   "use server";
//   import { z } from "zod";
//   import { eq } from "drizzle-orm";
//   import { ReglaDeNegocioError, crearAccionPrivada } from "@/lib/escritura-auditada";
//   import { proyectos } from "@/lib/schema";
//
//   export const editarDescripcion = crearAccionPrivada({
//     nombre: "editar-descripcion-proyecto",       // sale en el log si algo falla
//     esquema: z.object({
//       proyectoId: z.coerce.number().int().positive(),
//       descripcion: z.string().trim().min(1, "Escribe una descripción").max(500),
//     }),
//     escribir: async (tx, datos) => {              // tx es la transacción; datos ya están validados
//       const [antes] = await tx.select().from(proyectos).where(eq(proyectos.id, datos.proyectoId));
//       if (antes.estado === "finalizado") throw new ReglaDeNegocioError("Este proyecto ya está finalizado");
//       await tx.update(proyectos).set({ descripcion: datos.descripcion }).where(eq(proyectos.id, datos.proyectoId));
//       return {
//         datos: { id: datos.proyectoId },
//         // Obligatorio: al menos un registro. Solo los valores que deban quedar en el historial.
//         auditoria: [{
//           entidad: "proyecto", entidadId: datos.proyectoId, accion: "editar",
//           antes: { descripcion: antes.descripcion }, despues: { descripcion: datos.descripcion },
//         }],
//       };
//     },
//   });
//
// En el formulario: useActionState(editarDescripcion, null). Si el resultado es de tipo "validacion",
// muestra `errores` por campo y repone los campos con `valores`; si es "regla" o "error", muestra `mensaje`.
// Una acción de escritura que no usa esto no pasa la prueba estructural (tests/escritura-auditada-estructura.test.ts).
type DefinicionAccion<TEsquema extends z.ZodType, TDatos> = Pick<
  EscrituraAuditada<TEsquema, TDatos>,
  "nombre" | "esquema" | "camposSensibles" | "escribir"
>;

export function crearAccionPrivada<TEsquema extends z.ZodType, TDatos>(definicion: DefinicionAccion<TEsquema, TDatos>) {
  return async function accionPrivada(
    _estadoPrevio: ResultadoAccion<TDatos> | null,
    formData: FormData,
  ): Promise<ResultadoAccion<TDatos>> {
    const resultado = await ejecutarEscrituraAuditada({
      ...definicion,
      db: getDb(),
      requerir: requireResponsableActivo,
      entrada: formData,
    });
    // Fuera del try/catch del ejecutor: NEXT_REDIRECT no debe confundirse con un error.
    if (!resultado.ok && resultado.tipo === "no_autorizado") redirect("/login");
    return resultado;
  };
}
