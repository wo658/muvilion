import { ParticipantPortal } from "@/components/booths/participant-portal";
import { Suspense } from "react";

async function ParticipantContent({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ParticipantPortal projectId={projectId}/>;
}

export default function ParticipantPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <Suspense fallback={<main className="p-8" role="status">참가 부스를 불러오는 중…</main>}><ParticipantContent params={params}/></Suspense>;
}
