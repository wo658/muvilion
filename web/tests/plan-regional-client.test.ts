import type { PlanDocument } from "@/lib/plans/schema";
import { describe, expect, it } from "vitest";
import { runRegionalBatches, globalWallAuditBatches, applyGlobalWallAudit, type RegionalProgress } from "@/lib/plans/regional-client";

describe("regional Muse client worker pool", () => {
  it("visits every batch with at most three concurrent requests", async () => {
    const batches = Array.from({ length: 11 }, (_, index) => index);
    const seen: number[] = [];
    let active = 0, maximum = 0;
    const updates: RegionalProgress[] = [];
    const outcome = await runRegionalBatches(batches, async batch => {
      seen.push(batch); active++; maximum = Math.max(maximum, active);
      await Promise.resolve(); active--;
      return batch;
    }, new AbortController().signal, progress => updates.push(progress));
    expect(maximum).toBe(3);
    expect(seen).toEqual(batches);
    expect(outcome.results.toSorted((a, b) => a - b)).toEqual(batches);
    expect(outcome.progress).toEqual({ total: 11, completed: 11, failed: 0, settled: 11 });
    expect(updates[0].completed).toBe(0);
    expect(updates.at(-1)?.completed).toBe(11);
  });
  it("keeps successful results while failures do not count as reviewed", async () => {
    const outcome = await runRegionalBatches([0, 1, 2, 3], async batch => {
      if (batch === 1) throw new Error("Region unavailable");
      return batch;
    }, new AbortController().signal, () => {});
    expect(outcome.results.toSorted()).toEqual([0, 2, 3]);
    expect(outcome.errors).toEqual(["Region unavailable"]);
    expect(outcome.progress).toEqual({ total: 4, completed: 3, failed: 1, settled: 4 });
  });
  it("stops scheduling on cancel and retains a completed partial result", async () => {
    const controller = new AbortController();
    const visited: number[] = [];
    const outcome = await runRegionalBatches([0, 1, 2, 3], async batch => {
      visited.push(batch); controller.abort(); return batch;
    }, controller.signal, () => {});
    expect(visited).toEqual([0]);
    expect(outcome.results).toEqual([0]);
    expect(outcome.cancelled).toBe(true);
    expect(outcome.progress).toEqual({ total: 4, completed: 1, failed: 0, settled: 1 });
  });
  it("never counts aborted requests as failures or successes", async () => {
    const controller = new AbortController();
    const outcome = await runRegionalBatches([0, 1], async () => {
      controller.abort(); throw new DOMException("Cancelled", "AbortError");
    }, controller.signal, () => {});
    expect(outcome.results).toEqual([]);
    expect(outcome.errors).toEqual([]);
    expect(outcome.progress).toEqual({ total: 2, completed: 0, failed: 0, settled: 0 });
  });
});


describe("full-page wall context audit", () => {
  const base: PlanDocument = {
    schemaVersion: 1, source: { name: "plan.pdf", format: "pdf", page: 1, pages: 1, width: 100, height: 100 },
    preview: "data:image/png;base64,AA==", widthMeters: null, heightMeters: null, scaleConfirmed: false,
    texts: [{id:"label", text:"floor trench",x:0.5,y:0.5}], warnings: [], method: "pdf-vector",
    lines: [
      {id:"a",a:{x:0.1,y:0.1},b:{x:0.8,y:0.1},kind:"unknown",origin:"vector",confidence:0.3},
      {id:"b",a:{x:0.1,y:0.2},b:{x:0.8,y:0.2},kind:"unknown",origin:"vector",confidence:0.3},
      {id:"c",a:{x:0.1,y:0.3},b:{x:0.8,y:0.3},kind:"wall",origin:"manual",confidence:1},
      {id:"d",a:{x:0.1,y:0.4},b:{x:0.8,y:0.4},kind:"unknown",origin:"vector",confidence:0.3},
    ],
  };
  const proposed: PlanDocument = { ...base, lines: base.lines.map(line => ({...line,kind:line.id==="d"?"dimension":"wall",confidence:0.9})) };
  it("audits only new walls in the original full-image coordinate frame", () => {
    const [batch] = globalWallAuditBatches(base, proposed);
    expect(batch.preview).toBe(base.preview);
    expect(batch.source).toEqual(base.source);
    expect(batch.texts).toEqual(base.texts);
    expect(batch.lines.map(line=>line.id)).toEqual(["a","b"]);
    expect(batch.lines.every(line=>line.kind==="unknown")).toBe(true);
    expect(batch.lines[0].a).toEqual(base.lines[0].a);
  });
  it("keeps only supported walls and preserves user labels and proposed dimensions", () => {
    const [batch] = globalWallAuditBatches(base, proposed);
    const reviewed: PlanDocument = {...batch,lines:batch.lines.map(line=>({...line,kind:line.id==="a"?"wall":"dimension",confidence:0.9}))};
    const next=applyGlobalWallAudit(base,proposed,[reviewed],{completed:1,total:1,failed:0});
    expect(next.lines.map(line=>line.kind)).toEqual(["wall","unknown","wall","dimension"]);
    expect(next.lines[2]).toEqual(base.lines[2]);
    expect(next.lines[0].a).toEqual(base.lines[0].a);
  });
  it("reverts cancelled or failed wall candidates to unknown without losing dimensions", () => {
    const next=applyGlobalWallAudit(base,proposed,[],{completed:0,total:1,failed:1});
    expect(next.lines.map(line=>line.kind)).toEqual(["unknown","unknown","wall","dimension"]);
  });
  it("preserves short regional wall detail even when long-wall audit fails", () => {
    const shortLine = {...base.lines[0], id:"short-room-wall", a:{x:0.2,y:0.2}, b:{x:0.25,y:0.2}};
    const detailedBase = {...base, lines:[...base.lines,shortLine]};
    const detailedProposal: PlanDocument = {...proposed, lines:[...proposed.lines,{...shortLine,kind:"wall",confidence:0.9}]};
    expect(globalWallAuditBatches(detailedBase,detailedProposal).flatMap(batch=>batch.lines.map(line=>line.id))).not.toContain(shortLine.id);
    const next=applyGlobalWallAudit(detailedBase,detailedProposal,[],{completed:0,total:1,failed:1});
    expect(next.lines.find(line=>line.id===shortLine.id)).toEqual({...shortLine,kind:"wall",confidence:0.9});
    expect(next.lines.find(line=>line.id==="a")?.kind).toBe("unknown");
  });
  it("limits each full-page request to 250 wall candidates", () => {
    const lines=Array.from({length:501},(_,i)=>({...base.lines[0],id:String(i)}));
    const larger={...base,lines};
    expect(globalWallAuditBatches(larger,{...larger,lines:lines.map(line=>({...line,kind:"wall"}))}).map(batch=>batch.lines.length)).toEqual([250,250,1]);
  });
});
