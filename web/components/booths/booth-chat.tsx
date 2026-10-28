"use client";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "../ui";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Textarea } from "../ui/textarea";
import { useI18n } from "@/lib/i18n/provider";

type Props = { projectId: string; selectedZoneId?: string | null; applicationId?: string; token?: string; onDesign?: (brief: string) => void; designing?: boolean };
export function BoothChat({ projectId, selectedZoneId, applicationId, token, onDesign, designing }: Props) {
  const { t, locale } = useI18n();
  const [transport] = useState(() => new DefaultChatTransport({
    api: `/api/booths/projects/${projectId}/chat`,
    prepareSendMessagesRequest: ({ messages, body }) => ({ body: {
      applicationId: body?.applicationId, selectedZoneId: body?.selectedZoneId, locale: body?.locale,
      messages: messages.slice(-24).map(message => ({ role: message.role, parts: message.parts.filter(part => part.type === "text").map(part => ({ type: "text", text: part.text })) })),
    } }),
  }));
  const { messages, sendMessage, status, error, stop, clearError } = useChat({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim(); setInput(""); clearError();
    await sendMessage({ text }, { body: { applicationId, selectedZoneId, locale }, headers: token ? { authorization: `Bearer ${token}` } : undefined });
  }
  return <section className="flex flex-col gap-4 border-b border-hairline p-5" aria-label={t("Muse booth designer")}>
    <header><h2 className="text-sm font-semibold">{t("Muse · Booth designer")}</h2><p className="mt-2 text-xs text-muted">{onDesign ? t("Let’s design your booth layout and brand experience together.") : t("Let’s find a booth that fits your goals and budget. You can apply at the listed price.")}</p></header>
    {!messages.length && <div className="flex flex-wrap gap-2">{(onDesign ? [t("I want a booth for product demos and consultations"), t("Suggest a layout that makes our brand stand out")] : [t("Recommend an experience booth within a 1,000,000 KRW budget"), t("Tell me the price, pros and cons of the selected booth")]).map(text => <Button key={text} className="h-auto whitespace-normal text-left" onClick={() => setInput(text)}>{text}</Button>)}</div>}
    <div className="flex max-h-80 flex-col gap-4 overflow-y-auto" role="log" aria-live="polite">{messages.map(message => <article key={message.id}><strong className="text-xs text-muted">{message.role === "user" ? t("You") : "Muse"}</strong>{message.parts.map((part, index) => part.type === "text" ? <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p> : null)}</article>)}</div>
    {error && <p role="alert">{t("Muse couldn’t reply. Check the API settings and send again.")}</p>}
    <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void send(); }}>
      <FieldGroup><Field><FieldLabel htmlFor="booth-muse-input" className="sr-only">{t("Talk to the booth designer")}</FieldLabel><Textarea id="booth-muse-input" value={input} onChange={event => setInput(event.target.value)} maxLength={6000} placeholder={t("Tell me your goals, budget and the booth experience you want")} rows={3}/></Field></FieldGroup>
      <div className="flex flex-wrap gap-2">{busy ? <Button onClick={() => void stop()}>{t("Stop reply")}</Button> : <Button type="submit" variant="primary" disabled={!input.trim()}>{t("Send to Muse")}</Button>}{onDesign && <Button disabled={busy || designing || !input.trim()} onClick={() => onDesign(input.trim())}>{designing ? t("Designing booth…") : t("Design the booth from this")}</Button>}</div>
    </form>
  </section>;
}
