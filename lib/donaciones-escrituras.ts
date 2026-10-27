import { count, eq } from "drizzle-orm";
import { AdvertenciaError, ReglaDeNegocioError, definirEscritura } from "./escritura-auditada-core";
import { registrarDonacionEsquema } from "./donaciones-esquemas";
import {
  MENSAJES_DONACION,
  buscarDuplicados,
  exigirFechaNoFutura,
  mensajeDuplicado,
  resolverProyectoEItem,
} from "./donaciones-reglas";
import { apoyantes, donaciones } from "./schema";

// Registrar una donación: lo que el responsable DECLARA haber recibido. El sistema no cobra ni mueve dinero.
// Editar, anular y asignar una donación existente es el ítem #8.

const MENSAJES = {
  vinculadaNoEncontrada: "No se encontró la donación a vincular",
  vinculadaAnulada: "No se puede vincular una donación anulada",
  vinculadaOtroDonante: "La donación vinculada debe ser del mismo donante",
  vinculadaMismoTipo: "La donación vinculada debe ser de tipo distinto (dinero y producto)",
  vinculadaYaPareja: "Esa donación ya forma parte de una donación mixta",
} as const;

// El reloj se inyecta para poder probar "no futura" sin depender de la fecha real.
export function crearRegistrarDonacion(ahora: () => Date = () => new Date()) {
  return definirEscritura(registrarDonacionEsquema, async (tx, datos, responsable) => {
    exigirFechaNoFutura(datos.fecha, ahora());

    // Bloqueos compartidos, siempre en este orden (donante, proyecto): chocan con las escrituras que usan
    // FOR UPDATE (editar roles, finalizar o editar el proyecto), así una de las dos espera a la otra.
    const [donante] = await tx
      .select({ esDonante: apoyantes.esDonante })
      .from(apoyantes)
      .where(eq(apoyantes.id, datos.apoyanteId))
      .for("share");
    if (!donante) throw new ReglaDeNegocioError(MENSAJES_DONACION.donanteNoEncontrado);
    if (!donante.esDonante) throw new ReglaDeNegocioError(MENSAJES_DONACION.noEsDonante);

    // Un producto asignado necesita un proyecto con meta y un ítem de ESE proyecto (la FK compuesta de la
    // base es la red de seguridad); sin proyecto no lleva ítem y lleva descripción.
    const { proyecto, itemId } = await resolverProyectoEItem(tx, {
      proyectoId: datos.proyectoId,
      tipo: datos.tipo,
      itemId: datos.tipo === "producto" ? datos.itemId : undefined,
    });
    const descripcion = datos.tipo === "producto" && !proyecto ? datos.descripcionProducto : null;

    if (datos.donacionVinculadaId !== undefined) {
      const [vinculada] = await tx
        .select()
        .from(donaciones)
        .where(eq(donaciones.id, datos.donacionVinculadaId))
        .for("update");
      if (!vinculada) throw new ReglaDeNegocioError(MENSAJES.vinculadaNoEncontrada);
      if (vinculada.anulada) throw new ReglaDeNegocioError(MENSAJES.vinculadaAnulada);
      if (vinculada.apoyanteId !== datos.apoyanteId) throw new ReglaDeNegocioError(MENSAJES.vinculadaOtroDonante);
      if (vinculada.tipo === datos.tipo) throw new ReglaDeNegocioError(MENSAJES.vinculadaMismoTipo);
      const [{ n: apuntanA }] = await tx
        .select({ n: count() })
        .from(donaciones)
        .where(eq(donaciones.donacionVinculadaId, vinculada.id));
      if (vinculada.donacionVinculadaId !== null || apuntanA > 0) throw new ReglaDeNegocioError(MENSAJES.vinculadaYaPareja);
    }

    // Aviso blando de duplicados (ADR 0006): no hay restricción única y la comprobación no es atómica.
    if (!datos.confirmarDuplicado) {
      const iguales = await buscarDuplicados(tx, {
        apoyanteId: datos.apoyanteId,
        tipo: datos.tipo,
        fecha: datos.fecha,
        proyectoId: datos.proyectoId,
        monto: datos.tipo === "dinero" ? datos.monto : null,
        cantidad: datos.tipo === "producto" ? datos.cantidad : null,
        itemId,
        descripcion,
      });
      if (iguales.length > 0) {
        throw new AdvertenciaError(mensajeDuplicado(iguales.length, datos.tipo, datos.fecha, proyecto?.nombre));
      }
    }

    const [creada] = await tx
      .insert(donaciones)
      .values({
        apoyanteId: datos.apoyanteId,
        proyectoId: datos.proyectoId,
        tipo: datos.tipo,
        monto: datos.tipo === "dinero" ? datos.monto : null,
        medio: datos.tipo === "dinero" ? datos.medio : null,
        itemId,
        cantidad: datos.tipo === "producto" ? datos.cantidad : null,
        descripcionProducto: descripcion,
        fecha: datos.fecha,
        registradoPor: responsable.id,
        donacionVinculadaId: datos.donacionVinculadaId ?? null,
      })
      .returning({ id: donaciones.id });

    return {
      datos: { id: creada.id, tipo: datos.tipo },
      auditoria: [
        {
          entidad: "donacion",
          entidadId: creada.id,
          accion: "crear",
          antes: null,
          // Solo el id del donante: el historial no copia nombre ni contacto.
          despues: {
            tipo: datos.tipo,
            monto: datos.tipo === "dinero" ? datos.monto : null,
            medio: datos.tipo === "dinero" ? datos.medio : null,
            proyectoId: datos.proyectoId,
            itemId,
            cantidad: datos.tipo === "producto" ? datos.cantidad : null,
            descripcionProducto: descripcion,
            fecha: datos.fecha,
            apoyanteId: datos.apoyanteId,
            donacionVinculadaId: datos.donacionVinculadaId ?? null,
            duplicadoConfirmado: datos.confirmarDuplicado,
          },
        },
      ],
    };
  });
}

export const registrarDonacion = crearRegistrarDonacion();
