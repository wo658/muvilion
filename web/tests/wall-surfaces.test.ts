import { describe, expect, it } from "vitest";
import { PlanDocumentSchema, WallSurfaceSchema } from "@/lib/plans/schema";
import { applyDesignPatch, designPreview, previewDocument } from "@/lib/plans/design-stream";
import { wallSurfaceFrame, wallSurfaceIssues } from "@/lib/plans/wall-surfaces";
import { reviewDesignCoverage } from "@/lib/plans/design-review";
import { cropEvidence } from "@/lib/plans/crop";
import { designWarnings } from "@/lib/plans/design";

const base = PlanDocumentSchema.parse({schemaVersion:1,source:{name:'room',format:'image',page:1,pages:1,width:100,height:100},preview:'data:image/png;base64,AA==',widthMeters:10,heightMeters:10,scaleConfirmed:true,lines:[{id:'wall',a:{x:.1,y:.1},b:{x:.9,y:.1},kind:'wall',origin:'ai',confidence:1}],texts:[],warnings:[],method:'muse',wallHeight:3,objects:[{id:'partition',kind:'partition',label:'Partition',x:.5,y:.5,width:4,depth:.1,height:2.5,rotation:90,color:'#aabbcc'}]});
const surface = WallSurfaceSchema.parse({id:'branding',label:'Welcome wall',hostType:'wall',hostId:'wall',side:'front',start:.1,end:.9,elevation:.3,height:2,color:'#aabbcc',text:'안녕하세요 <Brand>',textColor:'#112233',graphic:'stripe'});
const patch = {label:'Brand wall',objects:[],zones:[],removeObjects:[],removeZones:[],wallSurfaces:[surface]};

describe('wall surface operations', () => {
  it('persists and streams treatments without changing walls, solid geometry or collision checks', () => {
    const next=applyDesignPatch(base,patch);
    expect(next.lines).toEqual(base.lines); expect(next.objects).toEqual(base.objects?.map(o=>({...o,provenance:undefined})));
    expect(designWarnings(next)).toEqual(designWarnings(base));
    const saved=PlanDocumentSchema.parse(JSON.parse(JSON.stringify(next)));
    expect(saved.wallSurfaces).toEqual([surface]);
    expect(previewDocument(base,designPreview(base,next,1,'Brand wall')).wallSurfaces).toEqual([surface]);
    const removed=applyDesignPatch(next,{...patch,wallSurfaces:[],removeWallSurfaces:['branding']});
    expect(previewDocument(next,designPreview(next,removed,2,'Remove treatment')).wallSurfaces).toEqual([]);
    expect(base.wallSurfaces).toBeUndefined();
  });
  it('rejects missing hosts, excess height and conflicting surface edits atomically', () => {
    expect(()=>applyDesignPatch(base,{...patch,wallSurfaces:[{...surface,hostId:'absent'}]})).toThrow('missing');
    expect(()=>applyDesignPatch(base,{...patch,wallSurfaces:[{...surface,height:3}]})).toThrow('above');
    const next=applyDesignPatch(base,{...patch,wallSurfaces:[{...surface,hostType:'partition',hostId:'partition'}]});
    expect(()=>applyDesignPatch(next,{...patch,wallSurfaces:[],removeObjects:['partition']})).toThrow('missing');
    expect(applyDesignPatch(next,{...patch,wallSurfaces:[],removeObjects:['partition'],removeWallSurfaces:['branding']}).objects).toEqual([]);
    expect(()=>applyDesignPatch(next,{...patch,removeWallSurfaces:['branding']})).toThrow('Conflicting');
    expect(next.objects).toHaveLength(1);
  });
  it('positions faces on rotated hosts and uses opposite normals for their backs', () => {
    const front=wallSurfaceFrame(base,{...surface,hostType:'partition',hostId:'partition',start:0,end:1})!;
    const back=wallSurfaceFrame(base,{...surface,hostType:'partition',hostId:'partition',start:0,end:1,side:'back'})!;
    expect(front.width).toBe(4); expect(front.x).toBeLessThan(5);expect(back.x).toBeGreaterThan(5);
    expect(back.angle-front.angle).toBeCloseTo(Math.PI); expect(front.y).toBeCloseTo(5);
    const wall=wallSurfaceFrame(base,surface)!;expect(wall.width).toBeCloseTo(6.4);expect(wall.y).toBeGreaterThan(1);
  });
  it('keeps legacy documents readable, hides stale hosts, and clears designs when cropping evidence', () => {
    expect(PlanDocumentSchema.parse(base).wallSurfaces).toBeUndefined();
    const stale={...base,wallSurfaces:[{...surface,hostId:'deleted'}]};
    expect(PlanDocumentSchema.parse(stale).wallSurfaces).toHaveLength(1);
    expect(wallSurfaceFrame(stale,stale.wallSurfaces[0])).toBeNull();expect(wallSurfaceIssues(stale)).toHaveLength(1);
    expect(cropEvidence({...base,wallSurfaces:[surface]},{x:0,y:0,width:.5,height:.5}).wallSurfaces).toEqual([]);
  });
  it('counts actual wall treatments independently from furnishings', () => {
    const result=reviewDesignCoverage({scope:'edit',direction:'Brand wall',requirements:[{id:'wall-brand',label:'Wall brand',target:'wallSurfaces',kinds:[],minimum:1}]},{...base,wallSurfaces:[surface]},[{requirementId:'wall-brand',ids:['branding'],decision:'Saved lettering and stripe'}]);
    expect(result.complete).toBe(true);
    expect(reviewDesignCoverage({scope:'edit',direction:'Brand wall',requirements:[{id:'wall-brand',label:'Wall brand',target:'wallSurfaces',kinds:[],minimum:1}]},base,[{requirementId:'wall-brand',ids:['partition'],decision:'Partition alone'}]).complete).toBe(false);
  });
});
