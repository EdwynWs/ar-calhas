import { createApp } from "./app.js";
import { accessConfig } from "./private-access.js";
const access = accessConfig(); // Validação ocorre antes de abrir o banco ou escutar conexões.
const { app, db } = createApp(
  process.env.DB_PATH || "./data/ar-calhas.sqlite",
  { access },
);
const server = app.listen(access.port, access.bind, () =>
  console.log(
    `AR Calhas: ${access.bind}:${access.port} · acesso ${access.mode}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
