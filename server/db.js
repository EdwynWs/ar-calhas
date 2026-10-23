import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const existed = existsSync(path);
  const db = new DatabaseSync(path);
  // Antes de qualquer alteração de esquema em um banco existente, faça uma cópia consistente.
  const oldVersion = db.prepare("PRAGMA user_version").get().user_version;
  if (
    existed &&
    oldVersion < 2 &&
    db.prepare("SELECT name FROM sqlite_master WHERE name='settings'").get()
  ) {
    const folder = dirname(path) + "/migration-backups";
    mkdirSync(folder, { recursive: true });
    const destination = folder + "/antes-v2-" + Date.now() + ".sqlite";
    db.prepare("VACUUM INTO ?").run(destination);
    console.log("Backup anterior à atualização criado: " + destination);
  }
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), company TEXT NOT NULL DEFAULT 'AR Calhas', phone TEXT DEFAULT '', document TEXT DEFAULT '', address TEXT DEFAULT '', initialBalanceCents INTEGER NOT NULL DEFAULT 0, monthlyGoalCents INTEGER NOT NULL DEFAULT 3000000);
 INSERT OR IGNORE INTO settings(id) VALUES(1);
 CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', document TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS quotes(id INTEGER PRIMARY KEY, clientId INTEGER NOT NULL REFERENCES clients(id), title TEXT NOT NULL, date TEXT NOT NULL, validUntil TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Rascunho','Enviado','Aprovado','Recusado')), jobStatus TEXT NOT NULL DEFAULT 'A iniciar' CHECK(jobStatus IN ('A iniciar','Produção','Instalação','Concluído')), scheduledDate TEXT NOT NULL DEFAULT '', items TEXT NOT NULL, discountCents INTEGER NOT NULL DEFAULT 0, totalCents INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('income','expense')), description TEXT NOT NULL, category TEXT NOT NULL, amountCents INTEGER NOT NULL CHECK(amountCents>0), dueDate TEXT NOT NULL, paidDate TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('pending','paid')), method TEXT NOT NULL, clientId INTEGER REFERENCES clients(id), quoteId INTEGER UNIQUE REFERENCES quotes(id), notes TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, clientId INTEGER REFERENCES clients(id), notes TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, userId INTEGER, action TEXT NOT NULL, entity TEXT NOT NULL, recordId INTEGER, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 `);
  if (oldVersion < 2) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS deleted_records(id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, record TEXT NOT NULL, deletedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, restored INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS request_keys(key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, response TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      PRAGMA user_version=2;
      COMMIT;`);
  }
  return db;
}
