import { asc, eq } from "drizzle-orm";
import type { LectorDb } from "./auth-credentials";
import { consultarAvance } from "./avance-consulta";
import { proyectos } from "./schema";

// ÚNICA vía por la que la zona pública lee la base (ADR 0007). Núcleo sin Next ni módulos privados, para
// probarlo contra Postgres real. Solo lecturas.
// Lo que sale está limitado por TIPO: proyectos, ítems y cantidades. No hay campos de dinero, costo
// referencial, "Sin asignar" ni datos de apoyantes, y este módulo no lee `apoyantes` (si algún día se muestra
// un nombre, debe pasar por nombrePublico() de lib/apoyantes-publico.ts).
// El avance viene de consultarAvance() (la misma función que la zona privada); el tope de la meta se aplica
// solo aquí, al presentar.

const ID_MAXIMO = 2_147_483_647;

export type ItemPublico = {
  id: number;
  nombre: string;
  unidad: string;
  meta: number;
  recibido: number; // ya limitado a la meta
  porcentaje: number; // 0..100
  cumplida: boolean;
};

export type ProyectoPublico = {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: "activo" | "finalizado";
  conMeta: boolean;
  resultado: string | null; // solo si está finalizado
  items: ItemPublico[];
  metasTotal: number;
  metasCumplidas: number;
};

type FilaProyecto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  tieneMeta: boolean;
  estado: string;
  resultado: string | null;
};

async function armar(db: LectorDb, filas: FilaProyecto[]): Promise<ProyectoPublico[]> {
  if (filas.length === 0) return [];
  const avance = await consultarAvance(db, { proyectoIds: filas.map((f) => f.id) });
  return filas.map((f) => {
    const items: ItemPublico[] = (f.tieneMeta ? (avance.proyectos[f.id]?.items ?? []) : [])
      .map((i) => ({
        id: i.id,
        nombre: i.nombre,
        unidad: i.unidad,
        meta: i.meta,
        recibido: Math.min(i.recibido, i.meta),
        porcentaje: Math.min(100, i.porcentaje),
        cumplida: i.cumplida,
      }))
      .sort((a, b) => a.id - b.id);
    const finalizado = f.estado === "finalizado";
    return {
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      estado: finalizado ? "finalizado" : "activo",
      conMeta: f.tieneMeta,
      resultado: finalizado ? f.resultado : null,
      items,
      metasTotal: items.length,
      metasCumplidas: items.filter((i) => i.cumplida).length,
    };
  });
}

const COLUMNAS = {
  id: proyectos.id,
  nombre: proyectos.nombre,
  descripcion: proyectos.descripcion,
  tieneMeta: proyectos.tieneMeta,
  estado: proyectos.estado,
  resultado: proyectos.resultado,
};

export function crearLecturasPublicas(obtenerDb: () => LectorDb) {
  return {
    // Activos primero y luego finalizados; dentro de cada grupo por id (orden de creación).
    async listarProyectosPublicos(): Promise<ProyectoPublico[]> {
      const db = obtenerDb();
      const filas = await db.select(COLUMNAS).from(proyectos).orderBy(asc(proyectos.estado), asc(proyectos.id));
      return armar(db, filas);
    },

    // null si el id no es válido o no existe.
    async getProyectoPublico(id: number): Promise<ProyectoPublico | null> {
      if (!Number.isSafeInteger(id) || id < 1 || id > ID_MAXIMO) return null;
      const db = obtenerDb();
      const filas = await db.select(COLUMNAS).from(proyectos).where(eq(proyectos.id, id)).limit(1);
      return (await armar(db, filas))[0] ?? null;
    },
  };
}
