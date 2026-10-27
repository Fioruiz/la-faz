import Link from "next/link";
import { AVISO_SIMULACION, DONACION_PRODUCTOS, MEDIOS_DONACION } from "@/lib/sitio-contenido";
import { AvisoSimulacion } from "../_componentes/aviso-simulacion";

export const metadata = {
  title: "Cómo donar – ONG La FAZ",
  description:
    "Formas de apoyar a La FAZ: Yape, Plin, transferencia bancaria nacional e internacional, y donación de productos (datos de demostración).",
};

export default function ComoDonarPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Cómo donar</h1>
      <p className="mt-3 max-w-3xl">
        Estas son las formas de apoyar a La FAZ. Cada aporte nos ayuda a seguir acompañando a quienes más lo necesitan.
      </p>

      <div className="mt-8">
        <AvisoSimulacion />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {MEDIOS_DONACION.map((medio) => (
          <section
            key={medio.id}
            aria-labelledby={`medio-${medio.id}`}
            className="rounded-2xl border border-publico-borde bg-publico-tarjeta p-6"
          >
            <p className="inline-block rounded-full bg-marca-suave px-3 py-0.5 text-sm font-semibold text-marca">
              {AVISO_SIMULACION.etiquetaMedio}
            </p>
            <h2 id={`medio-${medio.id}`} className="mt-3 text-xl font-bold">
              {medio.nombre}
            </h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              {medio.pasos.map((paso) => (
                <li key={paso}>{paso}</li>
              ))}
            </ol>
            <dl className="mt-4 space-y-1 rounded-xl bg-marca-suave p-4">
              {medio.datos.map((d) => (
                <div key={d.etiqueta} className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold">{d.etiqueta}:</dt>
                  <dd className="break-all">{d.valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section aria-labelledby="productos" className="mt-10 rounded-2xl border border-publico-borde bg-publico-tarjeta p-6">
        <h2 id="productos" className="text-xl font-bold">
          {DONACION_PRODUCTOS.titulo}
        </h2>
        <p className="mt-2 max-w-3xl">{DONACION_PRODUCTOS.texto}</p>
        <p className="mt-3">
          <Link href={DONACION_PRODUCTOS.enlaceHref} className="font-semibold text-marca underline underline-offset-4">
            {DONACION_PRODUCTOS.enlaceTexto}
          </Link>
        </p>
      </section>
    </div>
  );
}
