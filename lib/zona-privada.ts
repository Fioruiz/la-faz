import "server-only";

import { redirect } from "next/navigation";
import { ResponsableNoActivoError } from "./private-access";

// Para páginas privadas: si la lectura rechaza al responsable (sin sesión, desactivado o inexistente),
// lleva al login. Cualquier otro error sigue su curso.
export async function oAlLogin<T>(lectura: () => Promise<T>): Promise<T> {
  try {
    return await lectura();
  } catch (e) {
    if (e instanceof ResponsableNoActivoError) redirect("/login");
    throw e;
  }
}
