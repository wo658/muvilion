import "server-only";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** One local database for app settings, project state and file contents. */
export function withDatabase<T>(read: (db: DatabaseSync) => T): T {
  const directory = resolve(process.env.MUVILION_DATA_DIR ?? join(process.cwd(), "data"));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "app.sqlite");
  const db = new DatabaseSync(path);
  try {
    chmodSync(path, 0o600);
    db.exec(`PRAGMA busy_timeout = 5000;
      PRAGMA secure_delete = ON;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        meta_api_key TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
        state_json TEXT NOT NULL, legacy_key TEXT UNIQUE,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL, mime_type TEXT NOT NULL, content BLOB NOT NULL,
        digest TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('original', 'image')),
        created_at TEXT NOT NULL, UNIQUE(project_id, digest, kind)
      ) STRICT;`);
    return read(db);
  } finally {
    db.close();
  }
}
