"use server";

import { anularDonacion, asignarDonacion, editarDonacion } from "@/lib/donaciones-correcciones";
import { registrarDonacion } from "@/lib/donaciones-escrituras";
import { crearAccionPrivada } from "@/lib/escritura-auditada";

// No hay acciones de borrado ni de restaurar una donación anulada: el PRD solo habla de anular.
export const registrarDonacionAccion = crearAccionPrivada({ nombre: "registrar-donacion", ...registrarDonacion });
export const editarDonacionAccion = crearAccionPrivada({ nombre: "editar-donacion", ...editarDonacion });
export const asignarDonacionAccion = crearAccionPrivada({ nombre: "asignar-donacion", ...asignarDonacion });
export const anularDonacionAccion = crearAccionPrivada({ nombre: "anular-donacion", ...anularDonacion });
