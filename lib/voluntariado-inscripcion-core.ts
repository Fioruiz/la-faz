import { z } from "zod";
import { MENSAJE_ERROR_GENERICO, type DbTransaccional, type ResultadoAccion } from "./escritura-auditada-core";
import { intentar, type DbLimite } from "./limite-intentos";
import { apoyantes, voluntariosInscritos } from "./schema";
import { CAMPO_TRAMPA_NOMBRE, CONSENTIMIENTO_VOLUNTARIADO } from "./sitio-contenido";
import { inscripcionVoluntarioEsquema } from "./voluntariado-esquemas";

// ÚNICA escritura de la zona pública (ADR 0003: excepción a "responsable activo"). No usa audit_log: su
// responsable_id es obligatorio y quien se inscribe no es responsable; la propia fila (creado_en y
// consentimiento_version) es el registro. Cada envío crea un apoyante nuevo (decisión del usuario).
// Sin Next: el envoltorio con la base real está en lib/voluntariado-inscripcion.ts.

// Campo trampa del formulario: oculto a las personas, lo llenan los bots.
export const CAMPO_TRAMPA = CAMPO_TRAMPA_NOMBRE;

export type Inscripcion = Record<string, never>;

// Como ResultadoAccion, pero el error de guardado también devuelve lo escrito para que el formulario no lo pierda.
export type ResultadoInscripcion =
  | Exclude<ResultadoAccion<Inscripcion>, { tipo: "error" }>
  | { ok: false; tipo: "error" | "limite"; mensaje: string; valores: Record<string, string> };

export const MENSAJE_LIMITE = "Recibimos muchas inscripciones desde tu conexión. Intenta de nuevo en un rato.";

// La base debe poder guardar la inscripción (transacción) y llevar los contadores del límite.
export type DbInscripcion = DbTransaccional & DbLimite;

function comoObjeto(entrada: FormData | Record<string, unknown>): Record<string, unknown> {
  if (entrada instanceof FormData) {
    return Object.fromEntries([...entrada.entries()].filter(([, v]) => typeof v === "string"));
  }
  return entrada;
}

// Lo que escribió la persona, para no perderlo. El campo trampa nunca vuelve.
function valoresEscritos(entrada: Record<string, unknown>): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(entrada)) {
    if (campo === CAMPO_TRAMPA) continue;
    if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") valores[campo] = String(valor);
  }
  return valores;
}

// Solo el tipo de error y su código SQLSTATE: el mensaje de Postgres puede traer valores de la fila.
function registrarFallo(error: unknown) {
  const e = error as { name?: string; code?: unknown; cause?: { code?: unknown } };
  console.error("[voluntariado-inscripcion]", { error: e?.name ?? "Error", codigo: e?.code ?? e?.cause?.code ?? null });
}

// Orden fijo: campo trampa -> validación con Zod -> una transacción con el apoyante y la inscripción.
// `claveIp` ya viene resumida (claveDeIp): este módulo no conoce cabeceras ni guarda IP en claro.
export async function inscribirVoluntario(
  db: DbInscripcion,
  entrada: FormData | Record<string, unknown>,
  opciones: { claveIp: string; ahora?: Date },
): Promise<ResultadoInscripcion> {
  const datosCrudos = comoObjeto(entrada);

  // Primero el límite: cuenta TODO envío (también el de bots y el que falla la validación). Si el contador falla,
  // no se guarda nada sin contarlo.
  try {
    if (await intentar(db, "formulario", opciones.claveIp, opciones.ahora)) {
      return { ok: false, tipo: "limite", mensaje: MENSAJE_LIMITE, valores: valoresEscritos(datosCrudos) };
    }
  } catch (e) {
    registrarFallo(e);
    return { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO, valores: valoresEscritos(datosCrudos) };
  }

  // Cualquier texto en el campo trampa: se descarta sin guardar y con la misma respuesta de éxito.
  const trampa = datosCrudos[CAMPO_TRAMPA];
  if (typeof trampa === "string" ? trampa !== "" : trampa !== undefined && trampa !== null) {
    return { ok: true, datos: {} };
  }

  const parsed = inscripcionVoluntarioEsquema.safeParse(datosCrudos);
  if (!parsed.success) {
    const campos = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
    const errores: Record<string, string[]> = {};
    for (const [campo, mensajes] of Object.entries(campos)) errores[campo] = mensajes ?? [];
    return { ok: false, tipo: "validacion", errores, valores: valoresEscritos(datosCrudos) };
  }

  const datos = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const [apoyante] = await tx
        .insert(apoyantes)
        .values({ nombre: datos.nombre, contacto: datos.contacto, esDonante: false, esVoluntario: true, anonimoPublico: false })
        .returning({ id: apoyantes.id });
      await tx.insert(voluntariosInscritos).values({
        apoyanteId: apoyante.id,
        mensaje: datos.mensaje,
        // La versión la fija el servidor; el formulario solo dice "acepto".
        consentimientoVersion: CONSENTIMIENTO_VOLUNTARIADO.version,
      });
    });
    return { ok: true, datos: {} };
  } catch (e) {
    registrarFallo(e);
    return { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO, valores: valoresEscritos(datosCrudos) };
  }
}
