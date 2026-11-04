import React from 'react';
import {AbsoluteFill, Img, interpolate, Easing, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
import {TOKENS as T} from '../../web/lib/ui/tokens';

// Shared stage, panel camera and type helpers for the launch film scenes.
export const font='"SF Pro Display", Arial, sans-serif';
export const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
export const OUT=Easing.bezier(.16,1,.3,1);
export const IN_OUT=Easing.bezier(.65,0,.35,1);
export const asset=(name:string)=>staticFile(`launch-current/${name}`);
export const footageNote='Actual app capture · saved Muse demo · English edition';
export const BEAT=18.75; // one beat of the 2.5-second bar

// ── Camera keyframes ─────────────────────────────────────────────────────────
export type Pose={x?:number;y?:number;z?:number;rx?:number;ry?:number;rz?:number;s?:number;o?:number};
export type Key=[frame:number,pose:Pose,ease?:'out'|'inOut'];
export type Full=Required<Pose>;
export const REST:Full={x:0,y:0,z:0,rx:0,ry:0,rz:0,s:1,o:1};
export function track(f:number,keys:Key[]):Full{
 const full:Full[]=[];let prev={...REST};
 for(const [,p] of keys){prev={...prev};(Object.keys(p) as (keyof Full)[]).forEach(k=>{if(p[k]!==undefined)prev[k]=p[k]!});full.push(prev)}
 if(f<=keys[0][0])return full[0];
 for(let i=1;i<keys.length;i++){
  if(f<=keys[i][0]){
   const a=full[i-1],b=full[i],[f0]=keys[i-1],[f1,,e]=keys[i];
   const t=interpolate(f,[f0,f1],[0,1],{...clamp,easing:e==='inOut'?IN_OUT:OUT});
   const o={} as Full;(Object.keys(a) as (keyof Full)[]).forEach(k=>{o[k]=a[k]+(b[k]-a[k])*t});return o;
  }
 }
 return full[full.length-1];
}
export const tf=(p:Full)=>`translate3d(${p.x}px,${p.y}px,${p.z}px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotateZ(${p.rz}deg) scale(${p.s})`;

// Push-in inside a panel: cx/cy pick a point of the content (0–1), z is zoom.
export type Focus={cx?:number;cy?:number;z?:number};
export type FKey=[frame:number,focus:Focus,ease?:'out'|'inOut'];
export function focusAt(f:number,keys?:FKey[]){
 if(!keys)return {cx:.5,cy:.5,z:1};
 const p=track(f,keys.map(([k,v,e])=>[k,{x:v.cx,y:v.cy,s:v.z},e??'inOut'] as Key));
 return {cx:keys.some(k=>k[1].cx!==undefined)?p.x:.5,cy:keys.some(k=>k[1].cy!==undefined)?p.y:.5,z:p.s};
}

export function Stage({children,note,perspective=2200}:{children:React.ReactNode;note:string;perspective?:number}){
 return <AbsoluteFill style={{background:T.bg,overflow:'hidden',fontFamily:font}}>
  <AbsoluteFill style={{perspective,perspectiveOrigin:'50% 48%'}}>
   <AbsoluteFill style={{transformStyle:'preserve-3d'}}>{children}</AbsoluteFill>
  </AbsoluteFill>
  <Footnote>{note}</Footnote>
 </AbsoluteFill>;
}

// A floating panel. Window w×h; content cw×ch (defaults to the window) is cropped by focus.
export function Pane({w,h,cw=w,ch=h,keys,focus,radius=26,children,frame=true,soft=false,z=0}:{w:number;h:number;cw?:number;ch?:number;keys:Key[];focus?:FKey[];radius?:number;children:React.ReactNode;frame?:boolean;soft?:boolean;z?:number}){
 const f=useCurrentFrame();const p=track(f,keys);const fo=focusAt(f,focus);
 const sw=cw*fo.z,sh=ch*fo.z;
 const tx=sw<=w?(w-sw)/2:Math.min(0,Math.max(w-sw,w/2-fo.cx*sw));
 const ty=sh<=h?(h-sh)/2:Math.min(0,Math.max(h-sh,h/2-fo.cy*sh));
 return <div style={{position:'absolute',left:960-w/2,top:540-h/2,width:w,height:h,transform:tf(p),opacity:p.o,zIndex:z,borderRadius:radius,overflow:'hidden',background:T.surface,
  border:frame?`1px solid ${T.hairline}`:'none',boxShadow:!frame?'none':soft?`0 6px 18px ${T.shadowColor}`:`0 40px 90px ${T.shadowColor}, 0 8px 24px ${T.shadowColor}`,backfaceVisibility:'hidden'}}>
  <div style={{position:'absolute',left:0,top:0,width:cw,height:ch,transformOrigin:'0 0',transform:`translate(${tx}px,${ty}px) scale(${fo.z})`}}>{children}</div>
 </div>;
}
// A non-visual 3D group (orbits several panels together).
export function Group({keys,children}:{keys:Key[];children:React.ReactNode}){
 const f=useCurrentFrame();const p=track(f,keys);
 return <AbsoluteFill style={{transformStyle:'preserve-3d',transform:tf(p),opacity:p.o}}>{children}</AbsoluteFill>;
}

export const Clip=({file,rate=1,trim=0}:{file:string;rate?:number;trim?:number})=>{const {fps}=useVideoConfig();
 return <Video muted src={asset(file)} playbackRate={rate} trimBefore={Math.round(trim*fps)} objectFit="fill" style={{width:'100%',height:'100%'}}/>};
export const Still=({src,fit='cover'}:{src:string;fit?:'cover'|'contain'})=><Img src={asset(src)} style={{width:'100%',height:'100%',objectFit:fit}}/>;

// ── Type ─────────────────────────────────────────────────────────────────────
// Words rise out of a mask one by one; `out` sends them up and away.
export function Words({text,at=0,out,size=64,weight=600,color=T.ink,step=4,style,lineHeight=1.08}:{text:string;at?:number;out?:number;size?:number;weight?:number;color?:string;step?:number;style?:React.CSSProperties;lineHeight?:number}){
 const f=useCurrentFrame();let i=0;
 return <div style={{position:'absolute',fontFamily:font,fontSize:size,fontWeight:weight,color,letterSpacing:-size*.035,lineHeight,...style}}>
  {text.split('\n').map((line,l)=><div key={l} style={{whiteSpace:'nowrap'}}>{line.split(' ').map((word,j)=>{const k=i++;
   const t=interpolate(f,[at+k*step,at+k*step+20],[0,1],{...clamp,easing:OUT});
   const u=out===undefined?0:interpolate(f,[out+k*2,out+k*2+16],[0,1],{...clamp,easing:IN_OUT});
   return <span key={j} style={{display:'inline-block',overflow:'hidden',verticalAlign:'top',paddingBottom:size*.12,marginBottom:-size*.12}}>
    <span style={{display:'inline-block',transform:`translateY(${(1-t)*108-u*108}%)`,opacity:Math.min(t*1.4,1-u)}}>{word}{' '}</span>
   </span>})}</div>)}
 </div>;
}
export function Eyebrow({text,at=0,out,style}:{text:string;at?:number;out?:number;style?:React.CSSProperties}){
 const f=useCurrentFrame();
 const o=interpolate(f,[at,at+14],[0,1],clamp)*(out===undefined?1:interpolate(f,[out,out+12],[1,0],clamp));
 return <div style={{position:'absolute',fontFamily:font,fontSize:18,letterSpacing:3.4,color:T.muted,textTransform:'uppercase',opacity:o,display:'flex',alignItems:'center',gap:14,...style}}>
  <span style={{width:interpolate(f,[at,at+24],[0,34],{...clamp,easing:OUT}),height:3,borderRadius:2,background:T.accent}}/>{text}
 </div>;
}
export function Footnote({children,at=6}:{children:string;at?:number}){
 const f=useCurrentFrame();
 return <div style={{position:'absolute',left:60,bottom:24,padding:'5px 12px',borderRadius:999,background:T.bg,fontSize:19,color:T.muted,fontFamily:font,opacity:interpolate(f,[at,at+16],[0,1],clamp),zIndex:50}}>{children}</div>;
}
// Small label riding on a print.
export function Tag({children}:{children:string}){
 return <div style={{position:'absolute',left:18,bottom:16,padding:'8px 16px',borderRadius:999,background:T.surface,color:T.ink,fontFamily:font,fontSize:21,fontWeight:500,boxShadow:`0 6px 18px ${T.shadowColor}`}}>{children}</div>;
}

// All captures are 1440×810 CSS px at 1.5× (2160×1215).
export const CANVAS=1215/2160,DOC=1215/2160,PAGE=2200/1554;

