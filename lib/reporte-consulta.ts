import { and, gte, lte, sql } from "drizzle-orm";
import type { LectorDb } from "./auth-credentials";
import { esAnulada, esDineroVigente, esProductoVigente } from "./donaciones-condiciones";
import { armarReporte, type Reporte } from "./reporte";
import { donaciones, itemsMeta, proyectos, responsables } from "./schema";

// Consultas del reporte (#10): seis consultas SQL fijas, agregadas, sin cargar donaciones en memoria y sin tocar
// `apoyantes` (no hay datos personales de donantes). Qué donaciones cuentan lo define donaciones-condiciones.ts,
// la misma regla del avance (#9), así que sin filtro de fechas los totales coinciden.
export async function consultarReporte(db: LectorDb, rango: { desde?: string; hasta?: string } = {}): Promise<Reporte> {
  // Rango inclusivo sobre la fecha de recepción de la donación.
  const enRango = and(rango.desde ? gte(donaciones.fecha, rango.desde) : undefined, rango.hasta ? lte(donaciones.fecha, rango.hasta) : undefined);

  const dinero = await db
    .select({
      responsableId: donaciones.registradoPor,
      proyectoId: donaciones.proyectoId,
      medio: donaciones.medio,
      total: sql<string>`coalesce(sum(${donaciones.monto}), 0)`,
      cantidad: sql<string>`count(*)`,
    })
    .from(donaciones)
    .where(and(esDineroVigente, enRango))
    .groupBy(donaciones.registradoPor, donaciones.proyectoId, donaciones.medio);

  const productos = await db
    .select({
      responsableId: donaciones.registradoPor,
      proyectoId: donaciones.proyectoId,
      itemId: donaciones.itemId,
      cantidad: sql<string>`coalesce(sum(${donaciones.cantidad}), 0)`,
      donaciones: sql<string>`count(*)`,
    })
    .from(donaciones)
    .where(and(esProductoVigente, enRango))
    .groupBy(donaciones.registradoPor, donaciones.proyectoId, donaciones.itemId);

  const anuladas = await db
    .select({ responsableId: donaciones.registradoPor, proyectoId: donaciones.proyectoId, cantidad: sql<string>`count(*)` })
    .from(donaciones)
    .where(and(esAnulada, enRango))
    .groupBy(donaciones.registradoPor, donaciones.proyectoId);

  const [listaResponsables, listaProyectos, listaItems] = [
    await db.select({ id: responsables.id, nombre: responsables.nombre, activo: responsables.activo }).from(responsables),
    await db.select({ id: proyectos.id, nombre: proyectos.nombre, estado: proyectos.estado }).from(proyectos),
    await db.select({ id: itemsMeta.id, nombre: itemsMeta.nombre, unidad: itemsMeta.unidad, proyectoId: itemsMeta.proyectoId }).from(itemsMeta),
  ];

  // Los conteos y las cantidades de unidades son enteros pequeños; el dinero se queda como texto exacto.
  const aConteo = (valor: string) => Number(valor);
  return armarReporte({
    dinero: dinero.map((f) => ({ responsableId: f.responsableId, proyectoId: f.proyectoId, medio: f.medio, total: String(f.total), cantidad: aConteo(f.cantidad) })),
    productos: productos.map((f) => ({ ...f, cantidad: aConteo(f.cantidad), donaciones: aConteo(f.donaciones) })),
    anuladas: anuladas.map((f) => ({ ...f, cantidad: aConteo(f.cantidad) })),
    responsables: listaResponsables,
    proyectos: listaProyectos,
    items: listaItems,
  });
}
