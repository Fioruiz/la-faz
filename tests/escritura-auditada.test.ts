import assert from "node:assert/strict";
import { after, describe, mock, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  AdvertenciaError,
  MENSAJE_ERROR_GENERICO,
  ValidacionError,
  ReglaDeNegocioError,
  ejecutarEscrituraAuditada,
  registrarAuditoria,
  type DbTransaccional,
  type RegistroAuditoria,
  type TransaccionDb,
} from "../lib/escritura-auditada-core";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { auditLog, proyectos } from "../lib/schema";
import { crearProyecto, crearResponsable, db, enTransaccion, pool, type Tx } from "./helpers";
import { responsables } from "../lib/schema";

after(() => pool.end());

const comoDb = (tx: Tx) => tx as unknown as DbTransaccional;
const comoTx = (tx: Tx) => tx as unknown as TransaccionDb;

const historial = (tx: Tx, entidadId: number) =>
  tx.select().from(auditLog).where(and(eq(auditLog.entidad, "proyecto"), eq(auditLog.entidadId, entidadId)));
const descripcionDe = async (tx: Tx, id: number) =>
  (await tx.select().from(proyectos).where(eq(proyectos.id, id)))[0].descripcion;

describe("registrarAuditoria", () => {
  const base = (id: number): RegistroAuditoria => ({
    entidad: "proyecto",
    entidadId: id,
    accion: "crear",
    antes: null,
    despues: { nombre: "X" },
  });

  test("creación: antes vacío, después con los valores", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx)];
      await registrarAuditoria(comoTx(tx), r.id, base(p.id));
      const [fila] = await historial(tx, p.id);
      assert.equal(fila.accion, "crear");
      assert.equal(fila.antes, null);
      assert.deepEqual(fila.despues, { nombre: "X" });
    }));

  test("edición: guarda antes y después, el responsable y la fecha de la base", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx)];
      await registrarAuditoria(comoTx(tx), r.id, { ...base(p.id), accion: "editar", antes: { d: 1 }, despues: { d: 2 } });
      const [fila] = await historial(tx, p.id);
      assert.deepEqual([fila.antes, fila.despues], [{ d: 1 }, { d: 2 }]);
      assert.equal(fila.responsableId, r.id);
      assert.ok(fila.creadoEn instanceof Date && Math.abs(Date.now() - fila.creadoEn.getTime()) < 60_000);
    }));

  test("rechaza valores no serializables, acción desconocida y entidadId no entero", () =>
    enTransaccion(async (tx) => {
      const r = await crearResponsable(tx);
      const circular: Record<string, unknown> = {};
      circular.yo = circular;
      for (const malo of [
        { ...base(1), despues: { n: BigInt(10) } },
        { ...base(1), despues: circular },
        { ...base(1), accion: "borrar" as never },
        { ...base(1.5) },
        { ...base(Number.NaN) },
      ]) {
        await assert.rejects(registrarAuditoria(comoTx(tx), r.id, malo));
      }
      assert.equal((await tx.select().from(auditLog)).length, 0);
    }));
});

// Acción de ejemplo: edita la descripción de un proyecto. Es la plantilla de las acciones de #5 a #8.
const esquema = z.object({
  proyectoId: z.coerce.number().int().positive(),
  descripcion: z.string().trim().min(1, "Escribe una descripción").max(200),
  secreto: z.string().optional(),
});

type Extras = {
  auditoria?: (id: number, antes: string | null, despues: string) => RegistroAuditoria[] | undefined;
  falla?: Error;
  despuesDeEscribir?: () => void;
};

function ejemplo(tx: Tx, responsableId: number, entrada: FormData | Record<string, unknown>, extras: Extras = {}, requerir?: () => Promise<{ id: number; nombre: string }>) {
  return ejecutarEscrituraAuditada({
    nombre: "editar-proyecto-ejemplo",
    db: comoDb(tx),
    requerir: requerir ?? (() => verificarResponsableActivo(tx, responsableId)),
    esquema,
    entrada,
    camposSensibles: ["secreto"],
    escribir: async (t, datos) => {
      const [antes] = await t.select().from(proyectos).where(eq(proyectos.id, datos.proyectoId));
      await t.update(proyectos).set({ descripcion: datos.descripcion }).where(eq(proyectos.id, datos.proyectoId));
      if (extras.falla) throw extras.falla;
      const auditoria = extras.auditoria
        ? extras.auditoria(datos.proyectoId, antes.descripcion, datos.descripcion)
        : [{ entidad: "proyecto", entidadId: datos.proyectoId, accion: "editar" as const, antes: { descripcion: antes.descripcion }, despues: { descripcion: datos.descripcion } }];
      return { datos: { id: datos.proyectoId }, auditoria: auditoria as RegistroAuditoria[] };
    },
  });
}

