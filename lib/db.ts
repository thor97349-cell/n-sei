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
        CREATE TABLE IF NOT EXISTS professionals (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          city TEXT NOT NULL,
          expertise_area TEXT NOT NULL,
          years_experience INTEGER NOT NULL,
          hourly_rate DOUBLE PRECISION NOT NULL,
          availability TEXT NOT NULL,
          bio TEXT,
          linkedin_url TEXT,
          status TEXT NOT NULL DEFAULT 'novo',
          payment_status TEXT NOT NULL DEFAULT 'pendente',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Tables already existed in production before these columns were added.
      await sql`
        ALTER TABLE professionals ADD COLUMN IF NOT EXISTS linkedin_url TEXT
      `;
      await sql`
        ALTER TABLE professionals ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendente'
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS businesses (
          id SERIAL PRIMARY KEY,
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
          willingness_to_pay DOUBLE PRECISION,
          status TEXT NOT NULL DEFAULT 'novo',
          payment_status TEXT NOT NULL DEFAULT 'pendente',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS willingness_to_pay DOUBLE PRECISION
      `;
      await sql`
        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendente'
      `;
    })();
  }
  return schemaReady;
}

export async function getSqlReady(): Promise<NeonQueryFunction<false, false>> {
  await ensureSchema();
  return getSql();
}
