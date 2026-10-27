"use server";

import { crearAccionPrivada } from "@/lib/escritura-auditada";
import {
  crearItem,
  crearProyecto,
  editarItem,
  editarProyecto,
  finalizarProyecto,
} from "@/lib/proyectos-escrituras";

// No hay acciones de borrado ni de reapertura: el PRD no las menciona.
export const crearProyectoAccion = crearAccionPrivada({ nombre: "crear-proyecto", ...crearProyecto });
export const editarProyectoAccion = crearAccionPrivada({ nombre: "editar-proyecto", ...editarProyecto });
export const finalizarProyectoAccion = crearAccionPrivada({ nombre: "finalizar-proyecto", ...finalizarProyecto });
export const crearItemAccion = crearAccionPrivada({ nombre: "crear-item", ...crearItem });
export const editarItemAccion = crearAccionPrivada({ nombre: "editar-item", ...editarItem });