describe("ejecutarEscrituraAuditada: transacción e historial", () => {
  test("éxito: queda el cambio y su historial", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" });
      assert.deepEqual(res, { ok: true, datos: { id: p.id } });
      assert.equal(await descripcionDe(tx, p.id), "nueva");
      const [fila] = await historial(tx, p.id);
      assert.deepEqual([fila.antes, fila.despues], [{ descripcion: "vieja" }, { descripcion: "nueva" }]);
    }));

  test("falla el cambio: no queda nada", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      mock.method(console, "error", () => {});
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" }, { falla: new Error("boom") });
      mock.restoreAll();
      assert.equal(res.ok, false);
      assert.equal(await descripcionDe(tx, p.id), "vieja");
      assert.equal((await historial(tx, p.id)).length, 0);
    }));

  test("falla el historial después de aplicar el cambio: el cambio se revierte", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      mock.method(console, "error", () => {});
      // 2147483648 es un entero seguro en JS, pero Postgres lo rechaza (integer fuera de rango) al insertar.
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" }, {
        auditoria: () => [{ entidad: "proyecto", entidadId: 2_147_483_648, accion: "editar", antes: null, despues: null }],
      });
      mock.restoreAll();
      assert.deepEqual(res, { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO });
      assert.equal(await descripcionDe(tx, p.id), "vieja");
    }));

  test("sin registro de historial: se revierte y se informa un error", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      mock.method(console, "error", () => {});
      for (const auditoria of [() => [], () => undefined]) {
        const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" }, { auditoria });
        assert.deepEqual(res, { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO });
        assert.equal(await descripcionDe(tx, p.id), "vieja");
      }
      mock.restoreAll();
    }));

  test("varios registros en una escritura quedan todos", () =>
    enTransaccion(async (tx) => {
      const [r, p, q] = [await crearResponsable(tx), await crearProyecto(tx), await crearProyecto(tx)];
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" }, {
        auditoria: (id) => [
          { entidad: "proyecto", entidadId: id, accion: "editar", antes: null, despues: { a: 1 } },
          { entidad: "proyecto", entidadId: q.id, accion: "editar", antes: null, despues: { b: 2 } },
        ],
      });
      assert.equal(res.ok, true);
      assert.equal((await historial(tx, p.id)).length + (await historial(tx, q.id)).length, 2);
    }));

  test("el historial se atribuye al responsable de la sesión, no al de la entrada", () =>
    enTransaccion(async (tx) => {
      const [r, otro, p] = [await crearResponsable(tx), await crearResponsable(tx), await crearProyecto(tx)];
      await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva", responsableId: otro.id });
      assert.equal((await historial(tx, p.id))[0].responsableId, r.id);
    }));
});

