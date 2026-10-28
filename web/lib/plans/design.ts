import type { DesignObject, PlanDocument } from "./schema";

export function objectBounds(object: DesignObject, document: PlanDocument) {
  const width = (object.rotation === 90 ? object.depth : object.width) / (document.widthMeters ?? 1);
  const depth = (object.rotation === 90 ? object.width : object.depth) / (document.heightMeters ?? 1);
  return { x: object.x - width / 2, y: object.y - depth / 2, width, depth };
}

export function designWarnings(document: PlanDocument): string[] {
  if (!document.scaleConfirmed) return ["Confirm the drawing scale before placing objects."];
  const messages: string[] = [];
  const objects = document.objects ?? [];
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i], a = objectBounds(object, document);
    if (a.x < 0 || a.y < 0 || a.x + a.width > 1 || a.y + a.depth > 1) messages.push(`${object.label} extends outside the drawing.`);
    for (let j = i + 1; j < objects.length; j++) {
      const b = objectBounds(objects[j], document);
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.depth && a.y + a.depth > b.y)
        messages.push(`${object.label} overlaps ${objects[j].label}.`);
    }
    // Segment vs axis-aligned rectangle: clip against the four half-spaces.
    if (document.lines.some(line => {
      if (line.kind !== "wall") return false;
      const dx = line.b.x - line.a.x, dy = line.b.y - line.a.y;
      let t0 = 0, t1 = 1;
      const pairs = [[-dx, line.a.x-a.x], [dx, a.x+a.width-line.a.x], [-dy, line.a.y-a.y], [dy, a.y+a.depth-line.a.y]];
      for (const [p, q] of pairs) {
        if (p === 0) { if (q < 0) return false; }
        else { const t = q/p; if (p < 0) t0 = Math.max(t0,t); else t1 = Math.min(t1,t); if (t0 > t1) return false; }
      }
      return true;
    })) messages.push(`${object.label} intersects a classified wall line.`);
  }
  return messages;
}
