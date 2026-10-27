import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { count, eq, inArray } from "drizzle-orm";
import { sembrarProyectos } from "../scripts/seed-proyectos";
import {
  apoyantes,
  auditLog,
  donaciones,
  itemsMeta,
  proyectos,
  responsables,
  voluntariosInscritos,
} from "../lib/schema";
import { enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const NOMBRES = ["10 Derechos", "Apoyo alimentario", "Música", "Casa del Buen Samaritano"];

const iniciales = (tx: Tx) => tx.select().from(proyectos).where(inArray(proyectos.nombre, NOMBRES));

describe("datos iniciales", () => {
  test("cuatro proyectos activos, con meta solo en 10 Derechos y Apoyo alimentario", () =>
    enTransaccion(async (tx) => {
      await sembrarProyectos(tx);
      const filas = await iniciales(tx);
      assert.equal(filas.length, 4);
      assert.ok(filas.every((p) => p.estado === "activo"));
      const conMeta = filas.filter((p) => p.tieneMeta).map((p) => p.nombre).sort();
      assert.deepEqual(conMeta, ["10 Derechos", "Apoyo alimentario"]);
    }));

  test("cargar dos veces no duplica", () =>
    enTransaccion(async (tx) => {
      await sembrarProyectos(tx);
      await sembrarProyectos(tx);
      assert.equal((await iniciales(tx)).length, 4);
    }));

  test("un proyecto editado conserva su estado y descripción al volver a cargar", () =>
    enTransaccion(async (tx) => {
      await sembrarProyectos(tx);
      await tx
        .update(proyectos)
        .set({ estado: "finalizado", descripcion: "Editada", resultado: "Se entregaron 2000 packs" })
        .where(eq(proyectos.nombre, "10 Derechos"));
      await sembrarProyectos(tx);
      const [p] = await tx.select().from(proyectos).where(eq(proyectos.nombre, "10 Derechos"));
      assert.equal(p.estado, "finalizado");
      assert.equal(p.descripcion, "Editada");
      assert.equal(p.resultado, "Se entregaron 2000 packs");
    }));

  // Se compara antes y después, no contra cero: otras pruebas confirman filas por unos segundos
  // (conexión real, en procesos paralelos) y la base de pruebas no siempre está vacía.
  test("sembrar no escribe en las demás tablas", () =>
    enTransaccion(async (tx) => {
      const tablas = [responsables, apoyantes, itemsMeta, donaciones, voluntariosInscritos, auditLog];
      const contar = () => Promise.all(tablas.map(async (t) => (await tx.select({ n: count() }).from(t))[0].n));
      const antes = await contar();
      await sembrarProyectos(tx);
      assert.deepEqual(await contar(), antes);
    }));
});
