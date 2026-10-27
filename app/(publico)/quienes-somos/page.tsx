import { HISTORIA, QUIENES_SOMOS } from "@/lib/sitio-contenido";
import { LineaDeTiempo } from "../_componentes/linea-de-tiempo";
import { Seccion } from "../_componentes/seccion";

export const metadata = {
  title: "Quiénes somos – ONG La FAZ",
  description:
    "Conoce el origen, la historia y el trabajo de La FAZ en Ventanilla (Callao), Chepén e Ica.",
};

export default function QuienesSomosPage() {
  return (
    <>
      <section className="bg-marca-suave">
        <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
          <p className="text-sm font-bold tracking-widest text-marca">{QUIENES_SOMOS.etiqueta}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">{QUIENES_SOMOS.titular}</h1>
          <div className="mt-6 max-w-3xl space-y-4">
            {QUIENES_SOMOS.parrafos.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <Seccion id="historia" etiqueta={HISTORIA.etiqueta} titular={HISTORIA.titular}>
        <LineaDeTiempo />
      </Seccion>
    </>
  );
}
