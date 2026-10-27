import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { armarReporte, validarRango, type EntradaReporte } from "../lib/reporte";

const base = (extra: Partial<EntradaReporte> = {}): EntradaReporte => ({
  dinero: [], productos: [], anuladas: [],
  responsables: [{ id: 1, nombre: "Ana", activo: true }, { id: 2, nombre: "Beto", activo: false }],
  proyectos: [{ id: 10, nombre: "10 Derechos", estado: "activo" }, { id: 20, nombre: "Música", estado: "finalizado" }],
  items: [
    { id: 100, nombre: "Pack", unidad: "pack", proyectoId: 10 },
    { id: 101, nombre: "Agua", unidad: "botella", proyectoId: 10 },
    { id: 200, nombre: "Pack", unidad: "pack", proyectoId: 20 },
  ],
  ...extra,
});

describe("dinero con subtotales por medio", () => {
  test("Yape 100, Plin 50,50 y transferencia 200 suman 350,50 y los subtotales suman el total", () => {
    const r = armarReporte(base({ dinero: [
      { responsableId: 1, proyectoId: 10, medio: "yape", total: "100.00", cantidad: 2 },
      { responsableId: 1, proyectoId: 10, medio: "plin", total: "50.50", cantidad: 1 },
      { responsableId: 1, proyectoId: 10, medio: "transferencia", total: "200.00", cantidad: 1 },
    ] }));
    const g = r.porResponsable[0];
    assert.deepEqual([g.dinero.total, g.dinero.porMedio.yape, g.dinero.porMedio.plin, g.dinero.porMedio.transferencia, g.donaciones], ["350.50", "100.00", "50.50", "200.00", 4]);
  });

  test("0,10 + 0,20 = 0,30 exacto", () => {
    const r = armarReporte(base({ dinero: [
      { responsableId: 1, proyectoId: 10, medio: "yape", total: "0.10", cantidad: 1 },
      { responsableId: 1, proyectoId: 10, medio: "yape", total: "0.20", cantidad: 1 },
    ] }));
    assert.equal(r.porProyecto[0].dinero.total, "0.30");
  });

  test("dinero sin medio suma al total y aparece como sin medio", () => {
    const r = armarReporte(base({ dinero: [
      { responsableId: 1, proyectoId: 10, medio: "yape", total: "10.00", cantidad: 1 },
      { responsableId: 1, proyectoId: 10, medio: null, total: "5.00", cantidad: 1 },
    ] }));
    const m = r.porResponsable[0].dinero;
    assert.deepEqual([m.total, m.porMedio.sinMedio], ["15.00", "5.00"]);
  });

  test("un grupo solo con productos tiene total en soles 0.00", () => {
    const r = armarReporte(base({ productos: [{ responsableId: 1, proyectoId: 10, itemId: 100, cantidad: 5, donaciones: 1 }] }));
    assert.equal(r.porResponsable[0].dinero.total, "0.00");
  });
});

describe("productos por ítem", () => {
  test("dos ítems distintos no se mezclan, aunque tengan unidades distintas", () => {
    const r = armarReporte(base({ productos: [
      { responsableId: 1, proyectoId: 10, itemId: 100, cantidad: 1200, donaciones: 3 },
      { responsableId: 1, proyectoId: 10, itemId: 101, cantidad: 100, donaciones: 1 },
    ] }));
    const items = r.porResponsable[0].productos.items;
    assert.deepEqual(items.map((i) => [i.nombre, i.unidad, i.cantidad, i.donaciones]), [["Agua", "botella", 100, 1], ["Pack", "pack", 1200, 3]]);
  });

  test("dos proyectos con un ítem llamado igual se distinguen por proyecto en la vista por responsable", () => {
    const r = armarReporte(base({ productos: [
      { responsableId: 1, proyectoId: 10, itemId: 100, cantidad: 10, donaciones: 1 },
      { responsableId: 1, proyectoId: 20, itemId: 200, cantidad: 20, donaciones: 1 },
    ] }));
    assert.deepEqual(r.porResponsable[0].productos.items.map((i) => [i.proyecto, i.cantidad]), [["10 Derechos", 10], ["Música", 20]]);
  });

  test("productos sin asignar van en un renglón y no suman cantidades", () => {
    const r = armarReporte(base({ productos: [{ responsableId: 1, proyectoId: null, itemId: null, cantidad: 70, donaciones: 3 }] }));
    const g = r.porProyecto.find((x) => x.id === null);
    assert.deepEqual([g?.nombre, g?.productos.sinAsignar.donaciones, g?.productos.items.length, g?.donaciones], ["Sin asignar", 3, 0, 3]);
  });
});

