import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

async function consultasComo(tx: Tx, responsableId: number) {
  return crearConsultasPrivadas(() => verificarResponsableActivo(tx, responsableId), () => tx);
}

describe("lecturas privadas de proyectos", () => {
  test("la lista incluye activos y finalizados con su cantidad de ítems", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const activo = await crearProyecto(tx, { nombre: "Zeta activo", tieneMeta: true });
      const finalizado = await crearProyecto(tx, { nombre: "Alfa finalizado", estado: "finalizado", resultado: "Hecho" });
      await crearItem(tx, activo.id, { nombre: "A" });
      await crearItem(tx, activo.id, { nombre: "B" });
      const lista = await (await consultasComo(tx, r.id)).listarProyectos();
      const a = lista.find((p) => p.id === activo.id);
      const f = lista.find((p) => p.id === finalizado.id);
      assert.deepEqual([a?.estado, a?.tieneMeta, a?.cantidadItems], ["activo", true, 2]);
      assert.deepEqual([f?.estado, f?.cantidadItems], ["finalizado", 0]);
    }));

  test("la lista pone los activos antes que los finalizados", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      await crearProyecto(tx, { nombre: "A-finalizado", estado: "finalizado", resultado: "x" });
      await crearProyecto(tx, { nombre: "Z-activo" });
      const estados = (await (await consultasComo(tx, r.id)).listarProyectos()).map((p) => p.estado);
      assert.equal(estados.indexOf("finalizado") > estados.lastIndexOf("activo"), true);
    }));

  test("getProyecto devuelve los ítems ordenados por nombre", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const p = await crearProyecto(tx, { tieneMeta: true, descripcion: "d" });
      await crearItem(tx, p.id, { nombre: "Cereal" });
      await crearItem(tx, p.id, { nombre: "Agua", costoReferencial: "13.00" });
      const leido = await (await consultasComo(tx, r.id)).getProyecto(p.id);
      assert.deepEqual(leido?.items.map((i) => i.nombre), ["Agua", "Cereal"]);
      assert.equal(leido?.items[0].costoReferencial, "13.00");
      assert.equal(leido?.items[1].costoReferencial, null);
      assert.equal(leido?.descripcion, "d");
    }));

  test("un id inexistente o inválido devuelve null", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const c = await consultasComo(tx, r.id);
      for (const id of [2_000_000_000, 0, -1, 1.5, Number.NaN, 3_000_000_000]) {
        assert.equal(await c.getProyecto(id), null, String(id));
      }
    }));

  test("las consultas de proyectos rechazan a un responsable desactivado sin devolver datos", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { activo: false });
      const p = await crearProyecto(tx);
      const c = await consultasComo(tx, r.id);
      await assert.rejects(c.listarProyectos(), ResponsableNoActivoError);
      await assert.rejects(c.getProyecto(p.id), ResponsableNoActivoError);
    }));
});
