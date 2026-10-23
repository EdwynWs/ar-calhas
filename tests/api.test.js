import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.js";
import { openDb } from "../server/db.js";
import { accessConfig, privateAccess } from "../server/private-access.js";
import { summary, parseMoney } from "../src/utils.js";

test("Rede privada: bloqueio por padrão e sem confiar em proxy", () => {
  assert.throws(() => accessConfig({ BIND_HOST: "0.0.0.0" }));
  assert.throws(() => accessConfig({ ACCESS_MODE: "public" }));
  assert.throws(() =>
    accessConfig({ ACCESS_MODE: "private", BIND_HOST: "0.0.0.0" }),
  );
  assert.throws(() =>
    accessConfig({ ACCESS_MODE: "private", BIND_HOST: "192.168.1.10" }),
  );
  assert.throws(() =>
    accessConfig({
      ACCESS_MODE: "private",
      BIND_HOST: "192.168.1.10",
      ALLOWED_CLIENT_IPS: "192.168.1.0/24",
      ALLOWED_ORIGINS: "http://192.168.1.10:4000",
    }),
  );
  assert.throws(() =>
    accessConfig({
      ACCESS_MODE: "private",
      BIND_HOST: "192.168.1.10",
      ALLOWED_CLIENT_IPS: "192.168.1.20",
      ALLOWED_ORIGINS: "https://public.example.com",
    }),
  );
  const config = accessConfig({
    ACCESS_MODE: "private",
    BIND_HOST: "100.80.1.2",
    ALLOWED_CLIENT_IPS: "100.80.1.3",
    ALLOWED_ORIGINS: "http://100.80.1.2:4000",
  });
  const check = (ip, headers = {}, method = "GET") => {
    let outcome;
    const req = {
      socket: { remoteAddress: ip },
      headers: { host: "100.80.1.2:4000", ...headers },
      method,
      get(name) {
        return this.headers[name.toLowerCase()];
      },
      is() {
        return true;
      },
    };
    const res = {
      status(n) {
        outcome = n;
        return this;
      },
      json() {
        return this;
      },
    };
    privateAccess(config)(req, res, () => (outcome = 200));
    return outcome;
  };
  assert.equal(check("100.80.1.3"), 200);
  assert.equal(check("::ffff:100.80.1.3"), 200);
  assert.equal(check("100.80.1.99"), 403);
  assert.equal(check("8.8.8.8"), 403);
  assert.equal(check("8.8.8.8", { "x-forwarded-for": "100.80.1.3" }), 403);
  assert.equal(check("100.80.1.3", { "x-forwarded-for": "100.80.1.3" }), 403);
  assert.equal(check("100.80.1.3", { host: "public.example.com" }), 403);
  assert.equal(
    check("100.80.1.3", { origin: "https://evil.example.com" }),
    403,
  );
  assert.equal(check("100.80.1.3", { "sec-fetch-site": "cross-site" }), 403);
});

test("Conversão monetária sem arredondamentos ambíguos", () => {
  assert.equal(parseMoney("1.350,50"), 135050);
  assert.equal(parseMoney("350,50"), 35050);
  assert.equal(parseMoney("350.50"), 35050);
  assert.equal(parseMoney("0,01"), 1);
  assert.equal(parseMoney("-1"), null);
  assert.equal(parseMoney("1.001"), null);
  assert.equal(parseMoney("3e4"), null);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("1.2,34"), null);
  assert.equal(parseMoney("1..350,50"), null);
  assert.equal(parseMoney("1.350.000,50"), 135000050);
});

