import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { LectorDb } from "./auth-credentials";
import { calcularAvance, calcularProyecto, type AvanceProyecto, type ResultadoAvance } from "./avance";
import { esDineroVigente, esProductoVigente, esVigente } from "./donaciones-condiciones";
import { donaciones, itemsMeta } from "./schema";

// Consulta del avance, compartida por la zona privada y (en #12) la pública: tres consultas SQL fijas con
// agregaciones, sin cargar donaciones en memoria y sin importar cuántas haya. Sin Next ni módulos privados.
// Reglas (ADR 0008): lo recibido de un ítem es SUM(cantidad) de producto NO anulado con ese ítem; el dinero
// no suma a ninguna barra; las donaciones sin asignar no cuentan en ningún proyecto.

// Un proyecto sin ítems ni dinero (por ejemplo, uno informativo sin donaciones) no aparece en las
// agregaciones: quien lee usa esto como su avance.
export const AVANCE_VACIO: AvanceProyecto = calcularProyecto([], "0.00");

export async function consultarAvance(db: LectorDb, opciones: { proyectoIds?: number[] } = {}): Promise<ResultadoAvance> {
  const filtro = opciones.proyectoIds;
  if (filtro && filtro.length === 0) return calcularAvance({ proyectoIds: [], items: [], dineroPorProyecto: {}, sinAsignar: await sinAsignar(db) });

  // (1) Lo recibido por ítem. LEFT JOIN: un ítem sin donaciones aparece con 0.
  const items = await db
    .select({
      id: itemsMeta.id,
      proyectoId: itemsMeta.proyectoId,
      nombre: itemsMeta.nombre,
      unidad: itemsMeta.unidad,
      cantidadMeta: itemsMeta.cantidadMeta,
      costoReferencial: itemsMeta.costoReferencial,
      recibido: sql<string>`coalesce(sum(${donaciones.cantidad}), 0)`,
    })
    .from(itemsMeta)
    .leftJoin(donaciones, and(eq(donaciones.itemId, itemsMeta.id), esProductoVigente))
    .where(filtro ? inArray(itemsMeta.proyectoId, filtro) : undefined)
    .groupBy(itemsMeta.id);

  // (2) Dinero por proyecto: solo no anulado y asignado.
  const dinero = await db
    .select({ proyectoId: donaciones.proyectoId, total: sql<string>`coalesce(sum(${donaciones.monto}), 0)` })
    .from(donaciones)
    .where(
      and(
        esDineroVigente,
        isNotNull(donaciones.proyectoId),
        filtro ? inArray(donaciones.proyectoId, filtro) : undefined,
      ),
    )
    .groupBy(donaciones.proyectoId);

  const dineroPorProyecto: Record<number, string> = {};
  for (const fila of dinero) dineroPorProyecto[fila.proyectoId as number] = String(fila.total);

  const proyectoIds = filtro ?? [...new Set([...items.map((i) => i.proyectoId), ...Object.keys(dineroPorProyecto).map(Number)])];
  return calcularAvance({
    proyectoIds,
    items: items.map((i) => ({ ...i, recibido: Number(i.recibido) })),
    dineroPorProyecto,
    sinAsignar: await sinAsignar(db),
  });
}

// (3) Lo pendiente de asignar: no anuladas sin proyecto. No cuenta en ninguna barra.
async function sinAsignar(db: LectorDb) {
  const [fila] = await db
    .select({
      totalDinero: sql<string>`coalesce(sum(case when ${donaciones.tipo} = 'dinero' then ${donaciones.monto} end), 0)`,
      cantidad: sql<string>`count(*)`,
    })
    .from(donaciones)
    .where(and(isNull(donaciones.proyectoId), esVigente));
  const cantidad = Number(fila.cantidad); // un conteo de filas
  return { totalDinero: String(fila.totalDinero), cantidad };
}
