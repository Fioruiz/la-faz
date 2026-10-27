"use client";

import type { ReactNode } from "react";
import type { ResultadoAccion } from "@/lib/escritura-auditada-core";

export type Accion<T = { id: number }> = (previo: ResultadoAccion<T> | null, datos: FormData) => Promise<ResultadoAccion<T>>;

export const entrada = "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
export const boton = "rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

// Mensajes de un resultado: regla o error al pie del formulario; "Cambios guardados" tras un éxito.
export function Mensajes({ estado, exito }: { estado: ResultadoAccion<unknown> | null; exito?: string }) {
  if (!estado) return null;
  if (estado.ok) return exito ? <p role="status" className="text-sm text-green-700 dark:text-green-400">{exito}</p> : null;
  if (estado.tipo === "regla" || estado.tipo === "error") {
    return <p role="alert" className="text-sm text-red-700 dark:text-red-400">{estado.mensaje}</p>;
  }
  // La advertencia pide confirmar: el formulario que la usa añade su propio botón.
  if (estado.tipo === "advertencia") {
    return <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">{estado.mensaje}</p>;
  }
  return null;
}

// Lo que se muestra en un campo: lo que la persona escribió si hubo error de validación; si no, el valor guardado.
export function useCampos(estado: ResultadoAccion<unknown> | null) {
  const validacion = estado && !estado.ok && estado.tipo === "validacion" ? estado : null;
  return {
    valor: (campo: string, guardado: string | number | null | undefined) =>
      validacion ? (validacion.valores[campo] ?? "") : String(guardado ?? ""),
    marcada: (campo: string, guardada: boolean) => (validacion ? validacion.valores[campo] === "on" : guardada),
    error: (campo: string) => validacion?.errores[campo]?.[0],
  };
}

export function Campo({ etiqueta, error, children }: { etiqueta: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {etiqueta}
      {children}
      {error && <span role="alert" className="text-red-700 dark:text-red-400">{error}</span>}
    </label>
  );
}
