import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { FIXTURES, FIXTURE_TYPES, fixtureParts } from "@/lib/assets/fixtures";
import { dimensionsMatch, resolvePhysicalDimensions } from "@/lib/assets/dimensions";
import { fitAssetBounds } from "@/lib/assets/fit";
import { getModelAsset } from "@/lib/assets/catalog";
import { PlanDocumentSchema, DesignObjectSchema } from "@/lib/plans/schema";
import { designWarnings, objectBounds } from "@/lib/plans/design";
import { applyDesignProposal } from "@/lib/plans/muse";
const base = PlanDocumentSchema.parse({schemaVersion:1,source:{name:"1B",format:"image",page:1,pages:1,width:451,height:365},preview:"data:image/png;base64,AA==",widthMeters:90,heightMeters:63,scaleConfirmed:true,lines:[],texts:[],warnings:[],method:"opencv"});
const table = DesignObjectSchema.parse({id:"table",kind:"furniture",label:"Work table",fixtureType:"work-table",x:.5,y:.5,width:1.2,depth:.6,height:.74,rotation:0,color:"#445566"});
describe("physical dimensions", () => {
  it.each(FIXTURE_TYPES)("%s has visible metre bounds equal to the declared collision envelope", type => {
    const fixture = FIXTURES[type], bounds = new Box3();
    for (const p of fixtureParts(type)) {
      const half = new Vector3(...p.size).multiplyScalar(.5), center = new Vector3(...p.position);
      bounds.union(new Box3(center.clone().sub(half),center.clone().add(half)));
    }
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(fixture.width,8); expect(size.y).toBeCloseTo(fixture.height,8); expect(size.z).toBeCloseTo(fixture.depth,8);
    expect(bounds.min.y).toBeCloseTo(0,8);
    const object = DesignObjectSchema.parse({...table,...fixture,fixtureType:type});
    const footprint = objectBounds(object,base);
    expect(footprint.width*90).toBeCloseTo(size.x,8); expect(footprint.height*63).toBeCloseTo(size.z,8);
    const rotated = objectBounds({...object,rotation:90},base);
    expect(rotated.width*90).toBeCloseTo(size.z,8); expect(rotated.height*63).toBeCloseTo(size.x,8);
  });
  it("normalizes rounding, rejects a swapped coffee table, and keeps old files readable with a warning", () => {
    const asset=getModelAsset("modern_coffee_table_01")!;
    const native={...table,fixtureType:undefined,modelAssetId:asset.id,width:.6,depth:1.2,height:.39};
    expect(resolvePhysicalDimensions(native).depth).toBe(asset.depth);
    const swapped={...native,width:1.2,depth:.6};
    expect(dimensionsMatch(swapped)).toBe(false);
    expect(()=>applyDesignProposal(base,{summary:"Bad table",objects:[swapped],assumptions:[]})).toThrow("native dimensions");
    expect(PlanDocumentSchema.safeParse({...base,objects:[swapped]}).success).toBe(true);
    expect(designWarnings({...base,objects:[swapped]}).join(" ")).toContain("size box");
    expect(()=>fitAssetBounds([0,0,0],[asset.width,asset.height,asset.depth],[1.2,.39,.6])).toThrow("proportions");
  });
  it("uses the same visible width for collision checks and rejects fixture resizing or asset substitution", () => {
    const second={...table,id:"second",x:.5+1.19/90};
    expect(designWarnings({...base,objects:[table,second]}).join(" ")).toContain("overlaps");
    expect(designWarnings({...base,objects:[table,{...second,x:.5+1.21/90}]})).toEqual([]);
    expect(()=>resolvePhysicalDimensions({...table,height:.39})).toThrow("native dimensions");
    expect(DesignObjectSchema.safeParse({...table,modelAssetId:"modern_coffee_table_01"}).success).toBe(false);
    expect(FIXTURES["phone-stand"].height).toBe(1.6);
  });
});
