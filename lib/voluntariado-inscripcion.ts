import "server-only";

import { getDb } from "./db-client";
import { claveDeIp } from "./limite-intentos";
import { inscribirVoluntario as inscribir } from "./voluntariado-inscripcion-core";

export { CAMPO_TRAMPA } from "./voluntariado-inscripcion-core";

// `forwardedFor` es la cabecera x-forwarded-for: la IP solo se usa para el límite y queda como resumen con clave.
export const inscribirVoluntario = (entrada: FormData, forwardedFor: string | null) =>
  inscribir(getDb(), entrada, { claveIp: claveDeIp(forwardedFor) });
