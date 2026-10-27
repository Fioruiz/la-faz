import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const consultasComo = (tx: Tx, responsableId: number) =>
  crearConsultasPrivadas(() => verificarResponsableActivo(tx, responsableId), () => tx);

const HOY = "2026-10-26";
type Valores = Partial<typeof donaciones.$inferInsert>;
const inserta = async (tx: Tx, r: { id: number }, a: { id: number }, v: Valores & { tipo: string }) =>
  (await tx.insert(donaciones).values({ apoyanteId: a.id, registradoPor: r.id, fecha: HOY, ...v }).returning())[0];

describe("avance en las lecturas privadas", () => {
  test("getAvanceProyectos: proyecto con meta, informativo con dinero, finalizado, y lo sin asignar", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx, { nombre: "Ana" }), await crearApoyante(tx, { nombre: "Rosa Quispe", contacto: "999 888 777", esDonante: true })];
      const [conMeta, informativo, cerrado, vacio] = [
        await crearProyecto(tx, { tieneMeta: true }),
        await crearProyecto(tx, { tieneMeta: false }),
        await crearProyecto(tx, { tieneMeta: true, estado: "finalizado", resultado: "x" }),
        await crearProyecto(tx, { tieneMeta: false }),
      ];
      const [i1, i2, i3] = [
        await crearItem(tx, conMeta.id, { nombre: "Pack", cantidadMeta: 2000, costoReferencial: "13.00" }),
        await crearItem(tx, conMeta.id, { nombre: "Agua", cantidadMeta: 500 }),
        await crearItem(tx, cerrado.id, { cantidadMeta: 100 }),
      ];
      await inserta(tx, r, a, { proyectoId: conMeta.id, itemId: i1.id, tipo: "producto", cantidad: 2000 });
      await inserta(tx, r, a, { proyectoId: conMeta.id, itemId: i2.id, tipo: "producto", cantidad: 100 });
      await inserta(tx, r, a, { proyectoId: conMeta.id, tipo: "dinero", monto: "250.00", medio: "yape" });
      await inserta(tx, r, a, { proyectoId: informativo.id, tipo: "dinero", monto: "80.50", medio: "plin" });
      await inserta(tx, r, a, { proyectoId: cerrado.id, itemId: i3.id, tipo: "producto", cantidad: 60 });
      const antes = await consultasComo(tx, r.id).getAvanceProyectos();
      await inserta(tx, r, a, { proyectoId: null, tipo: "dinero", monto: "200.00", medio: "yape" });
      await inserta(tx, r, a, { proyectoId: null, tipo: "dinero", monto: "999.00", medio: "yape", anulada: true });
      const { proyectos, sinAsignar } = await consultasComo(tx, r.id).getAvanceProyectos();

      const m = proyectos[conMeta.id];
      assert.deepEqual([m.metasCumplidas, m.metasTotal, m.totalDinero, m.estimacion], [1, 2, "250.00", "parcial"]);
      assert.deepEqual([proyectos[informativo.id].totalDinero, proyectos[informativo.id].metasTotal], ["80.50", 0]);
      assert.equal(proyectos[cerrado.id].items[0].recibido, 60);
      assert.deepEqual([proyectos[vacio.id].totalDinero, proyectos[vacio.id].metasTotal, proyectos[vacio.id].faltaSoles], ["0.00", 0, null]);
      assert.equal(Number(sinAsignar.totalDinero) - Number(antes.sinAsignar.totalDinero), 200);
      assert.equal(sinAsignar.cantidad - antes.sinAsignar.cantidad, 1);
      const texto = JSON.stringify({ proyectos, sinAsignar });
      assert.ok(!/Rosa|Quispe|999 888 777/.test(texto));
    }));

  test("getProyecto trae el avance por ítem y lo sin asignar", () =>
    enTransaccion(async (tx) => {
      const [r, a, p] = [await crearResponsable(tx), await crearApoyante(tx, { esDonante: true }), await crearProyecto(tx, { tieneMeta: true })];
      const item = await crearItem(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000, costoReferencial: "13.00" });
      await inserta(tx, r, a, { proyectoId: p.id, itemId: item.id, tipo: "producto", cantidad: 1200 });
      await inserta(tx, r, a, { proyectoId: p.id, tipo: "dinero", monto: "5000.00", medio: "yape" });
      const leido = await consultasComo(tx, r.id).getProyecto(p.id);
      assert.deepEqual(
        [leido?.avance.items[0].recibido, leido?.avance.items[0].porcentaje, leido?.avance.faltaSoles, leido?.avance.estimacion],
        [1200, 60, "5400.00", "completa"],
      );
      assert.ok(leido && typeof leido.sinAsignar.cantidad === "number");
      assert.equal(leido?.items[0].nombre, "Pack"); // lo anterior de getProyecto sigue igual
    }));

  test("getProyecto de un proyecto sin ítems ni dinero trae un avance vacío; un id inexistente devuelve null", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { tieneMeta: false })];
      const c = consultasComo(tx, r.id);
      const leido = await c.getProyecto(p.id);
      assert.deepEqual([leido?.avance.metasTotal, leido?.avance.totalDinero, leido?.avance.faltaSoles], [0, "0.00", null]);
      assert.equal(await c.getProyecto(2_000_000_000), null);
    }));

  test("ambas lecturas rechazan a un responsable desactivado sin devolver datos", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx, { activo: false }), await crearProyecto(tx)];
      const c = consultasComo(tx, r.id);
      await assert.rejects(c.getAvanceProyectos(), ResponsableNoActivoError);
      await assert.rejects(c.getProyecto(p.id), ResponsableNoActivoError);
    }));
});
