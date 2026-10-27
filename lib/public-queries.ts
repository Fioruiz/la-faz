import "server-only";

import { getDbPublico } from "./db-publico";
import { crearLecturasPublicas } from "./public-queries-core";

export type { ItemPublico, ProyectoPublico } from "./public-queries-core";
// Lee con el rol de solo lectura (ADR 0011), nunca con la conexión de la aplicación.
export const { listarProyectosPublicos, getProyectoPublico } = crearLecturasPublicas(() => getDbPublico());
