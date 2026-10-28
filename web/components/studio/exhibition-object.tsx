"use client";
import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { DesignObject } from '@/lib/plans/schema';

// Locally drawn exhibition graphics: no remote textures or runtime font requests.
function Sign({ text, width, height, z }: {text:string;width:number;height:number;z:number}) {
 const texture=useMemo(()=>{
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=Math.max(192,Math.min(1536,Math.round(1536*height/width)));
  const H=canvas.height;
  const c=canvas.getContext('2d')!;
  const gradient=c.createLinearGradient(0,0,1536,H);gradient.addColorStop(0,'#072858');gradient.addColorStop(.55,'#075de8');gradient.addColorStop(1,'#8bcfff');c.fillStyle=gradient;c.fillRect(0,0,1536,H);
  c.strokeStyle='#ffffff28';c.lineWidth=3;
  for(let i=0;i<9;i++){c.beginPath();c.ellipse(1230,H*.5,180+i*48,H*(.17+i*.035),-.5,0,Math.PI*2);c.stroke();}
  c.fillStyle='#ffffff';c.font=`500 ${H*.06}px Arial`;c.fillText('Meta  /  EXPERIENCE LAB',90,H*.16);
  c.font=`500 ${Math.min(H*.19,1100/Math.max(text.length,1)*1.7)}px Arial`;c.fillText(text,90,H*.51,1320);
  c.font=`${H*.045}px Arial`;c.fillText('Explore. Create. Connect.',95,H*.74);
  c.font=`${H*.03}px Arial`;c.fillStyle='#d0e6ff';c.fillText('MUSE  /  SPATIAL CONCEPT',95,H*.9);
  const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;return t;
 },[text,width,height]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <mesh position={[0,height/2,z]}><planeGeometry args={[width*.94,height*.92]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>;
}
function Block({size,position,color,metal=0}:{size:[number,number,number];position:[number,number,number];color:string;metal?:number}) {
 return <mesh position={position} castShadow receiveShadow userData={{navigationObstacle:true}}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={metal?.35:.72} metalness={metal}/></mesh>;
}
export function ExhibitionObject({object:o}:{object:DesignObject}) {
 const {width:w,depth:d,height:h,color:c}=o;
 if(o.appearance==='sofa'||o.appearance==='seat') return <>
  <Block size={[w,h*.42,d*.88]} position={[0,h*.38,0]} color={c}/>
  <Block size={[w,h*.65,d*.18]} position={[0,h*.67,(o.appearance==='seat'?1:-1)*d*.4]} color={c}/>
  {[-1,1].map(side=><Block key={side} size={[w*.08,h*.55,d]} position={[side*w*.46,h*.5,0]} color={c}/>)}
  {[-1,1].flatMap(x=>[-1,1].map(z=><Block key={`${x}-${z}`} size={[.05,h*.2,.05]} position={[x*w*.36,h*.1,z*d*.32]} color='#38424d' metal={.6}/>))}
 </>;
 if(o.appearance==='table'||o.appearance==='counter') return <>
  <Block size={[w,h*.08,d]} position={[0,h*(o.appearance==='counter'?.75:.96),0]} color='#e4c9a3'/>
  <Block size={[w*.88,h*(o.appearance==='counter'?.71:.92),d*.8]} position={[0,h*(o.appearance==='counter'?.355:.46),0]} color={c}/>
  {o.appearance==='counter'&&<Block size={[w*.25,h*.21,.06]} position={[0,h*.895,0]} color='#203c5d'/>}
  {o.appearance==='counter'&&<Sign text={o.label} width={w*.9} height={h*.65} z={d*.405+.005}/>}
 </>;
 if(o.appearance==='plant') return <>
  <mesh position={[0,h*.16,0]} userData={{navigationObstacle:true}}><cylinderGeometry args={[w*.33,w*.26,h*.32,16]}/><meshStandardMaterial color='#e6ded1'/></mesh>
  <mesh position={[0,h*.5,0]}><cylinderGeometry args={[.04,.06,h*.6,8]}/><meshStandardMaterial color='#6c6048'/></mesh>
  {[0,1,2].map(i=><mesh key={i} position={[Math.sin(i*2)*w*.15,h*(.52+i*.13),Math.cos(i*2)*d*.15]} scale={[w*.42,h*.22,d*.42]} userData={{navigationObstacle:true}}><sphereGeometry args={[1,12,10]}/><meshStandardMaterial color={['#456b53','#5d8261','#739273'][i]} roughness={1}/></mesh>)}
 </>;
 if(o.appearance==='truss') return <>
  {[-1,1].flatMap(y=>[-1,1].map(z=><Block key={`${y}-${z}`} size={[w,.045,.045]} position={[0,h/2+y*h*.4,z*d*.4]} color='#a0aab7' metal={.8}/>))}
  {Array.from({length:Math.ceil(w)},(_,i)=><mesh key={i} position={[-w/2+(i+.5)*w/Math.ceil(w),h/2,0]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[.035,h*1.1,.035]}/><meshStandardMaterial color='#a0aab7' metalness={.8}/></mesh>)}
 </>;
 return <>
  <Block size={[w,h,d]} position={[0,h/2,0]} color={c}/>
  {(o.appearance==='screen'||o.kind==='hanging-sign')&&<>
   <Sign text={o.label} width={w} height={h} z={d/2+.008}/>
   <group rotation-y={Math.PI}><Sign text={o.label} width={w} height={h} z={d/2+.008}/></group>
  </>}
  {o.kind==='stage'&&<Block size={[w,.035,.025]} position={[0,h*.8,d/2+.015]} color='#3d94ff'/>}
  {o.kind==='light'&&<mesh position={[0,.005,0]} rotation-x={Math.PI/2}><planeGeometry args={[w*.95,d*.95]}/><meshBasicMaterial color='#fff2d5' toneMapped={false}/></mesh>}
 </>;
}
