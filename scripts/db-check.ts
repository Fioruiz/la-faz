import { sql } from "drizzle-orm";
import { getDb, getPool } from "../lib/db-client";

const TABLA = "zz_db_check";

async function contar(db: ReturnType<typeof getDb>): Promise<number> {
  const r = await db.execute(sql.raw(`select count(*)::int as n from ${TABLA}`));
  return Number(r.rows[0].n);
}

async function main() {
  const db = getDb();

  await db.execute(sql`select 1`);
  console.log("OK select 1");

  await db.execute(sql.raw(`drop table if exists ${TABLA}`));
  await db.execute(sql.raw(`create table ${TABLA} (n int)`));
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`insert into ${TABLA} values (1)`));
    });
    const tras = await contar(db);
    if (tras !== 1) throw new Error(`Transacción confirmada: se esperaba 1 fila y hay ${tras}`);
    console.log("OK transacción confirmada (1 fila)");

    await db
      .transaction(async (tx) => {
        await tx.execute(sql.raw(`insert into ${TABLA} values (2)`));
        throw new Error("rollback de prueba");
      })
      .catch((e: Error) => {
        if (e.message !== "rollback de prueba") throw e;
      });
    const trasRollback = await contar(db);
    if (trasRollback !== 1) {
      throw new Error(`Transacción revertida: se esperaba 1 fila y hay ${trasRollback}`);
    }
    console.log("OK transacción revertida (sigue 1 fila)");
  } finally {
    await db.execute(sql.raw(`drop table if exists ${TABLA}`));
  }
}

main()
  .then(() => getPool().end())
  .then(() => console.log("Conexión a Neon correcta"))
  .catch((e: Error) => {
    console.error("ERROR:", e.message);
    process.exit(1);
  });
