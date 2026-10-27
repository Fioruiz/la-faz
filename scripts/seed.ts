import { getDb, getPool } from "../lib/db-client";
import { sembrarProyectos } from "./seed-proyectos";

sembrarProyectos(getDb())
  .then(() => console.log("Proyectos iniciales cargados"))
  .catch((e: Error) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
