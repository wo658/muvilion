import React from 'react';
import {AbsoluteFill, Img, Sequence, getStaticFiles, interpolate, useCurrentFrame} from 'remotion';

import {TOKENS as T} from '../../web/lib/ui/tokens';
import {BEAT, Clip, Eyebrow, Footnote, Group, OUT, Pane, Words, asset, clamp, font, track, tf, DOC, PAGE, type Pose, type Key} from './LaunchKit';
import {Status} from './LaunchPrimitives';

// 1:45–2:52.5 — the saved design becomes a printed planning report.
// Paper pages are PNG renders of the PDFs the current app exported (launch/README.md);
// app captures are kept short and only lead into the PDF.

// ── Exported PDF pages ───────────────────────────────────────────────────────
type Deck='popup'|'kintex';
const AREAS:Record<Deck,number>={popup:6,kintex:8}; // area-guide pages start at page 3
const NAMES:Record<Deck,string>={popup:'Seongsu pop-up',kintex:'KINTEX creator day'};
// Page numbers are read from the files in public/, so a re-export with more pages just works.
function pagesOf(d:Deck):number[]{
 const re=new RegExp(`launch-current/${d}-pdf-p(\\d+)\\.png$`);
 const n=getStaticFiles().map(f=>re.exec(f.name)).filter((m):m is RegExpExecArray=>m!==null).map(m=>Number(m[1])).sort((a,b)=>a-b);
 return n.length?n:[1];
}
const totalOf=(d:Deck)=>Math.max(...pagesOf(d));
const areasOf=(d:Deck)=>{const a=pagesOf(d).filter(n=>n>=3&&n<3+AREAS[d]);return a.length?a:pagesOf(d).slice(0,1);};
// "Assumptions & items to review" starts on this page (checked against the 2026-11-05 02:43 export);
// falls back to the last page if a re-export no longer has it.
const REVIEW:Record<Deck,number>={popup:17,kintex:21};
const reviewOf=(d:Deck)=>pagesOf(d).includes(REVIEW[d])?REVIEW[d]:totalOf(d);
const COUNT=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve'];

// ── Paper and camera ─────────────────────────────────────────────────────────
// Pages are laid out large (close-ups stay sharp) and the camera group dollies back to frame them.
const PW=1200,P=2200;
const zFor=(s:number)=>P-P/s;
// Camera pose that shows local point (lx,ly) at scale s, offset (ox,oy) from screen centre.
const cam=(lx:number,ly:number,s:number,ox=0,oy=0,extra:Pose={}):Pose=>({x:ox/s-lx,y:oy/s-ly,z:zFor(s),rx:0,ry:0,rz:0,...extra});
// Same, aimed at a point (u,v ∈ 0–1) of a page centred at (px,py).
const onPage=(px:number,py:number,u:number,v:number,s:number,ox=0,oy=0,w=PW)=>cam(px+(u-.5)*w,py+(v-.5)*w*PAGE,s,ox,oy);
// Camera on a row turned by `deg` (yaw), centred on local x = lx.
const camRow=(lx:number,s:number,deg:number,oy=0):Pose=>{const a=deg*Math.PI/180;return {x:-lx*Math.cos(a),y:oy/s,z:zFor(s)+lx*Math.sin(a),rx:0,ry:deg,rz:0};};
const shift=(keys:Key[],by:number):Key[]=>keys.map(([k,p,e])=>[k+by,p,e]);

function Sheet({d,n,lx=0,ly=0,w=PW,keys=[[0,{}]],origin='50% 50%'}:{d:Deck;n:number;lx?:number;ly?:number;w?:number;keys?:Key[];origin?:string}){
 const f=useCurrentFrame();const p=track(f,keys);const h=w*PAGE;
 return <div style={{position:'absolute',left:960-w/2+lx,top:540-h/2+ly,width:w,height:h,transform:tf(p),transformOrigin:origin,opacity:p.o,
  background:T.surface,outline:`1px solid ${T.hairline}`,boxShadow:`0 2px 6px ${T.shadowColor}, 0 30px 70px ${T.shadowColor}, 0 70px 140px ${T.shadowColor}`,backfaceVisibility:'hidden'}}>
  <Img src={asset(`${d}-pdf-p${n}.png`)} style={{width:'100%',height:'100%',display:'block'}}/>
 </div>;
}

