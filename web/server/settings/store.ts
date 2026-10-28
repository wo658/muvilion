import "server-only";
import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** Local app settings, shared by projects. Never include this database in project exports. */
export function withSettings<T>(read: (db: DatabaseSync) => T): T {
  const directory = resolve(process.env.MUVILION_DATA_DIR ?? join(process.cwd(), "data"));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "app.sqlite");
  const db = new DatabaseSync(path);
  try {
    chmodSync(path, 0o600);
    db.exec(`PRAGMA busy_timeout = 5000;
      PRAGMA secure_delete = ON;
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        meta_api_key TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;`);
    return read(db);
  } finally {
    db.close();
  }
}

export function storedMetaKey(): string | undefined {
  return withSettings(db => {
    const row = db.prepare("SELECT meta_api_key FROM app_settings WHERE id = 1").get();
    return row ? String(row.meta_api_key) : undefined;
  });
}

export function saveMetaKey(key: string): void {
  withSettings(db => db.prepare(`INSERT INTO app_settings (id, meta_api_key, updated_at)
    VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET
    meta_api_key = excluded.meta_api_key, updated_at = excluded.updated_at`).run(key, new Date().toISOString()));
}

export function removeMetaKey(): void {
  withSettings(db => db.prepare("DELETE FROM app_settings WHERE id = 1").run());
}
