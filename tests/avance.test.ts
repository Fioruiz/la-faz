import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calcularAvance, calcularItem, type ItemAgregado } from "../lib/avance";

const item = (extra: Partial<ItemAgregado> = {}): ItemAgregado => ({
  id: 1, proyectoId: 10, nombre: "Pack", unidad: "pack", cantidadMeta: 2000, costoReferencial: "13.00", recibido: 1200, ...extra,
});
const avanceDe = (items: ItemAgregado[], dinero = "0.00", proyectoId = 10) =>
  calcularAvance({ proyectoIds: [proyectoId], items, dineroPorProyecto: { [proyectoId]: dinero }, sinAsignar: { totalDinero: "0", cantidad: 0 } }).proyectos[proyectoId];

describe("avance por ítem", () => {
  test("avance parcial: 1200 de 2000 es 60% y faltan 800", () => {
    const r = calcularItem(item());
    assert.deepEqual([r.porcentaje, r.falta, r.excedente, r.cumplida], [60, 800, 0, false]);
  });

  test("excedente real: 2150 de 2000 es 107%, excedente 150, cumplida, no falta nada", () => {
    const r = calcularItem(item({ recibido: 2150 }));
    assert.deepEqual([r.porcentaje, r.excedente, r.falta, r.cumplida], [107, 150, 0, true]);
  });

  test("1999 de 2000 es 99% y no está cumplida; exactamente la meta sí", () => {
    assert.deepEqual([calcularItem(item({ recibido: 1999 })).porcentaje, calcularItem(item({ recibido: 1999 })).cumplida], [99, false]);
    assert.equal(calcularItem(item({ recibido: 2000 })).cumplida, true);
  });

  test("sin donaciones: 0%", () => {
    const r = calcularItem(item({ recibido: 0 }));
    assert.deepEqual([r.porcentaje, r.falta, r.cumplida], [0, 2000, false]);
  });
});

describe("falta en soles (ADR 0010)", () => {
  test("caso base: faltan 800 × S/ 13 = 10.400 y con S/ 5.000 en dinero faltan 5.400", () => {
    const p = avanceDe([item()], "5000.00");
    assert.deepEqual([p.faltaSoles, p.totalDinero, p.estimacion], ["5400.00", "5000.00", "completa"]);
  });

  test("dinero mayor que el costo restante: la falta es 0, no negativa", () => {
    assert.equal(avanceDe([item()], "20000.00").faltaSoles, "0.00");
  });

  test("el excedente de un ítem no compensa lo que falta de otro", () => {
    const sobra = item({ id: 1, nombre: "Pack", cantidadMeta: 2000, recibido: 2150, costoReferencial: "13.00" });
    const falta = item({ id: 2, nombre: "Agua", unidad: "botella", cantidadMeta: 500, recibido: 100, costoReferencial: "2.00" });
    // solo cuenta lo que falta del ítem que falta: 400 × 2 = 800; los 150 que sobran de Pack no restan
    assert.equal(avanceDe([sobra, falta]).faltaSoles, "800.00");
  });

  test("metas cumplidas: la falta es 0", () => {
    assert.equal(avanceDe([item({ recibido: 2000 })]).faltaSoles, "0.00");
  });

  test("ítems sin costo: estimado parcial y solo cuentan los que tienen costo", () => {
    const conCosto = item({ id: 1, recibido: 1200 });
    const sinCosto = item({ id: 2, nombre: "Cereal", cantidadMeta: 100, recibido: 0, costoReferencial: null });
    const p = avanceDe([conCosto, sinCosto]);
    assert.deepEqual([p.estimacion, p.faltaSoles], ["parcial", "10400.00"]);
  });

  test("ningún ítem con costo, o sin ítems: no disponible y falta nula (no S/ 0)", () => {
    assert.deepEqual([avanceDe([item({ costoReferencial: null })]).estimacion, avanceDe([item({ costoReferencial: null })]).faltaSoles], ["no-disponible", null]);
    assert.deepEqual([avanceDe([]).estimacion, avanceDe([]).faltaSoles], ["no-disponible", null]);
  });

  test("3 unidades a S/ 13,33 cuestan exactamente S/ 39,99", () => {
    assert.equal(avanceDe([item({ cantidadMeta: 3, recibido: 0, costoReferencial: "13.33" })]).faltaSoles, "39.99");
  });

  test("valores grandes no se desbordan", () => {
    const p = avanceDe([item({ cantidadMeta: 1_000_000, recibido: 0, costoReferencial: "9999999.99" })]);
    assert.equal(p.faltaSoles, "9999999990000.00");
  });
});

describe("resumen del proyecto", () => {
  test("metas cumplidas de metas totales, sin porcentaje del proyecto", () => {
    const p = avanceDe([item({ id: 1, recibido: 2000 }), item({ id: 2, nombre: "Agua", cantidadMeta: 500, recibido: 10 })]);
    assert.deepEqual([p.metasCumplidas, p.metasTotal], [1, 2]);
    assert.ok(!("porcentaje" in p));
  });

  test("proyecto informativo con solo dinero: total en soles, sin ítems ni falta", () => {
    const p = avanceDe([], "350.50");
    assert.deepEqual([p.totalDinero, p.metasTotal, p.metasCumplidas, p.faltaSoles, p.items.length], ["350.50", 0, 0, null, 0]);
  });

  test("cada proyecto solo cuenta sus ítems y su dinero", () => {
    const r = calcularAvance({
      proyectoIds: [10, 20],
      items: [item({ proyectoId: 10, id: 1 }), item({ proyectoId: 20, id: 2, recibido: 2000 })],
      dineroPorProyecto: { 10: "100.00" },
      sinAsignar: { totalDinero: "0", cantidad: 0 },
    });
    assert.deepEqual([r.proyectos[10].metasCumplidas, r.proyectos[20].metasCumplidas, r.proyectos[10].totalDinero, r.proyectos[20].totalDinero], [0, 1, "100.00", "0.00"]);
  });

  test("lo sin asignar se normaliza a dos decimales", () => {
    const r = calcularAvance({ proyectoIds: [], items: [], dineroPorProyecto: {}, sinAsignar: { totalDinero: "200", cantidad: 2 } });
    assert.deepEqual(r.sinAsignar, { totalDinero: "200.00", cantidad: 2 });
  });
});
