import { HITOS } from "@/lib/sitio-contenido";

// Lista ordenada: el año va dentro de cada hito para que un lector de pantalla lo lea con su frase.
export function LineaDeTiempo() {
  return (
    <ol className="relative ml-3 border-l-2 border-publico-borde">
      {HITOS.map((hito, i) => (
        <li key={i} className="relative pb-10 pl-8 last:pb-0">
          <span aria-hidden className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-4 border-publico-fondo bg-marca" />
          <p className="inline-block rounded-full bg-marca px-3 py-0.5 text-sm font-bold text-marca-texto">{hito.anio}</p>
          <h3 className="mt-2 text-lg font-bold md:text-xl">{hito.frase}</h3>
          <p className="mt-1 max-w-2xl text-publico-apagado">{hito.descripcion}</p>
        </li>
      ))}
    </ol>
  );
}