// Stage with a flat overlay above the 3D world (chips must not be covered by paper).
function Scene({children,overlay,note,bg=true}:{children:React.ReactNode;overlay?:React.ReactNode;note?:string;bg?:boolean}){
 return <AbsoluteFill style={{background:bg?T.bg:undefined,overflow:'hidden',fontFamily:font}}>
  <AbsoluteFill style={{perspective:P,perspectiveOrigin:'50% 50%'}}>
   <AbsoluteFill style={{transformStyle:'preserve-3d'}}>{children}</AbsoluteFill>
  </AbsoluteFill>
  <AbsoluteFill>{overlay}</AbsoluteFill>
  {note?<Footnote>{note}</Footnote>:null}
 </AbsoluteFill>;
}

// A small label pill: "Planning report · PDF · 16 pages", "Page 6 of 16".
function Chip({children,at,out,style,accent=false}:{children:React.ReactNode;at:number;out?:number;style?:React.CSSProperties;accent?:boolean}){
 const f=useCurrentFrame();
 const t=interpolate(f,[at,at+14],[0,1],{...clamp,easing:OUT});
 const u=out===undefined?0:interpolate(f,[out,out+10],[0,1],clamp);
 return <div style={{position:'absolute',display:'flex',alignItems:'center',gap:12,padding:'11px 22px',borderRadius:999,background:T.surface,color:T.ink,fontFamily:font,fontSize:24,fontWeight:500,
  letterSpacing:-.2,border:`1px solid ${T.hairline}`,boxShadow:`0 8px 24px ${T.shadowColor}`,opacity:t*(1-u),transform:`translateY(${(1-t)*18-u*10}px)`,whiteSpace:'nowrap',...style}}>
  {accent?<span style={{padding:'3px 10px',borderRadius:8,background:T.accent,color:T.accentInk,fontSize:18,fontWeight:700,letterSpacing:1}}>PDF</span>:null}{children}
 </div>;
}

// ── 13 Bridge (105–107.5 s) ──────────────────────────────────────────────────
// The pill fades while the app's planning document swings up into its Report pose.
const BRIDGE=75,ENTER=40;
const appKeys=(sd:number):Key[]=>sd>0
 ?[[-35,{x:420,y:760,z:-1300,rx:58,ry:-8,rz:-4,o:0}],[-26,{o:1}],[48,{x:300,y:24,z:0,rx:0,ry:-8,rz:0}],[92,{x:260,z:70,ry:-3},'inOut'],[124,{x:640,y:-120,z:-900,ry:34,o:0},'inOut']]
 :[[0,{x:-520,z:-260,ry:42,rz:-2,o:.85}],[6,{o:1}],[52,{x:-300,y:24,z:0,ry:8,rz:0}],[92,{x:-260,z:70,ry:3},'inOut'],[124,{x:-640,y:-120,z:-900,ry:-34,o:0},'inOut']];
const APP_W=1180;
export function ReportBridge(){
 return <AbsoluteFill>
  <Status frames={BRIDGE} text="Bring the whole proposal together."/>
  <Scene bg={false}>
   <Pane w={APP_W} h={APP_W*DOC} radius={26} keys={shift(appKeys(1),BRIDGE)}>
    <Sequence from={ENTER}><Clip file="popup-report.mp4"/></Sequence>
   </Pane>
  </Scene>
 </AbsoluteFill>;
}

