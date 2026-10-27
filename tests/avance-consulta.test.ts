import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { LectorDb } from "../lib/auth-credentials";
import { AVANCE_VACIO, consultarAvance } from "../lib/avance-consulta";
import { anularDonacion, asignarDonacion, editarDonacion } from "../lib/donaciones-correcciones";
import { registrarDonacion } from "../lib/donaciones-escrituras";
import { ejecutarEscrituraAuditada, type DbTransaccional, type EscrituraAuditada } from "../lib/escritura-auditada-core";
import { hoyEnLima } from "../lib/fechas";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const HOY = hoyEnLima();
const lector = (tx: Tx) => tx as unknown as LectorDb;

type Valores = Partial<typeof donaciones.$inferInsert>;
const dinero = async (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number | null, monto: string, v: Valores = {}) =>
  (await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId, tipo: "dinero", monto, medio: "yape", fecha: HOY, registradoPor: r.id, ...v }).returning())[0];
const producto = async (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number, itemId: number, cantidad: number, v: Valores = {}) =>
  (await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId, itemId, tipo: "producto", cantidad, fecha: HOY, registradoPor: r.id, ...v }).returning())[0];

async function base(tx: Tx) {
  const [r, a, p] = [await crearResponsable(tx), await crearApoyante(tx, { esDonante: true }), await crearProyecto(tx, { tieneMeta: true })];
  const item = await crearItem(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000, costoReferencial: "13.00" });
  return { r, a, p, item };
}
const avanceDe = async (tx: Tx, proyectoId: number) => (await consultarAvance(lector(tx), { proyectoIds: [proyectoId] })).proyectos[proyectoId];