describe("grupos, anuladas y totales", () => {
  const entrada = () => base({
    dinero: [
      { responsableId: 1, proyectoId: 10, medio: "yape", total: "100.00", cantidad: 1 },
      { responsableId: 2, proyectoId: 20, medio: "plin", total: "300.00", cantidad: 2 },
      { responsableId: 2, proyectoId: null, medio: "yape", total: "50.00", cantidad: 1 },
    ],
    productos: [{ responsableId: 1, proyectoId: 10, itemId: 100, cantidad: 40, donaciones: 2 }],
    anuladas: [{ responsableId: 1, proyectoId: 10, cantidad: 2 }, { responsableId: 1, proyectoId: 30, cantidad: 1 }],
  });

  test("responsable desactivado aparece con su nombre y marcado; proyecto finalizado también", () => {
    const r = armarReporte(entrada());
    assert.deepEqual(r.porResponsable.map((g) => [g.nombre, g.desactivado]), [["Beto", true], ["Ana", false]]);
    assert.equal(r.porProyecto.find((g) => g.id === 20)?.finalizado, true);
  });

  test("ordena por total en soles descendente y hay un grupo Sin asignar", () => {
    const r = armarReporte(entrada());
    assert.deepEqual(r.porProyecto.map((g) => g.nombre).slice(0, 3), ["Música", "10 Derechos", "Sin asignar"]);
  });

  test("las anuladas no entran a los totales pero se cuentan aparte; un grupo con solo anuladas se muestra con ceros", () => {
    const r = armarReporte(entrada());
    const derechos = r.porProyecto.find((g) => g.id === 10);
    assert.deepEqual([derechos?.dinero.total, derechos?.anuladas, derechos?.donaciones], ["100.00", 2, 3]);
    const soloAnuladas = r.porProyecto.find((g) => g.id === 30);
    assert.deepEqual([soloAnuladas?.donaciones, soloAnuladas?.dinero.total, soloAnuladas?.anuladas], [0, "0.00", 1]);
  });

  test("la suma de los grupos de cada vista iguala al total general", () => {
    const r = armarReporte(entrada());
    const suma = (grupos: typeof r.porResponsable) => grupos.reduce((s, g) => s + Number(g.dinero.total) * 100, 0);
    assert.equal(suma(r.porResponsable), Number(r.total.dinero.total) * 100);
    assert.equal(suma(r.porProyecto), Number(r.total.dinero.total) * 100);
    assert.deepEqual([r.total.dinero.total, r.total.donaciones, r.total.anuladas], ["450.00", 6, 3]);
  });

  test("sin donaciones: ningún grupo y totales en cero", () => {
    const r = armarReporte(base());
    assert.deepEqual([r.porResponsable.length, r.porProyecto.length, r.total.dinero.total, r.total.donaciones], [0, 0, "0.00", 0]);
  });
});

describe("validarRango", () => {
  const HOY = "2026-10-26";

  test("sin fechas o vacías es sin límite", () => {
    assert.deepEqual(validarRango(undefined, undefined, HOY), { ok: true, desde: undefined, hasta: undefined });
    assert.deepEqual(validarRango("", "  ", HOY), { ok: true, desde: undefined, hasta: undefined });
  });

  test("un extremo o los dos válidos", () => {
    assert.deepEqual(validarRango("2026-11-01", undefined, HOY), { ok: true, desde: "2026-11-01", hasta: undefined });
    assert.deepEqual(validarRango(undefined, "2026-11-30", HOY), { ok: true, desde: undefined, hasta: "2026-11-30" });
    assert.deepEqual(validarRango("2026-11-01", "2026-11-01", HOY), { ok: true, desde: "2026-11-01", hasta: "2026-11-01" });
  });

  test("fecha inexistente o mal formada", () => {
    for (const mala of ["2026-02-30", "03/11/2026", "2026-13-01", "hoy"]) {
      const r = validarRango(mala, undefined, HOY);
      assert.ok(!r.ok && /no es válida/.test(r.error), mala);
    }
    assert.ok(!validarRango(undefined, "2026-02-30", HOY).ok);
  });

  test("desde posterior a hasta", () => {
    const r = validarRango("2026-11-10", "2026-11-01", HOY);
    assert.ok(!r.ok && /posterior/.test(r.error));
  });

  test("antes de 2020 y más de un año adelante", () => {
    assert.ok(!validarRango("2019-12-31", undefined, HOY).ok);
    assert.ok(validarRango("2020-01-01", undefined, HOY).ok);
    assert.ok(validarRango(undefined, "2027-10-26", HOY).ok);
    assert.ok(!validarRango(undefined, "2027-10-27", HOY).ok);
  });
});
