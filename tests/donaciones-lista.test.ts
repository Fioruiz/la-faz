import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { crearConsultasPrivadas } from "../lib/private-queries-core";
import { ResponsableNoActivoError, verificarResponsableActivo } from "../lib/responsable-activo";
import { donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const consultasComo = (tx: Tx, responsableId: number) =>
  crearConsultasPrivadas(() => verificarResponsableActivo(tx, responsableId), () => tx);

const marca = () => Math.random().toString(36).slice(2, 8);

async function dinero(tx: Tx, responsableId: number, apoyanteId: number, extra: Partial<typeof donaciones.$inferInsert> = {}) {
  const [d] = await tx
    .insert(donaciones)
    .values({ apoyanteId, tipo: "dinero", monto: "10", medio: "yape", fecha: "2026-11-03", registradoPor: responsableId, ...extra })
    .returning();
  return d;
}

describe("lista de donaciones", () => {
  test("ordena por fecha descendente y, dentro de una fecha, por registro descendente", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      const a = await crearApoyante(tx, { nombre: `Orden ${m}` });
      const vieja = await dinero(tx, r.id, a.id, { fecha: "2026-10-01" });
      const hoy1 = await dinero(tx, r.id, a.id, { fecha: "2026-11-03" });
      const hoy2 = await dinero(tx, r.id, a.id, { fecha: "2026-11-03" });
      const { filas } = await consultasComo(tx, r.id).listarDonaciones({ busqueda: m });
      assert.deepEqual(filas.map((f) => f.id), [hoy2.id, hoy1.id, vieja.id]);
    }));

  test("el filtro sin-asignar muestra solo sin proyecto y no anuladas; anuladas muestra solo anuladas", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      const a = await crearApoyante(tx, { nombre: `Filtro ${m}` });
      const p = await crearProyecto(tx);
      const sinAsignar = await dinero(tx, r.id, a.id, { proyectoId: null });
      const sinAsignarAnulada = await dinero(tx, r.id, a.id, { proyectoId: null, anulada: true });
      const asignada = await dinero(tx, r.id, a.id, { proyectoId: p.id });
      const c = consultasComo(tx, r.id);
      const ids = async (filtro: string) => (await c.listarDonaciones({ filtro, busqueda: m })).filas.map((f) => f.id).sort();
      assert.deepEqual(await ids("sin-asignar"), [sinAsignar.id]);
      assert.deepEqual(await ids("anuladas"), [sinAsignarAnulada.id]);
      assert.deepEqual(await ids("todas"), [sinAsignar.id, sinAsignarAnulada.id, asignada.id].sort());
      assert.deepEqual(await ids("cualquier-cosa"), [sinAsignar.id, sinAsignarAnulada.id, asignada.id].sort());
    }));

  test("la búsqueda encuentra al donante sin tildes ni mayúsculas y trata %, _ y comillas como texto", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      const a = await crearApoyante(tx, { nombre: `Ana Pérez ${m}` });
      const d = await dinero(tx, r.id, a.id);
      const c = consultasComo(tx, r.id);
      assert.deepEqual((await c.listarDonaciones({ busqueda: `PEREZ ${m}` })).filas.map((f) => f.id), [d.id]);
      assert.ok((await c.listarDonaciones({ busqueda: "%" })).filas.every((f) => f.donanteNombre.includes("%")));
      assert.ok((await c.listarDonaciones({ busqueda: "_" })).filas.every((f) => f.donanteNombre.includes("_")));
      assert.deepEqual((await c.listarDonaciones({ busqueda: "'; drop table donaciones; --" })).filas, []);
    }));

  test("muestra proyecto, ítem, pareja y no incluye el contacto", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      const a = await crearApoyante(tx, { nombre: `Datos ${m}`, contacto: "999 888 777" });
      const p = await crearProyecto(tx, { nombre: `Proy ${m}`, tieneMeta: true });
      const item = await crearItem(tx, p.id, { nombre: "Pack", unidad: "pack" });
      const primera = await dinero(tx, r.id, a.id, { proyectoId: p.id });
      const segunda = (await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId: p.id, itemId: item.id, tipo: "producto", cantidad: 5, fecha: "2026-11-03", registradoPor: r.id, donacionVinculadaId: primera.id }).returning())[0];
      const { filas } = await consultasComo(tx, r.id).listarDonaciones({ busqueda: m });
      const f1 = filas.find((f) => f.id === primera.id);
      const f2 = filas.find((f) => f.id === segunda.id);
      assert.deepEqual([f2?.proyectoNombre, f2?.itemNombre, f2?.itemUnidad, f2?.cantidad], [`Proy ${m}`, "Pack", "pack", 5]);
      assert.equal(f1?.esParteMixta, true);
      assert.equal(f2?.esParteMixta, true);
      assert.ok(!JSON.stringify(filas).includes("999 888 777"));
      assert.ok(filas.every((f) => !("contacto" in f)));
    }));

  test("muestra las primeras 100 y avisa que hay más", () =>
    enTransaccion(async (tx) => {
      const [r, m] = [await crearResponsable(tx), marca()];
      const a = await crearApoyante(tx, { nombre: `Masivo ${m}` });
      await tx.insert(donaciones).values(Array.from({ length: 101 }, (_, i) => ({ apoyanteId: a.id, tipo: "dinero", monto: String(i + 1), medio: "yape", fecha: "2026-11-03", registradoPor: r.id })));
      const resultado = await consultasComo(tx, r.id).listarDonaciones({ busqueda: m });
      assert.deepEqual([resultado.filas.length, resultado.total, resultado.hayMas], [100, 101, true]);
    }));
});

