import { z } from "zod";
import { campoProyecto, idOpcional } from "./donaciones-esquemas";
import { casilla, id, texto } from "./esquemas-formulario";

// Editar solo exige la donación: el resto (monto, medio, cantidad, fecha, proyecto, ítem,
// descripción, confirmación) se valida dentro de la escritura con registrarDonacionEsquema, usando el tipo
// y el donante que están en la fila. Así el tipo y el donante nunca salen de la entrada, y las reglas
// son las mismas que las del registro.
export const editarDonacionEsquema = z.looseObject({ donacionId: id("Donación") });
// Asignar solo toca el proyecto y el ítem: el resto de la donación no cambia.
export const asignarDonacionEsquema = z.object({
  donacionId: id("Donación"),
  proyectoId: campoProyecto,
  itemId: idOpcional("Ítem"),
  confirmarDuplicado: casilla,
});

export const anularDonacionEsquema = z.object({
  donacionId: id("Donación"),
  motivo: texto(200, "Escribe el motivo de la anulación"),
});
