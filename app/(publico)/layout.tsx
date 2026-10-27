import { Cabecera } from "./_componentes/cabecera";
import { Pie } from "./_componentes/pie";

export default function PublicoLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="publico flex flex-1 flex-col bg-publico-fondo text-base leading-relaxed text-foreground md:text-lg">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-marca focus:px-4 focus:py-2 focus:text-marca-texto"
      >
        Saltar al contenido
      </a>
      <Cabecera />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Pie />
    </div>
  );
}
