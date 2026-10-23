import { useRef, useState } from "react";
import { Field, SavedForm, useSave } from "../components/Common";
import {
  api,
  today,
  parseMoney,
  editMoney,
  requestKey,
  dateLabel,
} from "../utils";
export default function MoneyForm({ record, type, clients, onSaved, onDirty }) {
  const existing = record || {},
    income = (existing.type || type) === "income";
  const [description, setDescription] = useState(existing.description || ""),
    [amount, setAmount] = useState(record ? editMoney(record.amountCents) : ""),
    [pending, setPending] = useState(existing.status === "pending"),
    [date, setDate] = useState(existing.paidDate || today()),
    [due, setDue] = useState(existing.dueDate || today()),
    [method, setMethod] = useState(existing.method || "Dinheiro"),
    [clientId, setClientId] = useState(existing.clientId || ""),
    [notes, setNotes] = useState(existing.notes || ""),
    [errors, setErrors] = useState({});
  const idempotency = useRef(requestKey()),
    { busy, error, run } = useSave();
  function submit(e) {
    e.preventDefault();
    const value = parseMoney(amount),
      problems = {};
    if (!description.trim()) problems.description = "Escreva o que foi.";
    if (value === null || value <= 0)
      problems.amount = "Informe um valor maior que zero. Exemplo: 350,00.";
    setErrors(problems);
    if (Object.keys(problems).length) {
      document
        .getElementById(problems.description ? "description" : "amount")
        ?.focus();
      return;
    }
    run(async () => {
      await api(
        "/transactions" + (record ? "/" + record.id : ""),
        record ? "PUT" : "POST",
        {
          ...existing,
          type: income ? "income" : "expense",
          description: description.trim(),
          amountCents: value,
          category: existing.category || (income ? "Instalações" : "Materiais"),
          dueDate: pending ? due : record ? existing.dueDate : date,
          paidDate: pending ? "" : date,
          status: pending ? "pending" : "paid",
          method,
          clientId: clientId ? Number(clientId) : null,
          notes,
        },
        idempotency.current,
      );
      onSaved("Pronto! O dinheiro foi registrado.");
    });
  }
  return (
    <SavedForm onSubmit={submit} onDirty={onDirty} busy={busy} error={error}>
      <Field
        id="description"
        label="O que foi?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={200}
        error={errors.description}
        placeholder={
          income ? "Exemplo: Serviço do João" : "Exemplo: Compra de chapa"
        }
      />
      <Field
        id="amount"
        label="Quanto?"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={errors.amount}
        placeholder="R$ 0,00"
        readOnly={!!existing.quoteId}
      />
      <p className="help">
        {pending
          ? income
            ? "Esse dinheiro ainda não entrou."
            : "Esse dinheiro ainda não saiu."
          : `Vou registrar como ${income ? "recebido" : "pago"} ${date === today() ? "hoje" : "em " + dateLabel(date)}.`}
      </p>
      <details open={pending || undefined} className="form-details">
        <summary>
          {income
            ? "Ainda não recebi ou quero mudar a data"
            : "Ainda não paguei ou quero mudar a data"}
        </summary>
        <label className="check">
          <input
            type="checkbox"
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />
          {income ? "Ainda não recebi" : "Ainda não paguei"}
        </label>
        {pending ? (
          <Field
            label={income ? "Quando deve receber?" : "Quando deve pagar?"}
            type="date"
            required
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        ) : (
          <Field
            label={income ? "Dia em que recebeu" : "Dia em que pagou"}
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        )}
        <Field label="Como foi pago?" id="payment-method">
          <select
            id="payment-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {["Dinheiro", "Pix", "Cartão", "Boleto", "Transferência"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Cliente, se quiser informar" id="money-client">
          <select
            id="money-client"
            disabled={!!existing.quoteId}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Não precisa informar</option>
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Anotação, se precisar" id="notes">
          <textarea
            id="notes"
            maxLength={3000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </details>
      {existing.quoteId && (
        <p className="help">O valor vem do orçamento nº {existing.quoteId}.</p>
      )}
    </SavedForm>
  );
}
