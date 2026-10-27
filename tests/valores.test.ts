import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { apoyantes, itemsMeta, proyectos } from "../lib/schema";
import { CHECK, crearItem, crearProyecto, enTransaccion, pool, rechazo } from "./helpers";

after(() => pool.end());

describe("estados y valores permitidos", () => {
  test("proyecto con estado inválido se rechaza", () =>
    enTransaccion(async (tx) => {
      const r = await rechazo(tx, (t) => t.insert(proyectos).values({ nombre: "X", estado: "cerrado" }));
      assert.deepEqual(r, { code: CHECK, constraint: "proyectos_estado_valido" });
    }));

  test("proyecto nuevo queda activo y sin meta por defecto", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx);
      assert.equal(p.estado, "activo");
      assert.equal(p.tieneMeta, false);
    }));

  test("ítem con meta 0 se rechaza", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(itemsMeta).values({ proyectoId: p.id, nombre: "Pack", unidad: "pack", cantidadMeta: 0 }),
      );
      assert.deepEqual(r, { code: CHECK, constraint: "items_meta_meta_positiva" });
    }));

  test("ítem con costo referencial 0 se rechaza", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(itemsMeta).values({
          proyectoId: p.id,
          nombre: "Pack",
          unidad: "pack",
          cantidadMeta: 10,
          costoReferencial: "0",
        }),
      );
      assert.deepEqual(r, { code: CHECK, constraint: "items_meta_costo_positivo" });
    }));

  test("ítem sin costo referencial se acepta y queda nulo", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx);
      const i = await crearItem(tx, p.id);
      assert.equal(i.costoReferencial, null);
    }));

  test("ítem con costo referencial positivo se acepta", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx);
      const i = await crearItem(tx, p.id, { costoReferencial: "0.54" });
      assert.equal(i.costoReferencial, "0.54");
    }));

  test("nombre de proyecto repetido se rechaza", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx);
      const r = await rechazo(tx, (t) => t.insert(proyectos).values({ nombre: p.nombre }));
      assert.equal(r.code, "23505");
    }));

  test("apoyante sin rol se rechaza", () =>
    enTransaccion(async (tx) => {
      const r = await rechazo(tx, (t) => t.insert(apoyantes).values({ nombre: "Nadie" }));
      assert.deepEqual(r, { code: CHECK, constraint: "apoyantes_con_rol" });
    }));

  test("apoyante nuevo no es anónimo por defecto", () =>
    enTransaccion(async (tx) => {
      const [a] = await tx.insert(apoyantes).values({ nombre: "Ana", esVoluntario: true }).returning();
      assert.equal(a.anonimoPublico, false);
    }));
});
