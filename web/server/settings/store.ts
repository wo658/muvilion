import "server-only";
import { withDatabase } from "@/server/database";

export function storedMetaKey(): string | undefined {
  return withDatabase(db => {
    const row = db.prepare("SELECT meta_api_key FROM app_settings WHERE id = 1").get();
    return row ? String(row.meta_api_key) : undefined;
  });
}

export function saveMetaKey(key: string): void {
  withDatabase(db => db.prepare(`INSERT INTO app_settings (id, meta_api_key, updated_at)
    VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET
    meta_api_key = excluded.meta_api_key, updated_at = excluded.updated_at`).run(key, new Date().toISOString()));
}

export function removeMetaKey(): void {
  withDatabase(db => db.prepare("DELETE FROM app_settings WHERE id = 1").run());
}
