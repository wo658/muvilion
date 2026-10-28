import { ParticipantPortal } from "@/components/booths/participant-portal";
import { Suspense } from "react";
import { ParticipantLoading } from "@/components/booths/participant-loading";

async function ParticipantContent({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ParticipantPortal projectId={projectId}/>;
}

export default function ParticipantPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <Suspense fallback={<ParticipantLoading/>}><ParticipantContent params={params}/></Suspense>;
}
