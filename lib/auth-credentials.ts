import { eq } from "drizzle-orm";
import { z } from "zod";
import type { getDb } from "./db-client";
import { claveHmac, limpiarIntentos, registrarIntento, superaLimite, type DbLimite } from "./limite-intentos";
import { compararConHashFicticio, verificarPassword } from "./password";
import { responsables } from "./schema";

// Solo hace falta leer: así sirve tanto la conexión normal como una transacción de pruebas.
export type LectorDb = Pick<ReturnType<typeof getDb>, "select">;

export const credencialesSchema = z.object({
  correo: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  // El tope evita hashear entradas enormes.
  password: z.string().min(1).max(200),
});

export type Credenciales = z.infer<typeof credencialesSchema>;

// El correo acumuló demasiados fallos (ADR 0011). Se cuenta igual para correos existentes e inexistentes, así que
// avisarlo no revela quién es responsable. lib/auth.ts lo convierte en un error de Auth.js.
export class LoginBloqueadoError extends Error {
  constructor() {
    super("Demasiados intentos de inicio de sesión");
    this.name = "LoginBloqueadoError";
  }
}

// Devuelve el id del responsable o null. No distingue correo inexistente, contraseña
// incorrecta ni responsable desactivado: el login muestra un solo mensaje.
// Límite de intentos (ADR 0011). Se REGISTRA el intento primero y se cuenta después: con peticiones en paralelo solo
// las primeras 5 quedan bajo el tope y llegan a comprobar la contraseña; el resto se rechaza sin tocarla. Un acierto
// borra los intentos del correo; un fallo (incluidos correo inexistente y responsable desactivado) los deja. Si la base
// falla, el error se propaga: nunca se da acceso sin contar.
export async function autenticarResponsable(db: DbLimite, entrada: unknown): Promise<{ id: number } | null> {
  const parsed = credencialesSchema.safeParse(entrada);
  if (!parsed.success) return null;
  const { correo, password } = parsed.data;

  const clave = claveHmac(correo);
  await registrarIntento(db, "login", clave);
  if (await superaLimite(db, "login", clave)) throw new LoginBloqueadoError();

  const [responsable] = await db
    .select({ id: responsables.id, passwordHash: responsables.passwordHash, activo: responsables.activo })
    .from(responsables)
    .where(eq(responsables.correo, correo))
    .limit(1);

  if (!responsable) {
    await compararConHashFicticio(password);
    return null;
  }

  const coincide = await verificarPassword(password, responsable.passwordHash);
  if (!coincide || !responsable.activo) return null;
  await limpiarIntentos(db, "login", clave);
  return { id: responsable.id };
}
