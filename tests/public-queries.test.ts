import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { z } from "zod";
import type { LectorDb } from "../lib/auth-credentials";
import { consultarAvance } from "../lib/avance-consulta";
import { anularDonacion, asignarDonacion, editarDonacion } from "../lib/donaciones-correcciones";
import { ejecutarEscrituraAuditada, type DbTransaccional, type EscrituraAuditada } from "../lib/escritura-auditada-core";
import { hoyEnLima } from "../lib/fechas";
import { crearLecturasPublicas, type ProyectoPublico } from "../lib/public-queries-core";
import { verificarResponsableActivo } from "../lib/responsable-activo";
import { donaciones } from "../lib/schema";
import { crearApoyante, crearItem, crearProyecto, crearResponsable, enTransaccion, pool, type Tx } from "./helpers";

after(() => pool.end());

const HOY = hoyEnLima();
const lector = (tx: Tx) => tx as unknown as LectorDb;
const publicas = (tx: Tx) => crearLecturasPublicas(() => lector(tx));

type Valores = Partial<typeof donaciones.$inferInsert>;
const dinero = async (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number | null, monto: string, v: Valores = {}) =>
  (await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId, tipo: "dinero", monto, medio: "yape", fecha: HOY, registradoPor: r.id, ...v }).returning())[0];
const producto = async (tx: Tx, r: { id: number }, a: { id: number }, proyectoId: number, itemId: number, cantidad: number, v: Valores = {}) =>
  (await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId, itemId, tipo: "producto", cantidad, fecha: HOY, registradoPor: r.id, ...v }).returning())[0];

async function base(tx: Tx, apoyante: Parameters<typeof crearApoyante>[1] = {}) {
  const [r, a, p] = [
    await crearResponsable(tx),
    await crearApoyante(tx, { esDonante: true, ...apoyante }),
    await crearProyecto(tx, { tieneMeta: true, descripcion: "Packs para niños" }),
  ];
  const item = await crearItem(tx, p.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 2000, costoReferencial: "13.00" });
  return { r, a, p, item };
}
const detalle = async (tx: Tx, id: number) => {
  const p = await publicas(tx).getProyectoPublico(id);
  assert.ok(p, "el proyecto debe existir");
  return p;
};

describe("avance público: igual al privado, con el tope solo al presentar", () => {
  test("meta y recibido de cada ítem coinciden con consultarAvance; el recibido va hasta la meta", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const agua = await crearItem(tx, p.id, { nombre: "Agua", unidad: "botella", cantidadMeta: 500 });
      await producto(tx, r, a, p.id, item.id, 1200);
      await producto(tx, r, a, p.id, agua.id, 650); // excedente
      const privado = (await consultarAvance(lector(tx), { proyectoIds: [p.id] })).proyectos[p.id];
      const publico = await detalle(tx, p.id);
      assert.equal(publico.items.length, privado.items.length);
      for (const pub of publico.items) {
        const priv = privado.items.find((i) => i.id === pub.id)!;
        assert.equal(pub.meta, priv.meta);
        assert.equal(pub.recibido, Math.min(priv.recibido, priv.meta));
        assert.equal(pub.porcentaje, Math.min(100, priv.porcentaje));
        assert.equal(pub.cumplida, priv.cumplida);
      }
      const a2 = publico.items.find((i) => i.id === agua.id)!;
      assert.deepEqual([a2.recibido, a2.meta, a2.porcentaje, a2.cumplida], [500, 500, 100, true]);
      assert.deepEqual([publico.metasTotal, publico.metasCumplidas], [2, 1]);
      const pack = publico.items.find((i) => i.id === item.id)!;
      assert.deepEqual([pack.recibido, pack.porcentaje, pack.cumplida], [1200, 60, false]);
    }));

  test("2150 de 2000 se presenta como 2000 de 2000 al 100%, sin la cifra 2150", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      await producto(tx, r, a, p.id, item.id, 2150);
      const pub = await detalle(tx, p.id);
      assert.deepEqual([pub.items[0].recibido, pub.items[0].porcentaje, pub.items[0].cumplida], [2000, 100, true]);
      assert.doesNotMatch(JSON.stringify(pub), /2150/);
    }));

  test("un ítem sin donaciones aparece con 0", () =>
    enTransaccion(async (tx) => {
      const { p } = await base(tx);
      const pub = await detalle(tx, p.id);
      assert.deepEqual([pub.items[0].recibido, pub.items[0].porcentaje, pub.items[0].cumplida], [0, 0, false]);
    }));

  test("anuladas, sin asignar y dinero no suman a ninguna barra", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      await producto(tx, r, a, p.id, item.id, 100);
      await producto(tx, r, a, p.id, item.id, 999, { anulada: true });
      await dinero(tx, r, a, p.id, "5000.00");
      await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId: null, tipo: "producto", cantidad: 777, descripcionProducto: "Cajas", fecha: HOY, registradoPor: r.id });
      const pub = await detalle(tx, p.id);
      assert.equal(pub.items[0].recibido, 100);
    }));

  test("ítems con el mismo nombre en dos proyectos no se mezclan", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const p2 = await crearProyecto(tx, { tieneMeta: true });
      const item2 = await crearItem(tx, p2.id, { nombre: "Pack", unidad: "pack", cantidadMeta: 50 });
      await producto(tx, r, a, p.id, item.id, 300);
      await producto(tx, r, a, p2.id, item2.id, 20);
      assert.equal((await detalle(tx, p.id)).items[0].recibido, 300);
      assert.deepEqual([(await detalle(tx, p2.id)).items[0].recibido, (await detalle(tx, p2.id)).items[0].meta], [20, 50]);
    }));
});

