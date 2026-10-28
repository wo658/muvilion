"use client";

import Link from "next/link";
import { MetaKeySettings } from "@/components/settings/meta-key-settings";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { t } = useI18n();
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-8 p-6">
    <Link href="/">{t("← Back to studio")}</Link>
    <h1 className="text-2xl font-semibold">{t("Local settings")}</h1>
    <MetaKeySettings />
  </main>;
}
