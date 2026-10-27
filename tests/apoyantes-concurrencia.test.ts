import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { editarApoyante } from "../lib/apoyantes-escrituras";
import { ejecutarEscrituraAuditada, type DbTransaccional } from "../lib/escritura-auditada-core";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { apoyantes, auditLog, donaciones, responsables } from "../lib/schema";
import { crearApoyante, crearResponsable, db, pool, type Tx } from "./helpers";

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

// Conexión real, sin savepoints. Una transacción A registra una donación del apoyante y sigue abierta;
// quitarle el rol de donante debe ESPERAR a A (el `for update` choca con el bloqueo que toma la donación
// sobre el apoyante) y, al confirmar A, ver la donación y rechazarse. Sin el bloqueo, la edición contaría
// 0 donaciones (A no confirmó) y dejaría a un donante sin rol con una donación registrada.
test("registrar una donación y quitar el rol de donante a la vez: la edición espera y se rechaza", async () => {
  const tx = db as unknown as Tx;
  const r = await crearResponsable(tx);
  const a = await crearApoyante(tx, { nombre: "Concurrente", esDonante: true, esVoluntario: true });
  let liberar!: () => void;
  let adentro!: () => void;
  const puerta = new Promise<void>((res) => (liberar = res));
  const donacionInsertada = new Promise<void>((res) => (adentro = res));
  let registro: Promise<void> = Promise.resolve();
  try {
    registro = db.transaction(async (t) => {
      await t.insert(donaciones).values({ apoyanteId: a.id, tipo: "dinero", monto: "10", fecha: "2026-11-01", registradoPor: r.id });
      adentro();
      await puerta;
    });
    await donacionInsertada;

    let terminado = false;
    const edicion = ejecutarEscrituraAuditada({
      nombre: "concurrencia-apoyantes",
      db: db as unknown as DbTransaccional,
      requerir: () => verificarResponsableActivo(db, r.id),
      entrada: { apoyanteId: a.id, nombre: "Concurrente", esVoluntario: "on" },
      esquema: editarApoyante.esquema,
      escribir: editarApoyante.escribir,
    }).then((res) => {
      terminado = true;
      return res;
    });

    await esperarBloqueoEnPostgres();
    assert.equal(terminado, false, "la edición debió esperar al registro de la donación");

    liberar();
    await registro;
    const res = await edicion;
    assert.ok(!res.ok && res.tipo === "regla" && /donaciones/.test(res.mensaje));
    assert.equal((await db.select().from(apoyantes).where(eq(apoyantes.id, a.id)))[0].esDonante, true);
  } finally {
    // Si la prueba falla con A abierta, la limpieza esperaría a A para siempre: se la libera primero.
    liberar();
    await registro.catch(() => {});
    await db.delete(donaciones).where(eq(donaciones.apoyanteId, a.id));
    await db.delete(auditLog).where(eq(auditLog.responsableId, r.id));
    await db.delete(apoyantes).where(eq(apoyantes.id, a.id));
    await db.delete(responsables).where(eq(responsables.id, r.id));
  }
});
