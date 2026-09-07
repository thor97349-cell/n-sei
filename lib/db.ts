import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getConnectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      "Banco de dados não configurado: defina DATABASE_URL. Na Vercel, adicione um banco Postgres ao projeto em Storage → Create Database (Neon) — a variável é criada automaticamente.",
    );
  }

  return url;
}

// Lazily created so importing this module (e.g. during Next.js build-time
// page-data collection) never requires DATABASE_URL to be set.
function getSql(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    sqlClient = neon(getConnectionString());
  }
  return sqlClient;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          deadline DATE,
          invite_token TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (project_id, email)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          assignee_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          deadline DATE,
          status TEXT NOT NULL DEFAULT 'pendente',
          proof_text TEXT,
          proof_image TEXT,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })();
  }
  return schemaReady;
}

export async function getSqlReady(): Promise<NeonQueryFunction<false, false>> {
  await ensureSchema();
  return getSql();
}
