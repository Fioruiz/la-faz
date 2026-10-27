"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU, NOMBRE_ONG } from "@/lib/sitio-contenido";

export function Cabecera() {
  const ruta = usePathname();
  return (
    <header className="border-b border-publico-borde bg-publico-tarjeta">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight text-marca">
          ONG {NOMBRE_ONG}
        </Link>
        <nav aria-label="Principal">
          <ul className="flex flex-wrap gap-x-1 gap-y-1">
            {MENU.map((item) => {
              const actual = item.href === "/" ? ruta === "/" : ruta.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={actual ? "page" : undefined}
                    className={`inline-block rounded-lg px-3 py-2 text-base font-medium ${
                      actual ? "bg-marca text-marca-texto" : "text-foreground hover:bg-marca-suave"
                    }`}
                  >
                    {item.texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
