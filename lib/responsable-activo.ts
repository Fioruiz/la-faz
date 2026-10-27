import { eq } from "drizzle-orm";
import type { LectorDb } from "./auth-credentials";
import { responsables } from "./schema";

export class ResponsableNoActivoError extends Error {
  constructor() {
    super("Acceso denegado");
    this.name = "ResponsableNoActivoError";
  }
}

export type ResponsableActivo = { id: number; nombre: string };

// Núcleo de requireResponsableActivo(): lee al responsable en Postgres en cada llamada.
// Nunca se guarda su resultado entre peticiones (ADR 0005 y ADR 0009).
export async function verificarResponsableActivo(db: LectorDb, id: number): Promise<ResponsableActivo> {
  if (!Number.isSafeInteger(id)) throw new ResponsableNoActivoError();
  const [responsable] = await db
    .select({ id: responsables.id, nombre: responsables.nombre, activo: responsables.activo })
    .from(responsables)
    .where(eq(responsables.id, id))
    .limit(1);
  if (!responsable || !responsable.activo) throw new ResponsableNoActivoError();
  return { id: responsable.id, nombre: responsable.nombre };
}
