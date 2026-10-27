"use server";

import { crearApoyante, editarApoyante } from "@/lib/apoyantes-escrituras";
import { crearAccionPrivada } from "@/lib/escritura-auditada";

// No hay acción de borrado: el PRD no la menciona. El historial no guarda el contacto.
export const crearApoyanteAccion = crearAccionPrivada({ nombre: "crear-apoyante", ...crearApoyante });
export const editarApoyanteAccion = crearAccionPrivada({ nombre: "editar-apoyante", ...editarApoyante });
