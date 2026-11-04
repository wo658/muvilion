import React from 'react';
import {Sequence, getStaticFiles, interpolate, useCurrentFrame} from 'remotion';

import {TOKENS as T} from '../../web/lib/ui/tokens';
import {BEAT as B, CANVAS, Clip, Eyebrow, Group, IN_OUT, OUT, Stage, Still, Tag, Words, clamp, focusAt, font, footageNote, tf, track} from './LaunchKit';
import type {FKey, Key} from './LaunchKit';

// Seongsu chapter, 0:20–1:10. The visitor route drives the cut: sources → saved
// design → entry → fitting bars → photo walk → view modes → lounge → annex.
// Something changes on every one or two beats of the 2.5-second bar.

// Every number on screen comes from the saved sample the footage was captured from.
import recorded from '../../data/samples/popup/recorded.json';
type Zone={id:string;label:string;width:number;depth:number};
type Sample={state:{document:{widthMeters:number;heightMeters:number;floorBoundary:{x:number;y:number}[];zones:Zone[];objects:unknown[]};planningArtifacts:{content:{booths:{id:string}[]}}[]}};
const doc=(recorded as Sample).state.document;
const booths=(recorded as Sample).state.planningArtifacts[0].content.booths;
const floorArea=Math.abs(doc.floorBoundary.reduce((a,p,i,b)=>{const q=b[(i+1)%b.length];return a+p.x*q.y-q.x*p.y},0))/2*doc.widthMeters*doc.heightMeters;
const num=(n:number)=>String(Math.round(n*100)/100);
const zone=(id:string)=>{const z=doc.zones.find(q=>q.id===id);if(!z)throw new Error(`Seongsu sample has no zone ${id}`);return z};
const dims=(id:string)=>{const z=zone(id);return `${num(z.width)} × ${num(z.depth)} m`};
const area=(id:string)=>{const z=zone(id);return `${dims(id)} · ${num(z.width*z.depth)} m²`};
const name=(id:string)=>zone(id).label;
// Report areas in visitor order (the report's circulation notes).
const ROUTE=['z-checkin','z-fitting','z-trail','z-lounge','z-messenger','z-share'];

const MIX='Actual app capture and saved report photographs · saved Muse demo · English edition';
const PHOTOS='Saved scene photographs from the planning report · illustrative spatial design';

