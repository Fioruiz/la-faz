import { z } from "zod";
import type { getDb } from "./db-client";
import { ResponsableNoActivoError, type ResponsableActivo } from "./responsable-activo";
import { auditLog } from "./schema";

// Se añaden acciones aquí sin migrar: audit_log.accion es texto.
export const ACCIONES_AUDITORIA = ["crear", "editar", "anular", "asignar", "finalizar"] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export type Valores = Record<string, unknown> | null;

// Una fila de historial. Cada acción declara solo los valores que deben quedar (sin hashes ni
// datos que no corresponda guardar): nada se copia automáticamente de la fila.
export type RegistroAuditoria = {
  entidad: string;
  entidadId: number;
  accion: AccionAuditoria;
  antes: Valores;
  despues: Valores;
};

// Para rechazar una escritura con un mensaje dirigido a la persona. Revierte todo lo hecho.
export class ReglaDeNegocioError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ReglaDeNegocioError";
  }
}

// Para devolver errores de validación por campo desde dentro de `escribir` (cuando lo que se debe validar
// solo se conoce al leer la fila, por ejemplo el tipo de una donación). Revierte y conserva lo escrito.
export class ValidacionError extends Error {
  constructor(public readonly errores: Record<string, string[]>) {
    super("Datos inválidos");
    this.name = "ValidacionError";
  }
}

// Para pedir confirmación en vez de guardar (por ejemplo, un posible duplicado). Revierte todo lo hecho
// y no es un error: el formulario muestra el mensaje junto a una acción de confirmación.
export class AdvertenciaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "AdvertenciaError";
  }
}

export type ResultadoAccion<T> =
  | { ok: true; datos: T }
  | { ok: false; tipo: "validacion"; errores: Record<string, string[]>; valores: Record<string, string> }
  | { ok: false; tipo: "regla"; mensaje: string }
  | { ok: false; tipo: "advertencia"; mensaje: string }
  | { ok: false; tipo: "error"; mensaje: string };

// El núcleo no redirige: informa `no_autorizado` y la capa con Next lleva a la persona al login.
export type ResultadoNucleo<T> = ResultadoAccion<T> | { ok: false; tipo: "no_autorizado" };

export const MENSAJE_ERROR_GENERICO = "No pudimos guardar los cambios. Intenta de nuevo en unos minutos.";

type Db = ReturnType<typeof getDb>;
export type TransaccionDb = Parameters<Parameters<Db["transaction"]>[0]>[0];
// Sirve tanto la conexión normal como una transacción de pruebas (donde la interna es un savepoint).
export type DbTransaccional = { transaction: <T>(fn: (tx: TransaccionDb) => Promise<T>) => Promise<T> };

function comoJson(valores: Valores, campo: string): Valores {
  if (valores === null) return null;
  let texto: string | undefined;
  try {
    texto = JSON.stringify(valores);
  } catch {
    throw new Error(`El historial (${campo}) no se puede guardar como JSON`);
  }
  if (texto === undefined) throw new Error(`El historial (${campo}) no se puede guardar como JSON`);
  return valores;
}

// Inserta una fila en audit_log. El responsable lo pone el ejecutor, nunca la entrada.
export async function registrarAuditoria(
  tx: Pick<TransaccionDb, "insert">,
  responsableId: number,
  registro: RegistroAuditoria,
): Promise<void> {
  if (!(ACCIONES_AUDITORIA as readonly string[]).includes(registro.accion)) {
    throw new Error("Acción de historial desconocida");
  }
  if (!Number.isSafeInteger(registro.entidadId)) throw new Error("El id de la entidad del historial no es un entero");
  if (!registro.entidad) throw new Error("Falta la entidad del historial");
  await tx.insert(auditLog).values({
    entidad: registro.entidad,
    entidadId: registro.entidadId,
    accion: registro.accion,
    antes: comoJson(registro.antes, "antes"),
    despues: comoJson(registro.despues, "despues"),
    responsableId,
  });
}

