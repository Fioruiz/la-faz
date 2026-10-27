import Link from "next/link";
import {
  DESCRIPCION_ONG,
  LINEAS_DE_TRABAJO,
  QUIENES_SOMOS,
  VOLUNTARIOS,
} from "@/lib/sitio-contenido";
import { Seccion } from "./_componentes/seccion";

export const metadata = {
  title: "Inicio – ONG La FAZ",
  description:
    "La FAZ es una asociación sin fines de lucro que acompaña a personas, familias y comunidades en situación de vulnerabilidad en Perú.",
};

const BOTON =
  "inline-block rounded-xl px-6 py-3 text-center text-base font-semibold md:text-lg";

export default function InicioPage() {
  return (
    <>
      <section className="bg-marca-suave">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-20">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">ONG La FAZ</h1>
          <p className="mt-5 max-w-3xl text-lg md:text-xl">{DESCRIPCION_ONG}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/como-donar" className={`${BOTON} bg-marca text-marca-texto hover:opacity-90`}>
              Cómo donar
            </Link>
            <Link
              href={VOLUNTARIOS.href}
              className={`${BOTON} border-2 border-marca text-marca hover:bg-publico-tarjeta`}
            >
              {VOLUNTARIOS.boton}
            </Link>
          </div>
        </div>
      </section>

      <Seccion id="quienes-somos" etiqueta={QUIENES_SOMOS.etiqueta} titular={QUIENES_SOMOS.titular}>
        <p className="max-w-3xl">{QUIENES_SOMOS.parrafos[0]}</p>
        <p className="mt-4">
          <Link href="/quienes-somos#historia" className="font-semibold text-marca underline underline-offset-4">
            Conoce nuestra historia
          </Link>
        </p>
      </Seccion>

      <Seccion etiqueta="QUÉ HACEMOS" titular="Programas y proyectos sociales" suave>
        <ul className="grid gap-4 md:grid-cols-3">
          {LINEAS_DE_TRABAJO.map((linea) => (
            <li
              key={linea}
              className="rounded-2xl border border-publico-borde bg-publico-tarjeta p-5 text-lg font-semibold"
            >
              {linea}
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion id="voluntarios" etiqueta={VOLUNTARIOS.etiqueta} titular={VOLUNTARIOS.titular}>
        <p className="max-w-3xl">{VOLUNTARIOS.texto}</p>
        <Link
          href={VOLUNTARIOS.href}
          className={`${BOTON} mt-6 bg-marca text-marca-texto hover:opacity-90`}
        >
          {VOLUNTARIOS.boton}
        </Link>
      </Seccion>
    </>
  );
}
