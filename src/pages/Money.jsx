import { useState } from "react";
import { Button, Field, Empty, Deleted } from "../components/Common";
import {
  summary,
  money,
  dateLabel,
  monthLabel,
  today,
  match,
  paymentLabel,
  exportMoney,
} from "../utils";
export default function Money({ data, go, remove, restore, settle }) {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const stats = summary(
    data.transactions,
    month,
    data.settings.initialBalanceCents,
  );
  const rows = data.transactions
    .filter(
      (t) =>
        (filter === "pending"
          ? t.status === "pending"
          : (t.status === "paid" ? t.paidDate : t.dueDate).startsWith(month)) &&
        (filter === "income"
          ? t.type === "income"
          : filter === "expense"
            ? t.type === "expense"
            : true) &&
        match(t.description, query),
    )
    .sort((a, b) =>
      filter === "pending"
        ? a.dueDate.localeCompare(b.dueDate)
        : (b.paidDate || b.dueDate).localeCompare(a.paidDate || a.dueDate) ||
          b.id - a.id,
    );
  return (
    <>
      <div className="actions">
        <Button
          variant="receive"
          onClick={() => go({ page: "money-form", type: "income" })}
        >
          Recebi dinheiro
        </Button>
        <Button
          variant="spend"
          onClick={() => go({ page: "money-form", type: "expense" })}
        >
          Gastei dinheiro
        </Button>
      </div>
      <section className="money-summary" aria-label="Resumo do dinheiro">
        <p>
          Dinheiro disponível<strong>{money(stats.balance)}</strong>
        </p>
        <details>
          <summary>Ver quanto entrou e saiu</summary>
          <p>
            Recebido em {monthLabel(month)}: <b>{money(stats.income)}</b>
          </p>
          <p>
            Gasto em {monthLabel(month)}: <b>{money(stats.expense)}</b>
          </p>
          <p>
            Falta receber, de todos os meses: <b>{money(stats.receivable)}</b>
          </p>
          <p>
            Falta pagar, de todos os meses: <b>{money(stats.payable)}</b>
          </p>
        </details>
      </section>
      <div className="filters">
        <Field
          label="Qual mês?"
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          disabled={filter === "pending"}
        />
        <Field label="O que mostrar?" id="money-filter">
          <select
            id="money-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Tudo</option>
            <option value="income">Dinheiro que entrou</option>
            <option value="expense">Dinheiro que saiu</option>
            <option value="pending">Falta receber ou pagar</option>
          </select>
        </Field>
      </div>
      {filter === "pending" && (
        <p className="help">
          Mostrando o que falta receber ou pagar, de todos os meses.
        </p>
      )}
      <details className="secondary-details">
        <summary>Procurar uma anotação</summary>
        <Field
          label="Procurar pelo que foi escrito"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </details>
      <div className="record-list">
        {rows.length ? (
          rows.map((t) => (
            <article className="record" key={t.id} aria-label={t.description}>
              <div>
                <p
                  className={
                    "kind " + (t.type === "income" ? "received" : "spent")
                  }
                >
                  {t.type === "income"
                    ? "Entrada de dinheiro"
                    : "Saída de dinheiro"}
                </p>
                <h2>{t.description}</h2>
                <p>
                  {t.status === "paid"
                    ? dateLabel(t.paidDate)
                    : "Combinado para " + dateLabel(t.dueDate)}{" "}
                  · {paymentLabel(t)}
                </p>
                {t.status === "pending" && t.dueDate < today() && (
                  <p className="overdue">Passou do dia combinado</p>
                )}
              </div>
              <strong className="record-value">{money(t.amountCents)}</strong>
              <div className="record-actions">
                {t.status === "pending" && (
                  <Button variant="primary" onClick={() => settle(t)}>
                    {t.type === "income" ? "Já recebi" : "Já paguei"}
                  </Button>
                )}
                <Button onClick={() => go({ page: "money-form", record: t })}>
                  Editar
                </Button>
                <details className="item-details">
                  <summary>Mais</summary>
                  <Button
                    variant="danger"
                    onClick={() => remove("transactions", t)}
                  >
                    Excluir
                  </Button>
                </details>
              </div>
            </article>
          ))
        ) : (
          <Empty>
            {filter === "pending"
              ? "Não há nada para receber ou pagar."
              : "Nenhuma anotação neste mês. Use “Recebi dinheiro” ou “Gastei dinheiro”."}
          </Empty>
        )}
      </div>
      <details className="secondary-details">
        <summary>Guardar uma cópia desta lista</summary>
        <Button onClick={() => exportMoney(rows)}>
          Baixar para abrir no Excel
        </Button>
      </details>
      <Deleted entity="transactions" onRestore={restore} />
    </>
  );
}
