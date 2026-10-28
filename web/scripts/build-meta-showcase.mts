import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PlanDocumentSchema, type DesignObject, type SpaceZone } from '../lib/plans/schema';
import { designWarnings } from '../lib/plans/design';
const folder=process.argv[2];
if(!folder) throw new Error('Supply the local DemoData directory');
const doc=PlanDocumentSchema.parse(JSON.parse(await readFile(resolve(folder,'fort-mason-reviewed-plan.json'),'utf8')));
const W=doc.widthMeters!,D=doc.heightMeters!;
const objects:DesignObject[]=[],zones:SpaceZone[]=[];
function add(id:string,kind:DesignObject['kind'],label:string,x:number,y:number,w:number,d:number,h:number,color:string,appearance?:DesignObject['appearance'],elevation=0){
 objects.push({id,kind,label,x:x/W,y:y/D,width:w,depth:d,height:h,color,appearance,elevation,rotation:0});
}
function zone(id:string,label:string,purpose:SpaceZone['purpose'],x:number,y:number,w:number,d:number){zones.push({id,label,purpose,x:x/W,y:y/D,width:w,depth:d,rotation:0,assignable:false});}
const cx=31.6;
zone('keynote','01 / Muse stage','stage',cx,78,24,22);
zone('create','02 / Create with Muse','experience',cx,105,24,24);
zone('connect','03 / Connect lounge','lounge',cx,134,24,23);
zone('aisle','Main promenade','circulation',cx,113,4,44);
add('stage','stage','Muse keynote',cx,70,14,5,.45,'#17375f');
add('screen','partition','Muse Spark',cx,67,16,.35,4.6,'#12263f','screen');
add('lectern','furniture','Welcome',cx-5,70,1,.6,1.3,'#eeeae4','counter',.45);
for(let row=0;row<4;row++)for(const side of [-1,1])for(let col=0;col<4;col++)add(`chair-${row}-${side}-${col}`,'furniture','Audience seat',cx+side*(2+col*1.1),77+row*1.6,.7,.75,.85,'#d7dce2','seat');
for(const [i,y] of [98,108,118].entries())for(const side of [-1,1]){
 const x=cx+side*7, name=['Muse Spark','Muse Image','Meta AI'][i];
 add(`demo-${i}-${side}`,'furniture',name,x,y,3.8,1.2,1.1,'#eeeae4','counter');
 add(`display-${i}-${side}`,'equipment',name,x,y-2.7,4.5,.3,2.9,'#12263f','screen');
 add(`plant-${i}-${side}`,'furniture','Planter',x+side*2.8,y,1,1,1.65,'#55795e','plant');
}
for(const side of [-1,1]){
 add(`sofa-${side}`,'lounge','Connect lounge',cx+side*6,132,3,1.2,1,'#bbc9d6','sofa');
 add(`table-${side}`,'furniture','Coffee table',cx+side*6,134,1.8,1,.45,'#e4ded2','table');
 add(`lounge-plant-${side}`,'furniture','Planter',cx+side*10,134,1.2,1.2,1.9,'#55795e','plant');
 add(`welcome-${side}`,'partition',side<0?'Meta / Muse':'Experience Lab',cx+side*9,143,3.5,.3,3.1,'#12263f','screen');
}
add('reception','furniture','Welcome to Muse',cx-6,148,4,1.2,1.1,'#eeeae4','counter');
for(const [i,y] of [74,94,114,136].entries()){
 add(`truss-${i}`,'beam','Lighting truss',cx,y,27,.35,.35,'#b6bdc7','truss',5.3);
 for(const side of [-1,1])add(`light-${i}-${side}`,'light','Linear light',cx+side*7,y,8,.22,.08,'#fff1d9',undefined,5.1);
}
add('sign-create','hanging-sign','02 / Create with Muse',cx,121,6,.18,.9,'#075de8',undefined,3.8);
add('sign-stage','hanging-sign','01 / Muse stage',cx,92,6,.18,.9,'#075de8',undefined,3.8);
doc.objects=objects;doc.zones=zones;doc.visualStyle='exhibition';doc.ceiling={height:6,status:'estimated',color:'#ebe8e1'};doc.wallHeight=6;
doc.walkStart={x:cx/W,y:140/D};doc.source.name='Meta · Muse Experience Lab — Fort Mason concept';
doc.warnings=[...doc.warnings,'Independent Meta / Muse exhibition concept. See meta-muse-sources.json for official references; not an official event reconstruction.'];
const checked=PlanDocumentSchema.parse(doc);
const warnings=designWarnings(checked);
if(warnings.length) throw new Error(warnings.join('\n'));
console.log(JSON.stringify({objects:objects.length,zones:zones.length,designWarnings:warnings},null,2));
await writeFile(resolve(folder,'fort-mason-meta-muse-plan.json'),JSON.stringify(checked));
await writeFile(resolve(folder,'meta-muse-sources.json'),await readFile(new URL('../fixtures/meta-muse-sources.json',import.meta.url)));
