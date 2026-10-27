import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { z } from "zod";
import type { LectorDb } from "../lib/auth-credentials";
import { consultarAvance } from "../lib/avance-consulta";
import { anularDonacion, asignarDonacion, editarDonacion } from "../lib/donaciones-correcciones";
import { ejecutarEscrituraAuditada, type DbTransaccional, type EscrituraAuditada } from "../lib/escritura-auditada-core";
import { hoyEnLima } from "../lib/fechas";
import { consultarReporte } from "../lib/reporte-consulta";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const lector = (tx: Tx) => tx as unknown as LectorDb;
const HOY = hoyEnLima();

type Valores = Partial<typeof donaciones.$inferInsert>;
const dinero = async (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number | null, monto: string, medio: string | null, v: Valores = {}) =>
  (await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId, tipo: "dinero", monto, medio, fecha: HOY, registradoPor: r.id, ...v }).returning())[0];
const producto = async (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number, itemId: number, cantidad: number, v: Valores = {}) =>
  (await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId, itemId, tipo: "producto", cantidad, fecha: HOY, registradoPor: r.id, ...v }).returning())[0];

async function escenario(tx: Tx) {
  const [ana, beto] = [await crearResponsable(tx, { nombre: "Ana Reporte" }), await crearResponsable(tx, { nombre: "Beto Reporte", activo: false })];
  const donante = await crearApoyante(tx, { nombre: "Rosa Quispe Secreta", contacto: "999 888 777", esDonante: true });
  const [p1, p2] = [await crearProyecto(tx, { tieneMeta: true }), await crearProyecto(tx, { tieneMeta: true })];
  const [pack, agua, packDos] = [
    await crearItem(tx, p1.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000, costoReferencial: "13.00" }),
    await crearItem(tx, p1.id, { nombre: "Agua", unidad: "botella", cantidadMeta: 500 }),
    await crearItem(tx, p2.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 100 }),
  ];
  return { ana, beto, donante, p1, p2, pack, agua, packDos };
}
const grupo = <T extends { id: number | null }>(grupos: T[], id: number | null) => grupos.find((g) => g.id === id);

