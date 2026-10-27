import Link from "next/link";

export default function ProyectoNoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Proyecto no encontrado</h1>
      <Link href="/proyectos" className="underline">← Proyectos</Link>
    </main>
  );
}
