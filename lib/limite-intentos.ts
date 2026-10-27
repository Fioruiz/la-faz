import { createHmac } from "node:crypto";
import { and, count, eq, gt, lt } from "drizzle-orm";
import type { getDb } from "./db-client";
import { intentosLimitados } from "./schema";

// Límite de intentos con contadores en Postgres (ADR 0011). Sin Next. Sin servicios externos.
// - login: máximo 5 intentos por correo dentro de 15 minutos; el sexto se rechaza sin comprobar la contraseña.
// - formulario: máximo 5 envíos por hora por IP (el envío que pasa del máximo se rechaza).
// La `clave` es un HMAC (con AUTH_SECRET) del correo o de la IP: la tabla no guarda valores en claro.

export type TipoLimite = "login" | "formulario";

export const LIMITES = {
  login: { ventanaMs: 15 * 60 * 1000, maximo: 5 },
  formulario: { ventanaMs: 60 * 60 * 1000, maximo: 5 },
} as const satisfies Record<TipoLimite, { ventanaMs: number; maximo: number }>;

// Sirve la conexión normal y una transacción de pruebas.
export type DbLimite = Pick<ReturnType<typeof getDb>, "select" | "insert" | "delete">;

// Sin secreto no hay clave: falla cerrado en vez de guardar un resumen sin clave.
export function claveHmac(valor: string, secreto: string | undefined = process.env.AUTH_SECRET): string {
  if (!secreto) throw new Error("Falta la variable de entorno AUTH_SECRET");
  return createHmac("sha256", secreto).update(`limite:${valor}`).digest("hex");
}

// IPv6 normalizada a su prefijo /64 (lo que recibe una conexión residencial): sin esto, un cliente cambiaría de
// dirección en cada envío y evadiría el límite. Devuelve null si no es una IPv6.
export function prefijoIpv6(ip: string): string | null {
  const limpia = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (!limpia.includes(":")) return null;
  if (/^(::ffff:)?\d+\.\d+\.\d+\.\d+$/.test(limpia)) return null; // IPv4 (incluida la mapeada)
  const [cabeza, cola = ""] = limpia.split("::");
  const [g1, g2] = [cabeza ? cabeza.split(":") : [], cola ? cola.split(":") : []];
  if (!limpia.includes("::") && g1.length !== 8) return null;
  const grupos = limpia.includes("::") ? [...g1, ...Array(Math.max(0, 8 - g1.length - g2.length)).fill("0"), ...g2] : g1;
  if (grupos.length !== 8 || grupos.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return grupos.slice(0, 4).map((g) => g.padStart(4, "0")).join(":") + "::/64";
}

// Clave del límite del formulario a partir de x-forwarded-for (en Vercel lo fija la plataforma): su primer valor.
// Una IPv6 cuenta por su prefijo /64. Sin IP (por ejemplo, en local) todos comparten una clave fija: falla cerrado
// contra todos, no abierto.
export function claveDeIp(forwardedFor: string | null | undefined, secreto?: string): string {
  const primera = (forwardedFor ?? "").split(",")[0].trim().slice(0, 100);
  const ip = (primera && prefijoIpv6(primera)) || primera || "sin-ip";
  return claveHmac(`ip:${ip}`, secreto);
}

const desde = (ahora: Date, ms: number) => new Date(ahora.getTime() - ms);

// Intentos de esa clave dentro de la ventana, para el límite del formulario.
export async function contarIntentos(db: DbLimite, tipo: TipoLimite, clave: string, ahora = new Date()): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(intentosLimitados)
    .where(and(eq(intentosLimitados.tipo, tipo), eq(intentosLimitados.clave, clave), gt(intentosLimitados.creadoEn, desde(ahora, LIMITES[tipo].ventanaMs))));
  return n;
}

// El intento YA registrado pasó del máximo de la ventana.
export async function superaLimite(db: DbLimite, tipo: TipoLimite, clave: string, ahora = new Date()): Promise<boolean> {
  return (await contarIntentos(db, tipo, clave, ahora)) > LIMITES[tipo].maximo;
}

// Registra un intento y, de paso, borra los de más del doble de la ventana (sin tarea programada). Devuelve su id.
export async function registrarIntento(db: DbLimite, tipo: TipoLimite, clave: string, ahora = new Date()): Promise<number> {
  const [{ id }] = await db.insert(intentosLimitados).values({ tipo, clave, creadoEn: ahora }).returning({ id: intentosLimitados.id });
  await db
    .delete(intentosLimitados)
    .where(and(eq(intentosLimitados.tipo, tipo), lt(intentosLimitados.creadoEn, desde(ahora, 2 * LIMITES[tipo].ventanaMs))));
  return id;
}

// Cuenta un intento nuevo y dice si SUPERA el límite (true = rechazarlo). Se registra primero y se cuenta después:
// aunque lleguen muchas peticiones en paralelo, solo las primeras `maximo` quedan bajo el tope. Un intento rechazado
// NO se conserva: si siguiera contando, quien insiste mantendría el bloqueo sin fin (un atacante podría bloquear a
// un responsable para siempre con un intento cada pocos minutos). Así el bloqueo vence cuando los `maximo` intentos
// aceptados salen de la ventana.
export async function intentar(db: DbLimite, tipo: TipoLimite, clave: string, ahora = new Date()): Promise<boolean> {
  const id = await registrarIntento(db, tipo, clave, ahora);
  if (!(await superaLimite(db, tipo, clave, ahora))) return false;
  await db.delete(intentosLimitados).where(eq(intentosLimitados.id, id));
  return true;
}

// Tras un acierto de login, los fallos de ese correo dejan de contar.
export async function limpiarIntentos(db: DbLimite, tipo: TipoLimite, clave: string): Promise<void> {
  await db.delete(intentosLimitados).where(and(eq(intentosLimitados.tipo, tipo), eq(intentosLimitados.clave, clave)));
}