describe("agrupación y totales", () => {
  test("por responsable y por proyecto, con 'Sin asignar' y un responsable desactivado que sigue apareciendo", () =>
    enTransaccion(async (tx) => {
      const { ana, beto, donante, p1, p2 } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "100.00", "yape");
      await dinero(tx, beto, donante, p2.id, "300.00", "plin");
      await dinero(tx, beto, donante, null, "50.00", "yape");
      const r = await consultarReporte(lector(tx));
      assert.deepEqual([grupo(r.porResponsable, ana.id)?.dinero.total, grupo(r.porResponsable, beto.id)?.dinero.total], ["100.00", "350.00"]);
      assert.deepEqual([grupo(r.porResponsable, beto.id)?.nombre, grupo(r.porResponsable, beto.id)?.desactivado], ["Beto Reporte", true]);
      assert.deepEqual([grupo(r.porProyecto, p1.id)?.dinero.total, grupo(r.porProyecto, p2.id)?.dinero.total, grupo(r.porProyecto, null)?.dinero.total], ["100.00", "300.00", "50.00"]);
      assert.equal(grupo(r.porProyecto, null)?.nombre, "Sin asignar");
    }));

  test("subtotales por medio exactos y dinero sin medio", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1 } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "0.10", "yape");
      await dinero(tx, ana, donante, p1.id, "0.20", "yape");
      await dinero(tx, ana, donante, p1.id, "50.50", "plin");
      await dinero(tx, ana, donante, p1.id, "200.00", "transferencia");
      await dinero(tx, ana, donante, p1.id, "5.00", null);
      const m = grupo((await consultarReporte(lector(tx))).porProyecto, p1.id)?.dinero;
      assert.deepEqual([m?.total, m?.porMedio.yape, m?.porMedio.plin, m?.porMedio.transferencia, m?.porMedio.sinMedio, m?.donaciones], ["255.80", "0.30", "50.50", "200.00", "5.00", 5]);
    }));

  test("productos por ítem y unidad sin mezclar; dos proyectos con un ítem 'Pack' se distinguen; sin asignar en un renglón", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1, p2, pack, agua, packDos } = await escenario(tx);
      await producto(tx, ana, donante, p1.id, pack.id, 700);
      await producto(tx, ana, donante, p1.id, pack.id, 500);
      await producto(tx, ana, donante, p1.id, agua.id, 100);
      await producto(tx, ana, donante, p2.id, packDos.id, 30);
      await tx.insert(donaciones).values([
        { apoyanteId: donante.id, tipo: "producto", cantidad: 20, descripcionProducto: "Cajas de cereal", fecha: HOY, registradoPor: ana.id },
        { apoyanteId: donante.id, tipo: "producto", cantidad: 50, descripcionProducto: "Botellas", fecha: HOY, registradoPor: ana.id },
      ]);
      const r = await consultarReporte(lector(tx));
      const delProyecto = grupo(r.porProyecto, p1.id)?.productos.items.map((i) => [i.nombre, i.unidad, i.cantidad, i.donaciones]);
      assert.deepEqual(delProyecto, [["Agua", "botella", 100, 1], ["Pack", "pack", 1200, 2]]);
      // el orden depende del nombre del proyecto (aleatorio en la prueba): se compara sin orden
      const delResponsable = grupo(r.porResponsable, ana.id)?.productos.items.filter((i) => i.nombre === "Pack");
      assert.deepEqual(delResponsable?.map((i) => i.cantidad).sort((x, y) => x - y), [30, 1200]);
      assert.equal(new Set(delResponsable?.map((i) => i.proyecto)).size, 2);
      assert.deepEqual([grupo(r.porProyecto, null)?.productos.sinAsignar.donaciones, grupo(r.porProyecto, null)?.productos.items.length], [2, 0]);
    }));

  test("las anuladas quedan fuera de los totales y se cuentan aparte, también solo-anuladas", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1, p2, pack } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "100.00", "yape");
      await dinero(tx, ana, donante, p1.id, "900.00", "yape", { anulada: true });
      await producto(tx, ana, donante, p1.id, pack.id, 10);
      await producto(tx, ana, donante, p1.id, pack.id, 777, { anulada: true });
      await dinero(tx, ana, donante, p2.id, "40.00", "plin", { anulada: true });
      const r = await consultarReporte(lector(tx));
      const g1 = grupo(r.porProyecto, p1.id);
      assert.deepEqual([g1?.dinero.total, g1?.productos.items[0].cantidad, g1?.anuladas, g1?.donaciones], ["100.00", 10, 2, 2]);
      const g2 = grupo(r.porProyecto, p2.id);
      assert.deepEqual([g2?.donaciones, g2?.dinero.total, g2?.anuladas], [0, "0.00", 1]);
    }));

  test("la suma de los grupos de cada vista iguala al total general", () =>
    enTransaccion(async (tx) => {
      const { ana, beto, donante, p1, p2 } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "10.10", "yape");
      await dinero(tx, beto, donante, p2.id, "20.20", "plin");
      await dinero(tx, beto, donante, null, "30.30", "yape");
      const r = await consultarReporte(lector(tx));
      const centimos = (t: string) => Math.round(Number(t) * 100);
      const suma = (gs: { dinero: { total: string }; donaciones: number }[]) => [gs.reduce((s, g) => s + centimos(g.dinero.total), 0), gs.reduce((s, g) => s + g.donaciones, 0)];
      assert.deepEqual(suma(r.porResponsable), suma(r.porProyecto));
      assert.deepEqual(suma(r.porResponsable), [centimos(r.total.dinero.total), r.total.donaciones]);
    }));
});

