import { describe, expect, it } from "vitest";
import { designWarnings, placementHints } from "@/lib/plans/design";
import { PlanDocumentSchema } from "@/lib/plans/schema";
import { createDesignTools } from "@/server/agent/tools/design-tools";
import type { DesignToolContext } from "@/server/agent/tools/design-context";

// 20 × 20 m hall: 0.05 normalized units per metre.
const base = PlanDocumentSchema.parse({ schemaVersion: 1, source: { name: 'hall', format: 'pdf', page: 1, pages: 1, width: 100, height: 100 }, preview: 'data:image/png;base64,AA==', widthMeters: 20, heightMeters: 20, scaleConfirmed: true, lines: [], texts: [], warnings: [], method: 'pdf-vector',
  zones: [
    { id: 'bar', label: 'Fitting bar', purpose: 'other', x: .3, y: .3, width: 6, depth: 4, rotation: 0, assignable: true },
    { id: 'aisle', label: 'Main aisle', purpose: 'circulation', x: .5, y: .7, width: 20, depth: 2, rotation: 0, assignable: false },
  ] });
const counter = { id: 'counter', kind: 'furniture' as const, label: 'Counter', x: .4, y: .3, width: 4, depth: 1, height: 1, rotation: 0 as const, color: '#335577', zoneId: 'bar' };

describe('placement hints', () => {
  it('gives the allowed centre range for an object spilling out of its zone', () => {
    const document = { ...base, objects: [counter] };
    expect(designWarnings(document)).toContain('Counter extends outside its assigned space (Fitting bar).');
    // Zone spans x 0.15–0.45; a 4 m (0.2) counter centre must stay within 0.25–0.35.
    expect(placementHints(document, ['counter'])).toEqual(['Counter (counter): keep its centre within x 0.250–0.350, y 0.225–0.375 to stay inside Fitting bar (bar); now x 0.400, y 0.300.']);
  });
  it('says when an object cannot fit its zone at all', () => {
    expect(placementHints({ ...base, objects: [{ ...counter, x: .3, width: 8 }] }, ['counter'])[0]).toContain('is larger than Fitting bar');
  });
  it('locates circulation and object overlaps', () => {
    const bench = { ...counter, id: 'bench', label: 'Bench', zoneId: undefined, x: .5, y: .69 };
    const stool = { ...bench, id: 'stool', label: 'Stool', width: 1 };
    const hints = placementHints({ ...base, objects: [bench, stool] }, ['bench']);
    expect(hints).toContain('Bench (bench) footprint x 0.400–0.600, y 0.665–0.715 enters circulation Main aisle (aisle) at x 0.000–1.000, y 0.650–0.750; move it clear or narrow/move that route.');
    expect(hints).toContain('Bench (bench) footprint x 0.400–0.600, y 0.665–0.715 overlaps Stool (stool) at x 0.475–0.525, y 0.665–0.715.');
  });
  it('adds the fixes to a rejected edit group', async () => {
    const c: DesignToolContext = { base, draft: base, revision: 0, phase: 'initial', sources: [], signal: new AbortController().signal, env: {}, artifacts: [], pendingImages: [], calls: new Map(),
      brief: { scope: 'interior', direction: 'Bar', requirements: [{ id: 'bar', label: 'Bar', target: 'objects', kinds: ['furniture'], minimum: 1 }] } };
    const edit = createDesignTools(c).edit_design;
    await expect(edit.execute!({ label: 'Bar', objects: [counter], zones: [], removeObjects: [], removeZones: [] }, { toolCallId: 'test', messages: [], context: {} }))
      .rejects.toThrow('Placement fixes (normalized centre x/y; widths in metres): Counter (counter): keep its centre within x 0.250–0.350');
    expect(c.draft).toBe(base);
  });
});
