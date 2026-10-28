import {describe,it,expect} from 'vitest';
import {planRegions,combineRegionalResults} from '@/lib/plans/regions';
import {interpretationEvidence} from '@/lib/plans/muse';
import type {PlanDocument,PlanLine} from '@/lib/plans/schema';
const line=(id:string,x:number,y:number):PlanLine=>({id,a:{x,y},b:{x:x+.02,y},kind:'unknown',origin:'vector',confidence:.5});
const doc=(lines:PlanLine[]):PlanDocument=>({schemaVersion:1,source:{name:'dense.pdf',format:'pdf',page:1,pages:1,width:1800,height:1273},preview:'data:image/png;base64,AA==',widthMeters:180,heightMeters:127.3,scaleConfirmed:true,lines,texts:[],warnings:[],method:'pdf-vector'});
describe('regional coverage and global geometry preservation',()=>{
 it('covers candidates beyond old caps exactly once, including edge tiles and long crossing lines',()=>{
  const lines=Array.from({length:1301},(_,i)=>line(String(i),i%2?.9:.01,i%3?.9:.01));
  lines.push({...line('cross',0,.5),b:{x:1,y:.5}});
  const result=planRegions(doc(lines));
  const ids=result.batches.flatMap(batch=>batch.lineIds);
  expect(ids.length).toBe(1302);expect(new Set(ids).size).toBe(1302);
  expect(ids).toContain('1300');expect(result.batches.every(batch=>batch.lineIds.length<=250)).toBe(true);
  expect(result.batches.some(batch=>batch.region.x>.7 && batch.region.y>.7)).toBe(true);
 });
 it('retains short lines but reports deferred evidence, preserving user classifications',()=>{
  const short={...line('short',.1,.1),b:{x:.1001,y:.1}};
  const base=doc([line('wall',.2,.2),short,{...line('manual',.3,.3),kind:'wall',origin:'manual'}]);
  expect(planRegions(base)).toMatchObject({candidateCount:1,deferredCount:1});
  const local=doc([{...base.lines[0],a:{x:0,y:0},b:{x:1,y:1},kind:'wall',confidence:.9}]);
  const result=combineRegionalResults(base,[local],{completed:1,total:2,failed:1,candidates:1,deferred:1});
  expect(result.lines[0]).toEqual({...base.lines[0],kind:'wall',confidence:.9});
  expect(result.lines.slice(1)).toEqual(base.lines.slice(1));
  expect(result.source).toEqual(base.source);expect(result.scaleConfirmed).toBe(true);
  expect(result.warnings.join()).toContain('1/2');expect(result.warnings.join()).toContain('1 failed');
 });
 it('rejects unsplit evidence rather than silently dropping lines',()=>{
  expect(()=>interpretationEvidence(doc(Array.from({length:601},(_,i)=>line(String(i),0,0))))).toThrow(/Split/);
 });
});
