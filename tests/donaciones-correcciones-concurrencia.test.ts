import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq, inArray, sql } from "drizzle-orm";
import { editarDonacion } from "../lib/donaciones-correcciones";
import { ejecutarEscrituraAuditada, type DbTransaccional } from "../lib/escritura-auditada-core";
import { hoyEnLima } from "../lib/fechas";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { apoyantes, auditLog, donaciones, itemsMeta, proyectos, responsables } from "../lib/schema";
import { crearApoyante, crearProyecto, crearResponsable, db, pool, type Tx } from "./helpers";

after(() => pool.end());

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Espera a que Postgres muestre una consulta esperando un bloqueo (no depende del reloj).
async function esperarBloqueoEnPostgres() {
  for (let i = 0; i < 100; i++) {
    const r = await db.execute(sql`select count(*)::int as n from pg_locks where not granted`);
    if (Number((r.rows[0] as { n: number }).n) > 0) return;
    await esperar(100);
  }
  throw new Error("Ninguna consulta quedó esperando un bloqueo en 10 s");
}

type TxA = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ids = { donacionId: number; proyectoId: number; destinoId: number };

// Conexión real, sin savepoints. Una transacción A (anular, o finalizar el destino) sigue abierta; la
// edición debe ESPERAR a A y, al confirmar A, ver el estado nuevo y rechazarse. Sin los bloqueos vería el
// estado viejo y modificaría una donación anulada o la movería a un proyecto ya finalizado.
async function conA(preparar: (a: TxA, ids: Ids) => Promise<void>, editar: (ids: Ids) => Record<string, unknown>) {
  const tx = db as unknown as Tx;
  const r = await crearResponsable(tx);
  const donante = await crearApoyante(tx, { nombre: "Concurrente", esDonante: true });
  const [proyecto, destino] = [await crearProyecto(tx, { tieneMeta: true }), await crearProyecto(tx, { tieneMeta: true })];
  const [d] = await db.insert(donaciones).values({ apoyanteId: donante.id, proyectoId: proyecto.id, tipo: "dinero", monto: "10.00", medio: "yape", fecha: hoyEnLima(), registradoPor: r.id }).returning();
  const ids = { donacionId: d.id, proyectoId: proyecto.id, destinoId: destino.id };

  let liberar!: () => void;
  let adentro!: () => void;
  const puerta = new Promise<void>((res) => (liberar = res));
  const preparado = new Promise<void>((res) => (adentro = res));
  let transaccionA: Promise<void> = Promise.resolve();
  try {
    transaccionA = db.transaction(async (a) => {
      await preparar(a, ids);
      adentro();
      await puerta;
    });
    await preparado;

    let terminado = false;
    const edicion = ejecutarEscrituraAuditada({
      nombre: "concurrencia-correcciones",
      db: db as unknown as DbTransaccional,
      requerir: () => verificarResponsableActivo(db, r.id),
      entrada: editar(ids),
      esquema: editarDonacion.esquema,
      escribir: editarDonacion.escribir,
    }).then((res) => {
      terminado = true;
      return res;
    });

    await esperarBloqueoEnPostgres();
    assert.equal(terminado, false, "la edición debió esperar a la otra transacción");

    liberar();
    await transaccionA;
    const resultado = await edicion;
    const [despues] = await db.select().from(donaciones).where(eq(donaciones.id, d.id));
    return { resultado, despues, ids };
  } finally {
    // Si la prueba falla con A abierta, la limpieza esperaría a A para siempre: se la libera primero.
    liberar();
    await transaccionA.catch(() => {});
    await db.delete(donaciones).where(eq(donaciones.apoyanteId, donante.id));
    await db.delete(auditLog).where(eq(auditLog.responsableId, r.id));
    await db.delete(itemsMeta).where(inArray(itemsMeta.proyectoId, [proyecto.id, destino.id]));
    await db.delete(proyectos).where(inArray(proyectos.id, [proyecto.id, destino.id]));
    await db.delete(apoyantes).where(eq(apoyantes.id, donante.id));
    await db.delete(responsables).where(eq(responsables.id, r.id));
  }
}

describe("corregir donaciones con escrituras simultáneas", () => {
  test("se anula la donación a la vez: la edición espera y se rechaza por anulada", async () => {
    const { resultado, despues } = await conA(
      async (a, { donacionId }) => {
        await a.select().from(donaciones).where(eq(donaciones.id, donacionId)).for("update");
        await a.update(donaciones).set({ anulada: true }).where(eq(donaciones.id, donacionId));
      },
      ({ donacionId, proyectoId }) => ({ donacionId, proyectoId, fecha: hoyEnLima(), monto: "99", medio: "yape" }),
    );
    assert.deepEqual(resultado, { ok: false, tipo: "regla", mensaje: "Esta donación está anulada y no se puede modificar" });
    assert.equal(despues.monto, "10.00");
  });

  test("se finaliza el proyecto de destino a la vez: la reasignación espera y se rechaza por finalizado", async () => {
    const { resultado, despues, ids } = await conA(
      async (a, { destinoId }) => {
        await a.select().from(proyectos).where(eq(proyectos.id, destinoId)).for("update");
        await a.update(proyectos).set({ estado: "finalizado", resultado: "Cierre" }).where(eq(proyectos.id, destinoId));
      },
      ({ donacionId, destinoId }) => ({ donacionId, proyectoId: destinoId, fecha: hoyEnLima(), monto: "10", medio: "yape" }),
    );
    assert.deepEqual(resultado, { ok: false, tipo: "regla", mensaje: "Este proyecto ya está finalizado" });
    assert.equal(despues.proyectoId, ids.proyectoId);
  });
});
