import express from "express";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { openDb } from "./db.js";
import { accessConfig, privateAccess } from "./private-access.js";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const str = (v, label, max = 500) => {
  if (typeof v !== "string" || v.length > max)
    fail(`${label}: texto inválido.`);
  return v.trim();
};
const required = (v, label, max = 200) => {
  const s = str(v, label, max);
  if (!s) fail(`${label} é obrigatório.`);
  return s;
};
const integer = (v, label, min = 0, max = 100000000000) => {
  if (!Number.isSafeInteger(v) || v < min || v > max)
    fail(`${label}: valor inválido.`);
  return v;
};
const option = (v, values) => {
  if (!values.includes(v)) fail("Opção inválida.");
  return v;
};
const date = (v, optional = false) => {
  if (optional && !v) return "";
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail("Data inválida.");
  return v;
};
export function createApp(
  dbPath,
  { access = accessConfig(), staticDir = resolve("dist") } = {},
) {
  const db = openDb(dbPath),
    app = express();
  app.disable("x-powered-by");
  app.use(privateAccess(access));
  app.use(express.json({ limit: "256kb" }));
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  // Rotas de autenticação antigas não existem mais. As tabelas antigas são preservadas.
  const audit = (req, action, entity, id) =>
    db
      .prepare(
        "INSERT INTO audit(userId,action,entity,recordId) VALUES(?,?,?,?)",
      )
      .run(null, `${action} @ ${req.privatePeer}`, entity, id ?? null);
  const existsClient = (id) => {
    if (id === null || id === undefined || id === "") return null;
    integer(id, "Cliente", 1);
    if (!db.prepare("SELECT id FROM clients WHERE id=?").get(id))
      fail("Cliente não encontrado.");
    return id;
  };
  app.get("/api/data", (req, res) =>
    res.json({
      settings: db.prepare("SELECT * FROM settings").get(),
      clients: db.prepare("SELECT * FROM clients ORDER BY name").all(),
      quotes: db
        .prepare("SELECT * FROM quotes ORDER BY date DESC,id DESC")
        .all()
        .map((q) => ({ ...q, items: JSON.parse(q.items) })),
      transactions: db
        .prepare("SELECT * FROM transactions ORDER BY dueDate DESC,id DESC")
        .all(),
      events: db.prepare("SELECT * FROM events ORDER BY date,time").all(),
    }),
  );
  const nextId = (table) => {
    const active = db
      .prepare(`SELECT COALESCE(MAX(id),0) n FROM ${table}`)
      .get().n;
    const deleted = db
      .prepare(
        "SELECT COALESCE(MAX(json_extract(record,'$.id')),0) n FROM deleted_records WHERE entity=?",
      )
      .get(table).n;
    return Math.max(active, deleted) + 1;
  };
  const once = (req, scope, data, fn) => {
    const key = req.get("X-Request-ID");
    if (!key || !/^[0-9a-f-]{36}$/i.test(key))
      fail(
        "Não foi possível identificar esse salvamento. Atualize a página e tente novamente.",
      );
    const fingerprint = createHash("sha256")
      .update(scope + JSON.stringify(data))
      .digest("hex");
    db.exec("BEGIN IMMEDIATE");
    try {
      const saved = db
        .prepare("SELECT * FROM request_keys WHERE key=?")
        .get(key);
      if (saved) {
        if (saved.fingerprint !== fingerprint)
          fail(
            "Esse salvamento já foi feito com outros dados. Confira o que foi salvo antes de tentar novamente.",
            409,
          );
        db.exec("COMMIT");
        return JSON.parse(saved.response);
      }
      const result = fn();
      db.prepare(
        "INSERT INTO request_keys(key,fingerprint,response) VALUES(?,?,?)",
      ).run(key, fingerprint, JSON.stringify(result));
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const validators = {
    clients: (b) => ({
      name: required(b.name, "Nome"),
      phone: str(b.phone ?? "", "Telefone", 40),
      email: str(b.email ?? "", "E-mail", 200),
      document: str(b.document ?? "", "Documento", 30),
      address: str(b.address ?? "", "Endereço"),
      notes: str(b.notes ?? "", "Observações", 3000),
    }),
    transactions: (b) => {
      const status = option(b.status, ["pending", "paid"]);
      return {
        type: option(b.type, ["income", "expense"]),
        description: required(b.description, "Descrição"),
        category: required(b.category, "Categoria", 80),
        amountCents: integer(b.amountCents, "Valor", 1),
        dueDate: date(b.dueDate),
        paidDate: status === "paid" ? date(b.paidDate) : "",
        status,
        method: option(b.method, [
          "Pix",
          "Dinheiro",
          "Cartão",
          "Boleto",
          "Transferência",
        ]),
        clientId: existsClient(b.clientId),
        notes: str(b.notes ?? "", "Observações", 3000),
      };
    },
    quotes: (b) => {
      const clientId = existsClient(b.clientId);
      if (!clientId) fail("Selecione um cliente.");
      if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 100)
        fail("Adicione de 1 a 100 itens.");
      const items = b.items.map((i) => ({
        description: required(i.description, "Descrição do item"),
        unit: option(i.unit, ["m", "m²", "un", "serv."]),
        quantity:
          typeof i.quantity === "number" &&
          Number.isFinite(i.quantity) &&
          i.quantity >= 0.001 &&
          i.quantity <= 100000
            ? Math.round(i.quantity * 1000) / 1000
            : fail("Quantidade inválida."),
        unitPriceCents: integer(i.unitPriceCents, "Preço", 1),
      }));
      const subtotal = items.reduce(
        (s, i) => s + Math.round(i.quantity * i.unitPriceCents),
        0,
      );
      integer(subtotal, "Subtotal", 1);
      const discountCents = integer(
        b.discountCents ?? 0,
        "Desconto",
        0,
        subtotal - 1,
      );
      const d = date(b.date),
        v = date(b.validUntil);
      if (v < d) fail("A validade deve ser igual ou posterior à emissão.");
      return {
        clientId,
        title: required(b.title, "Título"),
        date: d,
        validUntil: v,
        status: option(b.status, [
          "Rascunho",
          "Enviado",
          "Aprovado",
          "Recusado",
        ]),
        jobStatus: option(b.jobStatus ?? "A iniciar", [
          "A iniciar",
          "Produção",
          "Instalação",
          "Concluído",
        ]),
        scheduledDate: date(b.scheduledDate, true),
        items: JSON.stringify(items),
        discountCents,
        totalCents: subtotal - discountCents,
        notes: str(b.notes ?? "", "Observações", 3000),
      };
    },
    events: (b) => ({
      title: required(b.title, "Título"),
      date: date(b.date),
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)
        ? b.time
        : fail("Horário inválido."),
      clientId: existsClient(b.clientId),
      notes: str(b.notes ?? "", "Observações", 3000),
      done: b.done ? 1 : 0,
    }),
  };
  for (const [table, validate] of Object.entries(validators)) {
    app.post(`/api/${table}`, (req, res) => {
      const data = validate(req.body),
        keys = Object.keys(data);
      const result = once(req, `create:${table}`, data, () => {
        const r = db
          .prepare(
            `INSERT INTO ${table}(id,${keys.join(",")}) VALUES(?,${keys.map(() => "?").join(",")})`,
          )
          .run(nextId(table), ...Object.values(data));
        const id = Number(r.lastInsertRowid);
        audit(req, "create", table, id);
        return { id };
      });
      res.status(201).json(result);
    });
    app.put(`/api/${table}/:id`, (req, res) => {
      const id = integer(Number(req.params.id), "ID", 1);
      const old = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
      if (!old) fail("Registro não encontrado.", 404);
      const data = validate(req.body);
      if (
        table === "quotes" &&
        db.prepare("SELECT id FROM transactions WHERE quoteId=?").get(id) &&
        (data.totalCents !== old.totalCents ||
          data.clientId !== old.clientId ||
          data.status !== "Aprovado")
      )
        fail(
          "Este orçamento já tem uma conta a receber. Confira essa conta na área Dinheiro antes de mudar o valor, o cliente ou a aprovação.",
        );
      if (
        table === "transactions" &&
        old.quoteId &&
        (data.type !== "income" ||
          data.clientId !== old.clientId ||
          data.amountCents !== old.amountCents)
      )
        fail("Valor, tipo e cliente são definidos pelo orçamento vinculado.");
      db.prepare(
        `UPDATE ${table} SET ${Object.keys(data)
          .map((k) => `${k}=?`)
          .join(",")} WHERE id=?`,
      ).run(...Object.values(data), id);
      audit(req, "update", table, id);
      res.json({ ok: true });
    });
    app.delete(`/api/${table}/:id`, (req, res) => {
      const id = integer(Number(req.params.id), "ID", 1);
      const old = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
      if (!old) fail("Esse registro não foi encontrado.", 404);
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
        const deleted = db
          .prepare("INSERT INTO deleted_records(entity,record) VALUES(?,?)")
          .run(table, JSON.stringify(old));
        audit(req, "delete", table, id);
        db.exec("COMMIT");
        res.json({ ok: true, undoId: Number(deleted.lastInsertRowid) });
      } catch (e) {
        db.exec("ROLLBACK");
        if (e.message.includes("FOREIGN KEY"))
          fail(
            "Esse registro está ligado a um orçamento ou uma conta. Confira os dados ligados a ele antes de excluir.",
          );
        throw e;
      }
    });
  }
  app.post("/api/quotes/:id/invoice", (req, res) => {
    const id = integer(Number(req.params.id), "ID", 1),
      q = db.prepare("SELECT * FROM quotes WHERE id=?").get(id);
    if (!q) fail("Orçamento não encontrado.", 404);
    if (q.status !== "Aprovado")
      fail("Aprove o orçamento antes de gerar a conta.");
    const due = date(req.body.dueDate);
    const result = once(req, `invoice:${id}`, { due }, () => {
      if (db.prepare("SELECT id FROM transactions WHERE quoteId=?").get(id))
        fail("Esse orçamento já tem uma conta a receber.", 409);
      const r = db
        .prepare(
          "INSERT INTO transactions(id,type,description,category,amountCents,dueDate,status,method,clientId,quoteId) VALUES(?,'income',?,'Instalações',?,?,'pending','Pix',?,?)",
        )
        .run(
          nextId("transactions"),
          `${q.title} • Orçamento #${q.id}`,
          q.totalCents,
          due,
          q.clientId,
          id,
        );
      audit(req, "invoice", "quotes", id);
      return { id: Number(r.lastInsertRowid) };
    });
    res.status(201).json(result);
  });
  app.get("/api/deleted", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,entity,record,deletedAt FROM deleted_records WHERE restored=0 ORDER BY id DESC LIMIT 100",
        )
        .all()
        .map((r) => ({ ...r, record: JSON.parse(r.record) })),
    ),
  );
  app.post("/api/deleted/:id/restore", (req, res) => {
    const id = integer(Number(req.params.id), "ID", 1);
    const saved = db
      .prepare("SELECT * FROM deleted_records WHERE id=?")
      .get(id);
    if (!saved || saved.restored)
      fail("Esse registro já foi recuperado ou não foi encontrado.", 409);
    if (!["clients", "quotes", "transactions", "events"].includes(saved.entity))
      fail("Registro inválido.");
    const record = JSON.parse(saved.record),
      keys = Object.keys(record);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        `INSERT INTO ${saved.entity}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`,
      ).run(...Object.values(record));
      db.prepare("UPDATE deleted_records SET restored=1 WHERE id=?").run(id);
      audit(req, "restore", saved.entity, record.id);
      db.exec("COMMIT");
      res.json({ ok: true });
    } catch (e) {
      db.exec("ROLLBACK");
      if (e.message.includes("constraint"))
        fail(
          "Não foi possível recuperar: há outro registro com o mesmo número ou falta um cliente/orçamento ligado a ele. Peça ajuda para recuperar pelo backup.",
          409,
        );
      throw e;
    }
  });

  app.put("/api/settings", (req, res) => {
    const b = req.body,
      data = {
        company: required(b.company, "Empresa"),
        phone: str(b.phone ?? "", "Telefone", 40),
        document: str(b.document ?? "", "Documento", 30),
        address: str(b.address ?? "", "Endereço"),
        initialBalanceCents: integer(
          b.initialBalanceCents,
          "Saldo inicial",
          -100000000000,
        ),
        monthlyGoalCents: integer(b.monthlyGoalCents, "Meta", 1),
      };
    db.prepare(
      `UPDATE settings SET ${Object.keys(data)
        .map((k) => `${k}=?`)
        .join(",")} WHERE id=1`,
    ).run(...Object.values(data));
    audit(req, "update", "settings", 1);
    res.json({ ok: true });
  });
  app.patch("/api/quotes/:id/progress", (req, res) => {
    const id = integer(Number(req.params.id), "ID", 1),
      q = db.prepare("SELECT * FROM quotes WHERE id=?").get(id);
    if (!q) fail("Orçamento não encontrado.", 404);
    if (q.status !== "Aprovado")
      fail("Primeiro marque o orçamento como aprovado.");
    const stage =
      req.body.jobStatus === undefined
        ? q.jobStatus
        : option(req.body.jobStatus, [
            "A iniciar",
            "Produção",
            "Instalação",
            "Concluído",
          ]);
    const scheduled =
      req.body.scheduledDate === undefined
        ? q.scheduledDate
        : date(req.body.scheduledDate, true);
    db.prepare("UPDATE quotes SET jobStatus=?,scheduledDate=? WHERE id=?").run(
      stage,
      scheduled,
      id,
    );
    audit(req, "progress", "quotes", id);
    res.json({ ok: true });
  });
  app.get("/api/export", (req, res) => {
    res.attachment("ar-calhas-exportacao.json").json({
      exportedAt: new Date().toISOString(),
      version: 1,
      ...Object.fromEntries(
        ["settings", "clients", "quotes", "transactions", "events"].map((t) => [
          t,
          db.prepare(`SELECT * FROM ${t}`).all(),
        ]),
      ),
    });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Rota não encontrada." }),
  );
  app.use(express.static(staticDir));
  app.get("/{*path}", (req, res) =>
    res.sendFile(resolve(staticDir, "index.html")),
  );
  app.use((err, req, res, next) => {
    if (!err.status) console.error(err);
    res.status(err.status ?? 500).json({
      error: err.status ? err.message : "Não foi possível concluir a operação.",
    });
  });
  return { app, db };
}
