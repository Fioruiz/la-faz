import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  anularDonacionEsquema,
  asignarDonacionEsquema,
  editarDonacionEsquema,
} from "./donaciones-correcciones-esquemas";
import { registrarDonacionEsquema } from "./donaciones-esquemas";
import {
  buscarDuplicados,
  exigirFechaNoFutura,
  leerProyectoCompartido,
  mensajeDuplicado,
  resolverProyectoEItem,
  type ProyectoLeido,
} from "./donaciones-reglas";
import {
  AdvertenciaError,
  ReglaDeNegocioError,
  ValidacionError,
  definirEscritura,
  type TransaccionDb,
} from "./escritura-auditada-core";
import { donaciones } from "./schema";

// Corregir lo registrado: editar, asignar y anular. Nunca se borra ni se restaura, y el tipo y el donante
// de una donación no cambian. Las reglas del registro viven en donaciones-reglas.ts y se reutilizan aquí.

const MENSAJES = {
  noEncontrada: "No se encontró la donación",
  anulada: "Esta donación está anulada y no se puede modificar",
  yaAnulada: "Esta donación ya está anulada",
  proyectoFinalizado: "El proyecto de esta donación está finalizado: no se puede modificar",
  sinCambios: "No hay cambios para guardar",
  yaTieneProyecto: "Esta donación ya tiene proyecto: usa la edición para reasignarla",
  elegirProyecto: "Elige un proyecto activo",
} as const;

type FilaDonacion = typeof donaciones.$inferSelect;

// Primera operación de toda corrección: la donación con `for update`, y luego los proyectos implicados con
// `for share` en orden de id (así dos escrituras que toquen los mismos proyectos los toman igual, sin
// interbloqueo). Las comprobaciones de estado van DESPUÉS de tener los bloqueos, para ver el estado vigente.
async function bloquear(tx: TransaccionDb, donacionId: number, destinoId: number | null) {
  const [donacion] = await tx.select().from(donaciones).where(eq(donaciones.id, donacionId)).for("update");
  if (!donacion) throw new ReglaDeNegocioError(MENSAJES.noEncontrada);
  const ids = [...new Set([donacion.proyectoId, destinoId].filter((v): v is number => v !== null))].sort((a, b) => a - b);
  const proyectos = new Map<number, ProyectoLeido>();
  for (const id of ids) proyectos.set(id, await leerProyectoCompartido(tx, id));
  return { donacion, proyectoActual: donacion.proyectoId === null ? undefined : proyectos.get(donacion.proyectoId) };
}

function exigirModificable(donacion: FilaDonacion, proyectoActual: ProyectoLeido | undefined) {
  if (donacion.anulada) throw new ReglaDeNegocioError(MENSAJES.anulada);
  if (proyectoActual?.estado === "finalizado") throw new ReglaDeNegocioError(MENSAJES.proyectoFinalizado);
}

// Los valores de negocio que se comparan y se guardan en el historial: nunca nombre ni contacto del donante.
const valores = (v: {
  monto: string | null;
  medio: string | null;
  cantidad: number | null;
  proyectoId: number | null;
  itemId: number | null;
  descripcion: string | null;
  fecha: string;
}) => ({
  monto: v.monto,
  medio: v.medio,
  cantidad: v.cantidad,
  proyectoId: v.proyectoId,
  itemId: v.itemId,
  descripcionProducto: v.descripcion,
  fecha: v.fecha,
});

const delFila = (d: FilaDonacion) =>
  valores({ monto: d.monto, medio: d.medio, cantidad: d.cantidad, proyectoId: d.proyectoId, itemId: d.itemId, descripcion: d.descripcionProducto, fecha: d.fecha });

function camposInvalidos(error: z.ZodError): Record<string, string[]> {
  const campos = z.flattenError(error as z.ZodError<Record<string, unknown>>).fieldErrors;
  return Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, (v as string[] | undefined) ?? []]));
}

