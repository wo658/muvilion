
import {useCurrentFrame} from 'remotion';

import {TOKENS as T} from '../../web/lib/ui/tokens';
import {BEAT, CANVAS, Clip, Eyebrow, Pane, Stage, Still, Tag, Words, footageNote} from './LaunchKit';

export function KintexReveal(){
 return <Stage note={footageNote} perspective={2600}>
  <Eyebrow text="KINTEX / Creator Connection Day" at={4} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="A larger stage for shared ideas." at={10} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="A 40 × 30 m event area inside Hall 1B." at={40} step={2} size={26} weight={400} color={T.inkSoft} style={{left:0,right:0,top:166,textAlign:'center'}}/>
  <Pane w={1380} h={1380*CANVAS} keys={[[0,{y:110,z:-1500,ry:46,rx:20,rz:-7,o:.3}],[10,{o:1}],[90,{y:100,z:0,ry:0,rx:0,rz:0}],[375,{y:100,ry:-5,z:20},'inOut']]}
   focus={[[180,{z:1}],[330,{z:1.55,cx:.5,cy:.56}],[375,{z:1.6}]]}>
   <Clip file="kintex-overview.mp4"/>
  </Pane>
 </Stage>;
}

export function KintexTop(){
 const f=useCurrentFrame();const SWITCH=160;
 const words=['Capture.','Edit.','Talk.','Unwind.'];
 return <Stage note={footageNote}>
  <Eyebrow text="Eight program areas" at={2} style={{left:110,top:250}}/>
  {words.map((w,i)=><Words key={w} text={w} at={6+i*BEAT} size={92} color={f>=6+(i+1)*BEAT&&f<6+4*BEAT?T.muted:T.ink} style={{left:104,top:300+i*104}}/>)}
  <Pane w={1100} h={1100*CANVAS} keys={[[0,{x:330,y:40,z:-300,rx:52,rz:-8,o:.3}],[8,{o:1}],[70,{x:330,y:20,z:0,rx:0,rz:0}],[SWITCH-6,{z:30},'inOut'],[SWITCH+50,{x:300,rx:16,ry:-7,rz:-2,z:10,y:40},'inOut'],[300,{rx:10,ry:-4,rz:0,z:0},'inOut']]}>
   <Clip file="kintex-top.mp4" rate={0.96}/>
  </Pane>
 </Stage>;
}

export function KintexDetail(){
 const prints:[string,string][]=[['kintex-photo-3.jpg','Talk stage and audience'],['kintex-photo-1.jpg','Instagram photo studio'],['kintex-photo-6.jpg','Threads conversation salon']];
 return <Stage note={'Actual app capture and saved report photographs · saved Muse demo · English edition'}>
  <Eyebrow text="Studios / salon / talk stage" at={2} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="Every zone has a purpose." at={8} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Pane w={1500} h={1500*CANVAS} keys={[[0,{y:110,z:-420,ry:-22,rz:6,o:.3}],[8,{o:1}],[70,{y:90,z:0,ry:-3,rz:0}],[110,{},'inOut'],[170,{x:-150,y:80,ry:8,z:-160},'inOut'],[300,{x:-160,ry:6,z:-150},'inOut']]}>
   <Clip file="kintex-detail.mp4"/>
  </Pane>
  {prints.map(([src,label],i)=>{const at=120+i*BEAT;return <Pane key={src} w={400} h={225} radius={18} z={10+i}
   keys={[[at,{x:760,y:-40+i*235,z:-300,ry:-34,rz:6,o:0}],[at+8,{o:1}],[at+48,{x:540,y:-130+i*235,z:120,ry:-10,rz:(i-1)*2}],[300,{x:536,y:-132+i*235,z:130},'inOut']]}>
   <Still src={src}/><Tag>{label}</Tag>
  </Pane>})}
 </Stage>;
}

// Document captures: the report column spans about 26–78 % of the frame width.