describe("recibido por ítem y total en soles", () => {
  test("suma varias donaciones en producto del ítem", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      for (const n of [500, 300, 400]) await producto(tx, r, a, p.id, item.id, n);
      const av = await avanceDe(tx, p.id);
      assert.deepEqual([av.items[0].recibido, av.items[0].porcentaje, av.items[0].falta], [1200, 60, 800]);
    }));

  test("las anuladas no suman, ni al ítem ni al total en soles", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      await producto(tx, r, a, p.id, item.id, 500);
      await producto(tx, r, a, p.id, item.id, 700, { anulada: true });
      await dinero(tx, r, a, p.id, "100.00");
      await dinero(tx, r, a, p.id, "900.00", { anulada: true });
      const av = await avanceDe(tx, p.id);
      assert.deepEqual([av.items[0].recibido, av.totalDinero], [500, "100.00"]);
    }));

  test("el dinero no suma a ninguna barra y un producto sin asignar no suma a ningún ítem", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      await dinero(tx, r, a, p.id, "5000.00");
      await tx.insert(donaciones).values({ apoyanteId: a.id, tipo: "producto", cantidad: 50, descripcionProducto: "Cajas", fecha: HOY, registradoPor: r.id });
      const av = await avanceDe(tx, p.id);
      assert.equal(av.items.find((i) => i.id === item.id)?.recibido, 0);
    }));

  test("ítem sin donaciones aparece con 0; el exceso se ve como excedente real", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const otro = await crearItem(tx, p.id, { nombre: "Agua", cantidadMeta: 500, unidad: "botella" });
      await producto(tx, r, a, p.id, item.id, 2150);
      const av = await avanceDe(tx, p.id);
      const pack = av.items.find((i) => i.id === item.id);
      const agua = av.items.find((i) => i.id === otro.id);
      assert.deepEqual([pack?.excedente, pack?.cumplida, pack?.porcentaje], [150, true, 107]);
      assert.deepEqual([agua?.recibido, agua?.cumplida], [0, false]);
      assert.deepEqual([av.metasCumplidas, av.metasTotal], [1, 2]);
    }));

  test("total en soles exacto (0.10 + 0.20)", () =>
    enTransaccion(async (tx) => {
      const { r, a, p } = await base(tx);
      await dinero(tx, r, a, p.id, "0.10");
      await dinero(tx, r, a, p.id, "0.20");
      assert.equal((await avanceDe(tx, p.id)).totalDinero, "0.30");
    }));

  test("falta en soles con dinero y con ítems sin costo", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      await producto(tx, r, a, p.id, item.id, 1200);
      await dinero(tx, r, a, p.id, "5000.00");
      assert.deepEqual([(await avanceDe(tx, p.id)).faltaSoles, (await avanceDe(tx, p.id)).estimacion], ["5400.00", "completa"]);
      await crearItem(tx, p.id, { nombre: "Sin costo", cantidadMeta: 10 });
      assert.equal((await avanceDe(tx, p.id)).estimacion, "parcial");
    }));

  test("proyecto informativo con dinero: total en soles, sin ítems; finalizado conserva su avance", () =>
    enTransaccion(async (tx) => {
      const { r, a } = await base(tx);
      const informativo = await crearProyecto(tx, { tieneMeta: false });
      await dinero(tx, r, a, informativo.id, "350.50");
      const cerrado = await crearProyecto(tx, { tieneMeta: true, estado: "finalizado", resultado: "x" });
      const item = await crearItem(tx, cerrado.id, { cantidadMeta: 100 });
      await producto(tx, r, a, cerrado.id, item.id, 80);
      const av = await consultarAvance(lector(tx), { proyectoIds: [informativo.id, cerrado.id] });
      assert.deepEqual([av.proyectos[informativo.id].totalDinero, av.proyectos[informativo.id].metasTotal, av.proyectos[informativo.id].faltaSoles], ["350.50", 0, null]);
      assert.equal(av.proyectos[cerrado.id].items[0].recibido, 80);
    }));

  test("resumen de lo sin asignar: dinero y producto vigentes, sin las anuladas", () =>
    enTransaccion(async (tx) => {
      const { r, a, p } = await base(tx);
      const antes = (await consultarAvance(lector(tx), { proyectoIds: [p.id] })).sinAsignar;
      await dinero(tx, r, a, null, "200.00");
      await tx.insert(donaciones).values({ apoyanteId: a.id, tipo: "producto", cantidad: 5, descripcionProducto: "Cajas", fecha: HOY, registradoPor: r.id });
      await dinero(tx, r, a, null, "999.00", { anulada: true });
      const despues = (await consultarAvance(lector(tx), { proyectoIds: [p.id] })).sinAsignar;
      assert.equal(Number(despues.totalDinero) - Number(antes.totalDinero), 200);
      assert.equal(despues.cantidad - antes.cantidad, 2);
    }));

  test("sin filtro devuelve todos los proyectos con ítems o dinero; AVANCE_VACIO es un avance sin nada", () =>
    enTransaccion(async (tx) => {
      const { r, a, p } = await base(tx);
      await dinero(tx, r, a, p.id, "10.00");
      const todos = await consultarAvance(lector(tx));
      assert.equal(todos.proyectos[p.id].totalDinero, "10.00");
      assert.deepEqual([AVANCE_VACIO.metasTotal, AVANCE_VACIO.totalDinero, AVANCE_VACIO.faltaSoles], [0, "0.00", null]);
    }));
});

// El avance debe seguir a las correcciones del #8 en la siguiente lectura (sin cachés ni contadores).
function ejecutar<TEsquema extends z.ZodType, TDatos>(
  tx: Tx,
  responsableId: number,
  escritura: { esquema: TEsquema; escribir: EscrituraAuditada<TEsquema, TDatos>["escribir"] },
  entrada: Record<string, unknown>,
) {
  return ejecutarEscrituraAuditada({
    nombre: "prueba-avance",
    db: tx as unknown as DbTransaccional,
    requerir: () => verificarResponsableActivo(tx, responsableId),
    entrada,
    esquema: escritura.esquema,
    escribir: escritura.escribir,
  });
}

