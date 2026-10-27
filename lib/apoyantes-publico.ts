export const ANONIMO = "Anónimo";

// Única regla de cómo se presenta un apoyante en datos públicos: con la marca de anonimato
// puesta nunca sale su nombre. Las lecturas públicas (lib/public-queries.ts, ítem #12) deben
// usar esta función y no el campo `nombre` directamente.
export function nombrePublico(apoyante: { nombre: string; anonimoPublico?: boolean | null }): string {
  return apoyante.anonimoPublico ? ANONIMO : apoyante.nombre;
}
