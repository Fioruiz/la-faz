import { and, eq, isNull } from "drizzle-orm";
import { ReglaDeNegocioError, type TransaccionDb } from "./escritura-auditada-core";
import { hoyEnLima } from "./fechas";
import { donaciones, itemsMeta, proyectos } from "./schema";

// Reglas de una donación que comparten registrar (#7), editar y asignar (#8): un solo sitio por regla.

export const MENSAJES_DONACION = {
  donanteNoEncontrado: "No se encontró al donante",
  noEsDonante: "Esta persona no es donante",
  proyectoNoEncontrado: "No se encontró el proyecto",
  finalizado: "Este proyecto ya está finalizado",
  sinMeta: "Este proyecto no tiene meta. Registra el producto como «Sin asignar» o crea antes el ítem",
  itemAjeno: "El ítem no pertenece al proyecto elegido",
  fechaFutura: "La fecha no puede ser futura",
} as const;

// Sin distinguir mayúsculas ni tildes: "Cajas de Cereal" y "cajas de cereal" son la misma descripción.
export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").trim();

export function exigirFechaNoFutura(fecha: string, ahora: Date) {
  if (fecha > hoyEnLima(ahora)) throw new ReglaDeNegocioError(MENSAJES_DONACION.fechaFutura);
}

export type ProyectoLeido = { id: number; nombre: string; estado: string; tieneMeta: boolean };

// Lee un proyecto con `for share`: choca con las escrituras que usan FOR UPDATE (finalizar o editar el
// proyecto), así que una de las dos espera a la otra. Ver design.md de registrar-donacion, decisión 4.
export async function leerProyectoCompartido(tx: TransaccionDb, id: number): Promise<ProyectoLeido> {
  const [proyecto] = await tx
    .select({ id: proyectos.id, nombre: proyectos.nombre, estado: proyectos.estado, tieneMeta: proyectos.tieneMeta })
    .from(proyectos)
    .where(eq(proyectos.id, id))
    .for("share");
  if (!proyecto) throw new ReglaDeNegocioError(MENSAJES_DONACION.proyectoNoEncontrado);
  return proyecto;
}

// Proyecto de destino de una donación (activo; con meta e ítem del proyecto si es producto asignado).
// Devuelve el proyecto leído (o undefined si queda sin asignar) y el ítem que corresponde (o null).
export async function resolverProyectoEItem(
  tx: TransaccionDb,
  entrada: { proyectoId: number | null; tipo: "dinero" | "producto"; itemId?: number },
): Promise<{ proyecto: ProyectoLeido | undefined; itemId: number | null }> {
  if (entrada.proyectoId === null) return { proyecto: undefined, itemId: null };
  const proyecto = await leerProyectoCompartido(tx, entrada.proyectoId);
  if (proyecto.estado === "finalizado") throw new ReglaDeNegocioError(MENSAJES_DONACION.finalizado);
  if (entrada.tipo !== "producto") return { proyecto, itemId: null };
  if (!proyecto.tieneMeta) throw new ReglaDeNegocioError(MENSAJES_DONACION.sinMeta);
  const [item] = await tx
    .select({ id: itemsMeta.id })
    .from(itemsMeta)
    .where(and(eq(itemsMeta.id, entrada.itemId as number), eq(itemsMeta.proyectoId, proyecto.id)));
  if (!item) throw new ReglaDeNegocioError(MENSAJES_DONACION.itemAjeno);
  return { proyecto, itemId: item.id };
}

export type CandidataDuplicado = {
  apoyanteId: number;
  tipo: "dinero" | "producto";
  fecha: string;
  proyectoId: number | null;
  monto: string | null;
  cantidad: number | null;
  itemId: number | null;
  descripcion: string | null;
};

// Aviso blando de duplicados (ADR 0006): mismo donante, tipo, fecha y proyecto, y monto, o cantidad e
// ítem, o cantidad y descripción sin asignar. No cuenta anuladas ni (en una edición) a la misma donación.
export async function buscarDuplicados(tx: TransaccionDb, c: CandidataDuplicado, excluirId?: number): Promise<number[]> {
  const mismas = await tx
    .select({ id: donaciones.id, descripcion: donaciones.descripcionProducto })
    .from(donaciones)
    .where(
      and(
        eq(donaciones.apoyanteId, c.apoyanteId),
        eq(donaciones.tipo, c.tipo),
        eq(donaciones.fecha, c.fecha),
        eq(donaciones.anulada, false),
        c.proyectoId === null ? isNull(donaciones.proyectoId) : eq(donaciones.proyectoId, c.proyectoId),
        c.tipo === "dinero" ? eq(donaciones.monto, c.monto as string) : eq(donaciones.cantidad, c.cantidad as number),
        c.tipo === "producto" && c.itemId !== null ? eq(donaciones.itemId, c.itemId) : undefined,
      ),
    );
  return mismas
    .filter((m) => m.id !== excluirId)
    .filter((m) => !(c.tipo === "producto" && c.itemId === null) || normalizar(m.descripcion ?? "") === normalizar(c.descripcion ?? ""))
    .map((m) => m.id);
}

// Sin nombre ni contacto del donante.
export function mensajeDuplicado(n: number, tipo: string, fecha: string, nombreProyecto: string | undefined) {
  return `Ya hay ${n} donación${n === 1 ? "" : "es"} igual${n === 1 ? "" : "es"} (${tipo}, ${fecha}, ${nombreProyecto ?? "Sin asignar"}). ¿Guardar de todos modos?`;
}