describe("el avance sigue a las donaciones registradas, editadas, reasignadas y anuladas", () => {
  test("registrar suma; editar la cantidad cambia; anular quita; todo en la siguiente lectura", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const entrada = { tipo: "producto", apoyanteId: a.id, proyectoId: p.id, itemId: item.id, cantidad: "500", fecha: HOY };
      const res = await ejecutar(tx, r.id, registrarDonacion, entrada);
      assert.ok(res.ok);
      assert.equal((await avanceDe(tx, p.id)).items[0].recibido, 500);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, { donacionId: res.datos.id, proyectoId: p.id, itemId: item.id, cantidad: "450", fecha: HOY })).ok);
      assert.equal((await avanceDe(tx, p.id)).items[0].recibido, 450);
      assert.ok((await ejecutar(tx, r.id, anularDonacion, { donacionId: res.datos.id, motivo: "Error" })).ok);
      assert.equal((await avanceDe(tx, p.id)).items[0].recibido, 0);
    }));

  test("reasignar a otro ítem baja uno y sube el otro", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const item2 = await crearItem(tx, p.id, { nombre: "Cereal", cantidadMeta: 100 });
      const d = await producto(tx, r, a, p.id, item.id, 40);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, { donacionId: d.id, proyectoId: p.id, itemId: item2.id, cantidad: "40", fecha: HOY })).ok);
      const av = await avanceDe(tx, p.id);
      assert.deepEqual([av.items.find((i) => i.id === item.id)?.recibido, av.items.find((i) => i.id === item2.id)?.recibido], [0, 40]);
    }));

  test("reasignar dinero a otro proyecto mueve el total", () =>
    enTransaccion(async (tx) => {
      const { r, a, p } = await base(tx);
      const otro = await crearProyecto(tx, { tieneMeta: true });
      const d = await dinero(tx, r, a, p.id, "100.00");
      assert.ok((await ejecutar(tx, r.id, editarDonacion, { donacionId: d.id, proyectoId: otro.id, monto: "100", medio: "yape", fecha: HOY })).ok);
      assert.deepEqual([(await avanceDe(tx, p.id)).totalDinero, (await avanceDe(tx, otro.id)).totalDinero], ["0.00", "100.00"]);
    }));

  test("asignar una sin asignar sale del resumen de sin asignar y entra al proyecto", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const d = await tx.insert(donaciones).values({ apoyanteId: a.id, tipo: "producto", cantidad: 25, descripcionProducto: "Cajas", fecha: HOY, registradoPor: r.id }).returning();
      const antes = (await consultarAvance(lector(tx), { proyectoIds: [p.id] })).sinAsignar.cantidad;
      assert.ok((await ejecutar(tx, r.id, asignarDonacion, { donacionId: d[0].id, proyectoId: p.id, itemId: item.id })).ok);
      const despues = await consultarAvance(lector(tx), { proyectoIds: [p.id] });
      assert.equal(despues.sinAsignar.cantidad, antes - 1);
      assert.equal(despues.proyectos[p.id].items[0].recibido, 25);
    }));

  test("cambiar una donación cambia el avance en la misma lectura de ida y vuelta", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const d = await producto(tx, r, a, p.id, item.id, 10);
      const antes = (await avanceDe(tx, p.id)).items[0].recibido;
      await tx.update(donaciones).set({ cantidad: 99 }).where(eq(donaciones.id, d.id));
      assert.deepEqual([antes, (await avanceDe(tx, p.id)).items[0].recibido], [10, 99]);
    }));
});

describe("número fijo de consultas", () => {
  async function contar(tx: Tx, proyectoId: number) {
    let selects = 0;
    const espia = new Proxy(tx, {
      get(objetivo, propiedad, receptor) {
        if (propiedad === "select") {
          selects++;
          return (objetivo.select as (...a: unknown[]) => unknown).bind(objetivo);
        }
        return Reflect.get(objetivo, propiedad, receptor);
      },
    }) as unknown as LectorDb;
    await consultarAvance(espia, { proyectoIds: [proyectoId] });
    return selects;
  }

  test("con 5 y con 500 donaciones se hacen las mismas 3 consultas y las sumas son exactas", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      for (let i = 0; i < 5; i++) await producto(tx, r, a, p.id, item.id, 1);
      const pocas = await contar(tx, p.id);
      await tx.insert(donaciones).values(Array.from({ length: 495 }, () => ({ apoyanteId: a.id, proyectoId: p.id, itemId: item.id, tipo: "producto", cantidad: 2, fecha: HOY, registradoPor: r.id })));
      await tx.insert(donaciones).values(Array.from({ length: 500 }, () => ({ apoyanteId: a.id, proyectoId: p.id, tipo: "dinero", monto: "0.10", medio: "yape", fecha: HOY, registradoPor: r.id })));
      const muchas = await contar(tx, p.id);
      assert.deepEqual([pocas, muchas], [3, 3]);
      const av = await avanceDe(tx, p.id);
      assert.deepEqual([av.items[0].recibido, av.totalDinero], [5 + 495 * 2, "50.00"]);
    }));
});