describe("detalle de una donación", () => {
  test("donación vigente: trae sus datos, quién la registró, los proyectos de destino y no es de solo lectura", () =>
    enTransaccion(async (tx) => {
      const [r, a, p] = [await crearResponsable(tx, { nombre: "Ana Responsable" }), await crearApoyante(tx, { nombre: "Rosa" }), await crearProyecto(tx, { tieneMeta: true })];
      await crearItem(tx, p.id, { nombre: "Pack" });
      const d = await dinero(tx, r.id, a.id, { proyectoId: p.id });
      const leida = await consultasComo(tx, r.id).getDonacion(d.id);
      assert.deepEqual([leida?.donanteNombre, leida?.registradoPorNombre, leida?.proyectoNombre, leida?.soloLectura, leida?.razonSoloLectura], ["Rosa", "Ana Responsable", p.nombre, false, null]);
      assert.ok(leida?.proyectosDestino.some((x) => x.id === p.id && x.items.length === 1));
    }));

  test("anulada es de solo lectura y no ofrece proyectos de destino", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyante(tx)];
      const d = await dinero(tx, r.id, a.id, { anulada: true });
      const leida = await consultasComo(tx, r.id).getDonacion(d.id);
      assert.deepEqual([leida?.soloLectura, leida?.razonSoloLectura, leida?.proyectosDestino], [true, "Esta donación está anulada.", []]);
    }));

  test("de un proyecto finalizado es de solo lectura", () =>
    enTransaccion(async (tx) => {
      const [r, a, p] = [await crearResponsable(tx), await crearApoyante(tx), await crearProyecto(tx, { estado: "finalizado", resultado: "x" })];
      const d = await dinero(tx, r.id, a.id, { proyectoId: p.id });
      const leida = await consultasComo(tx, r.id).getDonacion(d.id);
      assert.deepEqual([leida?.soloLectura, leida?.razonSoloLectura], [true, "El proyecto de esta donación está finalizado y es de solo lectura."]);
    }));

  test("sin asignar se edita, y trae la pareja en cualquiera de los dos sentidos", () =>
    enTransaccion(async (tx) => {
      const [r, a] = [await crearResponsable(tx), await crearApoyante(tx)];
      const primera = await dinero(tx, r.id, a.id, { proyectoId: null });
      const segunda = (await tx.insert(donaciones).values({ apoyanteId: a.id, tipo: "producto", cantidad: 3, descripcionProducto: "x", fecha: "2026-11-03", registradoPor: r.id, donacionVinculadaId: primera.id }).returning())[0];
      const c = consultasComo(tx, r.id);
      assert.equal((await c.getDonacion(primera.id))?.soloLectura, false);
      assert.deepEqual((await c.getDonacion(primera.id))?.pareja, { id: segunda.id, tipo: "producto" });
      assert.deepEqual((await c.getDonacion(segunda.id))?.pareja, { id: primera.id, tipo: "dinero" });
    }));

  test("un id inexistente o inválido devuelve null", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const c = consultasComo(tx, r.id);
      for (const id of [2_000_000_000, 0, -1, 1.5, Number.NaN, 3_000_000_000]) assert.equal(await c.getDonacion(id), null, String(id));
    }));

  test("la lista y el detalle rechazan a un responsable desactivado", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx, { activo: false });
      const c = consultasComo(tx, r.id);
      await assert.rejects(c.listarDonaciones(), ResponsableNoActivoError);
      await assert.rejects(c.getDonacion(1), ResponsableNoActivoError);
    }));
});
