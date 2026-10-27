import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const consultasComo = (tx: Tx, responsableId: number) =>
  crearConsultasPrivadas(() => verificarResponsableActivo(tx, responsableId), () => tx);

const marca = () => Math.random().toString(36).slice(2, 8);

async function dineroDe(tx: Tx, responsableId: number, apoyanteId: number, proyectoId: number | null) {
  const [d] = await tx
    .insert(donaciones)
    .values({ apoyanteId, proyectoId, tipo: "dinero", monto: "10", medio: "yape", fecha: "2026-11-03", registradoPor: responsableId })
    .returning();
  return d;
}

describe("datos del formulario de donación", () => {
  test("solo apoyantes con rol de donante, sin contacto, ordenados por nombre", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      await crearApoyante(tx, { nombre: `Zoila ${m}`, esDonante: true, contacto: "999 888 777" });
      await crearApoyante(tx, { nombre: `Álvaro ${m}`, esDonante: true });
      await crearApoyante(tx, { nombre: `Solo voluntario ${m}`, esDonante: false, esVoluntario: true });
      const { donantes } = await consultasComo(tx, r.id).getDatosFormularioDonacion();
      const propios = donantes.filter((d) => d.nombre.includes(m)).map((d) => d.nombre);
      assert.deepEqual(propios, [`Álvaro ${m}`, `Zoila ${m}`]);
      assert.ok(!JSON.stringify(donantes).includes("999 888 777"));
      assert.ok(donantes.every((d) => !("contacto" in d)));
    }));

  test("incluye solo proyectos activos y los ítems de cada uno", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      const activo = await crearProyecto(tx, { nombre: `Activo ${m}`, tieneMeta: true });
      const finalizado = await crearProyecto(tx, { nombre: `Cerrado ${m}`, tieneMeta: true, estado: "finalizado", resultado: "x" });
      await crearItem(tx, activo.id, { nombre: "Pack", unidad: "pack" });
      await crearItem(tx, finalizado.id, { nombre: "Oculto" });
      const { proyectos } = await consultasComo(tx, r.id).getDatosFormularioDonacion();
      const propio = proyectos.find((p) => p.id === activo.id);
      assert.deepEqual(propio?.items.map((i) => [i.nombre, i.unidad]), [["Pack", "pack"]]);
      assert.equal(proyectos.some((p) => p.id === finalizado.id), false);
      assert.ok(!JSON.stringify(proyectos).includes("Oculto"));
    }));

  test("proyecto por defecto: el de la última donación asignada del responsable", () =>
    enTransaccion(async (tx) => {
      const [r, otro, a] = [await crearResponsable(tx), await crearResponsable(tx), await crearApoyante(tx)];
      const [p1, p2, p3] = [await crearProyecto(tx), await crearProyecto(tx), await crearProyecto(tx)];
      await dineroDe(tx, r.id, a.id, p1.id);
      await dineroDe(tx, r.id, a.id, p2.id);
      await dineroDe(tx, otro.id, a.id, p3.id); // la de otro responsable no cuenta
      await dineroDe(tx, r.id, a.id, null); // las "Sin asignar" tampoco definen el proyecto
      assert.equal((await consultasComo(tx, r.id).getDatosFormularioDonacion()).proyectoPorDefectoId, p2.id);
    }));

  test("sin donaciones previas no hay proyecto por defecto", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      assert.equal((await consultasComo(tx, r.id).getDatosFormularioDonacion()).proyectoPorDefectoId, null);
    }));

  test("si el último proyecto ya está finalizado no hay proyecto por defecto", () =>
    enTransaccion(async (tx) => {
      const [r, a, p] = [await crearResponsable(tx), await crearApoyante(tx), await crearProyecto(tx, { estado: "finalizado", resultado: "x" })];
      await dineroDe(tx, r.id, a.id, p.id);
      assert.equal((await consultasComo(tx, r.id).getDatosFormularioDonacion()).proyectoPorDefectoId, null);
    }));

  test("trae hoy en Lima con formato de fecha", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      assert.match((await consultasComo(tx, r.id).getDatosFormularioDonacion()).hoy, /^\d{4}-\d{2}-\d{2}$/);
    }));
});

describe("donación para vincular", () => {
  test("devuelve lo mínimo y puedeVincularse en una donación libre", () =>
    enTransaccion(async (tx) => {
      const [r, a, p] = [await crearResponsable(tx), await crearApoyante(tx, { nombre: "Rosa" }), await crearProyecto(tx)];
      const d = await dineroDe(tx, r.id, a.id, p.id);
      const leida = await consultasComo(tx, r.id).getDonacionParaVincular(d.id);
      assert.deepEqual([leida?.tipo, leida?.apoyanteId, leida?.proyectoId, leida?.puedeVincularse, leida?.donanteNombre], ["dinero", a.id, p.id, true, "Rosa"]);
    }));

  test("anulada o ya vinculada no puede vincularse", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyante(tx)];
      const anulada = await dineroDe(tx, r.id, a.id, null);
      await tx.update(donaciones).set({ anulada: true }).where(eq(donaciones.id, anulada.id));
      const primera = await dineroDe(tx, r.id, a.id, null);
      await tx.insert(donaciones).values({ apoyanteId: a.id, tipo: "producto", cantidad: 3, descripcionProducto: "x", fecha: "2026-11-03", registradoPor: r.id, donacionVinculadaId: primera.id });
      const c = consultasComo(tx, r.id);
      assert.equal((await c.getDonacionParaVincular(anulada.id))?.puedeVincularse, false);
      assert.equal((await c.getDonacionParaVincular(primera.id))?.puedeVincularse, false);
    }));

  test("un id inexistente o inválido devuelve null", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const c = consultasComo(tx, r.id);
      for (const id of [2_000_000_000, 0, -1, 1.5, Number.NaN, 3_000_000_000]) assert.equal(await c.getDonacionParaVincular(id), null, String(id));
    }));
});

describe("acceso", () => {
  test("ambas lecturas rechazan a un responsable desactivado", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { activo: false });
      const c = consultasComo(tx, r.id);
      await assert.rejects(c.getDatosFormularioDonacion(), ResponsableNoActivoError);
      await assert.rejects(c.getDonacionParaVincular(1), ResponsableNoActivoError);
    }));
});
