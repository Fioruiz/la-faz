import { and, count, eq, ne } from "drizzle-orm";
import { ReglaDeNegocioError, definirEscritura as definir, type TransaccionDb } from "./escritura-auditada-core";
import {
  crearItemEsquema,
  crearProyectoEsquema,
  editarItemEsquema,
  editarProyectoEsquema,
  finalizarProyectoEsquema,
} from "./proyectos-esquemas";
import { itemsMeta, proyectos } from "./schema";

// No hay escritura de borrado ni de reapertura: el PRD no las menciona (ver design.md, decisión 8).

const MENSAJES = {
  proyectoNoEncontrado: "No se encontró el proyecto",
  itemNoEncontrado: "No se encontró el ítem en este proyecto",
  finalizado: "Este proyecto ya está finalizado",
  sinMeta: "Este proyecto no tiene meta",
  conItemsSinMeta: "Un proyecto con ítems no puede quedar sin meta",
  proyectoRepetido: "Ya existe un proyecto con ese nombre",
  itemRepetido: "Ya existe un ítem con ese nombre en este proyecto",
  sinCambios: "No hay cambios para guardar",
} as const;

// Sin distinguir mayúsculas ni espacios. Se compara en JS (no con lower() de Postgres) para que
// "Música" y "MÚSICA" cuenten como el mismo nombre sea cual sea la configuración de la base.
const clave = (nombre: string) => nombre.trim().toLocaleLowerCase("es");

function esUnicaViolada(error: unknown): boolean {
  const e = error as { code?: unknown; cause?: { code?: unknown } };
  return (e?.code ?? e?.cause?.code) === "23505";
}

// Primera operación de toda escritura que toca un proyecto existente: bloquea su fila hasta el fin
// de la transacción, para que cerrar el proyecto y agregarle ítems no se crucen (S3).
async function bloquearProyecto(tx: TransaccionDb, proyectoId: number) {
  const [proyecto] = await tx.select().from(proyectos).where(eq(proyectos.id, proyectoId)).for("update");
  if (!proyecto) throw new ReglaDeNegocioError(MENSAJES.proyectoNoEncontrado);
  return proyecto;
}

function exigirActivo(proyecto: { estado: string }) {
  if (proyecto.estado === "finalizado") throw new ReglaDeNegocioError(MENSAJES.finalizado);
}

async function exigirNombreLibre(tx: TransaccionDb, nombre: string, excluirId?: number) {
  const filas = await tx
    .select({ nombre: proyectos.nombre })
    .from(proyectos)
    .where(excluirId === undefined ? undefined : ne(proyectos.id, excluirId));
  if (filas.some((f) => clave(f.nombre) === clave(nombre))) throw new ReglaDeNegocioError(MENSAJES.proyectoRepetido);
}

async function exigirNombreItemLibre(tx: TransaccionDb, proyectoId: number, nombre: string, excluirId?: number) {
  const filas = await tx
    .select({ nombre: itemsMeta.nombre })
    .from(itemsMeta)
    .where(
      excluirId === undefined
        ? eq(itemsMeta.proyectoId, proyectoId)
        : and(eq(itemsMeta.proyectoId, proyectoId), ne(itemsMeta.id, excluirId)),
    );
  if (filas.some((f) => clave(f.nombre) === clave(nombre))) throw new ReglaDeNegocioError(MENSAJES.itemRepetido);
}

// El historial lleva solo campos de negocio.
const valoresProyecto = (p: { nombre: string; descripcion: string | null; tieneMeta: boolean }) => ({
  nombre: p.nombre,
  descripcion: p.descripcion,
  tieneMeta: p.tieneMeta,
});

const valoresItem = (i: { proyectoId: number; nombre: string; unidad: string; cantidadMeta: number; costoReferencial: string | null }) => ({
  proyectoId: i.proyectoId,
  nombre: i.nombre,
  unidad: i.unidad,
  cantidadMeta: i.cantidadMeta,
  costoReferencial: i.costoReferencial,
});

export const crearProyecto = definir(crearProyectoEsquema, async (tx, datos) => {
  await exigirNombreLibre(tx, datos.nombre);
  let creado: { id: number };
  try {
    [creado] = await tx
      .insert(proyectos)
      .values({ nombre: datos.nombre, descripcion: datos.descripcion, tieneMeta: datos.tieneMeta })
      .returning({ id: proyectos.id });
  } catch (e) {
    if (esUnicaViolada(e)) throw new ReglaDeNegocioError(MENSAJES.proyectoRepetido);
    throw e;
  }
  return {
    datos: { id: creado.id },
    auditoria: [
      {
        entidad: "proyecto",
        entidadId: creado.id,
        accion: "crear",
        antes: null,
        despues: { ...valoresProyecto(datos), estado: "activo" },
      },
    ],
  };
});

