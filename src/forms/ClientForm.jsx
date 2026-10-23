import { useState, useRef } from "react";
import { Field, SavedForm, useSave } from "../components/Common";
import { api, requestKey } from "../utils";
export default function ClientForm({ record, onSaved, onDirty }) {
  const [form, setForm] = useState({
      name: "",
      phone: "",
      address: "",
      email: "",
      document: "",
      notes: "",
      ...record,
    }),
    { busy, error, run } = useSave(),
    key = useRef(requestKey());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <SavedForm
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api(
            "/clients" + (record ? "/" + record.id : ""),
            record ? "PUT" : "POST",
            form,
            key.current,
          );
          onSaved("Pronto! O cliente foi salvo.");
        });
      }}
      onDirty={onDirty}
      busy={busy}
      error={error}
      button="Salvar cliente"
    >
      <Field
        label="Nome"
        required
        maxLength={200}
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <Field
        label="Telefone, se tiver"
        type="tel"
        maxLength={40}
        value={form.phone}
        onChange={(e) => set("phone", e.target.value)}
      />
      <Field
        label="Endereço, se quiser informar"
        maxLength={500}
        value={form.address}
        onChange={(e) => set("address", e.target.value)}
      />
      <details className="form-details">
        <summary>Mais informações, se precisar</summary>
        <Field
          label="CPF ou CNPJ"
          maxLength={30}
          value={form.document}
          onChange={(e) => set("document", e.target.value)}
        />
        <Field
          label="E-mail"
          type="email"
          maxLength={200}
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Field
          label="Anotação"
          maxLength={3000}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </details>
    </SavedForm>
  );
}
