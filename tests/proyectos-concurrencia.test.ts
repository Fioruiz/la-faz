import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { ejecutarEscrituraAuditada, type DbTransaccional } from "../lib/escritura-auditada-core";
import { crearItem } from "../lib/proyectos-escrituras";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { auditLog, itemsMeta, proyectos, responsables } from "../lib/schema";
import { crearProyecto, crearResponsable, db, pool, type Tx } from "./helpers";

after(() => pool.end());

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Espera a que Postgres muestre una consulta esperando un bloqueo. Así la creación ya hizo su lectura
// del proyecto (con o sin `for update`) antes de que el cierre confirme, y la prueba no depende del reloj.
async function esperarBloqueoEnPostgres() {
  for (let i = 0; i < 100; i++) {
    const r = await db.execute(sql`select count(*)::int as n from pg_locks where not granted`);
    if (Number((r.rows[0] as { n: number }).n) > 0) return;
    await esperar(100);
  }
  throw new Error("Ninguna consulta quedó esperando un bloqueo en 10 s");
}

// Conexión real del pool, sin savepoints: es lo que prueba el bloqueo de fila entre dos transacciones.
// Una transacción A finaliza el proyecto y sigue abierta; crear un ítem debe ESPERAR a A (por el
// `for update`) y, al terminar A, ver el proyecto finalizado. Sin el bloqueo, el ítem leería el proyecto
// como activo (A no ha confirmado), esperaría solo en la clave foránea y, al confirmar A, se crearía
// dentro de un proyecto ya finalizado.
test("finalizar y agregar un ítem a la vez: el ítem espera y se rechaza si el cierre gana", async () => {
  const tx = db as unknown as Tx;
  const r = await crearResponsable(tx);
  const p = await crearProyecto(tx, { tieneMeta: true });
  try {
    let liberar!: () => void;
    let adentro!: () => void;
    const puerta = new Promise<void>((res) => (liberar = res));
    const lockTomado = new Promise<void>((res) => (adentro = res));

    const cierre = db.transaction(async (a) => {
      await a.select().from(proyectos).where(eq(proyectos.id, p.id)).for("update");
      await a.update(proyectos).set({ estado: "finalizado", resultado: "Cierre" }).where(eq(proyectos.id, p.id));
      adentro();
      await puerta;
    });
    await lockTomado;

    let terminado = false;
    const creacion = ejecutarEscrituraAuditada({
      nombre: "concurrencia",
      db: db as unknown as DbTransaccional,
      requerir: () => verificarResponsableActivo(db, r.id),
      entrada: { proyectoId: p.id, nombre: "Pack", unidad: "pack", cantidadMeta: "10" },
      esquema: crearItem.esquema,
      escribir: crearItem.escribir,
    }).then((res) => {
      terminado = true;
      return res;
    });

    await esperarBloqueoEnPostgres();
    assert.equal(terminado, false, "la creación del ítem debió esperar al cierre");

    liberar();
    await cierre;
    const res = await creacion;
    assert.deepEqual(res, { ok: false, tipo: "regla", mensaje: "Este proyecto ya está finalizado" });
    assert.equal((await db.select().from(itemsMeta).where(eq(itemsMeta.proyectoId, p.id))).length, 0);
  } finally {
    await db.delete(auditLog).where(eq(auditLog.responsableId, r.id));
    await db.delete(itemsMeta).where(eq(itemsMeta.proyectoId, p.id));
    await db.delete(proyectos).where(eq(proyectos.id, p.id));
    await db.delete(responsables).where(eq(responsables.id, r.id));
  }
});
