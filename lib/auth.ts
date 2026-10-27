import "server-only";

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { LoginBloqueadoError, autenticarResponsable } from "./auth-credentials";
import { SESION_MAX_AGE_SEGUNDOS, jwtCallback, sessionCallback } from "./auth-config";
import { getDb } from "./db-client";

// Para que el formulario muestre el mensaje de espera (el resto de fallos siguen siendo CredentialsSignin genérico).
export class LoginBloqueado extends CredentialsSignin {
  code = "bloqueado";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESION_MAX_AGE_SEGUNDOS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { correo: {}, password: {} },
      // Un fallo de la base se propaga: el login lo muestra como error genérico, no como credenciales inválidas.
      async authorize(credentials) {
        try {
          const responsable = await autenticarResponsable(getDb(), credentials);
          return responsable ? { id: String(responsable.id) } : null;
        } catch (e) {
          if (e instanceof LoginBloqueadoError) throw new LoginBloqueado();
          throw e;
        }
      },
    }),
  ],
  callbacks: { jwt: jwtCallback, session: sessionCallback },
});
