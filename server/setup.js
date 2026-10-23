import { openDb } from "./db.js";
import { seedDemo } from "./demo.js";
const db = openDb(process.env.DB_PATH || "./data/ar-calhas.sqlite");
try {
  if (process.argv.includes("--demo")) {
    if (db.prepare("SELECT COUNT(*) n FROM users").get().n)
      throw new Error(
        "Não insira exemplos em um banco antigo. Use outro DB_PATH vazio para demonstração.",
      );
    seedDemo(db);
    console.log("Exemplos inseridos em banco separado.");
  } else
    console.log(
      "Banco pronto. A versão 2 abre diretamente e exige acesso local ou rede privada configurada.",
    );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