describe("rango de fechas", () => {
  test("inclusivo en ambos extremos, solo desde y solo hasta", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1 } = await escenario(tx);
      for (const f of ["2026-10-31", "2026-11-01", "2026-11-15", "2026-11-30", "2026-12-01"]) await dinero(tx, ana, donante, p1.id, "10.00", "yape", { fecha: f });
      const n = async (rango: { desde?: string; hasta?: string }) => grupo((await consultarReporte(lector(tx), rango)).porProyecto, p1.id)?.donaciones;
      assert.equal(await n({ desde: "2026-11-01", hasta: "2026-11-30" }), 3);
      assert.equal(await n({ desde: "2026-11-30" }), 2);
      assert.equal(await n({ hasta: "2026-11-01" }), 2);
      assert.equal(await n({}), 5);
      assert.equal(await n({ desde: "2026-11-01", hasta: "2026-11-01" }), 1);
    }));

  test("el rango también acota el conteo de anuladas", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1 } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "10.00", "yape", { fecha: "2026-11-10" });
      await dinero(tx, ana, donante, p1.id, "10.00", "yape", { fecha: "2026-11-10", anulada: true });
      await dinero(tx, ana, donante, p1.id, "10.00", "yape", { fecha: "2026-12-10", anulada: true });
      const g = grupo((await consultarReporte(lector(tx), { desde: "2026-11-01", hasta: "2026-11-30" })).porProyecto, p1.id);
      assert.deepEqual([g?.donaciones, g?.anuladas], [1, 1]);
    }));

  test("un rango sin donaciones no devuelve el grupo", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1 } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "10.00", "yape", { fecha: "2026-11-10" });
      const r = await consultarReporte(lector(tx), { desde: "2030-01-01" });
      assert.equal(grupo(r.porProyecto, p1.id), undefined);
    }));
});

describe("coherencia con el avance y con las correcciones de #8", () => {
  test("sin filtro, el total en soles y lo recibido por ítem igualan a consultarAvance", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1, p2, pack, agua, packDos } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "123.45", "yape");
      await dinero(tx, ana, donante, p1.id, "0.55", "plin");
      await dinero(tx, ana, donante, p2.id, "9.99", "yape", { anulada: true });
      await producto(tx, ana, donante, p1.id, pack.id, 700);
      await producto(tx, ana, donante, p1.id, pack.id, 5, { anulada: true });
      await producto(tx, ana, donante, p1.id, agua.id, 60);
      await producto(tx, ana, donante, p2.id, packDos.id, 8);
      const [reporte, avance] = [await consultarReporte(lector(tx)), await consultarAvance(lector(tx), { proyectoIds: [p1.id, p2.id] })];
      for (const p of [p1, p2]) {
        assert.equal(grupo(reporte.porProyecto, p.id)?.dinero.total ?? "0.00", avance.proyectos[p.id].totalDinero, `dinero de ${p.id}`);
        for (const item of avance.proyectos[p.id].items) {
          const enReporte = grupo(reporte.porProyecto, p.id)?.productos.items.find((i) => i.itemId === item.id)?.cantidad ?? 0;
          assert.equal(enReporte, item.recibido, `ítem ${item.id}`);
        }
      }
    }));

  function ejecutar<TEsquema extends z.ZodType, TDatos>(
    tx: Tx,
    responsableId: number,
    escritura: { esquema: TEsquema; escribir: EscrituraAuditada<TEsquema, TDatos>["escribir"] },
    entrada: Record<string, unknown>,
  ) {
    return ejecutarEscrituraAuditada({
      nombre: "prueba-reporte",
      db: tx as unknown as DbTransaccional,
      requerir: () => verificarResponsableActivo(tx, responsableId),
      entrada,
      esquema: escritura.esquema,
      escribir: escritura.escribir,
    });
  }

  test("editar, reasignar, asignar y anular mueven el reporte en la siguiente lectura", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1, p2 } = await escenario(tx);
      const otro = await crearResponsable(tx, { nombre: "Carla Reporte" });
      const d = await dinero(tx, ana, donante, p1.id, "100.00", "yape");
      const total = async (id: number | null) => grupo((await consultarReporte(lector(tx))).porProyecto, id)?.dinero.total ?? "0.00";
      // editar el monto (otro responsable edita: la donación sigue en el grupo de quien la registró)
      assert.ok((await ejecutar(tx, otro.id, editarDonacion, { donacionId: d.id, proyectoId: p1.id, monto: "80", medio: "yape", fecha: HOY })).ok);
      assert.equal(await total(p1.id), "80.00");
      assert.equal(grupo((await consultarReporte(lector(tx))).porResponsable, ana.id)?.dinero.total, "80.00");
      assert.equal(grupo((await consultarReporte(lector(tx))).porResponsable, otro.id), undefined);
      // reasignar a otro proyecto
      assert.ok((await ejecutar(tx, ana.id, editarDonacion, { donacionId: d.id, proyectoId: p2.id, monto: "80", medio: "yape", fecha: HOY })).ok);
      assert.deepEqual([await total(p1.id), await total(p2.id)], ["0.00", "80.00"]);
      // dejar sin asignar y volver a asignar
      assert.ok((await ejecutar(tx, ana.id, editarDonacion, { donacionId: d.id, proyectoId: "sin-asignar", monto: "80", medio: "yape", fecha: HOY })).ok);
      assert.equal(await total(null), "80.00");
      assert.ok((await ejecutar(tx, ana.id, asignarDonacion, { donacionId: d.id, proyectoId: p1.id })).ok);
      assert.deepEqual([await total(null), await total(p1.id)], ["0.00", "80.00"]);
      // anular: sale del total y se cuenta aparte
      assert.ok((await ejecutar(tx, ana.id, anularDonacion, { donacionId: d.id, motivo: "Error" })).ok);
      const g = grupo((await consultarReporte(lector(tx))).porProyecto, p1.id);
      assert.deepEqual([g?.dinero.total, g?.anuladas], ["0.00", 1]);
    }));
});

