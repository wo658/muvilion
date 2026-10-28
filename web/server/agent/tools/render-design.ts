import "server-only";
import sharp from "sharp";
import type { PlanDocument } from "@/lib/plans/schema";
import { objectBounds } from "@/lib/plans/design";

/** Deterministic geometry preview, not a photoreal render or an eye-level view. */
export async function renderDesign(document: PlanDocument, view: "plan" | "isometric") {
  const width = document.widthMeters!, depth = document.heightMeters!;
  const maxHeight = Math.max(document.wallHeight ?? 0, ...(document.objects ?? []).map(o => o.height + (o.elevation ?? 0)), 1);
  const scale = Math.min(840 / (view === "plan" ? width : width + depth), 600 / (view === "plan" ? depth : (width + depth) * .5 + maxHeight));
  const originX = view === "plan" ? 60 : 60 + depth * scale;
  const originY = view === "plan" ? 60 : 60 + maxHeight * scale;
  const project = (x: number, y: number, z = 0) => view === "plan" ? [originX + x * scale, originY + y * scale] : [originX + (x - y) * scale, originY + ((x + y) * .5 - z) * scale];
  const polygon = (points: number[][], fill: string, opacity = 1) => `<polygon points="${points.map(p => p.join(',')).join(' ')}" fill="${fill}" fill-opacity="${opacity}" stroke="#64748b" stroke-width="1"/>`;
  const pieces: string[] = [];
  const floor = document.floorBoundary ?? [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
  pieces.push(polygon(floor.map(p => project(p.x * width, p.y * depth)), '#eef2f6'));
  for (const zone of document.zones ?? []) {
    const b = objectBounds(zone, document);
    pieces.push(polygon([[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y]) => project(x*width,y*depth)), zone.purpose === 'circulation' ? '#a7f3d0' : '#bfdbfe', .4));
  }
  // All source walls remain visible. No truncation or invented wall heights.
  for (const wall of document.lines.filter(l => l.kind === 'wall')) {
    const a = project(wall.a.x*width, wall.a.y*depth), b = project(wall.b.x*width,wall.b.y*depth);
    pieces.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#334155" stroke-width="2"/>`);
  }
  const objects = [...(document.objects ?? [])].sort((a,b) => (a.x*width+a.y*depth)-(b.x*width+b.y*depth));
  for (const object of objects) {
    const b = objectBounds(object, document), bottom = object.elevation ?? 0, top = bottom + object.height;
    const corners = [[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]];
    if (view === 'isometric') {
      for (const [i,j] of [[1,2],[2,3]]) pieces.push(polygon([project(corners[i][0]*width,corners[i][1]*depth,bottom),project(corners[j][0]*width,corners[j][1]*depth,bottom),project(corners[j][0]*width,corners[j][1]*depth,top),project(corners[i][0]*width,corners[i][1]*depth,top)], object.color, .75));
    }
    pieces.push(polygon(corners.map(([x,y]) => project(x*width,y*depth,top)),object.color));
  }
  for (const entrance of document.entrances ?? []) {
    const [x,y] = project(entrance.x*width,entrance.y*depth);
    pieces.push(`<circle cx="${x}" cy="${y}" r="5" fill="#ef4444"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="white"/>${pieces.join('')}<text x="24" y="700" font-size="14" fill="#334155">${view} schematic — geometry, color and massing only; red dots: entrances</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
