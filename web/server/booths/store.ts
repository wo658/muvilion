import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Node's bundled SQLite keeps this single-host feature durable without a separate service.
// The project still targets Node 20 types; this narrow interface describes the Node 22.13+ API.
type SqlValue = string | number | null;
export type SqlRow = Record<string, string | number | null>;
export type BoothDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { run(...params: SqlValue[]): unknown; get(...params: SqlValue[]): SqlRow | undefined; all(...params: SqlValue[]): SqlRow[] };
  close(): void;
};
// Resolve the native builtin at runtime; bundlers must not rewrite it as a file URL.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as { DatabaseSync: new (path: string) => BoothDatabase };

export function withBoothDatabase<T>(action: (db: BoothDatabase) => T): T {
  const path = process.env.BOOTH_DB_PATH ?? resolve(process.cwd(), ".data/booths.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS booth_projects (id TEXT PRIMARY KEY, organizer_hash TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS booth_applications (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, booth_id TEXT NOT NULL, status TEXT NOT NULL, applicant_hash TEXT NOT NULL, data TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_approved_application ON booth_applications(project_id, booth_id) WHERE status = 'approved';
      CREATE INDEX IF NOT EXISTS applications_by_project ON booth_applications(project_id);`);
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = action(db);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally { db.close(); }
}
