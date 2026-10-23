import { test, expect } from "@playwright/test";
const forbidden =
  /\b(dashboard|receita|despesa|lançamento|liquidar|status|workflow|pipeline|workspace|kanban)\b/i;
async function enter(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Início", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gastei dinheiro", exact: true }),
  ).toBeVisible();
}
async function clickOrTap(locator, page) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0))
    await locator.tap();
  else await locator.click();
}
async function data(page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/data");
    return r.json();
  });
}
async function visibleFields(page) {
  return page
    .locator("form input:visible, form select:visible, form textarea:visible")
    .count();
}
async function checkLayout(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(await page.locator("main").innerText()).not.toMatch(forbidden);
  const small = await page
    .locator("main button, main input, main select, main summary")
    .evaluateAll((els) =>
      els
        .filter(
          (e) =>
            e.checkVisibility() &&
            (e.type === "checkbox"
              ? e.closest("label")
              : e
            ).getBoundingClientRect().height < 44,
        )
        .map((e) => e.textContent),
    );
  expect(small).toEqual([]);
}

test("entrada direta, apenas três ações principais e quatro áreas", async ({
  page,
}, info) => {
  await enter(page);
  await expect(page.locator("nav button")).toHaveText([
    "Início",
    "Dinheiro",
    "Orçamentos",
    "Clientes",
  ]);
  await expect(page.locator(".home-actions button")).toHaveText([
    "Recebi dinheiro",
    "Gastei dinheiro",
    "Fazer orçamento",
  ]);
  expect(await page.locator("main input:visible").count()).toBe(0);
  await expect(page.getByText("Senha", { exact: true })).toHaveCount(0);
  expect(
    await page
      .locator("body")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(18);
  await checkLayout(page);
  await page.screenshot({
    path: info.outputPath("inicio.png"),
    fullPage: true,
  });
});

test("registrar gasto: uma escolha, dois campos e Salvar; valor permanece após recarregar", async ({
  page,
}, info) => {
  await enter(page);
  const before = await data(page);
  const name = "Compra de chapa " + info.project.name;
  await clickOrTap(
    page.getByRole("button", { name: "Gastei dinheiro", exact: true }),
    page,
  );
  expect(await visibleFields(page)).toBe(2);
  await page.getByLabel("O que foi?", { exact: true }).fill(name);
  await page.getByLabel("Quanto?", { exact: true }).fill("350,50");
  await checkLayout(page);
  await page.screenshot({ path: info.outputPath("gasto.png"), fullPage: true });
  await clickOrTap(
    page.getByRole("button", { name: "Salvar", exact: true }),
    page,
  );
  await expect(page.getByRole("status")).toContainText(
    "Pronto! O dinheiro foi registrado.",
  );
  const after = await data(page);
  const t = after.transactions.find((t) => t.description === name);
  expect(t.amountCents).toBe(35050);
  expect(t.status).toBe("paid");
  expect(t.type).toBe("expense");
  expect(t.paidDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(after.transactions.length).toBe(before.transactions.length + 1);
  await page.reload();
  expect(
    (await data(page)).transactions.some((t) => t.description === name),
  ).toBe(true);
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  await expect(page.getByRole("article", { name, exact: true })).toBeVisible();
  await checkLayout(page);
});

test("registrar recebimento também exige só dois campos e aceita valor brasileiro", async ({
  page,
}, info) => {
  await enter(page);
  await clickOrTap(
    page.getByRole("button", { name: "Recebi dinheiro", exact: true }),
    page,
  );
  expect(await visibleFields(page)).toBe(2);
  await page
    .getByLabel("O que foi?", { exact: true })
    .fill("Recebimento João " + info.project.name);
  await page.getByLabel("Quanto?", { exact: true }).fill("1.500,00");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pronto!");
  const t = (await data(page)).transactions.find(
    (t) => t.description === "Recebimento João " + info.project.name,
  );
  expect(t.amountCents).toBe(150000);
  expect(t.type).toBe("income");
  expect(t.status).toBe("paid");
  await page
    .getByRole("button", { name: "Voltar ao início", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Início", exact: true }),
  ).toBeFocused();
});

test("valor inválido, falha de conexão e tentativa repetida não perdem campos nem duplicam dinheiro", async ({
  page,
}, info) => {
  await enter(page);
  await page
    .getByRole("button", { name: "Gastei dinheiro", exact: true })
    .click();
  const name = "Ferramenta " + info.project.name;
  await page.getByLabel("O que foi?", { exact: true }).fill(name);
  await page.getByLabel("Quanto?", { exact: true }).fill("-5");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Informe um valor maior que zero. Exemplo: 350,00."),
  ).toBeVisible();
  await page.getByLabel("Quanto?", { exact: true }).fill("5,00");
  let attempts = 0;
  await page.route("**/api/transactions", async (route) => {
    if (route.request().method() === "POST" && attempts++ === 0) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Não consegui confirmar");
  await expect(page.getByLabel("O que foi?", { exact: true })).toHaveValue(
    name,
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pronto!");
  expect(
    (await data(page)).transactions.filter((t) => t.description === name),
  ).toHaveLength(1);
});

test("dinheiro pendente fica fora do saldo e contas antigas continuam visíveis", async ({
  page,
}, info) => {
  await enter(page);
  const name = "Pagamento futuro " + info.project.name;
  await page
    .getByRole("button", { name: "Gastei dinheiro", exact: true })
    .click();
  await page.getByLabel("O que foi?", { exact: true }).fill(name);
  await page.getByLabel("Quanto?", { exact: true }).fill("80,00");
  await page
    .locator("summary")
    .filter({ hasText: "Ainda não paguei ou quero mudar a data" })
    .click();
  await page.getByLabel("Ainda não paguei", { exact: true }).check();
  await page
    .getByLabel("Quando deve pagar?", { exact: true })
    .fill("2027-01-15");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByLabel("O que mostrar?", { exact: true })
    .selectOption("pending");
  await expect(page.getByRole("article", { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("article", {
      name: "Dinheiro antigo por receber",
      exact: true,
    }),
  ).toBeVisible();
  const t = (await data(page)).transactions.find((t) => t.description === name);
  expect(t.status).toBe("pending");
  expect(t.paidDate).toBe("");
  await page
    .getByRole("article", { name, exact: true })
    .getByRole("button", { name: "Já paguei", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("marcado como pago");
  expect(
    (await data(page)).transactions.find((t) => t.description === name).status,
  ).toBe("paid");
});

test("cadastrar, procurar e editar cliente por nome e telefone", async ({
  page,
}, info) => {
  await enter(page);
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  expect(await visibleFields(page)).toBe(3);
  const name = "José Silva " + info.project.name;
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page
    .getByLabel("Telefone, se tiver", { exact: true })
    .fill("(14) 98888-7777");
  await page
    .getByLabel("Endereço, se quiser informar", { exact: true })
    .fill("Rua das Calhas, 10");
  await page
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  await page.getByLabel("Buscar cliente", { exact: true }).fill("jose");
  await expect(page.getByRole("article", { name, exact: true })).toBeVisible();
  await page.getByLabel("Buscar cliente", { exact: true }).fill("988887777");
  await expect(page.getByRole("article", { name, exact: true })).toBeVisible();
  await page
    .getByRole("article", { name, exact: true })
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  await page
    .getByLabel("Endereço, se quiser informar", { exact: true })
    .fill("Rua das Calhas, 20");
  await page
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  expect((await data(page)).clients.find((c) => c.name === name).address).toBe(
    "Rua das Calhas, 20",
  );
  await checkLayout(page);
});

test("criar, localizar, imprimir e aprovar orçamento sem cobrar duas vezes; serviço fica no orçamento", async ({
  page,
}, info) => {
  await enter(page);
  await page
    .getByRole("button", { name: "Fazer orçamento", exact: true })
    .click();
  await page
    .getByRole("button", { name: "É um cliente novo", exact: true })
    .click();
  const name = "Cliente orçamento " + info.project.name;
  await page.getByLabel("Nome do novo cliente", { exact: true }).fill(name);
  await page
    .getByLabel("O que será feito?", { exact: true })
    .fill("Calha nova " + info.project.name);
  await page.getByLabel("Quantidade ou medida", { exact: true }).fill("12,5");
  await page.getByLabel("Preço por metro (R$)", { exact: true }).fill("100,00");
  await expect(page.getByText("R$ 1.250,00", { exact: true })).toBeVisible();
  await checkLayout(page);
  await page
    .getByRole("button", { name: "Salvar orçamento", exact: true })
    .click();
  await page.getByLabel("Buscar orçamento", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Ver orçamento", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.__prints = 0;
    window.print = () => window.__prints++;
  });
  await page
    .getByRole("button", { name: "Imprimir / Salvar PDF", exact: true })
    .click();
  expect(await page.evaluate(() => window.__prints)).toBe(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-header")).toBeHidden();
  await expect(page.locator(".quote-paper")).toBeVisible();
  await expect(page.locator(".quote-followup")).toBeHidden();
  await page.pdf({
    path: info.outputPath("orcamento.pdf"),
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("button", { name: "O cliente aprovou", exact: true })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "Quer anotar esse valor para receber?" })
    .click();
  await page
    .getByLabel("Quando o cliente vai pagar?", { exact: true })
    .fill("2026-12-20");
  await page
    .getByRole("button", { name: "Anotar valor a receber", exact: true })
    .click();
  await expect(
    page.getByText("O valor já está anotado para receber na área Dinheiro."),
  ).toBeVisible();
  const records = await data(page),
    q = records.quotes.find(
      (q) => q.title === "Calha nova " + info.project.name,
    );
  expect(records.transactions.filter((t) => t.quoteId === q.id)).toHaveLength(
    1,
  );
  await page
    .getByRole("button", { name: "Iniciar serviço", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Serviço: Em andamento", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Concluir serviço", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Serviço: Concluído", exact: true }),
  ).toBeVisible();
  await checkLayout(page);
  await page.screenshot({
    path: info.outputPath("orcamento.png"),
    fullPage: true,
  });
});

test("confirma saída sem salvar, cancela exclusão e recupera exclusão acidental", async ({
  page,
}, info) => {
  await enter(page);
  await page
    .getByRole("button", { name: "Recebi dinheiro", exact: true })
    .click();
  await page.getByLabel("O que foi?", { exact: true }).fill("Não perder");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Voltar ao início", exact: true })
    .click();
  await expect(page.getByLabel("O que foi?", { exact: true })).toHaveValue(
    "Não perder",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Voltar ao início", exact: true })
    .click();
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  const name = "Excluir " + info.project.name;
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Salvar cliente", exact: true })
    .click();
  const row = page.getByRole("article", { name, exact: true });
  await row.locator("summary").click();
  page.once("dialog", (d) => d.dismiss());
  await row
    .getByRole("button", { name: "Excluir cliente", exact: true })
    .click();
  await expect(row).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await row
    .getByRole("button", { name: "Excluir cliente", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page
    .getByRole("button", { name: "Desfazer exclusão", exact: true })
    .click();
  await expect(row).toBeVisible();
});

test("navegação por teclado e palavras de todos os botões", async ({
  page,
}) => {
  await enter(page);
  const action = page.getByRole("button", {
    name: "Gastei dinheiro",
    exact: true,
  });
  await action.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("O que foi?", { exact: true }).focus();
  await page.keyboard.type("Teste teclado");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Quanto?", { exact: true })).toBeFocused();
  await page.keyboard.type("12,00");
  await page.getByRole("button", { name: "Salvar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Pronto!");
  for (const label of ["Início", "Dinheiro", "Orçamentos", "Clientes"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await checkLayout(page);
    const names = await page.locator("button:visible").allTextContents();
    expect(names.every((x) => x.trim().length > 1 && !forbidden.test(x))).toBe(
      true,
    );
  }
});
