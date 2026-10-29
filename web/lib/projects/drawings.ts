import type { PlanDocument } from "../plans/schema";
import type { DrawingSource, ProjectState } from "./schema";

/** Upgrade lazily so legacy backups and original-only samples still open. */
export function drawingSources(state: ProjectState): DrawingSource[] {
  if (state.drawings?.length) return state.drawings;
  return state.document ? [{ id: "legacy-drawing", document: state.document, originalAssetId: state.originalDrawingId, selected: state.sources.drawingSelected }] : [];
}

export function saveDrawing(state: ProjectState, document: PlanDocument | null): ProjectState {
  const drawings = drawingSources(state);
  const activeDrawingId = state.activeDrawingId ?? drawings[0]?.id;
  return { ...state, document, ...(activeDrawingId ? {
    activeDrawingId,
    drawings: drawings.map(item => item.id === activeDrawingId && document
      ? { ...item, document, originalAssetId: state.originalDrawingId, selected: state.sources.drawingSelected } : item),
  } : {}) };
}

export function activateDrawing(state: ProjectState, id: string): ProjectState {
  const saved = saveDrawing(state, state.document);
  const item = saved.drawings?.find(item => item.id === id);
  if (!item) throw new Error("Drawing source not found.");
  return { ...saved, activeDrawingId: id, document: item.document, originalDrawingId: item.originalAssetId,
    originalDrawingPage: undefined, sources: { ...saved.sources, drawingSelected: item.selected } };
}

export function addDrawing(state: ProjectState, item: DrawingSource): ProjectState {
  const saved = saveDrawing(state, state.document);
  const drawings = drawingSources(saved);
  if (drawings.length >= 12) throw new Error("A project supports up to 12 drawings.");
  if (drawings.some(existing => existing.id === item.id)) throw new Error("Duplicate drawing source.");
  return { ...saved, drawings: [...drawings, item], activeDrawingId: item.id, document: item.document,
    originalDrawingId: item.originalAssetId, originalDrawingPage: undefined,
    sources: { ...saved.sources, drawingSelected: item.selected } };
}

export function projectOriginalIds(state: ProjectState): string[] {
  return [...new Set([state.originalDrawingId, ...(state.drawings ?? []).map(item => item.originalAssetId),
    ...state.sources.items.map(item => item.originalAssetId)].filter((id): id is string => Boolean(id)))];
}
