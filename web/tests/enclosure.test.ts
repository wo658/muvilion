import { describe, expect, it } from "vitest";
import type { PlanDocument } from "@/lib/plans/schema";
import { deriveEnclosure } from "@/lib/plans/enclosure";

const room: PlanDocument = {schemaVersion:1,source:{name:"Room",format:"image",page:1,pages:1,width:100,height:100},preview:"data:image/png;base64,AA==",widthMeters:20,heightMeters:12,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv",floorBoundary:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]};

describe("display-only interior enclosure", () => {
  it("encloses a reviewed empty floor without persisting invented source walls or ceiling", () => {
    const before = JSON.stringify(room);
    const shell = deriveEnclosure(room);
    expect(shell?.walls).toHaveLength(4);
    expect(shell?.ceiling.height).toBe(4);
    expect(shell?.assumedWalls).toBe(true);
    expect(shell?.assumedCeiling).toBe(true);
    expect(shell?.walls.every(w => w.bottom === 0 && w.height === 4)).toBe(true);
    expect(JSON.stringify(room)).toBe(before);
  });
  it("follows every edge of the concave outline rather than a rectangular bounding box", () => {
    const boundary = [{x:0,y:0},{x:.5,y:0},{x:.5,y:.5},{x:1,y:.5},{x:1,y:1},{x:0,y:1}];
    const shell = deriveEnclosure({...room,floorBoundary:boundary})!;
    expect(shell?.walls).toHaveLength(6);
    expect(shell?.walls[1]).toMatchObject({a:{x:10,y:0},b:{x:10,y:6}});
  });
  it("preserves a measured ceiling and keeps assumed surfaces clear of tall installations", () => {
    const ceiling = {height:7,color:"#ffffff",status:"confirmed" as const};
    expect(deriveEnclosure({...room,ceiling})?.ceiling).toEqual(ceiling);
    expect(deriveEnclosure({...room,ceiling})?.assumedCeiling).toBe(false);
    const tall: PlanDocument = {...room,wallHeight:3,objects:[{id:"tall",kind:"equipment" as const,label:"Tower",x:.5,y:.5,width:1,depth:1,height:6,elevation:2,rotation:0,color:"#ffffff"}]};
    expect(deriveEnclosure(tall)?.ceiling.height).toBe(8.5);
  });
  it("keeps an unknown room ceiling above visitor height and every installed object", () => {
    expect(deriveEnclosure({...room,wallHeight:.5})?.ceiling.height).toBeGreaterThan(1.65);
    const tall: PlanDocument = {...room,objects:[{id:"tall",kind:"equipment",label:"Tower",x:.5,y:.5,width:1,depth:1,height:30,elevation:1,rotation:0,color:"#ffffff"}]};
    expect(deriveEnclosure(tall)?.ceiling.height).toBeGreaterThan(31);
  });
  it("does not seal known gaps or duplicate source walls along an evidenced perimeter edge", () => {
    const withWalls = {...room,wallHeight:4,lines:[{id:"left",a:{x:0,y:0},b:{x:.4,y:0},kind:"wall" as const,origin:"manual" as const,confidence:1},{id:"right",a:{x:.6,y:0},b:{x:1,y:0},kind:"wall" as const,origin:"manual" as const,confidence:1}]};
    const shell = deriveEnclosure(withWalls)!;
    expect(shell?.walls).toHaveLength(3);
    expect(shell?.walls.some(w => w.a.y === 0 && w.b.y === 0)).toBe(false);
  });
  it("fills only the upper bands over perimeter evidence while preserving source openings and interior walls", () => {
    const scene: PlanDocument = {...room,wallHeight:3,ceiling:{height:6,status:"confirmed",color:"#ffffff"},lines:[
      {id:"left",a:{x:0,y:0},b:{x:.4,y:0},kind:"wall",origin:"manual",confidence:1},
      {id:"right",a:{x:.6,y:0},b:{x:1,y:0},kind:"wall",origin:"manual",confidence:1},
      {id:"partition",a:{x:.2,y:.5},b:{x:.8,y:.5},kind:"wall",origin:"manual",confidence:1},
    ]};
    const before = JSON.stringify(scene);
    const shell = deriveEnclosure(scene)!;
    const north = shell.walls.filter(w => w.a.y === 0 && w.b.y === 0);
    expect(north.map(w => [w.a.x,w.b.x,w.bottom,w.height])).toEqual([[0,8,3,3],[12,20,3,3]]);
    expect(shell.walls.some(w => w.a.y === 6 && w.b.y === 6)).toBe(false);
    expect(JSON.stringify(scene)).toBe(before);
  });
  it("retains entrance openings with a lintel instead of placing a wall across the doorway", () => {
    const shell = deriveEnclosure({...room,entrances:[{id:"door",label:"Entry",x:.5,y:0,rotation:0}]})!;
    const north = shell?.walls.filter(w => w.a.y === 0 && w.b.y === 0);
    expect(north).toHaveLength(3);
    expect(north?.filter(w => w.bottom === 0).map(w => [w.a.x,w.b.x])).toEqual([[0,9],[11,20]]);
    expect(north?.find(w => w.bottom > 0)).toMatchObject({a:{x:9,y:0},b:{x:11,y:0},bottom:2.4,height:1.6});
  });
  it("does not invent a shell from unreviewed paper bounds or unconfirmed scale", () => {
    expect(deriveEnclosure({...room,floorBoundary:undefined})).toBeNull();
    expect(deriveEnclosure({...room,scaleConfirmed:false})).toBeNull();
  });
});
