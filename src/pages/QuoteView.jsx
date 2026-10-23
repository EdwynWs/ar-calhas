import { useState, useRef, useEffect } from "react";
import { Button, Field, useSave } from "../components/Common";
import { api, money, dateLabel, today, requestKey, stageLabel } from "../utils";
import { answer } from "./Quotes";
export default function QuoteView({
  quote: q,
  client: c,
  settings: s,
  linked,
  go,
  remove,
  changed,
  autoPrint,
}) {
  const [due, setDue] = useState(today()),
    [scheduled, setScheduled] = useState(q.scheduledDate || ""),
    { busy, error, run } = useSave(),
    key = useRef(requestKey()),
    printed = useRef(false);
  useEffect(() => {
    if (autoPrint && !printed.current) {
      printed.current = true;
      const timer = setTimeout(() => window.print(), 150);
      return () => {
        clearTimeout(timer);
        printed.current = false;
      };
    }
  }, [autoPrint]);
  async function approve() {
    await api("/quotes/" + q.id, "PUT", { ...q, status: "Aprovado" });
    await changed("Pronto! O orçamento foi marcado como aprovado.");
  }
  async function progress(jobStatus) {
    if (jobStatus === "Concluído" && !window.confirm("O serviço já terminou?"))
      return;
    await api("/quotes/" + q.id + "/progress", "PATCH", { jobStatus });
    await changed(
      jobStatus === "Concluído"
        ? "Pronto! O serviço foi marcado como concluído."
        : "Pronto! O serviço está em andamento.",
    );
  }
  return (
    <>
      <div className="actions no-print">
        <Button variant="primary" onClick={() => window.print()}>
          Imprimir / Salvar PDF
        </Button>
        <Button onClick={() => go({ page: "quote-form", record: q })}>
          Editar orçamento
        </Button>
      </div>
      <section className="quote-paper" aria-label="Orçamento para imprimir">
        <header className="paper-header">
          <div>
            <h2>{s.company}</h2>
            {s.document && <p>{s.document}</p>}
            {s.phone && <p>{s.phone}</p>}
            {s.address && <p>{s.address}</p>}
          </div>
          <div>
            <h2>Orçamento nº {q.id}</h2>
            <p>Feito em {dateLabel(q.date)}</p>
            <p>Preço válido até {dateLabel(q.validUntil)}</p>
          </div>
        </header>
        <div className="paper-client">
          <p>Para</p>
          <h2>{c?.name}</h2>
          {c?.phone && <p>{c.phone}</p>}
          {c?.address && <p>{c.address}</p>}
          {c?.document && <p>{c.document}</p>}
        </div>
        <h2>{q.title}</h2>
        <div className="paper-items">
          {q.items.map((i, index) => (
            <article key={index} className="paper-item">
              <h3>{i.description}</h3>
              <p>
                {Number(i.quantity).toLocaleString("pt-BR", {
                  maximumFractionDigits: 3,
                })}{" "}
                {
                  {
                    m: "metros",
                    "m²": "metros quadrados",
                    un: "unidades",
                    "serv.": "serviço(s)",
                  }[i.unit]
                }{" "}
                × {money(i.unitPriceCents)}
              </p>
              <strong>
                {money(Math.round(i.quantity * i.unitPriceCents))}
              </strong>
            </article>
          ))}
        </div>
        {q.discountCents > 0 && <p>Desconto: {money(q.discountCents)}</p>}
        <p className="quote-total">
          Total <strong>{money(q.totalCents)}</strong>
        </p>
        {q.notes && (
          <div className="paper-notes">
            <h3>O que foi combinado</h3>
            <p>{q.notes}</p>
          </div>
        )}
        <p className="paper-thanks">Obrigado pela preferência.</p>
      </section>
      <section
        className="quote-followup no-print"
        aria-label="Acompanhar orçamento"
      >
        <h2>{answer(q)}</h2>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {q.status !== "Aprovado" ? (
          <Button disabled={busy} onClick={() => run(approve)}>
            O cliente aprovou
          </Button>
        ) : (
          <>
            <div className="inline-box">
              <h3>Pagamento</h3>
              {linked ? (
                <p>
                  {linked.status === "paid"
                    ? "O dinheiro desse orçamento já foi recebido."
                    : "O valor já está anotado para receber na área Dinheiro."}
                </p>
              ) : (
                <details>
                  <summary>Quer anotar esse valor para receber?</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        await api(
                          "/quotes/" + q.id + "/invoice",
                          "POST",
                          { dueDate: due },
                          key.current,
                        );
                        await changed(
                          "Pronto! O valor foi anotado para receber.",
                        );
                      });
                    }}
                  >
                    <Field
                      label="Quando o cliente vai pagar?"
                      type="date"
                      required
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                    <Button type="submit" disabled={busy}>
                      Anotar valor a receber
                    </Button>
                  </form>
                </details>
              )}
            </div>
            <div className="inline-box">
              <h3>Serviço: {stageLabel(q)}</h3>
              <div className="actions">
                {q.jobStatus === "A iniciar" && (
                  <Button
                    disabled={busy}
                    onClick={() => run(() => progress("Produção"))}
                  >
                    Iniciar serviço
                  </Button>
                )}
                {q.jobStatus !== "Concluído" && (
                  <Button
                    disabled={busy}
                    onClick={() => run(() => progress("Concluído"))}
                  >
                    Concluir serviço
                  </Button>
                )}
              </div>
              <details>
                <summary>
                  {q.scheduledDate
                    ? "Mudar dia do serviço"
                    : "Anotar dia do serviço"}
                </summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await api("/quotes/" + q.id + "/progress", "PATCH", {
                        scheduledDate: scheduled,
                      });
                      await changed("Pronto! O dia do serviço foi salvo.");
                    });
                  }}
                >
                  <Field
                    label="Dia previsto"
                    type="date"
                    value={scheduled}
                    onChange={(e) => setScheduled(e.target.value)}
                  />
                  <Button type="submit" disabled={busy}>
                    Salvar dia
                  </Button>
                </form>
              </details>
            </div>
          </>
        )}
        <details className="secondary-details">
          <summary>Outras opções</summary>
          {q.status === "Aprovado" && q.jobStatus !== "A iniciar" && (
            <Button
              disabled={busy}
              onClick={() => run(() => progress("A iniciar"))}
            >
              Voltar o serviço para “A fazer”
            </Button>
          )}
          <Button variant="danger" onClick={() => remove("quotes", q)}>
            Excluir orçamento
          </Button>
        </details>
      </section>
    </>
  );
}