// El reloj se inyecta para poder probar "no futura" sin depender de la fecha real.
export function crearEditarDonacion(ahora: () => Date = () => new Date()) {
  return definirEscritura(editarDonacionEsquema, async (tx, entrada) => {
    // Primero la donación: el tipo y el donante salen de la fila, nunca de la entrada.
    const [previa] = await tx.select({ proyectoId: donaciones.proyectoId, tipo: donaciones.tipo, apoyanteId: donaciones.apoyanteId }).from(donaciones).where(eq(donaciones.id, entrada.donacionId));
    if (!previa) throw new ReglaDeNegocioError(MENSAJES.noEncontrada);

    const { donacionId } = entrada;
    // Tipo, donante y vínculo nunca se toman de la entrada.
    const resto = Object.fromEntries(Object.entries(entrada).filter(([k]) => !["tipo", "apoyanteId", "donacionVinculadaId", "donacionId"].includes(k)));
    const parsed = registrarDonacionEsquema.safeParse({ ...resto, tipo: previa.tipo, apoyanteId: previa.apoyanteId });
    if (!parsed.success) throw new ValidacionError(camposInvalidos(parsed.error));
    const datos = parsed.data;

    // Bloqueos (la donación y los proyectos actual y de destino) y estado vigente.
    const { donacion, proyectoActual } = await bloquear(tx, donacionId, datos.proyectoId);
    exigirModificable(donacion, proyectoActual);
    exigirFechaNoFutura(datos.fecha, ahora());

    const { proyecto, itemId } = await resolverProyectoEItem(tx, {
      proyectoId: datos.proyectoId,
      tipo: datos.tipo,
      itemId: datos.tipo === "producto" ? datos.itemId : undefined,
    });
    const descripcion = datos.tipo === "producto" && !proyecto ? datos.descripcionProducto : null;
    const nuevos = valores({
      monto: datos.tipo === "dinero" ? datos.monto : null,
      medio: datos.tipo === "dinero" ? datos.medio : null,
      cantidad: datos.tipo === "producto" ? datos.cantidad : null,
      proyectoId: datos.proyectoId,
      itemId,
      descripcion,
      fecha: datos.fecha,
    });
    const antes = delFila(donacion);
    if (JSON.stringify(antes) === JSON.stringify(nuevos)) throw new ReglaDeNegocioError(MENSAJES.sinCambios);

    if (!datos.confirmarDuplicado) {
      const iguales = await buscarDuplicados(
        tx,
        {
          apoyanteId: donacion.apoyanteId,
          tipo: datos.tipo,
          fecha: datos.fecha,
          proyectoId: datos.proyectoId,
          monto: nuevos.monto,
          cantidad: nuevos.cantidad,
          itemId,
          descripcion,
        },
        donacion.id,
      );
      if (iguales.length > 0) throw new AdvertenciaError(mensajeDuplicado(iguales.length, datos.tipo, datos.fecha, proyecto?.nombre));
    }

    await tx
      .update(donaciones)
      .set({
        monto: nuevos.monto,
        medio: nuevos.medio,
        cantidad: nuevos.cantidad,
        proyectoId: nuevos.proyectoId,
        itemId: nuevos.itemId,
        descripcionProducto: nuevos.descripcionProducto,
        fecha: nuevos.fecha,
      })
      .where(eq(donaciones.id, donacion.id));

    return {
      datos: { id: donacion.id },
      auditoria: [
        {
          entidad: "donacion",
          entidadId: donacion.id,
          accion: "editar",
          antes: { ...antes, apoyanteId: donacion.apoyanteId },
          despues: { ...nuevos, apoyanteId: donacion.apoyanteId, duplicadoConfirmado: datos.confirmarDuplicado },
        },
      ],
    };
  });
}
export const editarDonacion = crearEditarDonacion();

// Asignar una donación "Sin asignar" a un proyecto (y, si es producto, a un ítem) en una sola operación.
export const asignarDonacion = definirEscritura(asignarDonacionEsquema, async (tx, datos) => {
  if (datos.proyectoId === null) throw new ValidacionError({ proyectoId: [MENSAJES.elegirProyecto] });
  const { donacion, proyectoActual } = await bloquear(tx, datos.donacionId, datos.proyectoId);
  exigirModificable(donacion, proyectoActual);
  if (donacion.proyectoId !== null) throw new ReglaDeNegocioError(MENSAJES.yaTieneProyecto);
  if (donacion.tipo === "producto" && datos.itemId === undefined) throw new ValidacionError({ itemId: ["Elige el ítem"] });

  const { proyecto, itemId } = await resolverProyectoEItem(tx, {
    proyectoId: datos.proyectoId,
    tipo: donacion.tipo as "dinero" | "producto",
    itemId: datos.itemId,
  });

  if (!datos.confirmarDuplicado) {
    const iguales = await buscarDuplicados(
      tx,
      {
        apoyanteId: donacion.apoyanteId,
        tipo: donacion.tipo as "dinero" | "producto",
        fecha: donacion.fecha,
        proyectoId: datos.proyectoId,
        monto: donacion.monto,
        cantidad: donacion.cantidad,
        itemId,
        descripcion: null,
      },
      donacion.id,
    );
    if (iguales.length > 0) throw new AdvertenciaError(mensajeDuplicado(iguales.length, donacion.tipo, donacion.fecha, proyecto?.nombre));
  }

  // La descripción libre deja de hacer falta: el ítem dice qué es. El historial conserva la anterior.
  await tx
    .update(donaciones)
    .set({ proyectoId: datos.proyectoId, itemId, descripcionProducto: null })
    .where(eq(donaciones.id, donacion.id));

  return {
    datos: { id: donacion.id },
    auditoria: [
      {
        entidad: "donacion",
        entidadId: donacion.id,
        accion: "asignar",
        antes: { proyectoId: null, itemId: null, descripcionProducto: donacion.descripcionProducto, apoyanteId: donacion.apoyanteId },
        despues: { proyectoId: datos.proyectoId, itemId, descripcionProducto: null, apoyanteId: donacion.apoyanteId, duplicadoConfirmado: datos.confirmarDuplicado },
      },
    ],
  };
});

// Anular: la fila se conserva con sus valores y `anulada = true`. El motivo (obligatorio) va solo al
// historial: no hay columna para él. No se restaura.
export const anularDonacion = definirEscritura(anularDonacionEsquema, async (tx, datos) => {
  const { donacion, proyectoActual } = await bloquear(tx, datos.donacionId, null);
  if (donacion.anulada) throw new ReglaDeNegocioError(MENSAJES.yaAnulada);
  if (proyectoActual?.estado === "finalizado") throw new ReglaDeNegocioError(MENSAJES.proyectoFinalizado);

  await tx.update(donaciones).set({ anulada: true }).where(eq(donaciones.id, donacion.id));

  return {
    datos: { id: donacion.id },
    auditoria: [
      {
        entidad: "donacion",
        entidadId: donacion.id,
        accion: "anular",
        antes: { anulada: false, apoyanteId: donacion.apoyanteId },
        despues: { anulada: true, motivo: datos.motivo, apoyanteId: donacion.apoyanteId },
      },
    ],
  };
});