describe("consultas fijas y privacidad", () => {
  async function contar(tx: Tx) {
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
    await consultarReporte(espia);
    return selects;
  }

  test("con 5 y con 500 donaciones se hacen las mismas 6 consultas y las sumas son exactas", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1, pack } = await escenario(tx);
      for (let i = 0; i < 5; i++) await dinero(tx, ana, donante, p1.id, "0.10", "yape");
      const pocas = await contar(tx);
      await tx.insert(donaciones).values(Array.from({ length: 495 }, () => ({ apoyanteId: donante.id, proyectoId: p1.id, tipo: "dinero", monto: "0.10", medio: "yape", fecha: HOY, registradoPor: ana.id })));
      await tx.insert(donaciones).values(Array.from({ length: 500 }, () => ({ apoyanteId: donante.id, proyectoId: p1.id, itemId: pack.id, tipo: "producto", cantidad: 2, fecha: HOY, registradoPor: ana.id })));
      const muchas = await contar(tx);
      assert.deepEqual([pocas, muchas], [6, 6]);
      const g = grupo((await consultarReporte(lector(tx))).porProyecto, p1.id);
      assert.deepEqual([g?.dinero.total, g?.productos.items[0].cantidad, g?.donaciones], ["50.00", 1000, 1000]);
    }));

  test("el resultado no contiene el nombre ni el contacto del donante, y sí el nombre del responsable", () =>
    enTransaccion(async (tx) => {
      const { ana, donante, p1, pack } = await escenario(tx);
      await dinero(tx, ana, donante, p1.id, "10.00", "yape");
      await producto(tx, ana, donante, p1.id, pack.id, 5);
      await dinero(tx, ana, donante, null, "3.00", "plin", { anulada: true });
      const texto = JSON.stringify(await consultarReporte(lector(tx)));
      assert.ok(!/Quispe|Secreta|999 888 777/.test(texto));
      assert.ok(texto.includes("Ana Reporte"));
    }));
});
