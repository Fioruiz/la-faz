import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { donaciones } from "../lib/schema";
import {
  CHECK,
  FK,
  crearItem,
  crearProyecto,
  enTransaccion,
  escenarioBase,
  pool,
  rechazo,
} from "./helpers";

after(() => pool.end());

const ESTADO = { code: CHECK, constraint: "donaciones_estado_valido" };
const FECHA = "2026-11-01";

describe("tres estados válidos de donación (ADR 0008)", () => {
  test("dinero sin asignar con monto positivo se acepta", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const [d] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, tipo: "dinero", monto: "50.00", medio: "yape", fecha: FECHA, registradoPor: responsable.id })
        .returning();
      assert.equal(d.proyectoId, null);
    }));

  for (const [nombre, monto] of [
    ["monto 0", "0"],
    ["monto negativo", "-5"],
    ["monto nulo", undefined],
  ] as const) {
    test(`dinero con ${nombre} se rechaza`, () =>
      enTransaccion(async (tx) => {
        const { apoyante, responsable } = await escenarioBase(tx);
        const r = await rechazo(tx, (t) =>
          t.insert(donaciones).values({ apoyanteId: apoyante.id, tipo: "dinero", monto, fecha: FECHA, registradoPor: responsable.id }),
        );
        assert.deepEqual(r, ESTADO);
      }));
  }

  test("dinero con cantidad se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({ apoyanteId: apoyante.id, tipo: "dinero", monto: "10", cantidad: 3, fecha: FECHA, registradoPor: responsable.id }),
      );
      assert.deepEqual(r, ESTADO);
    }));

  test("dinero con ítem se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, proyecto, item } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({
          apoyanteId: apoyante.id,
          tipo: "dinero",
          monto: "10",
          itemId: item.id,
          proyectoId: proyecto.id,
          fecha: FECHA,
          registradoPor: responsable.id,
        }),
      );
      assert.deepEqual(r, ESTADO);
    }));

  test("dinero asignado a un proyecto se acepta", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, proyecto } = await escenarioBase(tx);
      const [d] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, proyectoId: proyecto.id, tipo: "dinero", monto: "10", fecha: FECHA, registradoPor: responsable.id })
        .returning();
      assert.equal(d.proyectoId, proyecto.id);
    }));

  test("producto asignado con ítem y proyecto coherentes se acepta", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, proyecto, item } = await escenarioBase(tx);
      const [d] = await tx
        .insert(donaciones)
        .values({
          apoyanteId: apoyante.id,
          proyectoId: proyecto.id,
          itemId: item.id,
          tipo: "producto",
          cantidad: 24,
          fecha: FECHA,
          registradoPor: responsable.id,
        })
        .returning();
      assert.equal(d.anulada, false);
    }));

  for (const [nombre, cantidad] of [
    ["cantidad 0", 0],
    ["cantidad negativa", -1],
    ["cantidad nula", undefined],
  ] as const) {
    test(`producto con ${nombre} se rechaza`, () =>
      enTransaccion(async (tx) => {
        const { apoyante, responsable, proyecto, item } = await escenarioBase(tx);
        const r = await rechazo(tx, (t) =>
          t.insert(donaciones).values({
            apoyanteId: apoyante.id,
            proyectoId: proyecto.id,
            itemId: item.id,
            tipo: "producto",
            cantidad,
            fecha: FECHA,
            registradoPor: responsable.id,
          }),
        );
        assert.deepEqual(r, ESTADO);
      }));
  }

  test("producto con ítem pero sin proyecto se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, item } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({
          apoyanteId: apoyante.id,
          itemId: item.id,
          tipo: "producto",
          cantidad: 5,
          descripcionProducto: "agua",
          fecha: FECHA,
          registradoPor: responsable.id,
        }),
      );
      assert.deepEqual(r, ESTADO);
    }));

  test("producto con proyecto pero sin ítem se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, proyecto } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({
          apoyanteId: apoyante.id,
          proyectoId: proyecto.id,
          tipo: "producto",
          cantidad: 5,
          descripcionProducto: "agua",
          fecha: FECHA,
          registradoPor: responsable.id,
        }),
      );
      assert.deepEqual(r, ESTADO);
    }));

  test("producto sin asignar con descripción se acepta", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const [d] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, tipo: "producto", cantidad: 12, descripcionProducto: "botellas de agua", fecha: FECHA, registradoPor: responsable.id })
        .returning();
      assert.equal(d.itemId, null);
      assert.equal(d.proyectoId, null);
    }));

  test("producto sin asignar sin descripción se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({ apoyanteId: apoyante.id, tipo: "producto", cantidad: 12, fecha: FECHA, registradoPor: responsable.id }),
      );
      assert.deepEqual(r, ESTADO);
    }));

  test("tipo fuera de dinero y producto se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({ apoyanteId: apoyante.id, tipo: "servicio", monto: "10", fecha: FECHA, registradoPor: responsable.id }),
      );
      // Ambos CHECK lo rechazan; Postgres informa el primero por orden alfabético.
      assert.equal(r.code, CHECK);
      assert.match(r.constraint ?? "", /^donaciones_(estado|tipo)_valido$/);
    }));

  test("medio fuera de Yape, Plin y transferencia se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({ apoyanteId: apoyante.id, tipo: "dinero", monto: "10", medio: "efectivo", fecha: FECHA, registradoPor: responsable.id }),
      );
      assert.deepEqual(r, { code: CHECK, constraint: "donaciones_medio_valido" });
    }));
});

describe("un ítem pertenece a un solo proyecto", () => {
  test("ítem de otro proyecto se rechaza por la FK compuesta", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, item } = await escenarioBase(tx);
      const otro = await crearProyecto(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({
          apoyanteId: apoyante.id,
          proyectoId: otro.id,
          itemId: item.id,
          tipo: "producto",
          cantidad: 5,
          fecha: FECHA,
          registradoPor: responsable.id,
        }),
      );
      assert.deepEqual(r, { code: FK, constraint: "donaciones_item_proyecto_fk" });
    }));

  test("ítem del proyecto B con otro ítem en el proyecto A solo acepta su propio par", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const b = await crearProyecto(tx);
      const itemB = await crearItem(tx, b.id);
      const [d] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, proyectoId: b.id, itemId: itemB.id, tipo: "producto", cantidad: 1, fecha: FECHA, registradoPor: responsable.id })
        .returning();
      assert.equal(d.itemId, itemB.id);
    }));
});
