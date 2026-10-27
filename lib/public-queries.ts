import "server-only";

import { getDbPublico } from "./db-publico";
import { crearLecturasPublicas } from "./public-queries-core";
import { comprobarRolPublico } from "./rol-publico";

export type { ItemPublico, ProyectoPublico } from "./public-queries-core";

// Lee con el rol de solo lectura (ADR 0011), nunca con la conexión de la aplicación.
const lecturas = crearLecturasPublicas(() => getDbPublico());

// Antes de la primera lectura se comprueba que la conexión sea de verdad el rol publico_lectura. Se recuerda solo si
// salió bien: si falla, cada visita vuelve a fallar de forma visible (error.tsx), nunca se lee con otro rol.
let verificada: Promise<void> | undefined;
function asegurarRolPublico(): Promise<void> {
  verificada ??= comprobarRolPublico(getDbPublico()).catch((e) => {
    verificada = undefined;
    throw e;
  });
  return verificada;
}

export async function listarProyectosPublicos(...args: Parameters<typeof lecturas.listarProyectosPublicos>) {
  await asegurarRolPublico();
  return lecturas.listarProyectosPublicos(...args);
}

export async function getProyectoPublico(...args: Parameters<typeof lecturas.getProyectoPublico>) {
  await asegurarRolPublico();
  return lecturas.getProyectoPublico(...args);
}
