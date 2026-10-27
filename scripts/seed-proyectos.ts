import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "../lib/schema";

// Solo 10 Derechos y Apoyo alimentario tienen meta y barra de avance (PRD).
const PROYECTOS = [
  {
    nombre: "10 Derechos",
    descripcion: "Cada noviembre, packs para niños. Meta de ejemplo: 2000 niños = 2000 packs.",
    tieneMeta: true,
  },
  {
    nombre: "Apoyo alimentario",
    descripcion: "Canastas básicas para familias en pobreza y pobreza extrema.",
    tieneMeta: true,
  },
  {
    nombre: "Música",
    descripcion: "Música con niños, adulto mayor y damnificados.",
    tieneMeta: false,
  },
  {
    nombre: "Casa del Buen Samaritano",
    descripcion: null,
    tieneMeta: false,
  },
];

// Repetible: un proyecto que ya existe no se toca, así se conservan sus ediciones.
export async function sembrarProyectos(db: Pick<NeonDatabase<typeof schema>, "insert">) {
  await db.insert(schema.proyectos).values(PROYECTOS).onConflictDoNothing({ target: schema.proyectos.nombre });
}
