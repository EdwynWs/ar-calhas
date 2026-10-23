import { useState } from "react";
import { Field, SavedForm, useSave } from "../components/Common";
import { api } from "../utils";
export default function CompanyForm({ settings, onSaved, onDirty }) {
  const [form, setForm] = useState(settings),
    { busy, error, run } = useSave();
  return (
    <SavedForm
      onDirty={onDirty}
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api("/settings", "PUT", form);
          onSaved("Pronto! Os dados da empresa foram salvos.");
        });
      }}
      busy={busy}
      error={error}
    >
      <p>Esses dados aparecem no orçamento impresso.</p>
      {[
        ["company", "Nome da empresa"],
        ["phone", "Telefone"],
        ["document", "CPF ou CNPJ"],
        ["address", "Endereço"],
      ].map(([key, label]) => (
        <Field
          key={key}
          label={label}
          required={key === "company"}
          maxLength={
            key === "document"
              ? 30
              : key === "phone"
                ? 40
                : key === "company"
                  ? 200
                  : 500
          }
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      ))}
    </SavedForm>
  );
}