describe("ejecutarEscrituraAuditada: responsable y entrada", () => {
  test("responsable desactivado con sesión vigente: no valida ni escribe", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx, { activo: false }), await crearProyecto(tx, { descripcion: "vieja" })];
      const esquemaEspia = mock.fn(() => esquema.parse);
      const spy = { ...esquema, safeParse: (...a: Parameters<typeof esquema.safeParse>) => (esquemaEspia(), esquema.safeParse(...a)) } as typeof esquema;
      const res = await ejecutarEscrituraAuditada({
        nombre: "x",
        db: comoDb(tx),
        requerir: () => verificarResponsableActivo(tx, r.id),
        esquema: spy,
        entrada: { proyectoId: p.id, descripcion: "nueva" },
        escribir: async () => assert.fail("no debía escribir"),
      });
      assert.deepEqual(res, { ok: false, tipo: "no_autorizado" });
      assert.equal(esquemaEspia.mock.callCount(), 0);
      assert.equal(await descripcionDe(tx, p.id), "vieja");
      assert.equal((await historial(tx, p.id)).length, 0);
    }));

  test("desactivado: la redirección no se registra como error inesperado", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx, { activo: false }), await crearProyecto(tx)];
      const espia = mock.method(console, "error", () => {});
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" });
      const llamadas = espia.mock.callCount();
      mock.restoreAll();
      assert.deepEqual(res, { ok: false, tipo: "no_autorizado" });
      assert.equal(llamadas, 0);
    }));

  test("historial con valores no serializables: se revierte y se informa un error", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      mock.method(console, "error", () => {});
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" }, {
        auditoria: (id) => [{ entidad: "proyecto", entidadId: id, accion: "editar", antes: null, despues: { n: BigInt(1) } }],
      });
      mock.restoreAll();
      assert.deepEqual(res, { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO });
      assert.equal(await descripcionDe(tx, p.id), "vieja");
    }));

  test("responsable inexistente: no escribe", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx, { descripcion: "vieja" });
      const res = await ejemplo(tx, 2_000_000_000, { proyectoId: p.id, descripcion: "nueva" });
      assert.deepEqual(res, { ok: false, tipo: "no_autorizado" });
      assert.equal(await descripcionDe(tx, p.id), "vieja");
    }));

  test("entrada inválida: no escribe", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "   " });
      assert.equal(res.ok, false);
      assert.equal(await descripcionDe(tx, p.id), "vieja");
      assert.equal((await historial(tx, p.id)).length, 0);
    }));

  test("escribir recibe los datos validados y tipados", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx)];
      let recibido: unknown;
      await ejecutarEscrituraAuditada({
        nombre: "x",
        db: comoDb(tx),
        requerir: () => verificarResponsableActivo(tx, r.id),
        esquema,
        entrada: { proyectoId: String(p.id), descripcion: "  con espacios  " },
        escribir: async (_t, datos) => {
          recibido = datos;
          return { datos: null, auditoria: [{ entidad: "proyecto", entidadId: p.id, accion: "editar", antes: null, despues: null }] };
        },
      });
      assert.deepEqual(recibido, { proyectoId: p.id, descripcion: "con espacios" });
    }));

  test("acepta un FormData", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx)];
      const form = new FormData();
      form.set("proyectoId", String(p.id));
      form.set("descripcion", "desde formulario");
      assert.equal((await ejemplo(tx, r.id, form)).ok, true);
      assert.equal(await descripcionDe(tx, p.id), "desde formulario");
    }));
});

describe("ejecutarEscrituraAuditada: resultados", () => {
  test("validación: mensajes por campo y valores de todos los campos, sin los sensibles", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx)];
      const res = await ejemplo(tx, r.id, { proyectoId: String(p.id), descripcion: "", secreto: "no-devolver" });
      assert.equal(res.ok, false);
      assert.ok(!res.ok && res.tipo === "validacion");
      assert.deepEqual(res.errores.descripcion, ["Escribe una descripción"]);
      assert.deepEqual(res.valores, { proyectoId: String(p.id), descripcion: "" });
      assert.ok(!("secreto" in res.valores));
    }));

  test("regla de negocio a mitad de la escritura: revierte y devuelve su mensaje", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" }, { falla: new ReglaDeNegocioError("Este proyecto ya está finalizado") });
      assert.deepEqual(res, { ok: false, tipo: "regla", mensaje: "Este proyecto ya está finalizado" });
      assert.equal(await descripcionDe(tx, p.id), "vieja");
      assert.equal((await historial(tx, p.id)).length, 0);
    }));

  test("ValidacionError desde escribir: devuelve validación por campo con lo escrito y revierte", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      const espia = mock.method(console, "error", () => {});
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva", secreto: "no-devolver" }, { falla: new ValidacionError({ monto: ["Monto inválido"] }) });
      const llamadas = espia.mock.callCount();
      mock.restoreAll();
      assert.ok(!res.ok && res.tipo === "validacion");
      assert.deepEqual(res.errores, { monto: ["Monto inválido"] });
      assert.equal(res.valores.descripcion, "nueva");
      assert.ok(!("secreto" in res.valores));
      assert.equal(llamadas, 0);
      assert.equal(await descripcionDe(tx, p.id), "vieja");
      assert.equal((await historial(tx, p.id)).length, 0);
    }));

  test("advertencia: revierte lo aplicado, no es un error y no deja historial", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx, { descripcion: "vieja" })];
      const espia = mock.method(console, "error", () => {});
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "nueva" }, { falla: new AdvertenciaError("Ya hay una igual. ¿Guardar de todos modos?") });
      const llamadas = espia.mock.callCount();
      mock.restoreAll();
      assert.deepEqual(res, { ok: false, tipo: "advertencia", mensaje: "Ya hay una igual. ¿Guardar de todos modos?" });
      assert.equal(llamadas, 0);
      assert.equal(await descripcionDe(tx, p.id), "vieja");
      assert.equal((await historial(tx, p.id)).length, 0);
    }));

  test("error de base: mensaje genérico sin texto de Postgres y log sin datos ni conexión", () =>
    enTransaccion(async (tx) => {
      const [r, p] = [await crearResponsable(tx), await crearProyecto(tx)];
      const espia = mock.method(console, "error", () => {});
      const res = await ejemplo(tx, r.id, { proyectoId: p.id, descripcion: "dato-personal-123" }, {
        auditoria: () => [{ entidad: "proyecto", entidadId: 2_147_483_648, accion: "editar", antes: null, despues: { d: "dato-personal-123" } }],
      });
      const registrado = JSON.stringify(espia.mock.calls.map((c) => c.arguments));
      mock.restoreAll();
      assert.deepEqual(res, { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO });
      assert.ok(!/out of range|integer/i.test(JSON.stringify(res)));
      assert.match(registrado, /editar-proyecto-ejemplo/);
      assert.match(registrado, /22003/);
      assert.ok(!registrado.includes("dato-personal-123"));
      assert.ok(!/postgres(ql)?:\/\//i.test(registrado));
    }));

  test("fallo al comprobar al responsable (base caída): mensaje genérico, no redirección", async () => {
    const espia = mock.method(console, "error", () => {});
    const res = await ejecutarEscrituraAuditada({
      nombre: "x",
      db: { transaction: () => assert.fail("no debía abrir la transacción") } as unknown as DbTransaccional,
      requerir: () => Promise.reject(Object.assign(new Error("connect ECONNREFUSED postgresql://u:p@h/db"), { code: "ECONNREFUSED" })),
      esquema,
      entrada: {},
      escribir: async () => assert.fail("no debía escribir"),
    });
    const registrado = JSON.stringify(espia.mock.calls.map((c) => c.arguments));
    mock.restoreAll();
    assert.deepEqual(res, { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO });
    assert.ok(!registrado.includes("postgresql://"));
  });
});