describe("estados del proyecto", () => {
  test("informativo: sin ítems ni barras aunque tenga dinero o ítems guardados", () =>
    enTransaccion(async (tx) => {
      const { r, a } = await base(tx);
      const inf = await crearProyecto(tx, { tieneMeta: false, descripcion: "Música con niños" });
      await dinero(tx, r, a, inf.id, "80.50", { medio: "plin" });
      const pub = await detalle(tx, inf.id);
      assert.deepEqual([pub.conMeta, pub.items, pub.metasTotal, pub.descripcion], [false, [], 0, "Música con niños"]);
    }));

  test("con meta pero sin ítems: sin barras", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx, { tieneMeta: true });
      const pub = await detalle(tx, p.id);
      assert.deepEqual([pub.conMeta, pub.items.length, pub.metasTotal], [true, 0, 0]);
    }));

  test("finalizado: muestra el resultado y sus cifras finales; el activo no devuelve resultado", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const cerrado = await crearProyecto(tx, { tieneMeta: true, estado: "finalizado", resultado: "Se entregaron 60 packs" });
      const i3 = await crearItem(tx, cerrado.id, { cantidadMeta: 100 });
      await producto(tx, r, a, cerrado.id, i3.id, 60);
      const pub = await detalle(tx, cerrado.id);
      assert.deepEqual([pub.estado, pub.resultado, pub.items[0].recibido], ["finalizado", "Se entregaron 60 packs", 60]);
      assert.equal((await detalle(tx, p.id)).resultado, null);
      void item;
    }));

  test("un resultado guardado en un proyecto activo no sale", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx, { tieneMeta: true, estado: "activo", resultado: "borrador interno" });
      assert.equal((await detalle(tx, p.id)).resultado, null);
    }));

  test("sin descripción: null, sin texto inventado", () =>
    enTransaccion(async (tx) => {
      const p = await crearProyecto(tx, { tieneMeta: false, descripcion: null });
      assert.equal((await detalle(tx, p.id)).descripcion, null);
    }));

  test("id inválido o inexistente devuelve null", () =>
    enTransaccion(async (tx) => {
      for (const id of [NaN, 0, -1, 1.5, 2_147_483_648, 999_999_999]) {
        assert.equal(await publicas(tx).getProyectoPublico(id), null, String(id));
      }
    }));

  test("la lista pone los activos primero y los finalizados después", () =>
    enTransaccion(async (tx) => {
      const cerrado = await crearProyecto(tx, { estado: "finalizado", resultado: "x" });
      const activo = await crearProyecto(tx, {});
      const lista = await publicas(tx).listarProyectosPublicos();
      const orden = lista.filter((p) => [cerrado.id, activo.id].includes(p.id)).map((p) => p.id);
      assert.deepEqual(orden, [activo.id, cerrado.id]);
      const primerCerrado = lista.findIndex((p) => p.estado === "finalizado");
      assert.ok(lista.slice(primerCerrado).every((p) => p.estado === "finalizado"));
    }));
});

describe("la salida pública no contiene datos personales, dinero ni costos", () => {
  const CLAVES_PROYECTO = ["conMeta", "descripcion", "estado", "id", "items", "metasCumplidas", "metasTotal", "nombre", "resultado"];
  const CLAVES_ITEM = ["cumplida", "id", "meta", "nombre", "porcentaje", "recibido", "unidad"];

  test("claves cerradas y el JSON sin nombre ni contacto del apoyante (con y sin anonimato) ni montos ni costos", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx, { nombre: "Rosa Quispe Secreta", contacto: "rosa.secreta@correo.test 987654321" });
      const anonimo = await crearApoyante(tx, { nombre: "Luis Escondido Perez", contacto: "luis-oculto@correo.test", esDonante: true, anonimoPublico: true });
      await producto(tx, r, a, p.id, item.id, 10);
      await producto(tx, r, anonimo, p.id, item.id, 5);
      await dinero(tx, r, a, p.id, "1234.56");
      const lista = await publicas(tx).listarProyectosPublicos();
      const json = JSON.stringify(lista);
      for (const prohibido of ["Rosa", "Quispe", "Secreta", "rosa.secreta", "987654321", "Luis", "Escondido", "oculto", "Anónimo", "1234", "13.00", "costo", "monto", "dinero", "registradoPor", "apoyante"]) {
        assert.ok(!json.includes(prohibido), `la salida pública contiene "${prohibido}"`);
      }
      for (const proyecto of lista) {
        assert.deepEqual(Object.keys(proyecto).sort(), CLAVES_PROYECTO);
        for (const i of proyecto.items) assert.deepEqual(Object.keys(i).sort(), CLAVES_ITEM);
      }
      const propio = lista.find((x) => x.id === p.id) as ProyectoPublico;
      assert.equal(propio.items[0].recibido, 15);
    }));
});

