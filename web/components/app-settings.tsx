"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Button } from "./ui/button";
import { NativeSelect } from "./ui/native-select";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { MetaKeySettings } from "./settings/meta-key-settings";
import { useI18n } from "@/lib/i18n/provider";

export type SettingsSection = { id: string; label: string; content: ReactNode };

/** Modal settings with a section nav. `section` is the open section; null closes the dialog. */
export function AppSettings({ section, onSectionChange, sections = [] }: {
  section: string | null;
  onSectionChange: (section: string | null) => void;
  sections?: SettingsSection[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { locale, setLocale, t } = useI18n();
  const all: SettingsSection[] = [
    { id: "general", label: t("General"), content: <FieldGroup><Field><FieldLabel htmlFor="app-language">{t("Language")}</FieldLabel><NativeSelect id="app-language" value={locale} onChange={event => setLocale(event.target.value === "en" ? "en" : "ko")}><option value="en">Eng</option><option value="ko">한국어</option></NativeSelect></Field></FieldGroup> },
    { id: "api-key", label: t("API key"), content: <MetaKeySettings/> },
    ...sections,
  ];
  const active = all.find(item => item.id === section) ?? all[0];
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (section !== null && !element.open) element.showModal();
    else if (section === null && element.open) element.close();
  }, [section]);
  return <dialog ref={dialog} className="app-settings" aria-labelledby="app-settings-title" onClose={() => onSectionChange(null)}>
    <header><h2 id="app-settings-title">{t("Settings")}</h2><Button variant="ghost" size="icon-sm" aria-label={t("Close")} onClick={() => onSectionChange(null)}><XIcon/></Button></header>
    <div className="app-settings-body">
      <nav aria-label={t("Settings sections")}>{all.map(item => <button key={item.id} type="button" aria-current={item.id === active.id ? "page" : undefined} onClick={() => onSectionChange(item.id)}>{item.label}</button>)}</nav>
      <div className="app-settings-content">{section !== null && active.content}</div>
    </div>
  </dialog>;
}