export const editarProyecto = definir(editarProyectoEsquema, async (tx, datos) => {
  const actual = await bloquearProyecto(tx, datos.proyectoId);
  exigirActivo(actual);
  if (!datos.tieneMeta && actual.tieneMeta) {
    const [{ n }] = await tx.select({ n: count() }).from(itemsMeta).where(eq(itemsMeta.proyectoId, actual.id));
    if (n > 0) throw new ReglaDeNegocioError(MENSAJES.conItemsSinMeta);
  }
  const nuevo = { nombre: datos.nombre, descripcion: datos.descripcion, tieneMeta: datos.tieneMeta };
  const antes = valoresProyecto(actual);
  if (JSON.stringify(antes) === JSON.stringify(nuevo)) throw new ReglaDeNegocioError(MENSAJES.sinCambios);
  await exigirNombreLibre(tx, nuevo.nombre, actual.id);
  try {
    await tx.update(proyectos).set(nuevo).where(eq(proyectos.id, actual.id));
  } catch (e) {
    if (esUnicaViolada(e)) throw new ReglaDeNegocioError(MENSAJES.proyectoRepetido);
    throw e;
  }
  return {
    datos: { id: actual.id },
    auditoria: [{ entidad: "proyecto", entidadId: actual.id, accion: "editar", antes, despues: nuevo }],
  };
});

export const finalizarProyecto = definir(finalizarProyectoEsquema, async (tx, datos) => {
  const actual = await bloquearProyecto(tx, datos.proyectoId);
  exigirActivo(actual);
  await tx
    .update(proyectos)
    .set({ estado: "finalizado", resultado: datos.resultado })
    .where(eq(proyectos.id, actual.id));
  return {
    datos: { id: actual.id },
    auditoria: [
      {
        entidad: "proyecto",
        entidadId: actual.id,
        accion: "finalizar",
        antes: { estado: actual.estado, resultado: actual.resultado },
        despues: { estado: "finalizado", resultado: datos.resultado },
      },
    ],
  };
});

export const crearItem = definir(crearItemEsquema, async (tx, datos) => {
  const proyecto = await bloquearProyecto(tx, datos.proyectoId);
  exigirActivo(proyecto);
  if (!proyecto.tieneMeta) throw new ReglaDeNegocioError(MENSAJES.sinMeta);
  await exigirNombreItemLibre(tx, proyecto.id, datos.nombre);
  const [creado] = await tx
    .insert(itemsMeta)
    .values({
      proyectoId: proyecto.id,
      nombre: datos.nombre,
      unidad: datos.unidad,
      cantidadMeta: datos.cantidadMeta,
      costoReferencial: datos.costoReferencial,
    })
    .returning({ id: itemsMeta.id });
  return {
    datos: { id: creado.id },
    auditoria: [
      {
        entidad: "item_meta",
        entidadId: creado.id,
        accion: "crear",
        antes: null,
        despues: valoresItem({ ...datos, proyectoId: proyecto.id }),
      },
    ],
  };
});

export const editarItem = definir(editarItemEsquema, async (tx, datos) => {
  const proyecto = await bloquearProyecto(tx, datos.proyectoId);
  exigirActivo(proyecto);
  const [actual] = await tx
    .select()
    .from(itemsMeta)
    .where(and(eq(itemsMeta.id, datos.itemId), eq(itemsMeta.proyectoId, proyecto.id)));
  if (!actual) throw new ReglaDeNegocioError(MENSAJES.itemNoEncontrado);
  const antes = valoresItem(actual);
  const nuevo = valoresItem({ ...datos, proyectoId: proyecto.id });
  if (JSON.stringify(antes) === JSON.stringify(nuevo)) throw new ReglaDeNegocioError(MENSAJES.sinCambios);
  await exigirNombreItemLibre(tx, proyecto.id, nuevo.nombre, actual.id);
  await tx
    .update(itemsMeta)
    .set({
      nombre: nuevo.nombre,
      unidad: nuevo.unidad,
      cantidadMeta: nuevo.cantidadMeta,
      costoReferencial: nuevo.costoReferencial,
    })
    .where(eq(itemsMeta.id, actual.id));
  return {
    datos: { id: actual.id },
    auditoria: [{ entidad: "item_meta", entidadId: actual.id, accion: "editar", antes, despues: nuevo }],
  };
});
