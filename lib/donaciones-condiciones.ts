import { and, eq, type SQL } from "drizzle-orm";
import { donaciones } from "./schema";

// ÚNICA definición de qué donaciones cuentan: las no anuladas. La usan el avance (#9) y el reporte (#10), así
// que sus totales no pueden divergir. Nadie más escribe `anulada = false` por su cuenta.
export const esVigente: SQL = eq(donaciones.anulada, false);
// Lo contrario, para contar aparte las anuladas (el reporte las muestra fuera de los totales).
export const esAnulada: SQL = eq(donaciones.anulada, true);
export const esDineroVigente = and(eq(donaciones.tipo, "dinero"), esVigente) as SQL;
export const esProductoVigente = and(eq(donaciones.tipo, "producto"), esVigente) as SQL;
