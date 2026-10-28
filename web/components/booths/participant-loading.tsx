"use client";
import { useI18n } from "@/lib/i18n/provider";

export function ParticipantLoading() {
  const { t } = useI18n();
  return <main className="p-8" role="status">{t("Loading participant booths…")}</main>;
}