// ── 14 / 16 Report (10 s each) ───────────────────────────────────────────────
// App document → push-in on "Open planning PDF" → the PDF cover flies out as paper →
// close-up on the cover → popup: page turn to the contents page; KINTEX: opens into a spread.
export function Report({file,title,eyebrow,mirror=false}:{file:string;title:string;eyebrow:string;mirror?:boolean}){
 const d:Deck=file.startsWith('kintex')?'kintex':'popup';const sd=mirror?-1:1;
 const total=totalOf(d);const second=pagesOf(d).find(n=>n>1);
 const side:React.CSSProperties=mirror?{left:1290}:{left:104};
 const F=.56,ox=330*sd;
 const coverIn:Key[]=[[100,{x:760*sd,y:-1000,z:-600,ry:-40*sd,rz:12*sd,o:0}],[110,{o:1}],[152,{x:0,y:0,z:0,ry:0,rz:0}]];
 const camKeys:Key[]=[[100,cam(0,0,.5,ox,0,{ry:-12*sd})],[152,cam(0,0,F,ox,6,{ry:-4*sd})],[160,{}],
  [190,onPage(0,0,.5,.12,1.08),'inOut'],[208,{z:zFor(1.1)},'inOut']];
 // Popup: the cover turns over the left edge to reveal page 2.
 // KINTEX: cover and page 2 slide apart into an open spread.
 const spread=mirror;
 if(!spread)camKeys.push([238,cam(0,0,.6,ox,0,{ry:-6*sd}),'inOut'],[270,onPage(0,0,.42,.2,1.02),'inOut'],[300,{z:zFor(1.05)},'inOut']);
 else camKeys.push([242,cam(0,0,.42,0,10,{ry:6}),'inOut'],[272,onPage(650,0,.42,.2,1.02),'inOut'],[300,{z:zFor(1.05)},'inOut']);
 const coverKeys:Key[]=spread?[...coverIn,[212,{}],[242,{x:-650,ry:4},'inOut']]:[...coverIn,[212,{}],[238,{ry:-180},'inOut']];
 const p2Keys:Key[]=spread?[...shift(coverIn,4),[212,{}],[242,{x:650,ry:-4},'inOut']]:shift(coverIn,4);
 return <Scene note={'Actual app capture, then pages of the PDF it exported · saved Muse demo · English edition'} overlay={<>
  <Eyebrow text={eyebrow} at={2} out={150} style={{...side,top:300}}/>
  <Words text={title} at={8} out={84} step={BEAT/2} size={74} style={{...side,left:(side.left as number)-6,top:346}}/>
  <Words text={'Open the\nplanning PDF.'} at={90} out={150} step={BEAT/2} size={74} style={{...side,left:(side.left as number)-6,top:346}}/>
  <Chip accent at={124} out={156} style={{...side,top:560}}>{`Planning report · ${total} pages`}</Chip>
  <Chip at={196} out={226} style={{left:60,top:56}}>{`Cover · page 1 of ${total}`}</Chip>
  {second?<Chip at={272} style={{left:60,top:56}}>{`Contents · page ${second} of ${total}`}</Chip>:null}
 </>}>
  <Pane w={APP_W} h={APP_W*DOC} radius={26} keys={appKeys(sd)}
   focus={[[0,{cx:.5,cy:.4,z:1}],[44,{z:1.03}],[86,{cx:.86,cy:.035,z:2.3},'inOut'],[124,{z:2.55}]]}>
   <Clip file={file} trim={mirror?0:(BRIDGE-ENTER)/30}/>
  </Pane>
  <Group keys={camKeys}>
   {second?<Sheet d={d} n={second} keys={p2Keys}/>:null}
   <Sheet d={d} n={1} keys={coverKeys} origin={spread?'50% 50%':'0% 50%'}/>
  </Group>
 </Scene>;
}

