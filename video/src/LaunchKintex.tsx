import type {ReactNode} from 'react';
import {AbsoluteFill, Freeze, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';

import {TOKENS as T} from '../../web/lib/ui/tokens';
import muviFace from '../../web/public/mascot/muvi-face.svg';
import {BEAT, CANVAS, Clip, Eyebrow, IN_OUT, OUT, Pane, Stage, Still, Words, clamp, font, track, type Key} from './LaunchKit';

// KINTEX segment, 1:10–1:47.5. Something changes on (almost) every second beat:
// bridge pill → overview push-in → push-through to eye level → split / triptych →
// whip back to the plan → Top view zone match-cuts → photo wall.

const NOTE='Actual app capture and saved report photographs · saved Muse demo · English edition';
const b=(n:number)=>Math.round(n*BEAT); // beat → frame
const ease=(f:number,a:number,z:number,from=0,to=1,e=OUT)=>interpolate(f,[a,z],[from,to],{...clamp,easing:e});

// Eye-level interiors with the ceiling. Recorded Explore-view clips when present,
// otherwise the saved report photograph of the same area.
type Area='stage'|'studio'|'salon'|'live'|'welcome';
const INTERIOR_CLIPS=true;
const AREAS:Record<Area,{clip:string;photo:string;label:string}>={
 stage:{clip:'kintex-interior-stage.mp4',photo:'kintex-photo-3.jpg',label:'Talk stage and audience'},
 studio:{clip:'kintex-interior-studio.mp4',photo:'kintex-photo-1.jpg',label:'Instagram photo studio'},
 salon:{clip:'kintex-interior-salon.mp4',photo:'kintex-photo-6.jpg',label:'Threads conversation salon'},
 live:{clip:'kintex-interior-live.mp4',photo:'kintex-photo-2.jpg',label:'Creator Live wall'},
 welcome:{clip:'kintex-interior-welcome.mp4',photo:'kintex-photo-5.jpg',label:'Registration and information'},
};
// Readable label on a panel: ≥20 px on screen, counter-scaled for a shrunken panel.
function Label({children,k=1}:{children:string;k?:number}){
 return <div style={{position:'absolute',left:20*k,bottom:18*k,padding:`${8*k}px ${18*k}px`,borderRadius:999,background:T.surface,color:T.ink,fontFamily:font,
  fontSize:24*k,fontWeight:550,letterSpacing:-.2*k,boxShadow:`0 6px 18px ${T.shadowColor}`,whiteSpace:'nowrap'}}>{children}</div>;
}
// A panel whose label keeps its on-screen size while the panel scales.
function LPane({keys,children,z,w=1380}:{keys:Key[];children:(k:number)=>ReactNode;z?:number;w?:number}){
 const f=useCurrentFrame();const k=1/Math.max(.45,track(f,keys).s);
 return <Pane w={w} h={w*CANVAS} z={z} keys={keys}>{children(k)}</Pane>;
}
function Interior({area,trim=0,k=1}:{area:Area;trim?:number;k?:number}){
 const f=useCurrentFrame();const a=AREAS[area];
 // Cropped slightly past the app chrome so the room fills the panel.
 if(INTERIOR_CLIPS)return <><div style={{position:'absolute',inset:0,transform:'scale(1.14)',transformOrigin:'56% 62%'}}><Clip file={a.clip} trim={trim}/></div><Label k={k}>{`Explore view · ${a.label}`}</Label></>;
 return <><div style={{position:'absolute',inset:0,transform:`scale(${1.04+f*0.0006})`}}><Still src={a.photo}/></div><Label k={k}>{`Report photo · ${a.label}`}</Label></>;
}
const Photo=({src,label}:{src:string;label:string})=><><Still src={src}/><Label>{`Report photo · ${label}`}</Label></>;

// A label chip in screen space (not scaled by a panel push-in).
function Chip({text,at,out,x,y,accent=false}:{text:string;at:number;out?:number;x:number;y:number;accent?:boolean}){
 const f=useCurrentFrame();const t=ease(f,at,at+14);const u=out===undefined?0:ease(f,out,out+10,0,1,IN_OUT);
 return <div style={{position:'absolute',left:x,top:y,padding:'12px 26px',borderRadius:999,background:accent?T.accent:T.surface,color:accent?T.accentInk:T.ink,
  fontFamily:font,fontSize:30,fontWeight:600,letterSpacing:-.3,boxShadow:`0 10px 30px ${T.shadowColor}`,border:accent?'none':`1px solid ${T.hairline}`,
  opacity:t*(1-u),transform:`translateY(${(1-t)*24-u*16}px) scale(${.92+.08*t})`,whiteSpace:'nowrap',zIndex:40}}>{text}</div>;
}

// ── 1:10 Bridge: the chapter pill grows into the first KINTEX panel ─────────
const PILL={w:780,h:120,cy:540,r:60};
const FIRST={w:1380,h:1380*CANVAS,cy:640,r:26}; // = KintexReveal's opening panel pose
export function KintexBridge(){
 const f=useCurrentFrame();
 const m=ease(f,22,54,0,1,IN_OUT);
 const pop=ease(f,0,16); // the pill lands with a tilt and a blur-in
 const box={w:PILL.w+(FIRST.w-PILL.w)*m,h:PILL.h+(FIRST.h-PILL.h)*m,cy:PILL.cy+(FIRST.cy-PILL.cy)*m,r:PILL.r+(FIRST.r-PILL.r)*m};
 const sweep=interpolate(f,[0,30],[-40,140],clamp);
 const text=1-ease(f,22,32);const pic=ease(f,24,38);
 const lift=Math.sin(m*Math.PI)*8+(1-pop)*34; // tilt in, then a slight tilt while it unfolds
 const sc=(.55+.45*pop)*(1+.05*ease(f,8,22));
 return <AbsoluteFill style={{background:T.bg,fontFamily:font,perspective:2600}}>
  <Words text="KINTEX / Creator Connection Day" at={36} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <div style={{position:'absolute',left:960-box.w/2,top:box.cy-box.h/2,width:box.w,height:box.h,borderRadius:box.r,overflow:'hidden',background:T.surface,
   border:`1px solid ${T.hairline}`,boxShadow:`0 40px 90px ${T.shadowColor}, 0 8px 24px ${T.shadowColor}`,transform:`rotateX(${lift}deg) rotateY(${(1-pop)*-18}deg) scale(${sc})`,filter:`blur(${(1-pop)*14}px)`,opacity:Math.min(1,pop*2.5)}}>
   <div style={{position:'absolute',left:(box.w-FIRST.w)/2,top:(box.h-FIRST.h)/2,width:FIRST.w,height:FIRST.h,opacity:pic}}>
    <Freeze frame={0}><Clip file="kintex-overview.mp4"/></Freeze>
   </div>
   <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',gap:20,opacity:text,transform:`scale(${1+m*.3})`}}>
    <Img src={muviFace} style={{width:52,height:52}}/>
    <span style={{fontSize:40,letterSpacing:-.6,fontWeight:500,whiteSpace:'nowrap',backgroundImage:`linear-gradient(100deg, ${T.ink} ${sweep-30}%, ${T.faint} ${sweep}%, ${T.ink} ${sweep+30}%)`,backgroundClip:'text',WebkitBackgroundClip:'text',color:'transparent'}}>From pop-ups to creator events.</span>
   </div>
  </div>
  <Audio src={staticFile('launch/chime.wav')} volume={.6}/>
 </AbsoluteFill>;
}

// ── 1:12.5 Reveal (375 f) ───────────────────────────────────────────────────
// 0 overview push-in on the 40 × 30 m area · 112 push-through to eye level ·
// 169 split · 206 triptych arc · 262 whip back to the plan, 144 count · 337 pitch away.
export function KintexReveal(){
 const f=useCurrentFrame();
 const THRU=b(6),SPLIT=b(9),TRI=b(11),WHIP=b(14),AWAY=b(18);
 const count=Math.round(interpolate(f,[WHIP+12,WHIP+44],[0,167],{...clamp,easing:OUT}));
 return <Stage note={NOTE} perspective={2600}>
  {/* Headlines, one per phrase */}
  <Words text="KINTEX / Creator Connection Day" at={-40} out={b(3)} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="A 40 × 30 m stage inside Hall 1B." at={b(3)+4} out={THRU-4} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="Step inside, at eye level." at={THRU+10} out={TRI-6} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="Studios, a salon and a talk stage." at={TRI+2} out={WHIP-6} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="objects in the saved design." at={WHIP+16} out={AWAY+8} size={44} weight={500} color={T.inkSoft} style={{left:860,top:150}}/>
  <div style={{position:'absolute',left:560,top:88,width:280,textAlign:'right',fontFamily:font,fontSize:120,fontWeight:650,letterSpacing:-5,color:T.accent,
   opacity:ease(f,WHIP+8,WHIP+20)*(1-ease(f,AWAY+8,AWAY+20)),fontVariantNumeric:'tabular-nums'}}>{count}</div>

  {/* Overview: pushes in on the area, then the camera flies through it */}
  <Pane w={1380} h={1380*CANVAS} z={5} keys={[[0,{y:100}],[b(3),{y:100,ry:-12,rx:8,rz:-2,z:-60},'inOut'],[THRU-4,{y:100,ry:6,rx:3,rz:1,z:20},'inOut'],[THRU+14,{z:1600,o:0,rx:0,ry:0,rz:0},'inOut']]}
   focus={[[0,{z:1,cx:.5,cy:.5}],[b(3),{z:1.6,cx:.52,cy:.56}],[THRU-6,{z:1.95,cx:.53,cy:.57}],[THRU+14,{z:2.5}]]}>
   <Clip file="kintex-overview.mp4"/>
  </Pane>
  <Chip text="40 × 30 m event area" at={b(3)+10} out={THRU-6} x={290} y={870}/>
  <Chip text="KINTEX Hall 1B" at={b(4)+6} out={THRU-6} x={680} y={870}/>

  {/* Eye level: stage first, then studio joins (split), then the salon (triptych) */}
  <LPane z={3} keys={[[THRU,{y:100,z:-900,o:0}],[THRU+6,{o:1}],[THRU+30,{y:100,z:0}],[SPLIT,{y:100,z:30,ry:-3},'inOut'],
   [SPLIT+24,{x:-470,y:110,s:.62,ry:12,z:0},'inOut'],[TRI,{x:-470,y:110,s:.62,ry:10},'inOut'],[TRI+22,{x:-610,y:60,s:.42,ry:24,z:-80},'inOut'],
   [WHIP,{x:-620,s:.42,ry:20},'inOut'],[WHIP+16,{x:-2600,ry:40,o:0},'inOut']]}>
   {k=><Interior area="stage" trim={.4} k={k}/>}
  </LPane>
  <LPane z={4} keys={[[SPLIT,{x:1500,y:110,s:.62,ry:-30,z:-200,o:0}],[SPLIT+6,{o:1}],[SPLIT+24,{x:470,y:110,s:.62,ry:-12,z:0}],[TRI,{x:470,ry:-10},'inOut'],
   [TRI+22,{x:0,y:60,s:.42,ry:0,z:60},'inOut'],[WHIP,{x:-20,ry:-2},'inOut'],[WHIP+16,{x:-2400,ry:40,o:0},'inOut']]}>
   {k=><Interior area="studio" trim={.4} k={k}/>}
  </LPane>
  <LPane z={3} keys={[[TRI,{x:1500,y:60,s:.42,ry:-40,z:-300,o:0}],[TRI+6,{o:1}],[TRI+22,{x:610,y:60,s:.42,ry:-24,z:-80}],
   [WHIP,{x:620,ry:-20},'inOut'],[WHIP+16,{x:-2200,ry:40,o:0},'inOut']]}>
   {k=><Interior area="salon" trim={.4} k={k}/>}
  </LPane>

  {/* Whip back to the plan: a later angle of the same overview recording */}
  <Sequence from={WHIP} layout="none">
   <Pane w={1380} h={1380*CANVAS} z={6} keys={[[0,{x:2400,y:110,ry:-40,z:-200,o:0}],[6,{o:1}],[24,{x:0,y:130,ry:-12,rx:8,rz:-2,z:-80}],[AWAY-WHIP,{x:0,y:130,ry:10,rx:3,rz:1,z:40},'inOut'],[375-WHIP,{y:200,rx:34,z:-260,rz:-5},'inOut']]}
    focus={[[0,{z:1.2,cx:.5,cy:.55}],[AWAY-WHIP,{z:1.75,cx:.52,cy:.56}],[375-WHIP,{z:1.3}]]}>
    <Clip file="kintex-overview.mp4" trim={9}/>
   </Pane>
  </Sequence>
  <Sequence from={WHIP} durationInFrames={30}><Audio src={staticFile('launch/whoosh.wav')} volume={.22}/></Sequence>
 </Stage>;
}

// ── 1:25 Top (300 f): the real Overview → Top switch, then each word pushes in on its zone
// (a held frame of the same Top capture) with that area's report photo; back to Overview.
const TOP_HOLD=80; // clip frame shown flat in Top view
const ZONES:{word:string;cx:number;cy:number;photo:string;label:string}[]=[
 {word:'Capture.',cx:.37,cy:.40,photo:'kintex-photo-1.jpg',label:'Instagram photo studio'},
 {word:'Edit.',cx:.70,cy:.42,photo:'kintex-photo-2.jpg',label:'Edits feedback'},
 {word:'Talk.',cx:.61,cy:.80,photo:'kintex-photo-3.jpg',label:'Talk stage and audience'},
 {word:'Unwind.',cx:.77,cy:.66,photo:'kintex-photo-4.jpg',label:'Rest lounge'},
];
const ALL=['Registration and information','Instagram photo studio','Edits feedback','Talk stage and audience','Threads conversation salon','Rest lounge','Threads extended salon','Instagram display pods'];
export function KintexTop(){
 const f=useCurrentFrame();
 const W0=b(3.5),STEP=b(2),BACK=W0+4*STEP; // 66, 103.5…, 216
 const BACKF=Math.round(BACK);
 const focus=[[0,{z:1,cx:.5,cy:.5}],[W0-8,{z:1,cx:.5,cy:.5}],
  ...ZONES.map((zn,i)=>[W0+i*STEP+10,{z:2.05,cx:zn.cx,cy:zn.cy},'inOut']),[BACK-10,{z:2.05,cx:ZONES[3].cx,cy:ZONES[3].cy}],[BACK+6,{z:1,cx:.5,cy:.5},'inOut']] as [number,{z:number;cx:number;cy:number},'inOut'?][];
 return <Stage note={NOTE}>
  <Eyebrow text="Eight program areas" at={2} out={BACK-8} style={{left:110,top:250}}/>
  {ZONES.map((zn,i)=>{const at=W0+i*STEP;const cur=f>=at&&f<at+STEP;const past=f>=at+STEP;
   return <Words key={zn.word} text={zn.word} at={at} out={BACK-6+i*2} size={96} color={cur||!past?T.ink:T.muted} style={{left:104,top:300+i*108}}/>})}
  <Pane w={1100} h={1100*CANVAS} keys={[[0,{x:330,y:160,z:-300,rx:44,rz:-6,o:.85}],[6,{o:1}],[56,{x:330,y:20,z:0,rx:0,rz:0}],[BACK-6,{x:330,y:20,z:20},'inOut'],
   [BACK+40,{x:300,y:60,rx:18,ry:-8,rz:-2,z:-20},'inOut'],[300,{x:290,rx:12,ry:-4,rz:0,z:20},'inOut']]} focus={focus}>
   {f<TOP_HOLD?<Clip file="kintex-top.mp4" rate={0.96}/>:f<BACKF?<Freeze frame={TOP_HOLD}><Clip file="kintex-top.mp4" rate={0.96}/></Freeze>
    :<Sequence from={BACKF} layout="none"><Clip file="kintex-top.mp4" rate={0.96} trim={5.6}/></Sequence>}
  </Pane>
  {ZONES.map((zn,i)=>{const at=W0+i*STEP+6;const k:Key[]=[[at,{x:-1400,y:300,z:-200,ry:40,rz:-6,o:0}],[at+4,{o:1}],[at+18,{x:620,y:250,z:120,ry:-14,rz:2}],[at+STEP-4,{x:600,y:254,z:130,ry:-10,rz:1},'inOut'],[at+STEP+10,{x:2200,y:220,ry:-40,o:0},'inOut']];
   return <Pane key={zn.photo} w={540} h={304} radius={18} z={10+i} keys={k}><Photo src={zn.photo} label={zn.label}/></Pane>})}
  <Words text="Eight areas, one floor." at={BACK+4} size={64} style={{left:104,top:240}}/>
  {ALL.map((a,i)=><Chip key={a} text={a} at={BACK+20+i*5} x={104+(i%2)*0} y={336+i*70}/>)}
 </Stage>;
}

// ── 1:35 Detail (300 f): Creator Live wall at eye level → split with the studio →
// whip to the salon → a wall of report photos plus the welcome walk → gather out.
type WallItem={photo:string;label:string}|{area:Area;trim:number};
export function KintexDetail(){
 const SPLIT=b(3),WHIP=b(6),WALL=b(9),OUTF=b(13);
 const wall:WallItem[]=[{area:'welcome',trim:1},{photo:'kintex-photo-8.jpg',label:'Instagram display pods'},{photo:'kintex-photo-2.jpg',label:'Edits feedback'},{photo:'kintex-photo-7.jpg',label:'Threads extended salon'}];
 return <Stage note={NOTE}>
  <Eyebrow text="Creator Live / studios / salon" at={2} out={WALL-8} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="Every zone has a purpose." at={8} out={WHIP-6} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="Room to talk. Room to rest." at={WHIP+6} out={WALL-6} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="Every area, seen up close." at={WALL+4} out={OUTF+4} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="Ready to become a proposal." at={OUTF+12} size={60} style={{left:0,right:0,top:470,textAlign:'center'}}/>

  <LPane z={4} keys={[[0,{y:110,z:-420,ry:-22,rz:6,o:.6}],[6,{o:1}],[SPLIT-4,{y:100,z:0,ry:-3,rz:0}],
   [SPLIT+22,{x:-470,y:110,s:.62,ry:12,z:0},'inOut'],[WHIP-2,{x:-480,ry:10},'inOut'],[WHIP+14,{x:-2600,ry:40,o:0},'inOut']]}>
   {k=><Interior area="live" trim={.4} k={k}/>}
  </LPane>
  <LPane z={5} keys={[[SPLIT,{x:1500,y:110,s:.62,ry:-30,z:-200,o:0}],[SPLIT+6,{o:1}],[SPLIT+22,{x:470,y:110,s:.62,ry:-12,z:0}],[WHIP-2,{x:460,ry:-10},'inOut'],[WHIP+14,{x:-2200,ry:40,o:0},'inOut']]}>
   {k=><Interior area="studio" trim={4.5} k={k}/>}
  </LPane>
  <Sequence from={WHIP} layout="none">
   <LPane z={6} keys={[[0,{x:2400,y:100,ry:-40,z:-200,o:0}],[6,{o:1}],[22,{x:0,y:100,ry:-4,z:0}],[WALL-WHIP,{x:0,y:100,ry:3,z:40},'inOut'],[WALL-WHIP+20,{x:0,y:120,s:.5,z:-500,ry:0,o:0},'inOut']]}>
    {k=><Interior area="salon" trim={4} k={k}/>}
   </LPane>
  </Sequence>
  <Sequence from={WHIP} durationInFrames={30}><Audio src={staticFile('launch/whoosh.wav')} volume={.22}/></Sequence>
  {wall.map((it,i)=>{const at=WALL+i*6;const col=i%2,row=Math.floor(i/2);const x=(col-.5)*660,y=row*380-80;
   const k:Key[]=[[at,{x:x*1.6,y:y+200,z:-900,ry:(col-.5)*-60,rx:20,o:0}],[at+6,{o:1}],[at+26,{x,y,z:0,ry:(col-.5)*-14,rx:4}],[OUTF,{x:x*.98,y,z:30,ry:(col-.5)*-8,rx:2},'inOut'],[OUTF+30,{x:x*.3,y:y*.3-20,z:-1400,ry:0,rx:0,o:0},'inOut']];
   return <Pane key={i} w={620} h={349} radius={20} z={10+i} keys={k}>
    {'area' in it?<Sequence from={WALL} layout="none"><Interior area={it.area} trim={it.trim} k={.9}/></Sequence>:<Photo src={it.photo} label={it.label}/>}
   </Pane>})}
 </Stage>;
}
