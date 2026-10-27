import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

// La caducidad ya no es el mecanismo de revocación (ADR 0009): eso lo hace requireResponsableActivo().
export const SESION_MAX_AGE_SEGUNDOS = 7 * 24 * 60 * 60;

// El JWT lleva solo el id del responsable. No se copian correo, nombre ni `activo`.
export function jwtCallback({ token, user }: { token: JWT; user?: { id?: string } }): JWT {
  if (user?.id) return { sub: user.id };
  return token.sub ? { sub: token.sub } : {};
}

export function sessionCallback({ session, token }: { session: Session; token: JWT }): Session {
  return { expires: session.expires, user: { id: token.sub ?? "" } } as Session;
}
