import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { LectorDb } from "../lib/auth-credentials";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { donaciones } from "../lib/schema";
import { crearApoyante, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const consultasComo = (tx: Tx, responsableId: number, obtenerDb: () => LectorDb = () => tx as unknown as LectorDb) =>
  crearConsultasPrivadas(() => verificarResponsableActivo(tx, responsableId), obtenerDb);

describe("getReporte", () => {
  test("devuelve el reporte con y sin rango válido", () =>
    enTransaccion(async (tx) => {
      const [r, a, p] = [await crearResponsable(tx, { nombre: "Ana" }), await crearApoyante(tx, { esDonante: true }), await crearProyecto(tx)];
      await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId: p.id, tipo: "dinero", monto: "10.00", medio: "yape", fecha: "2026-11-10", registradoPor: r.id });
      const c = consultasComo(tx, r.id);
      const todo = await c.getReporte();
      assert.ok(todo.ok);
      assert.equal(todo.reporte.porProyecto.find((g) => g.id === p.id)?.dinero.total, "10.00");
      const dentro = await c.getReporte({ desde: "2026-11-01", hasta: "2026-11-30" });
      assert.ok(dentro.ok && dentro.reporte.porProyecto.some((g) => g.id === p.id));
      const fuera = await c.getReporte({ desde: "2026-12-01" });
      assert.ok(fuera.ok && !fuera.reporte.porProyecto.some((g) => g.id === p.id));
    }));

  test("un rango inválido devuelve el error y no consulta la base", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const baseProhibida = () => {
        throw new Error("No se debía consultar la base");
      };
      const c = consultasComo(tx, r.id, baseProhibida);
      for (const rango of [{ desde: "2026-02-30" }, { desde: "2026-11-10", hasta: "2026-11-01" }, { desde: "2019-01-01" }, { hasta: "2099-01-01" }]) {
        const res = await c.getReporte(rango);
        assert.ok(!res.ok && res.error.length > 0, JSON.stringify(rango));
      }
    }));

  test("rechaza a un responsable desactivado antes de cualquier consulta", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { activo: false });
      const baseProhibida = () => {
        throw new Error("No se debía consultar la base");
      };
      await assert.rejects(consultasComo(tx, r.id, baseProhibida).getReporte(), ResponsableNoActivoError);
    }));
});
