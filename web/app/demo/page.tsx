import Link from "next/link";
import { SimpleView } from "@/components/simple/simple-view";

export default function DemoPage() {
  return <main><div className="border-b border-hairline bg-surface px-4 py-2 text-xs"><Link href="/" className="text-accent">← 프로젝트 홈</Link><span className="ml-4 text-muted">샘플 행사장 분석</span></div><SimpleView /></main>;
}
