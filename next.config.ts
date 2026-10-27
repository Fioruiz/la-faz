import type { NextConfig } from "next";

const desarrollo = process.env.NODE_ENV !== "production";

// Cabeceras de seguridad (ADR 0011). La CSP deja 'unsafe-inline' en scripts y estilos porque Next inserta scripts en
// línea para hidratar y no usamos nonces; lo importante aquí es que NADA externo se cargue (todo 'self'), que no se
// pueda incrustar el sitio en otro (frame-ancestors) y que los formularios solo envíen al propio sitio. En desarrollo
// se añade lo que Next necesita (eval y websocket de la recarga en caliente).
export const construirCsp = (enDesarrollo: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${enDesarrollo ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: construirCsp(desarrollo) },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
