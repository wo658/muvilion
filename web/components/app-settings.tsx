"use client";

import { useRef } from "react";
import { SettingsIcon, XIcon } from "lucide-react";
import { Button } from "./ui/button";
import { NativeSelect } from "./ui/native-select";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { useI18n } from "@/lib/i18n/provider";

export function AppSettings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const { locale, setLocale, t } = useI18n();
  return <>
    <Button variant="ghost" size="icon-sm" aria-label={t("Settings")} onClick={() => dialog.current?.showModal()}><SettingsIcon/></Button>
    <dialog ref={dialog} className="app-settings" aria-labelledby="app-settings-title">
      <header><h2 id="app-settings-title">{t("Settings")}</h2><Button variant="ghost" size="icon-sm" aria-label={t("Close")} onClick={() => dialog.current?.close()}><XIcon/></Button></header>
      <FieldGroup><Field><FieldLabel htmlFor="app-language">{t("Language")}</FieldLabel><NativeSelect id="app-language" value={locale} onChange={event => setLocale(event.target.value === "en" ? "en" : "ko")}><option value="en">Eng</option><option value="ko">한국어</option></NativeSelect></Field></FieldGroup>
    </dialog>
  </>;
}
