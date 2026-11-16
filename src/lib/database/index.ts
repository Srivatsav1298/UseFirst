import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Database = PgliteDatabase<typeof schema>;

type GlobalDb = {
  client?: PGlite;
  db?: Database;
  ready?: Promise<Database>;
};

const globalForDb = globalThis as unknown as { __useFirstDb?: GlobalDb };
const state: GlobalDb = (globalForDb.__useFirstDb ??= {});

async function createDatabase(): Promise<Database> {
  const dataDir = process.env.PGLITE_DATA_DIR || "./data/pglite";
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = drizzle(client, { schema });
  await runMigrations(client);
  state.client = client;
  state.db = db;
  return db;
}

async function runMigrations(client: PGlite): Promise<void> {
  await client.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());`,
  );
  const dir = join(process.cwd(), "database", "migrations");
  let files: string[] = [];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    throw new Error(`Migration directory not found: ${dir}`);
  }
  for (const file of files) {
    const applied = await client.query<{ name: string }>(
      `SELECT name FROM _migrations WHERE name = $1`,
      [file],
    );
    if (applied.rows.length > 0) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    await client.exec("BEGIN");
    try {
      await client.exec(sql);
      await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
      await client.exec("COMMIT");
    } catch (error) {
      await client.exec("ROLLBACK");
      throw error;
    }
  }
}

export function getDb(): Database {
  if (state.db) return state.db;
  throw new Error("Database not initialised. Call await db() first.");
}

export async function db(): Promise<Database> {
  if (state.db) return state.db;
  if (!state.ready) state.ready = createDatabase();
  return state.ready;
}

export async function closeDb(): Promise<void> {
  await state.client?.close();
  state.client = undefined;
  state.db = undefined;
  state.ready = undefined;
}
