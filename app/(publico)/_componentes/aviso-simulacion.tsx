import { AVISO_SIMULACION } from "@/lib/sitio-contenido";

// Aviso con texto (no depende solo del color) que va antes de cualquier dato de cuenta.
export function AvisoSimulacion() {
  return (
    <div role="note" className="rounded-2xl border-2 border-marca bg-marca-suave p-5">
      <p className="text-lg font-bold text-marca">⚠ {AVISO_SIMULACION.titulo}</p>
      <p className="mt-1">{AVISO_SIMULACION.texto}</p>
    </div>
  );
}
