import Link from "next/link";
import { VOLUNTARIOS } from "@/lib/sitio-contenido";
import { FormularioVoluntariado } from "./formulario";

export const metadata = {
  title: "Voluntariado – ONG La FAZ",
  description: "Súmate como voluntario de La FAZ: inscríbete con tu nombre y un contacto.",
};

// Única página pública con formulario (#13): la inscripción se guarda por la acción de actions.ts.
export default function VoluntariadoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
      <p className="text-sm font-bold tracking-widest text-marca">{VOLUNTARIOS.etiqueta}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{VOLUNTARIOS.titular}</h1>
      <p className="mt-4 max-w-3xl">{VOLUNTARIOS.texto}</p>
      <FormularioVoluntariado />
      <p className="mt-6">
        <Link href="/" className="font-semibold text-marca underline underline-offset-4">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
