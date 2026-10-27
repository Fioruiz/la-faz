import Link from "next/link";

export default function ProyectoNoEncontrado() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Proyecto no encontrado</h1>
      <p className="mt-3">No encontramos ese proyecto. Puede que el enlace sea antiguo.</p>
      <p className="mt-6">
        <Link href="/nuestros-proyectos" className="font-semibold text-marca underline underline-offset-4">
          Ver todos los proyectos
        </Link>
      </p>
    </div>
  );
}
