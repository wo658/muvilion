/** Plain-text summary of the chosen layout ("Copy summary" on the use-this-layout sheet). */
import type { SayInfo } from "@/lib/agent/events";
import { approvalLine, type ApprovalItem } from "./approvals";
import { headline, HEADLINE_LABEL } from "./plain";

export type LayoutSummaryInput = {
  venueName: string;
  boothCount: number;
  visitors: number;
  before?: number;
  after?: number;
  approvals: ApprovalItem[];
  cautions: SayInfo[];
};

export function onSiteChecks(cautions: SayInfo[]): string[] {
  return [...new Set(cautions.map((c) => c.text))];
}

export function layoutSummary(s: LayoutSummaryInput): string {
  const lines = [`Layout plan for ${s.venueName}`, "", `${s.boothCount} booths, tested with ${s.visitors} virtual visitors.`];
  if (s.before !== undefined) lines.push(`${HEADLINE_LABEL}: ${headline(s.before, s.after).text}`);
  if (s.approvals.length) lines.push("", "Approvals:", ...s.approvals.map((a) => `- ${approvalLine(a)}`));
  const checks = onSiteChecks(s.cautions);
  lines.push("", "Check on site:", ...(checks.length ? checks.map((c) => `- ${c}`) : ["- Nothing flagged by Muse."]));
  return lines.join("\n");
}
