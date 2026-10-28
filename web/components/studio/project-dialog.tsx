"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "../ui/button";

/** Project-level modal opened from the workspace header. Content stays mounted while closed. */
export function ProjectDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  return <dialog ref={dialog} className="ps-source-manager" aria-labelledby={titleId} onClose={onClose}>
    <header><h2 id={titleId}>{title}</h2><Button variant="ghost" size="icon-sm" aria-label={t("Close")} onClick={onClose}><XIcon/></Button></header>
    {children}
  </dialog>;
}