// ── 15 Seongsu area guide (12.5 s) ───────────────────────────────────────────
// Flip-through of the printed stack → push-ins on dimensions, photo and fee →
// the six area pages spread into a row the camera travels along.
export function PopupAreas(){
 const d:Deck='popup';const total=totalOf(d);const areas=areasOf(d);
 const heroAt=Math.max(0,areas.indexOf(6)>=0?areas.indexOf(6):Math.floor(areas.length/2));
 const lead=pagesOf(d).find(n=>n===2);
 const stack=[...(lead?[lead]:[]),...areas];
 const F=.56,ox=330;
 const flipT=(i:number)=>i===0&&lead?-6:14+(i-(lead?1:0))*BEAT; // page 2 is already turning at the cut
 const landed=flipT(stack.indexOf(areas[heroAt])-1)+18;
 const n=areas.length,GAP=1330,rowS=Math.min(.3,1760/(n*GAP));
 const slot=(i:number):Pose=>({x:(i-(n-1)/2)*GAP,y:0,z:0,ry:0,rz:0});
 const R=landed+122; // regroup into the row
 const camKeys:Key[]=[[0,cam(0,0,F,ox,0,{ry:-8})],[landed,cam(0,0,.6,ox,0,{ry:-3}),'inOut'],
  [landed+30,onPage(0,0,.5,.16,1.3),'inOut'],[landed+60,{z:zFor(1.33)},'inOut'],
  [landed+88,onPage(0,0,.4,.33,1.15),'inOut'],[landed+116,{z:zFor(1.18)},'inOut'],
  [R+40,camRow(slot(0).x!,.42,-26,30),'inOut'],[R+142,camRow(slot(n-1).x!,.42,-16,30),'inOut'],
  [375,cam(0,0,rowS,0,70,{ry:-4}),'inOut']];
 return <Scene note={'Area-guide pages of the planning PDF exported by the current app · saved Muse demo'} overlay={<>
  <Eyebrow text="Area-by-area guide" at={2} out={landed} style={{left:110,top:300}}/>
  <Words text={'Photographs.\nDimensions.\nVisitor flow.'} at={4} out={landed} step={BEAT} size={76} style={{left:104,top:346}}/>
  <PageCounter stack={stack} flipT={flipT} total={total} until={landed+4} style={{left:110,top:640}}/>
  <Chip at={landed+24} out={R} style={{left:60,top:56}}>{`Area guide · page ${areas[heroAt]} of ${total}`}</Chip>
  <Chip at={R+36} out={R+138} style={{left:60,top:56}}>{`Area guide · pages ${areas[0]}–${areas[n-1]} of ${total}`}</Chip>
  <Words text={`${COUNT[n]??n} areas. One printed guide.`} at={R+140} step={BEAT/3} size={58} style={{left:0,right:0,top:96,textAlign:'center'}}/>
 </>}>
  <Group keys={camKeys}>
   {stack.map((p,i)=>{const area=areas.indexOf(p);const t=flipT(i);const k=stack.length-1-i;
    const flips=i<stack.indexOf(areas[heroAt]);
    const keys:Key[]=[[0,{z:-i*3,ry:t<0?-40:0,rz:(k%3-1)*.4}]];
    if(flips)keys.push([Math.max(t,0),{}],[Math.max(t,0)+18,{ry:-180,z:30},'inOut']);
    if(area<0)return <Sheet key={p} d={d} n={p} keys={keys} origin="0% 50%"/>;
    // Every area page comes back for the row; turned pages re-enter from below.
    const s=slot(area),at=R+area*4;
    if(flips)keys.push([R-2,{o:0}],[R-1,{ry:0,x:s.x,y:2400,z:s.z}],[at+6,{o:1}],[at+46,s]);
    else keys.push([R,{}],[at+44,{...s,o:1},'inOut']);
    return <Sheet key={p} d={d} n={p} keys={keys} origin="0% 50%"/>;
   })}
  </Group>
 </Scene>;
}

// "Page 3 of 16" ticking along with the flip-through.
function PageCounter({stack,flipT,total,until,style}:{stack:number[];flipT:(i:number)=>number;total:number;until:number;style:React.CSSProperties}){
 const f=useCurrentFrame();let cur=stack[stack.length-1];
 for(let i=0;i<stack.length;i++){if(f<flipT(i)+9){cur=stack[i];break;}}
 const o=interpolate(f,[10,24,until,until+10],[0,1,1,0],clamp);
 return <div style={{position:'absolute',fontFamily:font,fontSize:26,color:T.muted,opacity:o,fontVariantNumeric:'tabular-nums',...style}}>
  Page <span style={{color:T.ink,fontWeight:600}}>{cur}</span> of {total}
 </div>;
}