// Eye-level interior captures (with ceiling) are optional; the matching report
// photograph stands in until the capture exists in public/launch-current.
const files=():Set<string>=>{try{return new Set(getStaticFiles().map(s=>s.name.replace(/^\//,'')))}catch{return new Set()}};
type Room='entry'|'fitting'|'lounge'|'alley';
const ROOM_PHOTO:Record<Room,string>={entry:'popup-photo-1.jpg',fitting:'popup-photo-2.jpg',lounge:'popup-photo-4.jpg',alley:'popup-photo-3.jpg'};
const roomFile=(r:Room)=>`popup-interior-${r}.mp4`;
// Seconds into each interior capture; retune here if a recapture changes its path.
const TRIM={entry:.4,entryCut:4,fitting:.4,fittingCut:3,lounge:5.4,alley:.4};
function useRooms(){return React.useMemo(()=>{const s=files();return (r:Room)=>s.has(`launch-current/${roomFile(r)}`)},[])}

// A photograph that drifts slowly so a still never reads as a freeze.
function Drift({src,at=0,dx=-.02}:{src:string;at?:number;dx?:number}){
 const f=useCurrentFrame();const t=interpolate(f,[at,at+200],[0,1],clamp);
 return <div style={{width:'100%',height:'100%',overflow:'hidden'}}><div style={{width:'100%',height:'100%',transform:`scale(${1.04+t*.07}) translateX(${t*dx*100}%)`}}><Still src={src}/></div></div>;
}
// Starts a clip when its panel enters (not when the scene starts).
const Late=({at,dur,children}:{at:number;dur?:number;children:React.ReactNode})=><Sequence from={Math.round(at)} durationInFrames={dur} layout="none">{children}</Sequence>;
function Room({room,at,trim=0,dur,live}:{room:Room;at:number;trim?:number;dur?:number;live:boolean}){
 return live?<Late at={at} dur={dur}><Clip file={roomFile(room)} trim={trim}/></Late>:<Drift src={ROOM_PHOTO[room]} at={at}/>;
}
const fade=(f:number,a:number,b:number,from=0,to=1)=>interpolate(f,[a,b],[from,to],{...clamp,easing:OUT});


// LaunchKit's Pane with a report label that stays put while the content pushes in.
function Pane({w,h,cw=w,ch=h,keys,focus,radius=26,children,z=0,label,labelAt}:{w:number;h:number;cw?:number;ch?:number;keys:Key[];focus?:FKey[];radius?:number;children:React.ReactNode;z?:number;frame?:boolean;label?:string;labelAt?:number}){
 const f=useCurrentFrame();const p=track(f,keys);const fo=focusAt(f,focus);
 const sw=cw*fo.z,sh=ch*fo.z;
 const tx=sw<=w?(w-sw)/2:Math.min(0,Math.max(w-sw,w/2-fo.cx*sw));
 const ty=sh<=h?(h-sh)/2:Math.min(0,Math.max(h-sh,h/2-fo.cy*sh));
 return <div style={{position:'absolute',left:960-w/2,top:540-h/2,width:w,height:h,transform:tf(p),opacity:p.o,zIndex:z,borderRadius:radius,overflow:'hidden',background:T.surface,
  border:`1px solid ${T.hairline}`,boxShadow:`0 40px 90px ${T.shadowColor}, 0 8px 24px ${T.shadowColor}`,backfaceVisibility:'hidden'}}>
  <div style={{position:'absolute',left:0,top:0,width:cw,height:ch,transformOrigin:'0 0',transform:`translate(${tx}px,${ty}px) scale(${fo.z})`}}>{children}</div>
  {label?<div style={{opacity:labelAt===undefined?1:fade(f,labelAt,labelAt+12)}}><Tag>{label}</Tag></div>:null}
 </div>;
}

// Dimension card from the report.
function Dims({label,value}:{label:string;value:string}){
 return <div style={{padding:'18px 28px',fontFamily:font}}>
  <div style={{fontSize:22,color:T.inkSoft,marginBottom:6}}>{label}</div>
  <div style={{fontSize:32,fontWeight:600,color:T.ink,letterSpacing:-.6}}>{value}</div>
 </div>;
}

// ── 0:20–0:27.5 · Sources ──────────────────────────────────────────────────
// Opens on the exact white card the opening ends on, fills it with the Sources
// dialog and pulls each source row out as a print on the beat.
export function Sources(){
 const f=useCurrentFrame();
 const refs=[{at:2*B,cy:.36,line:'The plan.',tag:'Drawing',x:-540,y:250,rz:-3},
  {at:4*B,cy:.555,line:'The brief.',tag:'Brief',x:-110,y:275,rz:1.5},
  {at:6*B,cy:.75,line:'The references.',tag:'Authored concept',x:320,y:250,rz:3}];
 const away=(k:number):[number,{z:number;o:number},'inOut']=>[k,{z:1500,o:0},'inOut'];
 return <Stage note={footageNote}>
  <Eyebrow text="01 / Context" at={B} out={8*B} style={{left:110,top:196}}/>
  {refs.map((r,i)=><Words key={r.line} text={r.line} at={r.at} out={7.6*B} size={80} color={f>=refs[Math.min(i+1,2)].at&&i<2?T.muted:T.ink} style={{left:104,top:240+i*94}}/>)}
  <Words text={'Every source,\nin one project.'} at={8.2*B} out={10.6*B} step={B/3} size={80} style={{left:104,top:240}}/>
  <Pane w={1560} h={816} cw={1560} ch={1560*CANVAS} radius={32}
   keys={[[0,{y:26}],[16,{y:26}],[52,{x:310,y:-50,ry:-14,rx:4,s:.72},'inOut'],[150,{x:300,ry:-9,rx:2,s:.74},'inOut'],[190,{x:270,ry:-4,s:.76},'inOut'],away(222)]}
   focus={[[12,{z:1}],[46,{z:2.05,cx:.5,cy:.36}],[4*B,{cy:.36}],[4*B+14,{cy:.555}],[6*B,{cy:.555}],[6*B+14,{cy:.72}],[8*B,{cy:.72,z:2.05}],[8*B+24,{z:1.18,cy:.5}],[222,{z:1.25}]]}>
   <div style={{width:'100%',height:'100%',opacity:fade(f,2,14)}}><Clip file="popup-sources.mp4"/></div>
  </Pane>
  {refs.map((r,i)=><Pane key={r.tag} w={400} h={270} radius={20} z={10+i}
   keys={[[r.at-4,{x:300,y:(r.cy-.5)*500,z:-200,s:.5,ry:-14,o:0}],[r.at+2,{o:1}],[r.at+26,{x:r.x,y:r.y,z:140,s:1,ry:-4,rz:r.rz}],[190,{x:r.x+20,y:r.y-10,z:170},'inOut'],away(220-i*3)]}>
   {i===1?<div style={{padding:'26px 28px',fontFamily:font,background:T.surface,height:'100%'}}>
    <div style={{fontSize:15,letterSpacing:2,color:T.accent,textTransform:'uppercase',marginBottom:10}}>Try. Capture. Share.</div>
    <div style={{fontSize:19,lineHeight:1.38,color:T.inkSoft}}>A 20-minute journey through trying on glasses, hands-free photography, open-ear listening and sharing with friends.</div>
   </div>:<div style={{width:'100%',height:'100%',background:T.surface,padding:i===0?14:0,boxSizing:'border-box'}}><Still src={i===0?'floor-plan.png':'fitting-bar.webp'} fit={i===0?'contain':'cover'}/></div>}
   <Tag>{r.tag}</Tag>
  </Pane>)}
 </Stage>;
}

// ── 0:27.5–0:40 · Saved design, then into the entry at eye level ───────────
export function SeongsuReveal(){
 const f=useCurrentFrame();const live=useRooms();
 const stats:[string,string][]=[[`≈ ${Math.round(floorArea)} m²`,'floor area in the saved design'],[String(doc.objects.length),'planned installations'],[String(booths.length),'experience areas in the report']];
 const route=ROUTE.map(name);
 const IN=182,SIDE=280,R0=300;
 const active=f>=R0+3.4*B?1:f>=R0+2*B?0:-1;
 return <Stage note={live('entry')?footageNote:MIX}>
  <Eyebrow text="Seongsu / experience pop-up" at={2} out={66} style={{left:0,right:0,top:60,justifyContent:'center'}}/>
  <Words text="A visitor journey, made spatial." at={8} out={66} size={64} style={{left:0,right:0,top:96,textAlign:'center'}}/>
  <Pane w={1500} h={1500*CANVAS} radius={30}
   keys={[[0,{y:380,z:-300,rx:62,rz:-3,o:0}],[8,{o:1}],[60,{y:80,z:0,rx:0,rz:0,ry:-3}],[74,{y:80,ry:-2}],[100,{x:-300,y:20,ry:14,rx:4,s:.74},'inOut'],[146,{x:-290,y:10,ry:-2,rx:9,s:.79}],[176,{x:0,y:40,ry:0,rx:0,s:1},'inOut'],[205,{s:2.4,z:200,o:0},'inOut']]}
   focus={[[60,{z:1}],[100,{z:1.3,cx:.5,cy:.56}],[146,{z:1.62,cx:.47,cy:.52}],[205,{z:2.6,cx:.6,cy:.42}]]}>
   <Clip file="popup-overview.mp4" trim={1}/>
  </Pane>
  {/* Stats sit after the panel so they always paint above it; the panel's right edge stays ~140 px clear. */}
  {stats.map(([n,l],i)=>{const at=80+i*B;return <div key={n} style={{position:'absolute',left:1410,top:250+i*200}}>
   <Words text={n} at={at} out={140} size={96} weight={600}/>
   <Words text={l} at={at+6} out={140} step={2} size={30} weight={500} color={T.inkSoft} style={{top:114}}/>
  </div>})}
  <Eyebrow text="Entry and check-in" at={IN+14} out={SIDE-10} style={{left:0,right:0,top:44,justifyContent:'center'}}/>
  <Words text="Step inside, at eye level." at={IN+18} out={SIDE-10} size={56} style={{left:0,right:0,top:78,textAlign:'center'}}/>
  <Pane w={1440} h={810}
   keys={[[IN,{y:70,z:-1000,s:.6,o:0}],[IN+10,{o:1}],[IN+40,{y:70,z:0,s:1}],[SIDE,{y:64,s:1.02},'inOut'],[SIDE+34,{x:-310,y:20,ry:10,s:.74},'inOut'],[356,{x:-330,ry:7,s:.76},'inOut'],[375,{x:-1900,ry:34},'inOut']]}
   focus={[[IN+40,{z:1}],[IN+3*B,{z:1.02}],[IN+3*B+16,{z:1.32,cx:.66,cy:.6}],[SIDE,{z:1.32}],[SIDE+30,{z:1.1,cx:.5,cy:.5}],[356,{z:1.18}]]}>
   <Room room="entry" at={IN} trim={TRIM.entry} live={live('entry')}/>
  </Pane>
  <Pane w={540} h={124} radius={20} z={10} keys={[[SIDE+10,{x:620,y:-300,z:-200,ry:-24,o:0}],[SIDE+18,{o:1}],[SIDE+44,{x:560,y:-310,z:60,ry:-6}],[356,{x:556,y:-312},'inOut'],[375,{x:-900,o:0},'inOut']]}>
   <Dims label={`${name('z-checkin')} · from the report`} value={area('z-checkin')}/>
  </Pane>
  {route.map((r,i)=>{const at=R0+i*B/2;const on=i===active;const o=fade(f,at,at+12)*fade(f,360,372,1,0);
   return <div key={r} style={{position:'absolute',left:1352+fade(f,at,at+16,40,0)-fade(f,360,375,0,600),top:370+i*66,display:'flex',alignItems:'center',gap:16,fontFamily:font,fontSize:32,fontWeight:on?600:500,color:on?T.ink:T.inkSoft,opacity:o*(on?1:.72)}}>
    <span style={{width:14,height:14,borderRadius:7,background:on?T.accent:T.hairlineStrong,transform:`scale(${on?1.25:1})`}}/>{r}
   </div>})}
 </Stage>;
}

// ── 0:40–0:50 · Fitting bars, then the photo walk ─────────────────────────
export function SeongsuDetail(){
 const f=useCurrentFrame();const live=useRooms();
 const F=60,P=150,S=228;
 return <Stage note={MIX}>
  <Eyebrow text="Fitting bars" at={6} out={P-10} style={{left:0,right:0,top:50,justifyContent:'center'}}/>
  <Words text="Try it on." at={12} out={P-10} size={60} style={{left:0,right:0,top:84,textAlign:'center'}}/>
  {/* Saved design whips in from the right and pushes through into the fitting bars. */}
  <Pane w={1400} h={1400*CANVAS} keys={[[0,{x:1700,y:70,ry:-40}],[20,{x:0,ry:0},'out'],[54,{y:70,s:1.02}],[82,{s:2.3,z:200,o:0},'inOut']]}
   focus={[[8,{z:1.05}],[54,{z:1.3,cx:.42,cy:.4}],[82,{z:2.1,cx:.4,cy:.36}]]}>
   <Clip file="popup-detail.mp4" trim={1.5}/>
  </Pane>
  <Pane w={1400} h={787.5}
   keys={[[F,{y:70,z:-1000,s:.6,o:0}],[F+10,{o:1}],[F+38,{y:70,z:0,s:1}],[P,{y:70,s:1.02},'inOut'],[P+30,{x:-1800,ry:40,o:0},'inOut']]}
   focus={[[F+38,{z:1}],[P,{z:1.14,cx:.45,cy:.52}]]} label={`${name('z-fitting')} · ${dims('z-fitting')}`} labelAt={F+40}>
   <Room room="fitting" at={F} trim={TRIM.fitting} live={live('fitting')}/>
  </Pane>
  {/* The design itself returns as an inset, so the room stays tied to the plan. */}
  <Pane w={440} h={440*CANVAS} radius={18} z={10} keys={[[F+50,{x:700,y:330,z:-300,ry:-20,o:0}],[F+58,{o:1}],[F+82,{x:500,y:240,z:120,ry:-6}],[P-6,{x:510,y:236,z:130},'inOut'],[P+14,{x:1400,o:0},'inOut']]}
   focus={[[F+50,{z:1.6,cx:.4,cy:.38}]]} label="Saved design">
   <Late at={F+50}><Clip file="popup-detail.mp4" trim={8}/></Late>
  </Pane>
  <Eyebrow text="Photo walk" at={P+30} out={S-8} style={{left:110,top:330}}/>
  <Words text={'Find your\nframe.'} at={P+34} out={S-8} step={B/2} size={84} style={{left:104,top:374}}/>
  <Words text="Three photo spots along the walk." at={P+56} out={S-8} step={2} size={28} weight={400} color={T.muted} style={{left:106,top:572}}/>
  {['Try.','Capture.','Share.'].map((w,k)=><Words key={w} text={w} at={S+22+k*B*.8} out={286} size={96} color={k<2&&f>=S+22+(k+1)*B*.8?T.muted:T.ink} style={{left:1330,top:300+k*112}}/>)}
  <Pane w={1300} h={731} radius={30} keys={[[P,{x:900,z:-700,ry:-34,o:0}],[P+10,{o:1}],[P+44,{x:270,y:30,z:0,ry:-8,s:.86}],[S,{x:262,ry:-5,s:.87},'inOut'],[S+22,{x:-280,y:30,ry:8,s:.86},'inOut'],[284,{x:-270,ry:5,s:.88},'inOut'],[300,{x:-200,z:1300,o:0},'inOut']]}
   focus={[[P+44,{z:1}],[S,{z:1.08,cx:.45,cy:.55}],[S+22,{z:1.3,cx:.52,cy:.52}],[284,{z:1.36}]]} label={`${name('z-trail')} · ${dims('z-trail')}${live('alley')?'':' · report photo'}`}>
   <Room room="alley" at={P} trim={TRIM.alley} live={live('alley')}/>
  </Pane>
 </Stage>;
}

// ── 0:50–1:00 · Top, Overview, Explore — then the lounge ──────────────────
// Each view mode gets one beat-length card; the interior wins the frame.
export function ViewControls(){
 const f=useCurrentFrame();const live=useRooms();
 const modes:[string,number][]=[['Top.',2],['Overview.',3*B],['Explore.',5*B]];
 const X=5*B-6,L=8*B;
 const deck=(at:number,side:number):[number,{x:number;y:number;z:number;ry:number;o:number},'inOut'][]=>
  [[at,{x:330+side*240,y:-150,z:-900,ry:-side*26,o:.55},'inOut'],[at+B,{x:330+side*420,y:-240,z:-1500,ry:-side*30,o:0},'inOut']];
 const loungeLive=live('lounge');
 return <Stage note={MIX}>
  <Eyebrow text="02 / Explore the saved design" at={2} out={150} style={{left:110,top:250}}/>
  {modes.map(([m,at],i)=><Words key={m} text={m} at={at} out={150} size={96} color={i<2&&f>=modes[i+1][1]?T.muted:T.ink} style={{left:104,top:300+i*112}}/>)}
  <Pane w={1180} h={1180*CANVAS} keys={[[0,{x:300,y:700,rx:-36,o:0}],[4,{o:1}],[26,{x:300,y:20,rx:0}],[3*B,{x:306,y:16,s:1.02}],...deck(3*B+6,1)]}
   focus={[[20,{z:1.05}],[3*B,{z:1.18,cx:.5,cy:.5}]]}>
   <Clip file="popup-top.mp4" rate={.96} trim={1.4}/>
  </Pane>
  <Pane w={1180} h={1180*CANVAS} keys={[[3*B-6,{x:1500,y:20,ry:-40,o:0}],[3*B,{o:1}],[3*B+20,{x:300,y:20,ry:0}],[X,{x:304}],...deck(X+6,-1)]}
   focus={[[3*B,{z:1.1}],[X,{z:1.22,cx:.5,cy:.55}]]}>
   <Late at={3*B-6}><Clip file="popup-overview.mp4" trim={9}/></Late>
  </Pane>
  {/* Explore: entry, fitting and lounge cut on consecutive beats. */}
  <Pane w={1560} h={877.5} keys={[[X,{x:300,y:20,z:-900,s:.74,o:0}],[X+8,{o:1}],[X+28,{x:300,y:20,z:0,s:.74}],[L,{x:300,s:.75}],[L+30,{x:0,y:60,s:1},'inOut'],[226,{x:0,y:60,s:1.02}],[250,{x:-250,y:40,ry:8,s:.76},'inOut'],[284,{x:-260,ry:6,s:.77},'inOut'],[300,{x:-1900,ry:34},'inOut']]}
   focus={[[L+30,{z:1}],[206,{z:1.02}],[222,{z:1.2,cx:.5,cy:.6}],[250,{z:1.06,cx:.5,cy:.55}],[300,{z:1.12,cx:.5}]]} label={f<X+8?undefined:f<6.5*B?'Entry and check-in':f<L?'Fitting bar zone':'Listening lounge'}>
   <Sequence from={Math.round(X)} durationInFrames={Math.round(6.5*B-X)} layout="none"><Room room="entry" at={0} trim={TRIM.entryCut} live={live('entry')}/></Sequence>
   <Sequence from={Math.round(6.5*B)} durationInFrames={Math.round(L-6.5*B)} layout="none"><Room room="fitting" at={0} trim={TRIM.fittingCut} live={live('fitting')}/></Sequence>
   <Sequence from={Math.round(L)} layout="none"><Room room="lounge" at={0} trim={TRIM.lounge} live={loungeLive}/></Sequence>
  </Pane>
  <Eyebrow text="Listening lounge" at={L+26} out={240} style={{left:0,right:0,top:44,justifyContent:'center'}}/>
  <Words text="Space to listen." at={L+30} out={240} size={58} style={{left:0,right:0,top:76,textAlign:'center'}}/>
  <Pane w={540} h={124} radius={20} z={10} keys={[[236,{x:640,y:-280,z:-200,ry:-24,o:0}],[242,{o:1}],[262,{x:560,y:-300,z:60,ry:-6}],[284,{x:556,y:-302},'inOut'],[300,{x:-900,o:0},'inOut']]}>
   <Dims label={`${name('z-lounge')} · from the report`} value={area('z-lounge')}/>
  </Pane>
  {loungeLive?<Pane w={470} h={264} radius={18} z={11} keys={[[250,{x:640,y:200,z:-200,ry:-24,o:0}],[256,{o:1}],[276,{x:560,y:100,z:80,ry:-6,rz:2}],[284,{x:556},'inOut'],[300,{x:-900,o:0},'inOut']]}>
   <Still src="popup-photo-4.jpg"/><Tag>Report photo</Tag>
  </Pane>:<Words text={'Eight seats.\nOpen-ear audio.'} at={252} step={B/3} size={40} color={T.inkSoft} style={{left:1330,top:420}}/>}
 </Stage>;
}

// ── 1:00–1:10 · The annex, then all six areas collapse into the next pill ──
export function Listening(){
 const f=useCurrentFrame();
 const annex:[string,string][]=[['popup-photo-6.jpg',`${name('z-messenger')} · ${dims('z-messenger')}`],['popup-photo-5.jpg',`${name('z-share')} · ${dims('z-share')}`]];
 const grid:[string,string][]=[['popup-photo-1.jpg','Entry and check-in'],['popup-photo-2.jpg','Fitting bar zone'],['popup-photo-3.jpg','Photo walk'],['popup-photo-4.jpg','Listening lounge'],['popup-photo-6.jpg','Messenger demo'],['popup-photo-5.jpg','Sharing and consultation']];
 const A=3*B,G=6*B,H=G+4*B,C=270;
 // Hand-off: a blank card shrinks to the chapter-pill shape KINTEX opens with.
 const m=interpolate(f,[C,300],[0,1],{...clamp,easing:IN_OUT});
 const cw=1640+(780-1640)*m,ch=660+(120-660)*m,cr=32+(60-32)*m,cy=520+(540-520)*m;
 type K=[number,{x?:number;y?:number;z?:number;ry?:number;s?:number;o?:number},'inOut'?];
 return <Stage note={PHOTOS}>
  <Eyebrow text="Annex" at={4} out={G-14} style={{left:110,top:300}}/>
  <Words text="Space to connect." at={8} out={G-14} size={76} style={{left:104,top:344}}/>
  <Words text="Share the moment." at={A+8} out={G-14} size={76} style={{left:104,top:436}}/>
  {annex.map(([src,label],i)=>{const at=i*A;const tail:K[]=i===0?[[A+20,{x:600,y:-200,z:-1100,ry:-20,o:.4},'inOut'],[G,{o:0}]]:[[G-4,{x:345},'inOut'],[G+18,{z:-1200,o:0},'inOut']];
   return <Pane key={src} w={1300} h={731} radius={30} z={i}
   keys={[[at,{x:1700,y:40,ry:-40,o:1}],[at+20,{x:330,y:40,ry:-6,s:.8},'out'],[at+A-4,{x:340,s:.82}],...tail]}
   focus={[[at+20,{z:1}],[at+B+10,{z:1.02}],[at+B+24,{z:1.3,cx:.6,cy:.58}],[at+A,{z:1.34}]]} label={label}>
   <Drift src={src} at={at}/>
  </Pane>})}
  <Eyebrow text="Seongsu / six experience areas" at={G+4} out={C-12} style={{left:0,right:0,top:50,justifyContent:'center'}}/>
  <Words text="Six areas. One route." at={G+8} out={C-8} size={60} style={{left:0,right:0,top:84,textAlign:'center'}}/>
  {/* Six report photos land on half beats, then the route lights them in order. */}
  <Group keys={[[G,{ry:-12,rx:8,z:-60}],[C,{ry:9,rx:2,z:40},'inOut']]}>
  {grid.map(([src,label],i)=>{const at=G+6+i*B/2,col=i%3,row=Math.floor(i/3);const x=(col-1)*540,y=row?260:-50;const p=H+i*B/2;
   return <Pane key={label} w={510} h={287} radius={18} z={20+i} label={label}
    keys={[[at,{x:x*1.25,y:y+80,z:-900,ry:(col-1)*-20,o:0}],[at+8,{o:1}],[at+30,{x,y,z:0,ry:(col-1)*-6}],[p,{z:0}],[p+6,{z:240,ry:0}],[p+B/2+6,{z:20,ry:(col-1)*-4},'inOut'],[C-8,{z:20}],[C+6,{x:x*.5,y:20+(y-20)*.5,z:-400,s:.7,o:0},'inOut']]}>
    <Still src={src}/>
   </Pane>})}
  </Group>
  <div style={{position:'absolute',left:960-cw/2,top:cy-ch/2,width:cw,height:ch,borderRadius:cr,background:T.surface,border:`1px solid ${T.hairline}`,boxShadow:`0 30px 90px ${T.shadowColor}`,opacity:fade(f,C-6,C+8),zIndex:30}}/>
 </Stage>;
}
