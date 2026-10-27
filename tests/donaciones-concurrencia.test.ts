import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { registrarDonacion } from "../lib/donaciones-escrituras";
import { ejecutarEscrituraAuditada, type DbTransaccional } from "../lib/escritura-auditada-core";
import { hoyEnLima } from "../lib/fechas";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { apoyantes, auditLog, donaciones, itemsMeta, proyectos, responsables } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, db, pool, type Tx } from "./helpers";

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

// Conexión real, sin savepoints. Una transacción A modifica al donante o al proyecto y sigue abierta;
// registrar una donación debe ESPERAR a A (bloqueo FOR SHARE contra el FOR UPDATE de A) y, al confirmar A,
// ver el estado nuevo y rechazarse. Sin el bloqueo vería el estado viejo (A no confirmó) y registraría
// una donación de un no-donante o en un proyecto ya finalizado.
async function conA(
  preparar: (a: Parameters<Parameters<typeof db.transaction>[0]>[0], ids: { apoyanteId: number; proyectoId: number }) => Promise<void>,
) {
  const tx = db as unknown as Tx;
  const r = await crearResponsable(tx);
  const donante = await crearApoyante(tx, { nombre: "Concurrente", esDonante: true });
  const proyecto = await crearProyecto(tx, { tieneMeta: true });
  const item = await crearItem(tx, proyecto.id);
  let liberar!: () => void;
  let adentro!: () => void;
  const puerta = new Promise<void>((res) => (liberar = res));
  const preparado = new Promise<void>((res) => (adentro = res));
  let transaccionA: Promise<void> = Promise.resolve();
  try {
    transaccionA = db.transaction(async (a) => {
      await preparar(a, { apoyanteId: donante.id, proyectoId: proyecto.id });
      adentro();
      await puerta;
    });
    await preparado;

    let terminado = false;
    const registro = ejecutarEscrituraAuditada({
      nombre: "concurrencia-donaciones",
      db: db as unknown as DbTransaccional,
      requerir: () => verificarResponsableActivo(db, r.id),
      entrada: { tipo: "dinero", apoyanteId: donante.id, proyectoId: proyecto.id, fecha: hoyEnLima(), monto: "10", medio: "yape" },
      esquema: registrarDonacion.esquema,
      escribir: registrarDonacion.escribir,
    }).then((res) => {
      terminado = true;
      return res;
    });

    await esperarBloqueoEnPostgres();
    assert.equal(terminado, false, "el registro debió esperar a la otra transacción");

    liberar();
    await transaccionA;
    const resultado = await registro;
    const cuantas = (await db.select().from(donaciones).where(eq(donaciones.apoyanteId, donante.id))).length;
    return { resultado, cuantas };
  } finally {
    // Si la prueba falla con A abierta, la limpieza esperaría a A para siempre: se la libera primero.
    liberar();
    await transaccionA.catch(() => {});
    await db.delete(donaciones).where(eq(donaciones.apoyanteId, donante.id));
    await db.delete(auditLog).where(eq(auditLog.responsableId, r.id));
    await db.delete(itemsMeta).where(eq(itemsMeta.id, item.id));
    await db.delete(proyectos).where(eq(proyectos.id, proyecto.id));
    await db.delete(apoyantes).where(eq(apoyantes.id, donante.id));
    await db.delete(responsables).where(eq(responsables.id, r.id));
  }
}

describe("registrar donación con escrituras simultáneas", () => {
  test("se finaliza el proyecto a la vez: el registro espera y se rechaza por finalizado", async () => {
    const { resultado, cuantas } = await conA(async (a, { proyectoId }) => {
      await a.select().from(proyectos).where(eq(proyectos.id, proyectoId)).for("update");
      await a.update(proyectos).set({ estado: "finalizado", resultado: "Cierre" }).where(eq(proyectos.id, proyectoId));
    });
    assert.deepEqual(resultado, { ok: false, tipo: "regla", mensaje: "Este proyecto ya está finalizado" });
    assert.equal(cuantas, 0);
  });

  test("se quita el rol de donante a la vez: el registro espera y se rechaza por falta del rol", async () => {
    const { resultado, cuantas } = await conA(async (a, { apoyanteId }) => {
      await a.select().from(apoyantes).where(eq(apoyantes.id, apoyanteId)).for("update");
      await a.update(apoyantes).set({ esDonante: false, esVoluntario: true }).where(eq(apoyantes.id, apoyanteId));
    });
    assert.deepEqual(resultado, { ok: false, tipo: "regla", mensaje: "Esta persona no es donante" });
    assert.equal(cuantas, 0);
  });
});
