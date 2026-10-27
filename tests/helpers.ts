import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type { PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "../lib/schema";
import { createTestDb } from "./test-db";

export type Tx = PgTransaction<
  NeonQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export const { pool, db } = createTestDb();

const REVERTIR = Symbol("revertir");

// Ejecuta la prueba dentro de una transacción que siempre se revierte: no deja filas.
export async function enTransaccion(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw REVERTIR;
    });
  } catch (e) {
    if (e !== REVERTIR) throw e;
  }
}

export type Rechazo = { code?: string; constraint?: string };

// Ejecuta fn en un savepoint y devuelve el error de Postgres; falla si la base lo acepta.
export async function rechazo(tx: Tx, fn: (tx: Tx) => Promise<unknown>): Promise<Rechazo> {
  try {
    await tx.transaction(async (sp) => {
      await fn(sp as unknown as Tx);
    });
  } catch (e) {
    const err = ((e as { cause?: unknown }).cause ?? e) as Rechazo;
    return { code: err.code, constraint: err.constraint };
  }
  throw new Error("Se esperaba un rechazo de la base, pero aceptó la fila");
}

// SQLSTATE de Postgres.
export const CHECK = "23514";
export const FK = "23503";
export const UNICO = "23505";
export const NO_NULO = "23502";

// Filas mínimas válidas para armar escenarios.
export async function crearResponsable(tx: Tx, valores: Partial<typeof schema.responsables.$inferInsert> = {}) {
  const n = Math.random().toString(36).slice(2);
  const [r] = await tx
    .insert(schema.responsables)
    .values({ nombre: "Resp", correo: `${n}@prueba.test`, passwordHash: "hash", ...valores })
    .returning();
  return r;
}

export async function crearProyecto(tx: Tx, valores: Partial<typeof schema.proyectos.$inferInsert> = {}) {
  const n = Math.random().toString(36).slice(2);
  const [p] = await tx
    .insert(schema.proyectos)
    .values({ nombre: `Proyecto ${n}`, ...valores })
    .returning();
  return p;
}

export async function crearItem(tx: Tx, proyectoId: number, valores: Partial<typeof schema.itemsMeta.$inferInsert> = {}) {
  const [i] = await tx
    .insert(schema.itemsMeta)
    .values({ proyectoId, nombre: "Pack", unidad: "pack", cantidadMeta: 2000, ...valores })
    .returning();
  return i;
}

export async function crearApoyante(tx: Tx, valores: Partial<typeof schema.apoyantes.$inferInsert> = {}) {
  const [a] = await tx
    .insert(schema.apoyantes)
    .values({ nombre: "Donante", esDonante: true, ...valores })
    .returning();
  return a;
}

export async function escenarioBase(tx: Tx) {
  const responsable = await crearResponsable(tx);
  const apoyante = await crearApoyante(tx);
  const proyecto = await crearProyecto(tx);
  const item = await crearItem(tx, proyecto.id);
  return { responsable, apoyante, proyecto, item };
}
