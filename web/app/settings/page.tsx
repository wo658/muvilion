import Link from "next/link";
import { MetaKeySettings } from "@/components/settings/meta-key-settings";

export default function SettingsPage() {
  return <main className="mx-auto flex w-full max-w-xl flex-col gap-8 p-6">
    <Link href="/">← Back to studio</Link>
    <h1 className="text-2xl font-semibold">Local settings</h1>
    <MetaKeySettings />
  </main>;
}
