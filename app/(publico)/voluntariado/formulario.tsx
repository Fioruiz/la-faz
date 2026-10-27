"use client";

import { useActionState } from "react";
import type { ResultadoInscripcion } from "@/lib/voluntariado-inscripcion-core";
import { CAMPO_TRAMPA_NOMBRE, CONSENTIMIENTO_VOLUNTARIADO } from "@/lib/sitio-contenido";
import { inscribirVoluntarioAccion } from "./actions";

const entrada =
  "w-full rounded-lg border border-publico-borde bg-publico-tarjeta px-3 py-2 text-base";

function Campo({ etiqueta, error, children }: { etiqueta: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 font-semibold">
      {etiqueta}
      {children}
      {error && (
        <span role="alert" className="text-sm font-normal text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

export function FormularioVoluntariado() {
  const [estado, accion, enviando] = useActionState<ResultadoInscripcion | null, FormData>(
    inscribirVoluntarioAccion,
    null,
  );

  if (estado?.ok) {
    return (
      <div role="status" className="mt-8 max-w-3xl rounded-2xl border-2 border-marca bg-marca-suave p-5">
        <p className="text-lg font-bold text-marca">¡Gracias por sumarte!</p>
        <p className="mt-1">Recibimos tu inscripción. Los responsables de La FAZ te contactarán.</p>
      </div>
    );
  }

  // Con error de validación o de guardado se conserva lo que la persona escribió.
  const validacion = estado && !estado.ok && (estado.tipo === "validacion" || "valores" in estado) ? estado : null;
  const valor = (campo: string) => validacion?.valores[campo] ?? "";
  const error = (campo: string) => (validacion && "errores" in validacion ? validacion.errores[campo]?.[0] : undefined);
  const falla = estado && !estado.ok && estado.tipo !== "validacion" ? estado : null;

  return (
    <form action={accion} className="mt-8 flex max-w-xl flex-col gap-5" noValidate>
      <Campo etiqueta="Nombre" error={error("nombre")}>
        <input name="nombre" defaultValue={valor("nombre")} maxLength={100} autoComplete="name" required className={entrada} />
      </Campo>
      <Campo etiqueta="Contacto (teléfono o correo)" error={error("contacto")}>
        <input name="contacto" defaultValue={valor("contacto")} maxLength={200} required className={entrada} />
      </Campo>
      <Campo etiqueta="Mensaje (opcional)" error={error("mensaje")}>
        <textarea name="mensaje" defaultValue={valor("mensaje")} maxLength={500} rows={4} className={entrada} />
      </Campo>

      {/* Campo trampa: oculto para personas y lectores de pantalla; los bots lo llenan. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No llenar este campo
          <input type="text" name={CAMPO_TRAMPA_NOMBRE} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="rounded-2xl border border-publico-borde bg-publico-tarjeta p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="consentimiento"
            defaultChecked={validacion?.valores.consentimiento === "on"}
            className="mt-1 size-5"
          />
          <span>{CONSENTIMIENTO_VOLUNTARIADO.texto}</span>
        </label>
        <p className="mt-2 text-sm text-marca">{CONSENTIMIENTO_VOLUNTARIADO.aviso}</p>
        {error("consentimiento") && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {error("consentimiento")}
          </p>
        )}
      </div>

      {falla && "mensaje" in falla && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {falla.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded-full bg-marca px-6 py-3 text-lg font-bold text-marca-texto disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Inscribirme"}
      </button>
    </form>
  );
}
