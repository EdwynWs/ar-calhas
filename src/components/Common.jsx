import { useEffect, useRef, useState } from "react";
import { api } from "../utils";
export function Button({ children, variant = "", ...props }) {
  return (
    <button type="button" className={"button " + variant} {...props}>
      {children}
    </button>
  );
}
export function Field({ label, error, children, ...props }) {
  const id = props.id || label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children || (
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? id + "-error" : undefined}
          {...props}
        />
      )}{" "}
      {error && (
        <p className="field-error" id={id + "-error"}>
          {error}
        </p>
      )}
    </div>
  );
}
export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}
export function Notice({ notice, onClose, onUndo }) {
  return (
    notice && (
      <div
        className={"notice " + (notice.error ? "error" : "")}
        role={notice.error ? "alert" : "status"}
      >
        <p>{notice.message}</p>
        {notice.undoId && (
          <Button onClick={() => onUndo(notice.undoId)}>
            Desfazer exclusão
          </Button>
        )}
        <Button variant="plain" onClick={onClose}>
          Fechar aviso
        </Button>
      </div>
    )
  );
}
export function useSave() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  const run = async (fn) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}
export function SavedForm({
  children,
  onSubmit,
  onDirty,
  busy,
  error,
  button = "Salvar",
}) {
  return (
    <form
      className="form-panel"
      onChange={() => onDirty(true)}
      onSubmit={onSubmit}
      aria-busy={busy}
    >
      {children}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="save-row">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Salvando…" : button}
        </Button>
      </div>
    </form>
  );
}
export function Deleted({ entity, onRestore }) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState([]),
    [error, setError] = useState("");
  async function load() {
    try {
      setRows((await api("/deleted")).filter((r) => r.entity === entity));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <details
      className="secondary-details"
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        if (e.currentTarget.open) load();
      }}
    >
      <summary>Recuperar algo que excluí</summary>
      {error && <p role="alert">{error}</p>}
      {open && !rows.length && !error && <p>Nada para recuperar aqui.</p>}
      {rows.map((r) => (
        <div className="recover-row" key={r.id}>
          <span>{r.record.description || r.record.name || r.record.title}</span>
          <Button
            onClick={async () => {
              if (await onRestore(r.id)) load();
            }}
          >
            Recuperar
          </Button>
        </div>
      ))}
    </details>
  );
}
export function FocusTitle({ children, route }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.focus();
  }, [route]);
  return (
    <h1 tabIndex={-1} ref={ref}>
      {children}
    </h1>
  );
}
