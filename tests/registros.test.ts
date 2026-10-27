import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { auditLog, donaciones, responsables, voluntariosInscritos } from "../lib/schema";
import { FK, NO_NULO, crearApoyante, crearResponsable, enTransaccion, escenarioBase, pool, rechazo } from "./helpers";

after(() => pool.end());

const FECHA = "2026-11-01";

describe("anulación sin borrado", () => {
  test("una donación nueva no está anulada", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const [d] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, tipo: "dinero", monto: "10", fecha: FECHA, registradoPor: responsable.id })
        .returning();
      assert.equal(d.anulada, false);
    }));

  test("anular conserva la fila con sus valores originales", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, proyecto } = await escenarioBase(tx);
      const [d] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, proyectoId: proyecto.id, tipo: "dinero", monto: "10", fecha: FECHA, registradoPor: responsable.id })
        .returning();
      await tx.update(donaciones).set({ anulada: true }).where(eq(donaciones.id, d.id));
      const [despues] = await tx.select().from(donaciones).where(eq(donaciones.id, d.id));
      assert.equal(despues.anulada, true);
      assert.equal(despues.apoyanteId, apoyante.id);
      assert.equal(despues.proyectoId, proyecto.id);
      assert.equal(despues.monto, "10.00");
    }));
});

describe("registros ligados a quien los creó", () => {
  test("donación sin registrado_por se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({
          apoyanteId: apoyante.id,
          tipo: "dinero",
          monto: "10",
          fecha: FECHA,
          registradoPor: undefined as unknown as number,
        }),
      );
      assert.equal(r.code, NO_NULO);
    }));

  test("responsable nuevo está activo por defecto", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      assert.equal(r.activo, true);
    }));

  test("desactivar a un responsable no toca sus donaciones", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const [d] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, tipo: "dinero", monto: "10", fecha: FECHA, registradoPor: responsable.id })
        .returning();
      await tx.update(responsables).set({ activo: false }).where(eq(responsables.id, responsable.id));
      const [despues] = await tx.select().from(donaciones).where(eq(donaciones.id, d.id));
      assert.deepEqual(despues, d);
    }));

  test("no se puede borrar un responsable con donaciones", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, tipo: "dinero", monto: "10", fecha: FECHA, registradoPor: responsable.id });
      const r = await rechazo(tx, (t) => t.delete(responsables).where(eq(responsables.id, responsable.id)));
      assert.equal(r.code, FK);
    }));
});

describe("donación mixta vinculada", () => {
  test("vínculo a una donación existente se acepta", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable, proyecto, item } = await escenarioBase(tx);
      const [dinero] = await tx
        .insert(donaciones)
        .values({ apoyanteId: apoyante.id, proyectoId: proyecto.id, tipo: "dinero", monto: "30", fecha: FECHA, registradoPor: responsable.id })
        .returning();
      const [producto] = await tx
        .insert(donaciones)
        .values({
          apoyanteId: apoyante.id,
          proyectoId: proyecto.id,
          itemId: item.id,
          tipo: "producto",
          cantidad: 6,
          fecha: FECHA,
          registradoPor: responsable.id,
          donacionVinculadaId: dinero.id,
        })
        .returning();
      assert.equal(producto.donacionVinculadaId, dinero.id);
    }));

  test("vínculo a una donación inexistente se rechaza", () =>
    enTransaccion(async (tx) => {
      const { apoyante, responsable } = await escenarioBase(tx);
      const r = await rechazo(tx, (t) =>
        t.insert(donaciones).values({
          apoyanteId: apoyante.id,
          tipo: "dinero",
          monto: "10",
          fecha: FECHA,
          registradoPor: responsable.id,
          donacionVinculadaId: 2147483000,
        }),
      );
      assert.deepEqual(r, { code: FK, constraint: "donaciones_vinculada_fk" });
    }));
});

describe("historial de cambios", () => {
  test("fila completa se acepta y la fecha se completa sola", () =>
    enTransaccion(async (tx) => {
      const { responsable } = await escenarioBase(tx);
      const [fila] = await tx
        .insert(auditLog)
        .values({
          entidad: "donaciones",
          entidadId: 1,
          accion: "anular",
          antes: { anulada: false },
          despues: { anulada: true },
          responsableId: responsable.id,
        })
        .returning();
      assert.ok(fila.creadoEn instanceof Date);
      assert.deepEqual(fila.despues, { anulada: true });
    }));

  test("fila sin responsable se rechaza", () =>
    enTransaccion(async (tx) => {
      const r = await rechazo(tx, (t) =>
        t.insert(auditLog).values({
          entidad: "donaciones",
          entidadId: 1,
          accion: "anular",
          responsableId: undefined as unknown as number,
        }),
      );
      assert.equal(r.code, NO_NULO);
    }));
});

describe("inscripciones de voluntariado", () => {
  test("inscripción con apoyante se acepta", () =>
    enTransaccion(async (tx) => {
      const a = await crearApoyante(tx, { esDonante: false, esVoluntario: true });
      const [v] = await tx.insert(voluntariosInscritos).values({ apoyanteId: a.id, consentimientoVersion: "prueba" }).returning();
      assert.equal(v.apoyanteId, a.id);
    }));

  test("inscripción con apoyante inexistente se rechaza", () =>
    enTransaccion(async (tx) => {
      const r = await rechazo(tx, (t) => t.insert(voluntariosInscritos).values({ apoyanteId: 2147483000, consentimientoVersion: "prueba" }));
      assert.equal(r.code, FK);
    }));

  test("inscripción sin apoyante se rechaza", () =>
    enTransaccion(async (tx) => {
      const r = await rechazo(tx, (t) =>
        t.insert(voluntariosInscritos).values({ apoyanteId: undefined as unknown as number, consentimientoVersion: "prueba" }),
      );
      assert.equal(r.code, NO_NULO);
    }));
});
