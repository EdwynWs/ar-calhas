import { useState, useRef } from "react";
import { Field, Button, SavedForm, useSave } from "../components/Common";
import {
  api,
  today,
  afterDays,
  requestKey,
  editMoney,
  parseMoney,
  money,
} from "../utils";
const blankItem = () => ({
  description: "",
  quantity: "1",
  unit: "m",
  price: "",
});
export default function QuoteForm({
  record,
  clientId,
  clients,
  onSaved,
  onDirty,
}) {
  const [client, setClient] = useState(record?.clientId || clientId || ""),
    [newClient, setNewClient] = useState(false),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const [items, setItems] = useState(
    record
      ? record.items.map((i) => ({
          ...i,
          quantity: String(i.quantity).replace(".", ","),
          price: editMoney(i.unitPriceCents),
        }))
      : [blankItem()],
  );
  const [details, setDetails] = useState({
    date: record?.date || today(),
    validUntil: record?.validUntil || afterDays(today(), 30),
    discount: editMoney(record?.discountCents || 0),
    notes: record?.notes || "",
    title: record?.title || "",
    status: record?.status || "Rascunho",
    scheduledDate: record?.scheduledDate || "",
  });
  const { busy, error, run, setError } = useSave(),
    key = useRef(requestKey()),
    clientKey = useRef(requestKey()),
    createdClient = useRef(null);
  const set = (k, v) => setDetails((d) => ({ ...d, [k]: v }));
  const itemChange = (index, k, value) =>
    setItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [k]: value } : row)),
    );
  const converted = items.map((i) => ({
    description: i.description,
    unit: i.unit,
    quantity: Number(i.quantity.replace(",", ".")),
    unitPriceCents: parseMoney(i.price),
  }));
  const subtotal = converted.reduce(
      (n, i) =>
        n +
        (Number.isFinite(i.quantity) && i.unitPriceCents
          ? Math.round(i.quantity * i.unitPriceCents)
          : 0),
      0,
    ),
    discount = parseMoney(details.discount);
  function submit(e) {
    e.preventDefault();
    setError("");
    if ((!newClient && !client) || (newClient && !name.trim())) {
      setError("Escolha um cliente ou escreva o nome do novo cliente.");
      return;
    }
    if (
      converted.some(
        (i) =>
          !i.description.trim() ||
          !Number.isFinite(i.quantity) ||
          i.quantity < 0.001 ||
          i.quantity > 100000 ||
          i.unitPriceCents === null ||
          i.unitPriceCents <= 0,
      )
    ) {
      setError("Confira o serviço, a quantidade e o preço de cada item.");
      return;
    }
    if (discount === null || discount < 0 || discount >= subtotal) {
      setError("O desconto precisa ser menor que o valor do orçamento.");
      return;
    }
    run(async () => {
      let id = Number(client);
      if (newClient) {
        if (!createdClient.current) {
          createdClient.current = await api(
            "/clients",
            "POST",
            {
              name: name.trim(),
              phone,
              address: "",
              document: "",
              email: "",
              notes: "",
            },
            clientKey.current,
          );
        }
        id = createdClient.current.id;
      }
      await api(
        "/quotes" + (record ? "/" + record.id : ""),
        record ? "PUT" : "POST",
        {
          ...record,
          clientId: id,
          title: details.title.trim() || converted[0].description,
          date: details.date,
          validUntil: details.validUntil,
          status: details.status,
          jobStatus: record?.jobStatus || "A iniciar",
          scheduledDate: details.scheduledDate,
          items: converted,
          discountCents: discount,
          notes: details.notes,
        },
        key.current,
      );
      onSaved("Pronto! O orçamento foi salvo.");
    });
  }
  return (
    <SavedForm
      onSubmit={submit}
      onDirty={onDirty}
      busy={busy}
      error={error}
      button="Salvar orçamento"
    >
      <Field label="Para qual cliente?" id="quote-client">
        <select
          id="quote-client"
          required={!newClient}
          disabled={newClient}
          value={client}
          onChange={(e) => setClient(e.target.value)}
        >
          <option value="">Escolha o cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Button
        onClick={() => {
          if (createdClient.current) return;
          setNewClient(!newClient);
          onDirty(true);
        }}
      >
        {newClient ? "Escolher um cliente já cadastrado" : "É um cliente novo"}
      </Button>
      {newClient && (
        <div className="inline-box">
          <Field
            label="Nome do novo cliente"
            required
            maxLength={200}
            value={name}
            readOnly={!!createdClient.current}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Telefone, se tiver"
            type="tel"
            maxLength={40}
            value={phone}
            readOnly={!!createdClient.current}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      )}
      <div className="quote-items">
        {items.map((i, index) => (
          <fieldset key={index}>
            <legend>
              {items.length > 1 ? `Serviço ${index + 1}` : "Serviço"}
            </legend>
            <Field
              label="O que será feito?"
              id={"item-desc-" + index}
              required
              maxLength={200}
              value={i.description}
              onChange={(e) => itemChange(index, "description", e.target.value)}
              placeholder="Exemplo: Instalação de calha"
            />
            <div className="field-pair">
              <Field
                label="Quantidade ou medida"
                id={"item-qty-" + index}
                inputMode="decimal"
                required
                value={i.quantity}
                onChange={(e) => itemChange(index, "quantity", e.target.value)}
              />
              <Field label="Medido em" id={"item-unit-" + index}>
                <select
                  id={"item-unit-" + index}
                  value={i.unit}
                  onChange={(e) => itemChange(index, "unit", e.target.value)}
                >
                  <option value="m">Metros</option>
                  <option value="m²">Metros quadrados</option>
                  <option value="un">Unidades</option>
                  <option value="serv.">Serviço completo</option>
                </select>
              </Field>
            </div>
            <Field
              label={
                i.unit === "m"
                  ? "Preço por metro (R$)"
                  : i.unit === "m²"
                    ? "Preço por metro quadrado (R$)"
                    : i.unit === "un"
                      ? "Preço por unidade (R$)"
                      : "Preço do serviço (R$)"
              }
              id={"item-price-" + index}
              inputMode="decimal"
              required
              value={i.price}
              onChange={(e) => itemChange(index, "price", e.target.value)}
              placeholder="0,00"
            />
            {items.length > 1 && (
              <Button
                onClick={() => {
                  if (window.confirm("Retirar este serviço do orçamento?")) {
                    setItems((rows) => rows.filter((_, n) => n !== index));
                    onDirty(true);
                  }
                }}
              >
                Retirar este serviço
              </Button>
            )}
          </fieldset>
        ))}
      </div>
      <Button
        onClick={() => {
          setItems((rows) => [...rows, blankItem()]);
          onDirty(true);
        }}
        disabled={items.length >= 100}
      >
        Adicionar outro serviço
      </Button>
      <p className="quote-total" aria-live="polite">
        Total do orçamento <strong>{money(subtotal - (discount || 0))}</strong>
      </p>
      <details className="form-details">
        <summary>Desconto e outras informações</summary>
        <Field
          label="Desconto em reais"
          inputMode="decimal"
          value={details.discount}
          onChange={(e) => set("discount", e.target.value)}
        />
        <Field
          label="Dia do orçamento"
          type="date"
          required
          value={details.date}
          onChange={(e) => set("date", e.target.value)}
        />
        <Field
          label="Preço válido até"
          type="date"
          min={details.date}
          required
          value={details.validUntil}
          onChange={(e) => set("validUntil", e.target.value)}
        />
        <Field
          label="Dia previsto para fazer o serviço"
          type="date"
          value={details.scheduledDate}
          onChange={(e) => set("scheduledDate", e.target.value)}
        />
        <Field
          label="Nome do orçamento, se quiser mudar"
          maxLength={200}
          value={details.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <Field label="O cliente já respondeu?" id="quote-answer">
          <select
            id="quote-answer"
            value={details.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="Rascunho">Ainda não enviei</option>
            <option value="Enviado">Estou esperando a resposta</option>
            <option value="Aprovado">O cliente aprovou</option>
            <option value="Recusado">O cliente não aprovou</option>
          </select>
        </Field>
        <Field
          label="Anotação ou forma de combinar o pagamento"
          id="quote-notes"
        >
          <textarea
            id="quote-notes"
            maxLength={3000}
            value={details.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </details>
    </SavedForm>
  );
}
