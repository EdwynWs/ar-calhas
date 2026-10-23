import { useState } from "react";
import { Button, Field, Empty, Deleted } from "../components/Common";
import { match } from "../utils";
function whatsapp(phone) {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10 || p.length === 11) p = "55" + p;
  return /^55\d{10,11}$/.test(p) ? "https://wa.me/" + p : null;
}
export default function Clients({ data, go, remove, restore }) {
  const [query, setQuery] = useState("");
  const rows = data.clients.filter(
    (c) =>
      match(c.name, query) ||
      match(c.phone, query) ||
      (!!query.replace(/\D/g, "") &&
        c.phone.replace(/\D/g, "").includes(query.replace(/\D/g, ""))),
  );
  return (
    <>
      <div className="actions">
        <Button variant="primary" onClick={() => go({ page: "client-form" })}>
          Novo cliente
        </Button>
      </div>
      <Field
        label="Buscar cliente"
        type="search"
        placeholder="Escreva o nome ou telefone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="record-list">
        {rows.length ? (
          rows.map((c) => (
            <article
              className="record client-record"
              key={c.id}
              aria-label={c.name}
            >
              <div>
                <h2>{c.name}</h2>
                {c.phone && <p>{c.phone}</p>}
                {c.address && <p>{c.address}</p>}
              </div>
              <div className="record-actions">
                <Button onClick={() => go({ page: "client-form", record: c })}>
                  Editar
                </Button>
                <Button onClick={() => go({ page: "quotes", clientId: c.id })}>
                  Ver orçamentos
                </Button>
                <details className="item-details">
                  <summary>Mais</summary>
                  {whatsapp(c.phone) && (
                    <a
                      className="button"
                      href={whatsapp(c.phone)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Conversar no WhatsApp
                    </a>
                  )}
                  <Button variant="danger" onClick={() => remove("clients", c)}>
                    Excluir cliente
                  </Button>
                </details>
              </div>
            </article>
          ))
        ) : (
          <Empty>
            {query
              ? "Não encontrei esse cliente. Tente outra parte do nome ou telefone."
              : "Nenhum cliente ainda. Use “Novo cliente” para começar."}
          </Empty>
        )}
      </div>
      <Deleted entity="clients" onRestore={restore} />
    </>
  );
}
