import { useState } from "react";
import { Button, Field, Empty, Deleted } from "../components/Common";
import { match, money, dateLabel, stageLabel } from "../utils";
const answer = (q) =>
  ({
    Rascunho: "Ainda não enviado",
    Enviado: "Esperando resposta",
    Aprovado: "Cliente aprovou",
    Recusado: "Cliente não aprovou",
  })[q.status];
export { answer };
export default function Quotes({ data, go, clientId, restore }) {
  const [query, setQuery] = useState("");
  const client = (id) =>
    data.clients.find((c) => c.id === id)?.name || "Cliente não encontrado";
  const rows = data.quotes.filter(
    (q) =>
      (!clientId || q.clientId === clientId) &&
      (match(client(q.clientId), query) ||
        match(q.title, query) ||
        String(q.id) === query),
  );
  return (
    <>
      <div className="actions">
        <Button
          variant="primary"
          onClick={() => go({ page: "quote-form", clientId })}
        >
          Fazer orçamento
        </Button>
      </div>
      <Field
        label="Buscar orçamento"
        type="search"
        placeholder="Nome do cliente ou serviço"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {clientId && (
        <div className="filter-info">
          <p>Orçamentos de {client(clientId)}</p>
          <Button onClick={() => go({ page: "quotes" })}>
            Ver todos os clientes
          </Button>
        </div>
      )}
      <div className="record-list">
        {rows.length ? (
          rows.map((q) => (
            <article className="record" aria-label={q.title} key={q.id}>
              <div>
                <h2>{client(q.clientId)}</h2>
                <p>{q.title}</p>
                <p>
                  {dateLabel(q.date)} · {answer(q)}
                </p>
                {q.status === "Aprovado" && (
                  <p>
                    Serviço: {stageLabel(q)}
                    {q.scheduledDate ? " · " + dateLabel(q.scheduledDate) : ""}
                  </p>
                )}
              </div>
              <strong className="record-value">{money(q.totalCents)}</strong>
              <div className="record-actions">
                <Button onClick={() => go({ page: "quote-view", id: q.id })}>
                  Ver orçamento
                </Button>
                <Button
                  onClick={() =>
                    go({ page: "quote-view", id: q.id, print: true })
                  }
                >
                  Imprimir / Salvar PDF
                </Button>
              </div>
            </article>
          ))
        ) : (
          <Empty>
            {query
              ? "Não encontrei esse orçamento. Tente o nome do cliente."
              : "Nenhum orçamento aqui. Use “Fazer orçamento” para começar."}
          </Empty>
        )}
      </div>
      {data.events.length > 0 && (
        <details className="secondary-details">
          <summary>Compromissos que já estavam anotados</summary>
          <p>Suas anotações antigas foram mantidas.</p>
          {data.events.map((e) => (
            <article key={e.id} className="old-event">
              <h2>{e.title}</h2>
              <p>
                {dateLabel(e.date)} às {e.time}
                {e.done ? " · Já foi feito" : ""}
              </p>
              {e.notes && <p>{e.notes}</p>}
            </article>
          ))}
        </details>
      )}
      <details className="secondary-details">
        <summary>Dados usados no orçamento impresso</summary>
        <Button onClick={() => go({ page: "company" })}>
          Conferir dados da empresa
        </Button>
      </details>
      <Deleted entity="quotes" onRestore={restore} />
    </>
  );
}
