import { NextResponse } from "next/server";

// Decisión del proxy, separada para poder probarla sin levantar Next.
// Devuelve la redirección al login, o undefined para dejar pasar la petición.
export function redirigirSinSesion(tieneSesion: boolean, url: URL): NextResponse | undefined {
  if (tieneSesion) return undefined;
  return NextResponse.redirect(new URL("/login", url));
}
