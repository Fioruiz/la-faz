"use server";

import { headers } from "next/headers";
import type { ResultadoInscripcion } from "@/lib/voluntariado-inscripcion-core";
import { inscribirVoluntario } from "@/lib/voluntariado-inscripcion";

// Única Server Action pública: no hay responsable que comprobar (ADR 0003) ni historial que escribir.
export async function inscribirVoluntarioAccion(
  _previo: ResultadoInscripcion | null,
  datos: FormData,
): Promise<ResultadoInscripcion> {
  return inscribirVoluntario(datos, (await headers()).get("x-forwarded-for"));
}
