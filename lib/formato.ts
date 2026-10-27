// Solo presentación. Los montos llegan como texto exacto ("5400.00") y se agrupan por miles con texto, sin
// convertirlos a coma flotante.
export function formatearSoles(monto: string): string {
  const [entero, decimales = "00"] = monto.split(".");
  return `S/ ${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimales}`;
}

export const formatearCantidad = (n: number) => n.toLocaleString("es-PE");
