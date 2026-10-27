"use server";

import { AuthError } from "next-auth";
import { credencialesSchema } from "@/lib/auth-credentials";
import { signIn } from "@/lib/auth";

export type EstadoLogin = { error?: string };

// Un solo mensaje para contraseña incorrecta, correo inexistente y responsable desactivado.
const CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos.";
const DATOS_INVALIDOS = "Escribe un correo válido y tu contraseña.";
// Mismo texto para correos de responsables y para correos que no existen: no revela quién tiene cuenta.
const DEMASIADOS_INTENTOS = "Demasiados intentos. Espera 15 minutos antes de volver a intentar.";
const ERROR_GENERICO = "No pudimos iniciar sesión. Intenta de nuevo en unos minutos.";

export async function iniciarSesion(_previo: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const entrada = { correo: formData.get("correo"), password: formData.get("password") };
  if (!credencialesSchema.safeParse(entrada).success) return { error: DATOS_INVALIDOS };

  try {
    await signIn("credentials", { ...entrada, redirectTo: "/panel" });
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.type === "CredentialsSignin" && (e as { code?: string }).code === "bloqueado") return { error: DEMASIADOS_INTENTOS };
      return { error: e.type === "CredentialsSignin" ? CREDENCIALES_INVALIDAS : ERROR_GENERICO };
    }
    throw e; // el redirect de signIn también llega aquí y debe seguir su curso
  }
  return {};
}
