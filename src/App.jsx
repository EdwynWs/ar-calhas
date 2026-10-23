import { useState, useEffect, useRef } from "react";
import Home from "./pages/Home";
import Money from "./pages/Money";
import Clients from "./pages/Clients";
import Quotes from "./pages/Quotes";
import QuoteView from "./pages/QuoteView";
import MoneyForm from "./forms/MoneyForm";
import ClientForm from "./forms/ClientForm";
import QuoteForm from "./forms/QuoteForm";
import CompanyForm from "./forms/CompanyForm";
import { Button, Notice, FocusTitle } from "./components/Common";
import { api, today } from "./utils";
const nav = [
  ["home", "Início"],
  ["money", "Dinheiro"],
  ["quotes", "Orçamentos"],
  ["clients", "Clientes"],
];
export default function App() {
  const [data, setData] = useState(null),
    [route, setRoute] = useState({ page: "home" }),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState(null),
    [loadError, setLoadError] = useState(""),
    [working, setWorking] = useState(false);
  const lock = useRef(false);
  const formPage = route.page.endsWith("-form") || route.page === "company";
  async function refresh() {
    const incoming = await api("/data");
    setData(incoming);
    setLoadError("");
    return incoming;
  }
  useEffect(() => {
    refresh().catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function go(next) {
    if (
      dirty &&
      !window.confirm(
        "Você ainda não salvou. Quer sair e perder o que preencheu?",
      )
    )
      return;
    setDirty(false);
    setRoute(next);
    window.scrollTo({ top: 0 });
  }
  const notify = (message, error = false, undoId) =>
    setNotice({ message, error, undoId });
  async function changed(message) {
    await refresh();
    notify(message);
  }
  async function saved(message) {
    setDirty(false);
    setRoute({
      page:
        route.page === "money-form"
          ? "money"
          : route.page === "client-form"
            ? "clients"
            : "quotes",
    });
    notify(message);
    window.scrollTo({ top: 0 });
    try {
      await refresh();
    } catch {
      setLoadError(
        "O que você preencheu foi salvo, mas não consegui atualizar a lista. Toque em “Tentar de novo”.",
      );
    }
  }
  async function action(fn) {
    if (lock.current) return;
    lock.current = true;
    setNotice(null);
    setWorking(true);
    try {
      await fn();
      return true;
    } catch (e) {
      notify(e.message, true);
      return false;
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  async function remove(entity, record) {
    if (
      !window.confirm(
        `Excluir “${record.description || record.name || record.title}”? Você poderá recuperar depois.`,
      )
    )
      return;
    await action(async () => {
      const r = await api("/" + entity + "/" + record.id, "DELETE", {});
      await refresh();
      if (route.page === "quote-view") setRoute({ page: "quotes" });
      notify(
        "Foi excluído. Se foi sem querer, toque em “Desfazer exclusão”.",
        false,
        r.undoId,
      );
    });
  }
  async function restore(id) {
    return action(async () => {
      await api("/deleted/" + id + "/restore", "POST", {});
      await refresh();
      notify("Pronto! O registro foi recuperado.");
    });
  }
  async function settle(record) {
    await action(async () => {
      await api("/transactions/" + record.id, "PUT", {
        ...record,
        status: "paid",
        paidDate: today(),
      });
      await changed(
        record.type === "income"
          ? "Pronto! O dinheiro foi marcado como recebido."
          : "Pronto! O dinheiro foi marcado como pago.",
      );
    });
  }
  const title = {
    home: "Início",
    money: "Dinheiro",
    quotes: "Orçamentos",
    clients: "Clientes",
    company: "Dados da empresa",
    "client-form": route.record ? "Editar cliente" : "Novo cliente",
    "money-form": route.record
      ? "Corrigir anotação"
      : route.type === "income"
        ? "Recebi dinheiro"
        : "Gastei dinheiro",
    "quote-form": route.record ? "Editar orçamento" : "Fazer orçamento",
    "quote-view": "Ver orçamento",
  }[route.page];
  const active = route.page.startsWith("money")
    ? "money"
    : route.page.startsWith("client")
      ? "clients"
      : route.page.startsWith("quote") || route.page === "company"
        ? "quotes"
        : "home";
  const quote = data?.quotes.find((q) => q.id === route.id);
  return (
    <div className="app">
      <a className="skip-link" href="#content">
        Ir para a página
      </a>
      <header className="app-header">
        <span className="brand">AR Calhas</span>
        <nav aria-label="Áreas do sistema">
          {nav.map(([page, label]) => (
            <Button
              key={page}
              aria-current={active === page ? "page" : undefined}
              onClick={() => go({ page })}
            >
              {label}
            </Button>
          ))}
        </nav>
      </header>
      <main id="content">
        <div className="page-heading">
          <FocusTitle route={route}>{title}</FocusTitle>
          {route.page !== "home" && (
            <Button onClick={() => go({ page: "home" })}>
              Voltar ao início
            </Button>
          )}
        </div>
        <Notice
          notice={notice}
          onClose={() => setNotice(null)}
          onUndo={restore}
        />
        {loadError && (
          <div className="error-panel" role="alert">
            <p>{loadError}</p>
            <Button
              onClick={() => refresh().catch((e) => setLoadError(e.message))}
            >
              Tentar de novo
            </Button>
          </div>
        )}
        {!data && !loadError && <p role="status">Abrindo suas anotações…</p>}
        {working && <p aria-live="polite">Guardando a alteração…</p>}
        {data && (
          <div aria-busy={working}>
            {route.page === "home" && <Home go={go} />}
            {route.page === "money" && (
              <Money
                data={data}
                go={go}
                remove={remove}
                restore={restore}
                settle={settle}
              />
            )}
            {route.page === "clients" && (
              <Clients data={data} go={go} remove={remove} restore={restore} />
            )}
            {route.page === "quotes" && (
              <Quotes
                key={route.clientId || "all"}
                data={data}
                go={go}
                clientId={route.clientId}
                restore={restore}
              />
            )}
            {route.page === "money-form" && (
              <MoneyForm
                key={route.record?.id || route.type}
                record={route.record}
                type={route.type}
                clients={data.clients}
                onSaved={saved}
                onDirty={setDirty}
              />
            )}
            {route.page === "client-form" && (
              <ClientForm
                key={route.record?.id || "new"}
                record={route.record}
                onSaved={saved}
                onDirty={setDirty}
              />
            )}
            {route.page === "quote-form" && (
              <QuoteForm
                key={route.record?.id || "new"}
                record={route.record}
                clientId={route.clientId}
                clients={data.clients}
                onSaved={saved}
                onDirty={setDirty}
              />
            )}
            {route.page === "quote-view" &&
              (quote ? (
                <QuoteView
                  key={quote.id}
                  quote={quote}
                  client={data.clients.find((c) => c.id === quote.clientId)}
                  settings={data.settings}
                  linked={data.transactions.find((t) => t.quoteId === quote.id)}
                  go={go}
                  remove={remove}
                  changed={changed}
                  autoPrint={route.print}
                />
              ) : (
                <p>
                  Esse orçamento não está mais na lista. Volte à área
                  Orçamentos.
                </p>
              ))}
            {route.page === "company" && (
              <CompanyForm
                settings={data.settings}
                onSaved={saved}
                onDirty={setDirty}
              />
            )}
          </div>
        )}
      </main>
      <footer className="app-footer">Desenvolvido por EWS Tech</footer>
    </div>
  );
}
