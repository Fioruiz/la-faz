import Link from "next/link";
import { DATOS_LEGALES } from "@/lib/sitio-contenido";

export function Pie() {
  return (
    <footer className="border-t border-publico-borde bg-publico-tarjeta">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-publico-apagado">
        <p className="text-base font-semibold text-foreground">{DATOS_LEGALES.nombre}</p>
        <p className="mt-1">{DATOS_LEGALES.razonSocial}</p>
        <p className="mt-3">{DATOS_LEGALES.descripcion}</p>
        <p className="mt-4">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            Acceso responsables
          </Link>
        </p>
      </div>
    </footer>
  );
}
