import "server-only";

import { cache } from "react";
import { auth } from "./auth";
import { getDb } from "./db-client";
import { ResponsableNoActivoError, verificarResponsableActivo } from "./responsable-activo";

export { ResponsableNoActivoError };

// Primera operación de toda lectura o escritura privada (ADR 0009). La sesión solo dice quién
// dice ser el responsable; la base dice si existe y está activo.
// `cache` de React solo evita repetir la consulta dentro de una misma renderización.
export const requireResponsableActivo = cache(async () => {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!session?.user?.id || !Number.isSafeInteger(id)) throw new ResponsableNoActivoError();
  return verificarResponsableActivo(getDb(), id);
});