describe("la lectura pública sigue a las correcciones del #8 sin caché", () => {
  function ejecutar<TEsquema extends z.ZodType, TDatos>(
    tx: Tx,
    responsableId: number,
    escritura: { esquema: TEsquema; escribir: EscrituraAuditada<TEsquema, TDatos>["escribir"] },
    entrada: Record<string, unknown>,
  ) {
    return ejecutarEscrituraAuditada({
      nombre: "prueba-publico",
      db: tx as unknown as DbTransaccional,
      requerir: () => verificarResponsableActivo(tx, responsableId),
      entrada,
      esquema: escritura.esquema,
      escribir: escritura.escribir,
    });
  }

  test("editar, reasignar, asignar y anular se reflejan en la siguiente lectura", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      const item2 = await crearItem(tx, p.id, { nombre: "Cereal", cantidadMeta: 100 });
      const d = await producto(tx, r, a, p.id, item.id, 40);
      const recibido = async (id: number) => (await detalle(tx, p.id)).items.find((i) => i.id === id)!.recibido;
      assert.equal(await recibido(item.id), 40);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, { donacionId: d.id, proyectoId: p.id, itemId: item.id, cantidad: "55", fecha: HOY })).ok);
      assert.equal(await recibido(item.id), 55);
      assert.ok((await ejecutar(tx, r.id, editarDonacion, { donacionId: d.id, proyectoId: p.id, itemId: item2.id, cantidad: "55", fecha: HOY })).ok);
      assert.deepEqual([await recibido(item.id), await recibido(item2.id)], [0, 55]);
      assert.ok((await ejecutar(tx, r.id, anularDonacion, { donacionId: d.id, motivo: "Error" })).ok);
      assert.equal(await recibido(item2.id), 0);
      const [suelta] = await tx.insert(donaciones).values({ apoyanteId: a.id, proyectoId: null, tipo: "producto", cantidad: 30, descripcionProducto: "Cajas", fecha: HOY, registradoPor: r.id }).returning();
      assert.equal(await recibido(item.id), 0);
      assert.ok((await ejecutar(tx, r.id, asignarDonacion, { donacionId: suelta.id, proyectoId: p.id, itemId: item.id })).ok);
      assert.equal(await recibido(item.id), 30);
    }));
});

describe("número fijo de consultas", () => {
  async function contar(tx: Tx, fn: (l: ReturnType<typeof crearLecturasPublicas>) => Promise<unknown>) {
    let selects = 0;
    const espia = new Proxy(tx, {
      get(objetivo, propiedad, receptor) {
        if (propiedad === "select") {
          selects++;
          return (objetivo.select as (...a: unknown[]) => unknown).bind(objetivo);
        }
        return Reflect.get(objetivo, propiedad, receptor);
      },
    }) as unknown as LectorDb;
    await fn(crearLecturasPublicas(() => espia));
    return selects;
  }

  test("con 5 y con 500 donaciones, la lista y el detalle hacen las mismas consultas (4)", () =>
    enTransaccion(async (tx) => {
      const { r, a, p, item } = await base(tx);
      for (let i = 0; i < 5; i++) await producto(tx, r, a, p.id, item.id, 1);
      const [listaPocas, detallePocas] = [await contar(tx, (l) => l.listarProyectosPublicos()), await contar(tx, (l) => l.getProyectoPublico(p.id))];
      await tx.insert(donaciones).values(Array.from({ length: 495 }, () => ({ apoyanteId: a.id, proyectoId: p.id, itemId: item.id, tipo: "producto", cantidad: 2, fecha: HOY, registradoPor: r.id })));
      await tx.insert(donaciones).values(Array.from({ length: 500 }, () => ({ apoyanteId: a.id, proyectoId: p.id, tipo: "dinero", monto: "0.10", medio: "yape", fecha: HOY, registradoPor: r.id })));
      const [listaMuchas, detalleMuchas] = [await contar(tx, (l) => l.listarProyectosPublicos()), await contar(tx, (l) => l.getProyectoPublico(p.id))];
      assert.deepEqual([listaPocas, detallePocas], [listaMuchas, detalleMuchas]);
      assert.deepEqual([listaMuchas, detalleMuchas], [4, 4]);
      assert.equal((await detalle(tx, p.id)).items[0].recibido, 995);
    }));
});
