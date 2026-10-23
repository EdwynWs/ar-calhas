export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const money = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (v || 0) / 100,
  );
export const dateLabel = (v) =>
  v ? new Date(v + "T12:00:00").toLocaleDateString("pt-BR") : "Sem data";
export const monthLabel = (v) =>
  new Date(v + "-15T12:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
export const afterDays = (value, days) => {
  const d = new Date(value + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Evita ponto flutuante para dinheiro. Aceita 350,50 / 350.50 / 1.350,50.
export function parseMoney(value) {
  let s = String(value)
    .trim()
    .replace(/^R\$\s*/, "");
  if (s.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(s)) return null;
    s = s.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, fraction = ""] = s.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(n) && n <= 100000000000 ? n : null;
}
export const editMoney = (v) => (v / 100).toFixed(2).replace(".", ",");
export const match = (value, query) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes(
      query
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim(),
    );
export const paymentLabel = (t) =>
  t.status === "paid"
    ? t.type === "income"
      ? "Recebido"
      : "Pago"
    : t.type === "income"
      ? "Falta receber"
      : "Falta pagar";
export const stageLabel = (q) =>
  q.jobStatus === "Concluído"
    ? "Concluído"
    : q.jobStatus === "A iniciar"
      ? "A fazer"
      : "Em andamento";
export function requestKey() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const s = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export async function api(path, method = "GET", body, key) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-AR-Request": "1",
        ...(key ? { "X-Request-ID": key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Não consegui confirmar o salvamento. Confira a conexão e tente de novo. Seus campos continuam preenchidos.",
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Não consegui ler a resposta. Tente de novo.");
  }
  if (!res.ok) {
    const e = new Error(
      data.error || "Não foi possível salvar. Tente de novo.",
    );
    e.status = res.status;
    throw e;
  }
  return data;
}
export function summary(transactions, month, initial = 0) {
  const sum = (arr, type) =>
      arr.filter((t) => t.type === type).reduce((s, t) => s + t.amountCents, 0),
    paid = transactions.filter((t) => t.status === "paid"),
    period = paid.filter((t) => t.paidDate.startsWith(month));
  return {
    income: sum(period, "income"),
    expense: sum(period, "expense"),
    balance: initial + sum(paid, "income") - sum(paid, "expense"),
    receivable: sum(
      transactions.filter((t) => t.status === "pending"),
      "income",
    ),
    payable: sum(
      transactions.filter((t) => t.status === "pending"),
      "expense",
    ),
  };
}
export function exportMoney(rows) {
  const safe = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const contents = [
    [
      "O que foi",
      "Entrou ou saiu",
      "Valor em reais",
      "Dia combinado",
      "Dia do pagamento",
      "Já foi pago?",
    ],
    ...rows.map((t) => [
      t.description,
      t.type === "income" ? "Entrou" : "Saiu",
      editMoney(t.amountCents),
      dateLabel(t.dueDate),
      t.paidDate ? dateLabel(t.paidDate) : "",
      paymentLabel(t),
    ]),
  ]
    .map((r) => r.map(safe).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + contents], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "AR-Calhas-dinheiro.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
