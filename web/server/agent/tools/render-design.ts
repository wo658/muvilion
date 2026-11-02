import "server-only";
import sharp from "sharp";
import type { PlanDocument } from "@/lib/plans/schema";
import { isSeat, seatDirection } from "@/lib/plans/usability";
import { wallSurfaceFrame } from "@/lib/plans/wall-surfaces";
import { deriveWalls } from "@/lib/plans/walls";
import { objectBounds } from "@/lib/plans/design";

/** Deterministic geometry preview, not a photoreal render or an eye-level view. */
export async function renderDesign(document: PlanDocument, view: "plan" | "isometric") {
  const width = document.widthMeters!, depth = document.heightMeters!;
  // Keep the full venue in the plan view, but inspect the designed interior up close.
  // A small booth in a large hall would otherwise be only a few pixels across.
  const bounds = (document.objects ?? []).map(object => objectBounds(object, document));
  const focused = view === "isometric" && bounds.length > 0;
  const minX = focused ? Math.max(0, Math.min(...bounds.map(b => b.x * width)) - 3) : 0;
  const minY = focused ? Math.max(0, Math.min(...bounds.map(b => b.y * depth)) - 3) : 0;
  const maxX = focused ? Math.min(width, Math.max(...bounds.map(b => (b.x + b.width) * width)) + 3) : width;
  const maxY = focused ? Math.min(depth, Math.max(...bounds.map(b => (b.y + b.height) * depth)) + 3) : depth;
  const frameWidth = Math.max(1, maxX - minX), frameDepth = Math.max(1, maxY - minY);
  const maxHeight = Math.max(document.wallHeight ?? 0, ...(document.objects ?? []).map(o => o.height + (o.elevation ?? 0)), 1);
  const scale = Math.min(840 / (view === "plan" ? width : frameWidth + frameDepth), 600 / (view === "plan" ? depth : (frameWidth + frameDepth) * .5 + maxHeight));
  const originX = view === "plan" ? 60 : 60 + frameDepth * scale;
  const originY = view === "plan" ? 60 : 60 + maxHeight * scale;
  const project = (x: number, y: number, z = 0) => view === "plan" ? [originX + x * scale, originY + y * scale] : [originX + ((x - minX) - (y - minY)) * scale, originY + (((x - minX) + (y - minY)) * .5 - z) * scale];
  const polygon = (points: number[][], fill: string, opacity = 1) => `<polygon points="${points.map(p => p.join(',')).join(' ')}" fill="${fill}" fill-opacity="${opacity}" stroke="#64748b" stroke-width="1"/>`;
  const pieces: string[] = [];
  const floor = document.floorBoundary ?? [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
  pieces.push(polygon(floor.map(p => project(p.x * width, p.y * depth)), '#eef2f6'));
  pieces.push(`<defs><clipPath id="event-floor"><polygon points="${floor.map(p=>project(p.x*width,p.y*depth).join(',')).join(' ')}"/></clipPath></defs><g clip-path="url(#event-floor)">`);
  for (const zone of document.zones ?? []) {
    const b = objectBounds(zone, document);
    pieces.push(polygon([[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y]) => project(x*width,y*depth)), zone.purpose === 'circulation' ? '#a7f3d0' : '#bfdbfe', .4));
  }
  pieces.push("</g>");
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
    if (isSeat(object)) {
      const f = seatDirection(object.rotation), c = project(object.x*width,object.y*depth,top+.01), tip = project(object.x*width+f.x*object.depth*.45,object.y*depth+f.y*object.depth*.45,top+.01);
      pieces.push(`<line x1="${c[0]}" y1="${c[1]}" x2="${tip[0]}" y2="${tip[1]}" stroke="#ef4444" stroke-width="2"/><circle cx="${tip[0]}" cy="${tip[1]}" r="2" fill="#ef4444"/>`);
    }
  }
  const surfaceWalls = deriveWalls(document, { pairParallelEdges: true });
  const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[value]!);
  for (const surface of document.wallSurfaces ?? []) {
    const frame = wallSurfaceFrame(document, surface, surfaceWalls); if (!frame) continue;
    const point = (u: number, v: number) => project(frame.x + Math.cos(frame.angle) * u, frame.y + Math.sin(frame.angle) * u, frame.elevation + v);
    if (view === "plan") {
      const a = point(-frame.width / 2, 0), b = point(frame.width / 2, 0);
      pieces.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${surface.color}" stroke-width="4"/>`);
    } else {
      pieces.push(polygon([point(-frame.width / 2, 0), point(frame.width / 2, 0), point(frame.width / 2, frame.height), point(-frame.width / 2, frame.height)], surface.color));
      if (surface.graphic === "stripe") pieces.push(polygon([point(-frame.width / 2, frame.height * .16), point(frame.width / 2, frame.height * .16), point(frame.width / 2, frame.height * .28), point(-frame.width / 2, frame.height * .28)], surface.graphicColor ?? surface.textColor ?? surface.color));
      if (surface.graphic === "frame") {
        for (const [cx, cy, w, h] of [[0, frame.height * .06, frame.width * .9, frame.height * .025], [0, frame.height * .94, frame.width * .9, frame.height * .025], [-frame.width * .44, frame.height / 2, frame.width * .025, frame.height * .9], [frame.width * .44, frame.height / 2, frame.width * .025, frame.height * .9]])
          pieces.push(polygon([point(cx-w/2,cy-h/2),point(cx+w/2,cy-h/2),point(cx+w/2,cy+h/2),point(cx-w/2,cy+h/2)], surface.graphicColor ?? surface.textColor ?? surface.color));
      }
      if (surface.text) { const c = point(0, frame.height / 2); pieces.push(`<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-size="12" fill="${surface.textColor ?? surface.graphicColor ?? surface.color}">${escape(surface.text)}</text>`); }
    }
  }
  for (const entrance of document.entrances ?? []) {
    const [x,y] = project(entrance.x*width,entrance.y*depth);
    pieces.push(`<circle cx="${x}" cy="${y}" r="5" fill="#ef4444"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="white"/><svg x="0" y="0" width="960" height="680">${pieces.join('')}</svg><text x="24" y="700" font-size="14" fill="#334155">${focused ? "interior detail" : view} schematic — geometry, color and massing only; red marks: entrances and seat fronts</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