// ── 17 KINTEX area guide (12.5 s) ────────────────────────────────────────────
// A tilted wall of the area pages; the camera flies page to page and settles flat to read.
export function KintexAreas(){
 const d:Deck='kintex';const total=totalOf(d);const areas=areasOf(d);const n=areas.length;
 const cols=Math.min(4,n),rows=Math.ceil(n/cols),GX=1330,GY=1840;
 const pos=(i:number)=>({x:(i%cols-(cols-1)/2)*GX,y:(Math.floor(i/cols)-(rows-1)/2)*GY});
 const wallS=Math.min(.24,1500/(cols*GX));
 const stops=[0,2,Math.min(5,n-1)].filter((v,i,a)=>a.indexOf(v)===i);
 const look:[number,number,number][]=[[.5,.14,1.05],[.3,.32,1.05],[.52,.14,1.05]];
 const camKeys:Key[]=[[0,cam(0,0,wallS*.8,0,200,{rx:46,rz:-12})],[58,cam(0,0,wallS,120,90,{rx:30,rz:-8,ry:-6})]];
 stops.forEach((s,k)=>{const p=pos(s);const [u,v,sc]=look[k];const t=96+k*72;
  camKeys.push([t,onPage(p.x,p.y,u,v,sc),'inOut'],[t+30,{z:zFor(sc*1.03)},'inOut']);});
 const back=96+stops.length*72+6;
 camKeys.push([back+50,cam(0,0,wallS,0,110,{rx:24,rz:5,ry:8}),'inOut'],[375,cam(0,0,wallS*1.1,-40,110,{rx:20,rz:6,ry:12}),'inOut']);
 return <Scene note={'Area-guide pages of the planning PDF exported by the current app · saved Muse demo'} overlay={<>
  <Eyebrow text="Design intent / operations / review" at={2} out={86} style={{left:110,top:110}}/>
  <Words text={'Ready for the next\nconversation.'} at={8} out={86} step={4} size={70} style={{left:104,top:154}}/>
  {stops.map((s,k)=><Chip key={s} at={100+k*72} out={128+k*72+30} style={{left:60,top:56}}>{`Area guide · page ${areas[s]} of ${total}`}</Chip>)}
  <Words text={`${COUNT[n]??n} areas. Every one on paper.`} at={back+20} step={BEAT/3} size={58} style={{left:0,right:0,top:92,textAlign:'center'}}/>
 </>}>
  <Group keys={camKeys}>
   {areas.map((p,i)=>{const q=pos(i);const at=6+i*4;
    return <Sheet key={p} d={d} n={p} lx={q.x} ly={q.y} keys={[[0,{y:500+i*70,z:-400,rx:-24}],[at+44,{y:0,z:0,rx:0}]]}/>;})}
  </Group>
 </Scene>;
}

// ── 18 Review notes (7.5 s) ──────────────────────────────────────────────────
// The review page of each PDF: assumptions and items to review, read close.
export function Export(){
 const decks:Deck[]=['popup','kintex'];const W=1554,X=900;
 const camKeys:Key[]=[[0,cam(0,0,.3,0,60,{rx:18,ry:-16})],[40,cam(0,0,.33,0,70,{ry:-4})],
  [76,onPage(-X,0,.36,.22,1.05,0,0,W),'inOut'],[110,{z:zFor(1.08)},'inOut'],
  [130,cam(0,0,.42,0,60,{ry:8}),'inOut'],[158,onPage(X,0,.36,.22,1.05,0,0,W),'inOut'],[184,{z:zFor(1.08)},'inOut'],
  [225,cam(0,0,.36,0,70,{ry:8}),'inOut']];
 return <Scene note={'Review pages of the exported planning PDFs · planning material, not construction certification'} overlay={<>
  <Eyebrow text="04 / Review notes" at={2} out={64} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="What still needs checking is on paper." at={6} out={64} size={54} style={{left:0,right:0,top:88,textAlign:'center'}}/>
  {decks.map((d,i)=><Chip key={d} at={82+i*82} out={120+i*74} style={{left:60,top:56}}>{`${NAMES[d]} · page ${reviewOf(d)} of ${totalOf(d)}`}</Chip>)}
  <Words text="Assumptions stay visible." at={190} size={54} style={{left:0,right:0,top:88,textAlign:'center'}}/>
 </>}>
  <Group keys={camKeys}>
   {decks.map((d,i)=>{const sx=(i?1:-1)*X;
    return <Sheet key={d} d={d} n={reviewOf(d)} w={W} lx={sx} keys={[[0,{x:-sx*.35,y:900,z:-500,rz:i?8:-8}],[36+i*5,{x:0,y:0,z:0,rz:0}]]}/>;})}
  </Group>
 </Scene>;
}

