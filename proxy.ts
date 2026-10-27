import { auth } from "@/lib/auth";
import { redirigirSinSesion } from "@/lib/proxy-redireccion";

// Filtro grueso: solo mira si hay sesión. No consulta la base ni es la barrera de seguridad
// (ADR 0009); eso lo hace requireResponsableActivo() en cada lectura y escritura privada.
export const proxy = auth((req) => redirigirSinSesion(Boolean(req.auth), req.nextUrl));

export const config = {
  matcher: ["/panel/:path*", "/proyectos/:path*", "/apoyantes/:path*", "/donaciones/:path*", "/reportes/:path*", "/voluntarios/:path*"],
};
