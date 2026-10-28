"use client";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "../ui";
import { Field, FieldGroup, FieldLabel } from "../ui/field";
import { Textarea } from "../ui/textarea";

type Props = { projectId: string; selectedZoneId?: string | null; applicationId?: string; token?: string; onDesign?: (brief: string) => void; designing?: boolean };
export function BoothChat({ projectId, selectedZoneId, applicationId, token, onDesign, designing }: Props) {
  const [transport] = useState(() => new DefaultChatTransport({
    api: `/api/booths/projects/${projectId}/chat`,
    prepareSendMessagesRequest: ({ messages, body }) => ({ body: {
      applicationId: body?.applicationId, selectedZoneId: body?.selectedZoneId,
      messages: messages.slice(-24).map(message => ({ role: message.role, parts: message.parts.filter(part => part.type === "text").map(part => ({ type: "text", text: part.text })) })),
    } }),
  }));
  const { messages, sendMessage, status, error, stop, clearError } = useChat({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim(); setInput(""); clearError();
    await sendMessage({ text }, { body: { applicationId, selectedZoneId }, headers: token ? { authorization: `Bearer ${token}` } : undefined });
  }
  return <section className="flex flex-col gap-4 border-b border-hairline p-5" aria-label="Muse 부스 디자이너">
    <header><h2 className="text-sm font-semibold">Muse · 부스 디자이너</h2><p className="mt-2 text-xs text-muted">{onDesign ? "내 부스의 구성과 브랜드 경험을 함께 디자인해요." : "목적과 예산에 맞는 부스를 함께 골라요. 표시된 가격으로 신청할 수 있어요."}</p></header>
    {!messages.length && <div className="flex flex-wrap gap-2">{(onDesign ? ["제품 체험과 상담이 가능한 부스로 꾸미고 싶어", "우리 브랜드를 돋보이게 할 구성을 제안해줘"] : ["예산 100만원 안에서 체험 부스를 추천해줘", "선택한 부스의 가격과 장단점을 알려줘"]).map(text => <Button key={text} className="h-auto whitespace-normal text-left" onClick={() => setInput(text)}>{text}</Button>)}</div>}
    <div className="flex max-h-80 flex-col gap-4 overflow-y-auto" role="log" aria-live="polite">{messages.map(message => <article key={message.id}><strong className="text-xs text-muted">{message.role === "user" ? "나" : "Muse"}</strong>{message.parts.map((part, index) => part.type === "text" ? <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p> : null)}</article>)}</div>
    {error && <p role="alert">Muse가 답변하지 못했습니다. API 설정을 확인하고 다시 보내 주세요.</p>}
    <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void send(); }}>
      <FieldGroup><Field><FieldLabel htmlFor="booth-muse-input" className="sr-only">부스 디자이너에게 이야기하기</FieldLabel><Textarea id="booth-muse-input" value={input} onChange={event => setInput(event.target.value)} maxLength={6000} placeholder="목적, 예산, 원하는 부스 경험을 알려주세요" rows={3}/></Field></FieldGroup>
      <div className="flex flex-wrap gap-2">{busy ? <Button onClick={() => void stop()}>답변 중단</Button> : <Button type="submit" variant="primary" disabled={!input.trim()}>Muse에게 보내기</Button>}{onDesign && <Button disabled={busy || designing || !input.trim()} onClick={() => onDesign(input.trim())}>{designing ? "부스 디자인 중…" : "이 내용으로 부스 디자인"}</Button>}</div>
    </form>
  </section>;
}