// ── 19 Both proposals (12.5 s) ───────────────────────────────────────────────
// Two printed decks land, fan open like a hand of pages, orbit, and close into neat stacks.
export function Documents(){
 const decks:Deck[]=['popup','kintex'];const X=1500;
 const LIFT_K=.64; // lifted covers sit about ±470 px from centre at ~73% frame height
 const camKeys:Key[]=[[0,cam(0,0,.21,0,40,{rx:36,ry:-10})],[60,cam(0,0,.26,0,40,{rx:14,ry:-6})],
  [160,cam(0,0,.28,0,30,{rx:10,ry:10}),'inOut'],[240,cam(0,0,.32,0,10,{rx:5,ry:-6}),'inOut'],
  // Covers lift off their stacks; a last arc, then the camera flies through into the end card's empty white.
  [296,cam(0,0,.42,0,0,{rx:0,ry:-7}),'inOut'],[346,cam(0,0,.45,0,0,{ry:7}),'inOut'],[374,cam(0,0,.72,0,0,{ry:0,o:0}),'inOut']];
 return <Scene note={'Pages rendered from PDFs exported by the current app · planning material, not construction certification'} overlay={<>
  <Eyebrow text="Ready to share" at={2} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="A complete proposal." at={8} out={158} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="A clear next step." at={170} out={338} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  {decks.map((d,i)=><Words key={d} text={`${NAMES[d]} · PDF · ${totalOf(d)} pages`} at={250+i*8} out={336} step={2} size={30} weight={500} color={T.inkSoft} style={{left:i?985:35,width:900,top:978,textAlign:'center'}}/>)}
 </>}>
  <Group keys={camKeys}>
   {decks.map((d,di)=>{const pg=pagesOf(d);const cx=(di?1:-1)*X;const m=pg.length;
    return <React.Fragment key={d}>{pg.map((p,i)=>{const k=i-(m-1)/2;const at=di*8+(m-1-i)*2;
     const fx=Math.min(140,1300/Math.max(1,m-1)),fr=Math.min(5.5,50/Math.max(1,m-1)),fy=fx*.28;const fanAt=60+di*10+i*2;const close=160+di*8+(m-1-i)*1.2;
     const keys:Key[]=[[0,{x:cx-(di?-1:1)*300,y:1100+(m-i)*30,z:-300-i*6,rz:di?6:-6}],[at+40,{x:cx,y:0,z:-i*6,rz:(i%3-1)*.6}],
      [fanAt,{}],[fanAt+50,{x:cx+k*fx,y:Math.abs(k)*fy,z:-i*6,rz:k*fr},'inOut'],
      [close,{}],[close+46,{x:cx,y:0,z:-i*6,rz:(i%3-1)*.6},'inOut']];
     if(i===0)keys.push([244,{}],[296,{x:cx*LIFT_K,y:-6,z:600,rx:0,ry:di?-8:8,rz:0},'inOut'],[346,{}],[372,{x:cx*1.6,ry:di?30:-30,o:0},'inOut']);
     return <Sheet key={p} d={d} n={p} keys={keys} origin="50% 120%"/>;})}</React.Fragment>;})}
  </Group>
 </Scene>;
}
