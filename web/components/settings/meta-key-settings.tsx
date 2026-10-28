"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { MetaKeyStatus, type MetaKeyStatus as Status } from "@/lib/meta-key";
import { useI18n } from "@/lib/i18n/provider";
import { localizeMessage } from "@/lib/i18n/messages";

export function MetaKeySettings() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings/meta-key", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load settings. Open this app on localhost and retry.");
        setStatus(MetaKeyStatus.parse(await response.json()));
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);

  async function update(action: "save" | "import" | "remove") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/settings/meta-key", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "save" ? { action, key } : { action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save settings.");
      setStatus(MetaKeyStatus.parse(result)); setKey("");
      setNotice(action === "remove" ? "Stored key removed. Environment settings apply again." : "Key saved. Your next Muse request will use it; no restart is needed.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save settings."); }
    finally { setBusy(false); }
  }

  return <section className="flex flex-col gap-6" aria-labelledby="meta-key-heading">
    <div className="flex flex-col gap-2">
      <h2 id="meta-key-heading" className="text-xl font-semibold">{t("Meta API key")}</h2>
      <p>{t("Use one key across all projects on this computer.")}</p>
      <p role="status">{status ? `${t("Active provider: {provider}.", { provider: status.activeProvider === "meta" ? "Meta" : "Baseten" })} ${status.source === "sqlite" ? t("Using the key saved locally.") : status.source === "environment" ? t("Using server environment settings.") : t("No API key configured.")}` : t("Loading settings…")}</p>
    </div>
    <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void update("save"); }}>
      <Field>
        <FieldLabel htmlFor="meta-api-key">{t("New Meta API key")}</FieldLabel>
        <Input id="meta-api-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} maxLength={4096} disabled={busy} placeholder={t("Paste your Meta API key")} />
      </Field>
      <Button type="submit" disabled={busy || !status || !key.trim()}>{t("Save key")}</Button>
    </form>
    <div className="flex flex-col gap-3">
      <Button variant="outline" disabled={busy || !status?.environmentAvailable} onClick={() => void update("import")}>{t("Import from .env.local")}</Button>
      <p className="text-sm">{t("Copies the server’s MODEL_API_KEY into local storage. Next.js loads it from .env.local or the launch environment. The key is never displayed here.")}</p>
      <Button variant="outline" disabled={busy || !status?.stored} onClick={() => void update("remove")}>{t("Remove stored key")}</Button>
    </div>
    <p className="text-sm">{t("Saved keys override environment provider settings and use Meta. Removing a saved key restores those settings. Saving does not validate the key with Meta.")}</p>
    <p className="text-sm">{t("Keys are stored unencrypted in this computer’s SQLite database, outside project exports. Keep the local data folder private.")}</p>
    {notice && <p role="status">{localizeMessage(locale, notice)}</p>}
    {error && <p role="alert">{localizeMessage(locale, error)}</p>}
  </section>;
}
