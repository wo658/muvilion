"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { MetaKeyStatus, type MetaKeyStatus as Status } from "@/lib/meta-key";

export function MetaKeySettings() {
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
      <h2 id="meta-key-heading" className="text-xl font-semibold">Meta API key</h2>
      <p>Use one key across all projects on this computer.</p>
      <p role="status">{status ? `Active provider: ${status.activeProvider === "meta" ? "Meta" : "Baseten"}. ${status.source === "sqlite" ? "Using the key saved locally." : status.source === "environment" ? "Using server environment settings." : "No API key configured."}` : "Loading settings…"}</p>
    </div>
    <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void update("save"); }}>
      <Field>
        <FieldLabel htmlFor="meta-api-key">New Meta API key</FieldLabel>
        <Input id="meta-api-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} maxLength={4096} disabled={busy} placeholder="Paste your Meta API key" />
      </Field>
      <Button type="submit" disabled={busy || !status || !key.trim()}>Save key</Button>
    </form>
    <div className="flex flex-col gap-3">
      <Button variant="outline" disabled={busy || !status?.environmentAvailable} onClick={() => void update("import")}>Import from .env.local</Button>
      <p className="text-sm">Copies the server’s MODEL_API_KEY into local storage. Next.js loads it from .env.local or the launch environment. The key is never displayed here.</p>
      <Button variant="outline" disabled={busy || !status?.stored} onClick={() => void update("remove")}>Remove stored key</Button>
    </div>
    <p className="text-sm">Saved keys override environment provider settings and use Meta. Removing a saved key restores those settings. Saving does not validate the key with Meta.</p>
    <p className="text-sm">Keys are stored unencrypted in this computer’s SQLite database, outside project exports. Keep the local data folder private.</p>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
