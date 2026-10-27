import { eq, inArray } from "drizzle-orm";
import { hashPassword } from "../lib/password";
import { apoyantes, auditLog, donaciones, intentosLimitados, proyectos, responsables } from "../lib/schema";
import { createTestDb } from "../tests/test-db";

// Datos de apoyo de las pruebas E2E que escriben. SOLO la rama de pruebas de Neon: createTestDb se niega si
// DATABASE_URL_TEST es el mismo endpoint que la base real. Cada prueba crea lo suyo con un sufijo único y lo borra.
export const { db, pool } = createTestDb();

export const sufijo = () => Math.random().toString(36).slice(2, 8);

export async function crearResponsableDePrueba(password: string) {
  const correo = `e2e-${sufijo()}@prueba.test`;
  const [r] = await db
    .insert(responsables)
    .values({ nombre: "Responsable E2E", correo, passwordHash: await hashPassword(password) })
    .returning();
  return { id: r.id, correo };
}

// Devuelve el proyecto; si la rama de pruebas no lo tiene (los seeds solo se corren en producción), lo crea y avisa
// con `creado` para que la prueba lo borre al terminar. Un proyecto que ya existía nunca se borra.
export async function asegurarProyecto(nombre: string, tieneMeta: boolean) {
  const [existente] = await db.select().from(proyectos).where(eq(proyectos.nombre, nombre));
  if (existente) return { id: existente.id, creado: false };
  const [p] = await db.insert(proyectos).values({ nombre, tieneMeta }).returning();
  return { id: p.id, creado: true };
}

// Borra lo que creó el responsable de prueba (historial y donaciones primero, por las claves foráneas), a sus
// apoyantes de prueba y, solo si lo creó la prueba, el proyecto. Nunca toca datos de otros.
export async function limpiar(responsableId: number, apoyanteIds: number[], proyectoCreadoId?: number) {
  await db.delete(auditLog).where(eq(auditLog.responsableId, responsableId));
  await db.delete(donaciones).where(eq(donaciones.registradoPor, responsableId));
  if (apoyanteIds.length) await db.delete(apoyantes).where(inArray(apoyantes.id, apoyanteIds));
  await db.delete(responsables).where(eq(responsables.id, responsableId));
  if (proyectoCreadoId) await db.delete(proyectos).where(eq(proyectos.id, proyectoCreadoId));
}

// En local no hay cabecera de IP: todos los envíos del formulario comparten una clave y alcanzan el límite de 5
// por hora (ADR 0011). Las pruebas que envían el formulario vacían esos contadores de la RAMA DE PRUEBAS.
export async function vaciarContadoresDelFormulario() {
  await db.delete(intentosLimitados).where(eq(intentosLimitados.tipo, "formulario"));
}
