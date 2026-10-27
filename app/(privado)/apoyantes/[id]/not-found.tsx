import Link from "next/link";

export default function ApoyanteNoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Apoyante no encontrado</h1>
      <Link href="/apoyantes" className="underline">← Apoyantes</Link>
    </main>
  );
}
