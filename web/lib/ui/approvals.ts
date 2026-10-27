/**
 * Approval choices the user makes on Muse messages that need a person's OK (`needs_approval`).
 * Client state only: the run itself is not changed; the choice is reflected in the final summary.
 */
import type { SayInfo } from "@/lib/agent/events";

export type ApprovalChoice = "approved" | "kept";
export type ApprovalState = Record<string, ApprovalChoice>;
export type ApprovalAction = { type: "decide"; id: string; choice: ApprovalChoice } | { type: "undo"; id: string } | { type: "reset" };

export function approvalReducer(state: ApprovalState, action: ApprovalAction): ApprovalState {
  switch (action.type) {
    case "decide":
      return state[action.id] === action.choice ? state : { ...state, [action.id]: action.choice };
    case "undo": {
      if (!(action.id in state)) return state;
      const next = { ...state };
      delete next[action.id];
      return next;
    }
    case "reset":
      return Object.keys(state).length ? {} : state;
  }
}

/** Stable id of a Muse message within one run (its position in the feed plus what it is about). */
export const sayId = (m: SayInfo, index: number) => `${index}:${m.moment}:${m.iteration ?? "-"}`;

export type ApprovalItem = { id: string; text: string; choice: ApprovalChoice | null };

export function approvalItems(messages: SayInfo[], state: ApprovalState): ApprovalItem[] {
  return messages.flatMap((m, i) => {
    if (!m.needs_approval) return [];
    const id = sayId(m, i);
    return [{ id, text: m.text, choice: state[id] ?? null }];
  });
}

/** One line per approval for the summary sheet and the copied summary. */
export function approvalLine(item: ApprovalItem): string {
  const verdict = item.choice === "approved" ? "Approved" : item.choice === "kept" ? "Kept the original" : "Not answered yet";
  return `${verdict}: ${item.text}`;
}
