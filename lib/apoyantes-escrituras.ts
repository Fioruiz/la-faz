import { count, eq } from "drizzle-orm";
import { crearApoyanteEsquema, editarApoyanteEsquema } from "./apoyantes-esquemas";
import { ReglaDeNegocioError, definirEscritura as definir } from "./escritura-auditada-core";
import { apoyantes, donaciones, voluntariosInscritos } from "./schema";

// No hay escritura de borrado: el PRD no la menciona y el usuario decidió no borrar ni anonimizar
// a pedido en esta versión. Faltan revisión legal y consentimiento (ver CLAUDE.md y #13).

const MENSAJES = {
  noEncontrado: "No se encontró el apoyante",
  sinCambios: "No hay cambios para guardar",
  conDonaciones: "Este apoyante ya tiene donaciones registradas; no se le puede quitar el rol de donante",
  conInscripciones: "Este apoyante ya tiene inscripciones de voluntariado; no se le puede quitar el rol de voluntario",
} as const;

type ValoresApoyante = {
  nombre: string;
  contacto: string | null;
  esDonante: boolean;
  esVoluntario: boolean;
  anonimoPublico: boolean;
};

// Lo único que va al historial. El contacto NUNCA se copia: solo si lo tiene (decisión del usuario, A8).
const valoresHistorial = (a: ValoresApoyante) => ({
  nombre: a.nombre,
  esDonante: a.esDonante,
  esVoluntario: a.esVoluntario,
  anonimoPublico: a.anonimoPublico,
  tieneContacto: a.contacto !== null,
});

export const crearApoyante = definir(crearApoyanteEsquema, async (tx, datos) => {
  const [creado] = await tx
    .insert(apoyantes)
    .values({
      nombre: datos.nombre,
      contacto: datos.contacto,
      esDonante: datos.esDonante,
      esVoluntario: datos.esVoluntario,
      anonimoPublico: datos.anonimoPublico,
    })
    .returning({ id: apoyantes.id });
  return {
    datos: { id: creado.id },
    auditoria: [
      { entidad: "apoyante", entidadId: creado.id, accion: "crear", antes: null, despues: valoresHistorial(datos) },
    ],
  };
});

export const editarApoyante = definir(editarApoyanteEsquema, async (tx, datos) => {
  // Bloquea la fila: registrar una donación toma un bloqueo sobre el apoyante, así que esta edición y
  // esa donación se ordenan y no dejan a un donante sin el rol que acaba de usar.
  const [actual] = await tx.select().from(apoyantes).where(eq(apoyantes.id, datos.apoyanteId)).for("update");
  if (!actual) throw new ReglaDeNegocioError(MENSAJES.noEncontrado);

  const nuevo: ValoresApoyante = {
    nombre: datos.nombre,
    contacto: datos.contacto,
    esDonante: datos.esDonante,
    esVoluntario: datos.esVoluntario,
    anonimoPublico: datos.anonimoPublico,
  };
  const contactoCambio = actual.contacto !== nuevo.contacto;
  const sinCambios =
    !contactoCambio &&
    actual.nombre === nuevo.nombre &&
    actual.esDonante === nuevo.esDonante &&
    actual.esVoluntario === nuevo.esVoluntario &&
    actual.anonimoPublico === nuevo.anonimoPublico;
  if (sinCambios) throw new ReglaDeNegocioError(MENSAJES.sinCambios);

  if (actual.esDonante && !nuevo.esDonante) {
    const [{ n }] = await tx.select({ n: count() }).from(donaciones).where(eq(donaciones.apoyanteId, actual.id));
    if (n > 0) throw new ReglaDeNegocioError(MENSAJES.conDonaciones);
  }
  if (actual.esVoluntario && !nuevo.esVoluntario) {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(voluntariosInscritos)
      .where(eq(voluntariosInscritos.apoyanteId, actual.id));
    if (n > 0) throw new ReglaDeNegocioError(MENSAJES.conInscripciones);
  }

  await tx
    .update(apoyantes)
    .set({
      nombre: nuevo.nombre,
      contacto: nuevo.contacto,
      esDonante: nuevo.esDonante,
      esVoluntario: nuevo.esVoluntario,
      anonimoPublico: nuevo.anonimoPublico,
    })
    .where(eq(apoyantes.id, actual.id));

  return {
    datos: { id: actual.id },
    auditoria: [
      {
        entidad: "apoyante",
        entidadId: actual.id,
        accion: "editar",
        antes: valoresHistorial(actual),
        // El valor del contacto no se guarda; si cambió, solo queda constancia de que cambió.
        despues: { ...valoresHistorial(nuevo), ...(contactoCambio ? { contactoModificado: true } : {}) },
      },
    ],
  };
});