export type EscrituraAuditada<TEsquema extends z.ZodType, TDatos> = {
  // Identifica la acción en el log del servidor.
  nombre: string;
  db: DbTransaccional;
  requerir: () => Promise<ResponsableActivo>;
  esquema: TEsquema;
  entrada: FormData | Record<string, unknown>;
  camposSensibles?: string[];
  escribir: (
    tx: TransaccionDb,
    datos: z.output<TEsquema>,
    responsable: ResponsableActivo,
  ) => Promise<{ datos: TDatos; auditoria: RegistroAuditoria[] }>;
};

function comoObjeto(entrada: FormData | Record<string, unknown>): Record<string, unknown> {
  if (entrada instanceof FormData) {
    return Object.fromEntries([...entrada.entries()].filter(([, v]) => typeof v === "string"));
  }
  return entrada;
}

// Lo que la persona escribió, para que el formulario no lo pierda. Sin los campos sensibles.
function valoresEscritos(entrada: Record<string, unknown>, sensibles: string[]): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(entrada)) {
    if (sensibles.includes(campo)) continue;
    if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") valores[campo] = String(valor);
  }
  return valores;
}

// Solo el tipo de error y su código SQLSTATE: el mensaje de Postgres puede traer valores de la fila
// (datos personales) o de la conexión.
function registrarFallo(nombre: string, error: unknown) {
  const e = error as { name?: string; code?: unknown; cause?: { code?: unknown } };
  const codigo = e?.code ?? e?.cause?.code;
  console.error("[escritura-auditada]", { accion: nombre, error: e?.name ?? "Error", codigo: codigo ?? null });
}

function fallo(): { ok: false; tipo: "error"; mensaje: string } {
  return { ok: false, tipo: "error", mensaje: MENSAJE_ERROR_GENERICO };
}

// Orden fijo: responsable activo, validación, transacción con el cambio y su historial.
export async function ejecutarEscrituraAuditada<TEsquema extends z.ZodType, TDatos>(
  def: EscrituraAuditada<TEsquema, TDatos>,
): Promise<ResultadoNucleo<TDatos>> {
  let responsable: ResponsableActivo;
  try {
    responsable = await def.requerir();
  } catch (e) {
    if (e instanceof ResponsableNoActivoError) return { ok: false, tipo: "no_autorizado" };
    registrarFallo(def.nombre, e);
    return fallo();
  }

  const entrada = comoObjeto(def.entrada);
  const parsed = def.esquema.safeParse(entrada);
  if (!parsed.success) {
    const campos = z.flattenError(parsed.error as z.ZodError<Record<string, unknown>>).fieldErrors;
    const errores: Record<string, string[]> = {};
    for (const [campo, mensajes] of Object.entries(campos)) errores[campo] = (mensajes as string[] | undefined) ?? [];
    return { ok: false, tipo: "validacion", errores, valores: valoresEscritos(entrada, def.camposSensibles ?? []) };
  }

  try {
    const datos = await def.db.transaction(async (tx) => {
      const resultado = await def.escribir(tx, parsed.data, responsable);
      if (!Array.isArray(resultado?.auditoria) || resultado.auditoria.length === 0) {
        throw new Error("La escritura no declaró ningún registro de historial");
      }
      for (const registro of resultado.auditoria) await registrarAuditoria(tx, responsable.id, registro);
      return resultado.datos;
    });
    return { ok: true, datos };
  } catch (e) {
    if (e instanceof ValidacionError) {
      return { ok: false, tipo: "validacion", errores: e.errores, valores: valoresEscritos(entrada, def.camposSensibles ?? []) };
    }
    if (e instanceof ReglaDeNegocioError) return { ok: false, tipo: "regla", mensaje: e.message };
    if (e instanceof AdvertenciaError) return { ok: false, tipo: "advertencia", mensaje: e.message };
    registrarFallo(def.nombre, e);
    return fallo();
  }
}

// Define una escritura como un par { esquema, escribir } con los tipos inferidos, sin Next.
// Las acciones privadas lo pasan a crearAccionPrivada() y las pruebas lo ejecutan con ejecutarEscrituraAuditada().
export function definirEscritura<TEsquema extends z.ZodType, TDatos>(
  esquema: TEsquema,
  escribir: EscrituraAuditada<TEsquema, TDatos>["escribir"],
) {
  return { esquema, escribir };
}