// Sin savepoint: conexión real del pool, con confirmación real. Es la prueba que detecta un cambio
// escrito fuera de la transacción, que el savepoint de las pruebas anteriores deshace sin querer.
describe("ejecutarEscrituraAuditada: atomicidad con conexión real", () => {
  async function conFilasReales(fn: (r: { id: number; nombre: string }, p: { id: number }) => Promise<void>) {
    const tx = db as unknown as Tx;
    const r = await crearResponsable(tx);
    const p = await crearProyecto(tx, { descripcion: "vieja" });
    try {
      await fn(r, p);
    } finally {
      await db.delete(auditLog).where(eq(auditLog.responsableId, r.id));
      await db.delete(proyectos).where(eq(proyectos.id, p.id));
      await db.delete(responsables).where(eq(responsables.id, r.id));
    }
  }

  const real = db as unknown as DbTransaccional;
  const ejecutar = (r: { id: number }, p: { id: number }, auditoria: RegistroAuditoria[]) =>
    ejecutarEscrituraAuditada({
      nombre: "real",
      db: real,
      requerir: () => verificarResponsableActivo(db, r.id),
      esquema,
      entrada: { proyectoId: p.id, descripcion: "nueva" },
      escribir: async (t, datos) => {
        await t.update(proyectos).set({ descripcion: datos.descripcion }).where(eq(proyectos.id, datos.proyectoId));
        return { datos: null, auditoria };
      },
    });

  test("éxito confirma el cambio y el historial", () =>
    conFilasReales(async (r, p) => {
      const res = await ejecutar(r, p, [{ entidad: "proyecto", entidadId: p.id, accion: "editar", antes: null, despues: { d: 1 } }]);
      assert.equal(res.ok, true);
      assert.equal(await descripcionDe(db as unknown as Tx, p.id), "nueva");
      assert.equal((await historial(db as unknown as Tx, p.id)).length, 1);
    }));

  test("falla el historial: el cambio ya aplicado se revierte de verdad", () =>
    conFilasReales(async (r, p) => {
      mock.method(console, "error", () => {});
      const res = await ejecutar(r, p, [{ entidad: "proyecto", entidadId: 2_147_483_648, accion: "editar", antes: null, despues: null }]);
      mock.restoreAll();
      assert.equal(res.ok, false);
      assert.equal(await descripcionDe(db as unknown as Tx, p.id), "vieja");
    }));

  test("historial vacío: el cambio no queda", () =>
    conFilasReales(async (r, p) => {
      mock.method(console, "error", () => {});
      const res = await ejecutar(r, p, []);
      mock.restoreAll();
      assert.equal(res.ok, false);
      assert.equal(await descripcionDe(db as unknown as Tx, p.id), "vieja");
    }));
});
