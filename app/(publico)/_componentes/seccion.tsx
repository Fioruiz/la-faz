import type { ReactNode } from "react";

// Etiqueta pequeña + titular (h2) + contenido. El h1 de cada página lo pone la página.
export function Seccion({
  id,
  etiqueta,
  titular,
  children,
  suave = false,
}: {
  id?: string;
  etiqueta: string;
  titular: string;
  children: ReactNode;
  suave?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titulo` : undefined} className={suave ? "bg-marca-suave" : ""}>
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <p className="text-sm font-bold tracking-widest text-marca">{etiqueta}</p>
        <h2 id={id ? `${id}-titulo` : undefined} className="mt-2 max-w-3xl text-2xl font-bold tracking-tight md:text-3xl">
          {titular}
        </h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}
