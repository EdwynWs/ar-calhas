// Servidor exclusivo de testes. Nunca lê nem apaga o banco do .env.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../server/app.js";
import { accessConfig } from "../../server/private-access.js";
import { today, afterDays } from "../../src/utils.js";
const dir = mkdtempSync(join(tmpdir(), "ar-e2e-"));
const { app, db } = createApp(join(dir, "isolated.sqlite"), {
  access: accessConfig({ PORT: "4173", NODE_ENV: "production" }),
});
db.exec(
  "INSERT INTO clients(id,name,phone,address) VALUES(1,'Cliente Antigo','14999999999','Rua de exemplo, 10');",
);
db.prepare(
  "INSERT INTO quotes(id,clientId,title,date,validUntil,status,jobStatus,items,totalCents) VALUES(1,1,'Calhas antigas',?,?,'Enviado','Instalação',?,150000)",
).run(
  today(),
  afterDays(today(), 30),
  JSON.stringify([
    {
      description: "Instalação de calhas",
      quantity: 15,
      unit: "m",
      unitPriceCents: 10000,
    },
  ]),
);
db.prepare(
  "INSERT INTO transactions(type,description,category,amountCents,dueDate,status,method) VALUES('income','Dinheiro antigo por receber','Instalações',20000,?,'pending','Pix')",
).run("2025-01-01");
db.prepare(
  "INSERT INTO events(title,date,time,clientId) VALUES('Visita anotada antes',?,'09:00',1)",
).run(today());
const server = app.listen(4173, "127.0.0.1", () =>
  console.log("Servidor isolado pronto: 4173"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
      process.exit(0);
    }),
  );
