"use client";

import { useEffect } from "react";

// Si la base no responde se muestra esto y nunca un avance en cero (TECH-DESIGN). No se muestra el error al
// visitante; en el log queda solo su tipo.
export default function ErrorProyectos({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("proyectos públicos:", error.name);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">No pudimos cargar los proyectos</h1>
      <p className="mt-3">
        Tuvimos un problema para consultar la información en este momento. Por favor, inténtalo de nuevo en unos
        minutos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-marca px-6 py-3 text-base font-semibold text-marca-texto hover:opacity-90"
      >
        Reintentar
      </button>
    </div>
  );
}
