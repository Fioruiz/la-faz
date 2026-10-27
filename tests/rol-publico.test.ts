import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { LectorDb } from "../lib/auth-credentials";
import { consultarAvance } from "../lib/avance-consulta";
import { hoyEnLima } from "../lib/fechas";
import { crearLecturasPublicas } from "../lib/public-queries-core";
import {
  COLUMNAS_DONACIONES,
  COLUMNAS_DONACIONES_DENEGADAS,
  ROL_PUBLICO,
  TABLAS_DENEGADAS,
  TABLAS_PUBLICAS,
  sentenciasPermisos,
} from "../lib/rol-publico";
import * as schema from "../lib/schema";
import { apoyantes, donaciones, itemsMeta, proyectos, responsables } from "../lib/schema";
import { db, pool } from "./helpers";

// Estas pruebas necesitan un rol REAL y datos CONFIRMADOS (el rol es otra conexión y no ve una transacción abierta),
// así que usan la rama de pruebas con datos propios que borran al terminar. Requieren que se haya creado el rol:
//   PUBLICO_LECTURA_PASSWORD=... npm run db:rol-publico -- --prueba   y   DATABASE_URL_TEST_PUBLICO en .env.test
const url = process.env.DATABASE_URL_TEST_PUBLICO;
if (!url) {
  throw new Error(
    `Falta DATABASE_URL_TEST_PUBLICO (.env.test): crea el rol con "npm run db:rol-publico -- --prueba" y pon su cadena de conexión.`,
  );
}
const poolPublico = new Pool({ connectionString: url });
const dbPublico = drizzle({ client: poolPublico, schema });

const HOY = hoyEnLima();
const lector = (d: unknown) => d as LectorDb;
const sufijo = Math.random().toString(36).slice(2, 8);
let ids: { responsable: number; apoyante: number; proyecto: number; item: number };

before(async () => {
  const [r] = await db.insert(responsables).values({ nombre: "Resp rol", correo: `rol-${sufijo}@prueba.test`, passwordHash: "hash" }).returning();
  const [a] = await db.insert(apoyantes).values({ nombre: `Donante rol ${sufijo}`, contacto: "999 111 222", esDonante: true }).returning();
  const [p] = await db.insert(proyectos).values({ nombre: `Proyecto rol ${sufijo}`, tieneMeta: true }).returning();
  const [i] = await db.insert(itemsMeta).values({ proyectoId: p.id, nombre: "Pack", unidad: "pack", cantidadMeta: 100, costoReferencial: "13.00" }).returning();
  const base = { apoyanteId: a.id, fecha: HOY, registradoPor: r.id };
  await db.insert(donaciones).values([
    { ...base, proyectoId: p.id, itemId: i.id, tipo: "producto", cantidad: 30 },
    { ...base, proyectoId: p.id, itemId: i.id, tipo: "producto", cantidad: 5, anulada: true },
    { ...base, proyectoId: p.id, tipo: "dinero", monto: "50.00", medio: "yape" },
  ]);
  ids = { responsable: r.id, apoyante: a.id, proyecto: p.id, item: i.id };
});

// Borra lo que creó (las donaciones antes que sus padres) aunque alguna prueba falle, y luego cierra las conexiones.
after(async () => {
  try {
    if (ids) {
      await db.delete(donaciones).where(eq(donaciones.proyectoId, ids.proyecto));
      await db.delete(itemsMeta).where(eq(itemsMeta.proyectoId, ids.proyecto));
      await db.delete(proyectos).where(eq(proyectos.id, ids.proyecto));
      await db.delete(apoyantes).where(eq(apoyantes.id, ids.apoyante));
      await db.delete(responsables).where(eq(responsables.id, ids.responsable));
    }
  } finally {
    await poolPublico.end();
    await pool.end();
  }
});

// Código SQLSTATE del rechazo, o falla si la base acepta.
async function rechazo(consulta: string): Promise<string | undefined> {
  try {
    await poolPublico.query(consulta);
  } catch (e) {
    return (e as { code?: string }).code;
  }
  assert.fail(`la base aceptó: ${consulta}`);
}

describe("permisos declarados del rol público", () => {
  test("lo concedido y lo denegado no se cruzan", () => {
    assert.deepEqual(TABLAS_PUBLICAS.filter((t) => (TABLAS_DENEGADAS as readonly string[]).includes(t)), []);
    assert.deepEqual(COLUMNAS_DONACIONES.filter((c) => (COLUMNAS_DONACIONES_DENEGADAS as readonly string[]).includes(c)), []);
  });

  test("las sentencias solo conceden SELECT y nunca permisos de escritura", () => {
    const todas = sentenciasPermisos().join("\n");
    assert.doesNotMatch(todas, /grant\s+(insert|update|delete|all|create|truncate)/i);
    assert.doesNotMatch(todas, /apoyantes|responsables|audit_log|voluntarios_inscritos/);
  });
});

describe("rol de solo lectura de la zona pública", () => {
  test("conecta como el rol público", async () => {
    assert.equal((await poolPublico.query("select current_user as u")).rows[0].u, ROL_PUBLICO);
  });

  test("el avance con el rol es idéntico al de la conexión plena", async () => {
    const [plena, publica] = [
      await consultarAvance(lector(db), { proyectoIds: [ids.proyecto] }),
      await consultarAvance(lector(dbPublico), { proyectoIds: [ids.proyecto] }),
    ];
    assert.deepEqual(publica, plena);
    assert.equal(publica.proyectos[ids.proyecto].items.find((i) => i.id === ids.item)?.recibido, 30);
  });

  test("las lecturas públicas con el rol dan lo mismo que con la conexión plena", async () => {
    const [plena, publica] = [
      await crearLecturasPublicas(() => lector(db)).getProyectoPublico(ids.proyecto),
      await crearLecturasPublicas(() => lector(dbPublico)).getProyectoPublico(ids.proyecto),
    ];
    assert.ok(publica);
    assert.deepEqual(publica, plena);
    assert.deepEqual(publica.items.map((i) => [i.recibido, i.meta, i.porcentaje]), [[30, 100, 30]]);
    assert.ok(!JSON.stringify(publica).includes("999 111 222") && !JSON.stringify(publica).includes("50.00"));
  });

  test("las tablas con datos personales o internos están denegadas", async () => {
    for (const tabla of TABLAS_DENEGADAS) assert.equal(await rechazo(`select count(*) from "${tabla}"`), "42501", tabla);
  });

  test("las columnas personales de donaciones están denegadas, también con select *", async () => {
    for (const c of COLUMNAS_DONACIONES_DENEGADAS) assert.equal(await rechazo(`select "${c}" from donaciones`), "42501", c);
    assert.equal(await rechazo("select * from donaciones"), "42501");
  });

  test("las columnas permitidas de donaciones se pueden leer", async () => {
    const lista = COLUMNAS_DONACIONES.map((c) => `"${c}"`).join(", ");
    await poolPublico.query(`select ${lista} from donaciones limit 1`);
  });

  test("no puede insertar, actualizar ni borrar", async () => {
    assert.equal(await rechazo(`insert into proyectos (nombre) values ('x-${sufijo}')`), "42501");
    assert.equal(await rechazo(`update proyectos set nombre = 'x' where id = ${ids.proyecto}`), "42501");
    assert.equal(await rechazo(`delete from items_meta where id = ${ids.item}`), "42501");
    assert.equal(await rechazo(`update donaciones set cantidad = 1 where id = 1`), "42501");
    assert.equal(await rechazo(`create table zz_no (n int)`), "42501");
  });
});
