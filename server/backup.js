import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "./db.js";
const db = openDb(process.env.DB_PATH || "./data/ar-calhas.sqlite");
try {
  mkdirSync("./backups", { recursive: true });
  const destination = resolve(
    `backups/ar-calhas-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
  );
  db.prepare("VACUUM INTO ?").run(destination);
  console.log(`Backup consistente criado: ${destination}`);
} finally {
  db.close();
}
