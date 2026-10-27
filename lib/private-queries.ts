import "server-only";

import { getDb } from "./db-client";
import { requireResponsableActivo } from "./private-access";
import { crearConsultasPrivadas } from "./private-queries-core";

export const { getPanel, listarProyectos, getProyecto, getAvanceProyectos, listarApoyantes, getApoyante, listarVoluntarios, getDatosFormularioDonacion, getDonacionParaVincular, listarDonaciones, getDonacion, getReporte } = crearConsultasPrivadas(requireResponsableActivo, () => getDb());
