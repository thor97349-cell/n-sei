import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

declare global {
  var __nseiDb: Database.Database | undefined;
}

function initDb(): Database.Database {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(path.join(dataDir, "n-sei.db"));
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS professionals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      expertise_area TEXT NOT NULL,
      years_experience INTEGER NOT NULL,
      hourly_rate REAL NOT NULL,
      availability TEXT NOT NULL,
      bio TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      business_type TEXT NOT NULL,
      num_employees INTEGER NOT NULL,
      help_needed TEXT NOT NULL,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL,
      budget TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

// Lazily opened on first real use so importing this module (e.g. during
// Next.js build-time page-data collection, potentially from several
// workers at once) never touches the SQLite file.
export function getDb(): Database.Database {
  if (!global.__nseiDb) {
    global.__nseiDb = initDb();
  }
  return global.__nseiDb;
}
