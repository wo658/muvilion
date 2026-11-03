import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ generate: vi.fn(), hasKey: true }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: mock.generate }));
vi.mock('@/server/agent/model', () => ({ getModel: () => ({ hasKey: mock.hasKey, model: {} }) }));
// Scale/floor measurement runs in parallel and is covered in plan-measure.test.ts; keep these model responses for wall tracing.
vi.mock('@/server/plans/floor', () => ({ traceFloorOutline: async () => null }));
import { traceWalls } from '@/server/plans/trace';
import { PlanDocumentSchema } from '@/lib/plans/schema';
const document = PlanDocumentSchema.parse({ schemaVersion: 1, source: { name: 'drawing.png', format: 'image', page: 1, pages: 1, width: 100, height: 100 }, preview: 'data:image/png;base64,AA==', lines: [], texts: [], method: 'preview', warnings: [], widthMeters: null, heightMeters: null, scaleConfirmed: false });
afterEach(() => { mock.generate.mockReset(); mock.hasKey = true; });
describe('model-only drawing interpretation', () => {
  it('sends the source image and validates walls/text without confirming estimated scale', async () => {
    mock.generate.mockResolvedValue({ finishReason: 'tool-calls', toolCalls: [{ toolName: 'submit_trace', input: { summary: 'Read', walls: [{ a: {x:.1,y:.1}, b: {x:.9,y:.1} }], texts: [{ text: '회의실', x: .2, y: .2 }], scaleEvidence: [{ source: 'dimension', label: '24 m', value: 24, unit: 'm', a: { x: .1, y: .9 }, b: { x: .9, y: .9 } }], uncertainties: [] } }] });
    const result = await traceWalls(document, new AbortController().signal);
    expect(mock.generate.mock.calls[0][0].messages[0].content[1]).toMatchObject({ data: document.preview, mediaType: 'image/png' });
    expect(result).toMatchObject({ method: 'muse', scaleConfirmed: false, widthMeters: 30, heightMeters: 30 });
    expect(mock.generate).toHaveBeenCalledTimes(1);
    expect(result.texts[0].text).toBe('회의실');
    expect(result.lines[0].origin).toBe('ai');
  });
  it('ignores a model-claimed refinement so one unchecked reading cannot confirm scale', async () => {
    mock.generate.mockResolvedValue({ finishReason: 'tool-calls', toolCalls: [{ toolName: 'submit_trace', input: { summary: 'Read', walls: [{ a: {x:.1,y:.1}, b: {x:.9,y:.1} }], scaleEvidence: [{ source: 'dimension', label: '24 m', value: 24, unit: 'm', refined: true, a: { x: .1, y: .9 }, b: { x: .9, y: .9 } }], uncertainties: [] } }] });
    expect(await traceWalls(document, new AbortController().signal)).toMatchObject({ scaleConfirmed: false, widthMeters: 30 });
  });
  it('rejects truncated, missing, invalid and failed model output instead of providing local geometry', async () => {
    for (const response of [
      { finishReason: 'length', toolCalls: [] },
      { finishReason: 'stop', toolCalls: [] },
      { finishReason: 'tool-calls', toolCalls: [{ toolName: 'submit_trace', input: { walls: 'invalid' } }] },
    ]) {
      mock.generate.mockResolvedValueOnce(response);
      await expect(traceWalls(document, new AbortController().signal)).rejects.toMatchObject({ status: 502 });
    }
    mock.generate.mockRejectedValueOnce(new Error('provider details must not escape'));
    await expect(traceWalls(document, new AbortController().signal)).rejects.toMatchObject({ status: 502, message: 'Muse could not read this drawing. Check model access and retry.' });
  });
  it('never calls the model when unconfigured or already cancelled', async () => {
    mock.hasKey = false;
    await expect(traceWalls(document, new AbortController().signal)).rejects.toMatchObject({ status: 503 });
    mock.hasKey = true;
    const abort = new AbortController(); abort.abort();
    await expect(traceWalls(document, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(mock.generate).not.toHaveBeenCalled();
  });
});
