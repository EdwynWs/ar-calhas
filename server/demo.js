// Dados inteiramente fictícios, inseridos somente com npm run setup -- --demo.
export function seedDemo(db) {
  if (
    db.prepare("SELECT COUNT(*) n FROM clients").get().n ||
    db.prepare("SELECT COUNT(*) n FROM transactions").get().n
  )
    throw new Error(
      "A demonstração só pode ser inserida em banco sem clientes e lançamentos.",
    );
  const now = new Date(),
    year = now.getFullYear(),
    month = now.getMonth();
  const fmt = (offset, day) => {
    const d = new Date(
      year,
      month + offset,
      Math.min(day, new Date(year, month + offset + 1, 0).getDate()),
    );
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  db.exec("BEGIN");
  try {
    const names = [
      "João Silva (exemplo)",
      "Maria Oliveira (exemplo)",
      "Construtora Horizonte (exemplo)",
      "Carlos Mendes (exemplo)",
      "Fernanda Souza (exemplo)",
      "Residencial Primavera (exemplo)",
    ];
    const ids = names.map((name, i) =>
      Number(
        db
          .prepare(
            "INSERT INTO clients(name,phone,email,address,notes) VALUES(?,?,?,?,?)",
          )
          .run(
            name,
            "",
            `cliente${i + 1}@example.com`,
            "Endereço demonstrativo — Bastos/SP",
            "Registro fictício para apresentação.",
          ).lastInsertRowid,
      ),
    );
    const insert = db.prepare(
      "INSERT INTO transactions(type,description,category,amountCents,dueDate,paidDate,status,method,clientId,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
    );
    const amounts = [
      128000, 64000, 295000, 189000, 78000, 385000, 210000, 156000, 320000,
      230000, 145000, 256000,
    ];
    for (let offset = -5; offset <= 0; offset++) {
      const maxDay = offset === 0 ? now.getDate() : 28;
      for (let i = 0; i < 12; i++) {
        const day = Math.max(1, Math.floor(((i + 1) * maxDay) / 13));
        const d = fmt(offset, day);
        insert.run(
          "income",
          [
            "Instalação de calhas",
            "Manutenção de rufos",
            "Calhas e condutores",
          ][i % 3] + " · exemplo",
          i % 3 === 1 ? "Manutenção" : "Instalações",
          Math.round(amounts[i] * (1 + offset * 0.055)),
          d,
          d,
          "paid",
          ["Pix", "Transferência", "Dinheiro"][i % 3],
          ids[i % ids.length],
          "Dados fictícios de demonstração.",
        );
      }
      const expense = [
        ["Chapas galvanizadas", "Materiais", 438000],
        ["Equipe de instalação", "Mão de obra", 320000],
        ["Combustível e deslocamento", "Transporte", 92000],
        ["Aluguel da oficina", "Aluguel", 180000],
        ["Ferramentas e acessórios", "Ferramentas", 62000],
        ["Tributos do mês", "Impostos", 125000],
      ];
      expense.forEach(([desc, cat, amount], i) => {
        const d = fmt(offset, Math.max(1, Math.floor(((i + 1) * maxDay) / 7)));
        insert.run(
          "expense",
          desc + " · exemplo",
          cat,
          Math.round(amount * (1 + offset * 0.025)),
          d,
          d,
          "paid",
          i % 2 ? "Pix" : "Boleto",
          null,
          "Dados fictícios de demonstração.",
        );
      });
    }
    for (let i = 0; i < 4; i++)
      insert.run(
        i % 2 ? "expense" : "income",
        [
          "Instalação — próximo recebimento",
          "Fornecedor de chapas",
          "Manutenção residencial",
          "Pagamento da equipe",
        ][i] + " · exemplo",
        i % 2 ? "Materiais" : "Instalações",
        [245000, 168000, 85000, 110000][i],
        fmt(
          0,
          i === 0
            ? Math.max(1, now.getDate() - 3)
            : Math.min(28, now.getDate() + i + 2),
        ),
        "",
        "pending",
        "Pix",
        i % 2 ? null : ids[i],
        "Dados fictícios de demonstração.",
      );
    const titles = [
      "Calha residencial",
      "Rufos para muro",
      "Instalação completa",
      "Calhas e condutores",
      "Manutenção preventiva",
      "Cobertura da área de lazer",
    ];
    titles.forEach((title, i) => {
      const qty = [12, 8, 25, 18, 10, 20][i],
        price = [10667, 8000, 11800, 10500, 7800, 16500][i];
      db.prepare(
        "INSERT INTO quotes(clientId,title,date,validUntil,status,jobStatus,scheduledDate,items,totalCents,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(
        ids[i],
        title + " · exemplo",
        fmt(0, Math.min(now.getDate(), i + 1)),
        fmt(1, 15),
        i < 4 ? "Aprovado" : i === 4 ? "Enviado" : "Rascunho",
        [
          "A iniciar",
          "Produção",
          "Instalação",
          "Concluído",
          "A iniciar",
          "A iniciar",
        ][i],
        i < 3 ? fmt(0, Math.min(28, now.getDate() + i + 1)) : "",
        JSON.stringify([
          {
            description: title,
            quantity: qty,
            unit: "m",
            unitPriceCents: price,
          },
        ]),
        qty * price,
        "Orçamento fictício. Condições: 50% de entrada e 50% na conclusão.",
      );
    });
    for (let i = 0; i < 3; i++)
      db.prepare(
        "INSERT INTO events(title,date,time,clientId,notes) VALUES(?,?,?,?,?)",
      ).run(
        ["Visita técnica", "Levantamento de medidas", "Revisão do projeto"][i] +
          " · exemplo",
        fmt(0, Math.min(28, now.getDate() + i)),
        ["09:00", "14:30", "10:00"][i],
        ids[i],
        "Compromisso fictício.",
      );
    db.prepare(
      "UPDATE settings SET initialBalanceCents=500000,monthlyGoalCents=3000000 WHERE id=1",
    ).run();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
