"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { ModelModeStatus } from "@/lib/model-mode";
import { Field, FieldLabel } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/provider";

export function ModelModeSettings() {
  const { t } = useI18n();
  const [status, setStatus] = useState<z.infer<typeof ModelModeStatus> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings/model-mode", { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); setStatus(ModelModeStatus.parse(await response.json())); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  async function change(checked: boolean) {
    setBusy(true); setError(false);
    try {
      const response = await fetch("/api/settings/model-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checked ? "contributor" : "standard") });
      if (!response.ok) throw new Error();
      setStatus(ModelModeStatus.parse(await response.json()));
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <section className="flex flex-col gap-3" aria-labelledby="model-mode-heading">
    <h4 id="model-mode-heading" className="font-medium">{t("Model data use")}</h4>
    <Field orientation="horizontal">
      <input id="model-contributor" type="checkbox" className="size-4 shrink-0 accent-[var(--accent)]" checked={status?.mode === "contributor"} disabled={!status?.supported || busy} onChange={event => void change(event.target.checked)} aria-describedby="model-contributor-description"/>
      <FieldLabel htmlFor="model-contributor">{t("Use Contributor pricing")}</FieldLabel>
    </Field>
    <p id="model-contributor-description" className="settings-description">{t("Allow Meta to use the prompts, drawings, reference files and responses sent to Muse Spark to train and improve its models in exchange for discounted API pricing. Uncheck to use Standard without training use.")}</p>
    <p className="settings-description">{t("This choice applies to this browser's next requests, including its open tabs. It does not change other visitors' choices or undo data already sent. Muse Image is separate.")}</p>
    {status && <p role="status" className="settings-description">{status.supported ? status.mode === "contributor" ? t("Contributor enabled for this browser.") : t("Standard enabled for this browser.") : t("Contributor selection is unavailable for the configured provider or model.")}</p>}
    {error && <p role="alert" className="text-sm text-bad">{t("Could not update model data settings. Reopen Settings and try again.")}</p>}
  </section>;
}