test("Banco antigo, dinheiro, orçamento e recuperação", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ar-v2-")),
    path = join(dir, "old.sqlite");
  // Representa o esquema v1, inclusive tabelas antigas de login e etapas já usadas.
  let old = openDb(path);
  old.exec(
    "INSERT INTO users VALUES(1,'Dono antigo','antigo@example.com','hash-legado'); INSERT INTO sessions VALUES('sessao-antiga',1,9999999999999); INSERT INTO clients(id,name,phone) VALUES(1,'Cliente antigo','14999999999'); INSERT INTO events(id,title,date,time,clientId) VALUES(1,'Visita antiga','2026-10-10','09:00',1); INSERT INTO audit(userId,action,entity,recordId) VALUES(1,'create','clients',1);",
  );
  for (const [id, stage] of [
    [1, "Produção"],
    [2, "Instalação"],
  ])
    old
      .prepare(
        "INSERT INTO quotes(id,clientId,title,date,validUntil,status,jobStatus,items,totalCents) VALUES(?,1,?,'2026-10-01','2026-12-30','Aprovado',?,?,10000)",
      )
      .run(
        id,
        "Serviço antigo " + id,
        stage,
        JSON.stringify([
          {
            description: "Calha",
            quantity: 1,
            unit: "m",
            unitPriceCents: 10000,
          },
        ]),
      );
  old.exec(
    "INSERT INTO transactions(id,type,description,category,amountCents,dueDate,paidDate,status,method,clientId) VALUES(1,'income','Recebimento antigo','Instalações',40000,'2026-10-01','2026-10-01','paid','Pix',1); UPDATE settings SET initialBalanceCents=50000,monthlyGoalCents=2500000;",
  );
  const tables = [
    "users",
    "sessions",
    "settings",
    "clients",
    "quotes",
    "transactions",
    "events",
    "audit",
  ];
  const before = Object.fromEntries(
    tables.map((name) => [
      name,
      old
        .prepare(`SELECT * FROM ${name}`)
        .all()
        .map((r) => ({ ...r })),
    ]),
  );
  old.exec(
    "DROP TABLE request_keys; DROP TABLE deleted_records; PRAGMA user_version=0",
  );
  old.close();
  const access = accessConfig({ PORT: "4100", NODE_ENV: "production" });
  const { app, db } = createApp(path, { access });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(url, method = "GET", body, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = request(
        base + url,
        {
          method,
          headers: {
            Host: "127.0.0.1:4100",
            Origin: "http://127.0.0.1:4100",
            "Content-Type": "application/json",
            "X-AR-Request": "1",
            "X-Request-ID": randomUUID(),
            ...(body === undefined
              ? {}
              : { "Content-Length": Buffer.byteLength(JSON.stringify(body)) }),
            ...headers,
          },
        },
        (response) => {
          let raw = "";
          response.on("data", (c) => (raw += c));
          response.on("end", () => {
            let data;
            try {
              data = JSON.parse(raw);
            } catch {
              data = raw;
            }
            resolve({ status: response.statusCode, body: data });
          });
        },
      );
      req.on("error", reject);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
  let clientId, quoteId, tx;
  try {
    await t.test(
      "preserva todas as linhas v1 e cria backup consistente antes da migração",
      () => {
        for (const name of tables)
          assert.deepEqual(
            db
              .prepare(`SELECT * FROM ${name}`)
              .all()
              .map((r) => ({ ...r })),
            before[name],
          );
        const files = readdirSync(join(dir, "migration-backups"));
        assert.equal(files.length, 1);
        const copy = new DatabaseSync(join(dir, "migration-backups", files[0]));
        assert.equal(copy.prepare("PRAGMA user_version").get().user_version, 0);
        for (const name of tables)
          assert.deepEqual(
            copy
              .prepare(`SELECT * FROM ${name}`)
              .all()
              .map((r) => ({ ...r })),
            before[name],
          );
        copy.close();
      },
    );
    await t.test(
      "acesso direto não depende de usuário, senha ou sessão",
      async () => {
        assert.equal((await call("/api/data")).status, 200);
        for (const route of ["me", "login", "logout", "password"])
          assert.equal(
            (
              await call(
                "/api/" + route,
                route === "me" ? "GET" : "POST",
                route === "me" ? undefined : {},
              )
            ).status,
            404,
          );
        assert.ok((await call("/api/data")).body.events.length);
      },
    );
    await t.test(
      "protege também HTML, arquivos estáticos e exportação",
      async () => {
        for (const route of [
          "/",
          "/favicon.svg",
          "/api/data",
          "/api/export",
          "/api/health",
        ]) {
          assert.equal(
            (await call(route, "GET", undefined, { Host: "evil.example.com" }))
              .status,
            403,
          );
          assert.equal(
            (
              await call(route, "GET", undefined, {
                Origin: "https://evil.example.com",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await call(route, "GET", undefined, {
                "X-Forwarded-For": "127.0.0.1",
              })
            ).status,
            403,
          );
        }
        assert.equal(
          (
            await call(
              "/api/clients",
              "POST",
              { name: "Bloqueado" },
              { Origin: "" },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call(
              "/api/clients",
              "POST",
              { name: "Bloqueado" },
              { "X-AR-Request": "" },
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "salvar duas vezes com a mesma chave cria um só cliente",
      async () => {
        const key = randomUUID(),
          body = { name: "Cliente novo", phone: "14988887777" };
        const a = await call("/api/clients", "POST", body, {
            "X-Request-ID": key,
          }),
          b = await call("/api/clients", "POST", body, { "X-Request-ID": key });
        assert.equal(a.status, 201);
        assert.deepEqual(a.body, b.body);
        clientId = a.body.id;
        assert.equal(
          (
            await call(
              "/api/clients",
              "POST",
              { name: "Outro" },
              { "X-Request-ID": key },
            )
          ).status,
          409,
        );
      },
    );
    await t.test("recalcula orçamento e protege conta única", async () => {
      const q = await call("/api/quotes", "POST", {
        clientId,
        title: "Calha",
        date: "2026-10-01",
        validUntil: "2026-11-30",
        status: "Aprovado",
        items: [
          {
            description: "Calha",
            quantity: 12.5,
            unit: "m",
            unitPriceCents: 10001,
          },
        ],
        discountCents: 1000,
        totalCents: 1,
      });
      assert.equal(q.status, 201);
      quoteId = q.body.id;
      assert.equal(
        (await call("/api/data")).body.quotes.find((x) => x.id === quoteId)
          .totalCents,
        124013,
      );
      const key = randomUUID();
      const a = await call(
          `/api/quotes/${quoteId}/invoice`,
          "POST",
          { dueDate: "2026-10-30" },
          { "X-Request-ID": key },
        ),
        b = await call(
          `/api/quotes/${quoteId}/invoice`,
          "POST",
          { dueDate: "2026-10-30" },
          { "X-Request-ID": key },
        );
      assert.equal(a.status, 201);
      assert.deepEqual(a.body, b.body);
      assert.equal(
        (
          await call(`/api/quotes/${quoteId}/invoice`, "POST", {
            dueDate: "2026-10-30",
          })
        ).status,
        409,
      );
      tx = (await call("/api/data")).body.transactions.find(
        (x) => x.quoteId === quoteId,
      );
    });
    await t.test(
      "orçamento e pendência não somam no dinheiro recebido",
      async () => {
        const s = summary(
          (await call("/api/data")).body.transactions,
          "2026-10",
          50000,
        );
        assert.equal(s.balance, 90000);
        assert.equal(s.income, 40000);
        assert.equal(s.receivable, 124013);
        assert.equal(
          (
            await call("/api/transactions/" + tx.id, "PUT", {
              ...tx,
              amountCents: 100,
            })
          ).status,
          400,
        );
        assert.equal(
          (await call("/api/quotes/" + quoteId, "DELETE", {})).status,
          400,
        );
      },
    );
    await t.test(
      "pagamento repetido não duplica e conta pela data efetiva",
      async () => {
        const body = { ...tx, status: "paid", paidDate: "2026-11-02" };
        assert.equal(
          (await call("/api/transactions/" + tx.id, "PUT", body)).status,
          200,
        );
        assert.equal(
          (await call("/api/transactions/" + tx.id, "PUT", body)).status,
          200,
        );
        const rows = (await call("/api/data")).body.transactions;
        assert.equal(summary(rows, "2026-10").income, 40000);
        assert.equal(summary(rows, "2026-11").income, 124013);
      },
    );
    await t.test(
      "valida dinheiro e datas e impede duplicidade no gasto",
      async () => {
        const b = {
            type: "expense",
            description: "Chapas",
            category: "Materiais",
            amountCents: 35000,
            dueDate: "2026-11-02",
            paidDate: "2026-11-02",
            status: "paid",
            method: "Dinheiro",
          },
          key = randomUUID();
        const a = await call("/api/transactions", "POST", b, {
            "X-Request-ID": key,
          }),
          c = await call("/api/transactions", "POST", b, {
            "X-Request-ID": key,
          });
        assert.equal(a.status, 201);
        assert.deepEqual(a.body, c.body);
        for (const invalid of [
          { amountCents: -1 },
          { amountCents: 1.1 },
          { paidDate: "2026-02-30" },
          { paidDate: "" },
        ])
          assert.equal(
            (await call("/api/transactions", "POST", { ...b, ...invalid }))
              .status,
            400,
          );
        const s = summary(
          (await call("/api/data")).body.transactions,
          "2026-11",
          50000,
        );
        assert.deepEqual([s.expense, s.balance], [35000, 179013]);
      },
    );
    await t.test(
      "permite excluir, recuperar e evita reutilizar o número excluído",
      async () => {
        const a = await call("/api/clients", "POST", { name: "Acidental" }),
          d = await call("/api/clients/" + a.body.id, "DELETE", {});
        assert.equal(d.status, 200);
        const newer = await call("/api/clients", "POST", {
          name: "Outro cliente",
        });
        assert.ok(newer.body.id > a.body.id);
        assert.equal(
          (await call("/api/deleted/" + d.body.undoId + "/restore", "POST", {}))
            .status,
          200,
        );
        assert.ok(
          (await call("/api/data")).body.clients.some(
            (c) => c.id === a.body.id,
          ),
        );
        assert.equal(
          (await call("/api/deleted/" + d.body.undoId + "/restore", "POST", {}))
            .status,
          409,
        );
        assert.equal(
          (await call("/api/clients/" + clientId, "DELETE", {})).status,
          400,
        );
      },
    );
    await t.test(
      "recupera dinheiro excluído com o mesmo valor e vínculos",
      async () => {
        const original = (await call("/api/data")).body.transactions.find(
          (t) => t.id === tx.id,
        );
        const d = await call("/api/transactions/" + tx.id, "DELETE", {});
        assert.equal(d.status, 200);
        assert.equal(
          (await call("/api/deleted/" + d.body.undoId + "/restore", "POST", {}))
            .status,
          200,
        );
        assert.deepEqual(
          (await call("/api/data")).body.transactions.find(
            (t) => t.id === tx.id,
          ),
          original,
        );
      },
    );
    await t.test(
      "atualiza serviços sem alterar valores ou etapas antigas inadvertidamente",
      async () => {
        assert.equal(
          (
            await call("/api/quotes/1/progress", "PATCH", {
              scheduledDate: "2026-12-10",
            })
          ).status,
          200,
        );
        let q = (await call("/api/data")).body.quotes.find((q) => q.id === 1);
        assert.equal(q.jobStatus, "Produção");
        assert.equal(
          (
            await call("/api/quotes/2/progress", "PATCH", {
              jobStatus: "Concluído",
            })
          ).status,
          200,
        );
        q = (await call("/api/data")).body.quotes.find((q) => q.id === 2);
        assert.equal(q.totalCents, 10000);
        assert.equal(q.jobStatus, "Concluído");
      },
    );
    await t.test(
      "exportação e auditoria não expõem usuários nem sessões",
      async () => {
        const r = await call("/api/export");
        assert.equal(r.status, 200);
        assert.equal(r.body.users, undefined);
        assert.equal(r.body.sessions, undefined);
        assert.ok(
          db.prepare("SELECT * FROM audit WHERE userId IS NULL").all().length,
        );
        assert.equal(db.prepare("SELECT COUNT(*) n FROM events").get().n, 1);
        const backup = join(dir, "backup.sqlite");
        db.prepare("VACUUM INTO ?").run(backup);
        const copy = new DatabaseSync(backup);
        assert.equal(
          copy.prepare("SELECT COUNT(*) n FROM transactions").get().n,
          3,
        );
        copy.close();
      },
    );
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
