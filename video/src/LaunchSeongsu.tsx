
import {interpolate, useCurrentFrame} from 'remotion';

import {TOKENS as T} from '../../web/lib/ui/tokens';
import {BEAT, CANVAS, Clip, Eyebrow, OUT, Pane, Stage, Still, Tag, Words, clamp, font, footageNote} from './LaunchKit';

export function Sources(){
 return <Stage note={footageNote}>
  <Eyebrow text="01 / Context" at={2} style={{left:110,top:300}}/>
  <Words text={'The plan.\nThe brief.\nThe brand.'} at={8} step={BEAT/2} size={84} style={{left:104,top:350}}/>
  <Pane w={1160} h={1160*CANVAS} keys={[[0,{x:560,z:-700,ry:-38,rx:14,rz:4,o:.3}],[10,{o:1}],[56,{x:330,z:-40,ry:-16,rx:5,rz:0}],[225,{x:320,z:40,ry:-9,rx:2},'inOut']]}
   focus={[[70,{z:1,cx:.5,cy:.5}],[150,{z:1.42,cx:.51,cy:.5}],[225,{z:1.5}]]}>
   <Clip file="popup-sources.mp4"/>
  </Pane>
 </Stage>;
}

export function SeongsuReveal(){
 return <Stage note={footageNote}>
  <Eyebrow text="Seongsu / experience pop-up" at={2} out={150} style={{left:0,right:0,top:66,justifyContent:'center'}}/>
  <Words text="A visitor journey, made spatial." at={8} out={150} size={68} style={{left:0,right:0,top:104,textAlign:'center'}}/>
  <Pane w={1500} h={1500*CANVAS} keys={[[0,{y:330,z:-360,rx:62,rz:-3,o:.3}],[8,{o:1}],[96,{y:80,z:0,rx:0,rz:0,ry:-3}],[160,{ry:2},'inOut'],[250,{y:10,s:1.12,ry:0},'inOut'],[375,{s:1.15,ry:3},'inOut']]}
   focus={[[170,{z:1}],[300,{z:1.3,cy:.56}],[375,{z:1.36}]]} radius={30}>
   <Clip file="popup-overview.mp4"/>
  </Pane>
 </Stage>;
}

export function SeongsuDetail(){
 const prints:[string,string,number,number,number][]=[['popup-photo-2.jpg','Fitting bar zone',600,-3,120],['popup-photo-3.jpg','Photo walk',858,2,150]];
 return <Stage note={'Actual app capture and saved report photographs · saved Muse demo · English edition'}>
  <Pane w={1220} h={1220*CANVAS} keys={[[0,{x:-560,z:-500,ry:42,rz:-5,rx:8,o:.3}],[8,{o:1}],[64,{x:-250,z:0,ry:12,rz:0,rx:3}],[300,{x:-240,ry:6,z:30},'inOut']]}>
   <Clip file="popup-detail.mp4"/>
  </Pane>
  <Eyebrow text="Fitting bars / photo walk" at={4} style={{left:1300,top:150}}/>
  <Words text={'Try it on.\nFind your frame.'} at={10} step={BEAT/2} size={66} style={{left:1294,top:196}}/>
  {prints.map(([src,label,y,rz,at],i)=><Pane key={src} w={430} h={242} radius={18} z={10+i}
   keys={[[at,{x:620,y:y-540+260,z:-200,ry:-30,rz:rz*3,o:0}],[at+8,{o:1}],[at+50,{x:590-i*70,y:y-540,z:100,ry:-8,rz}],[300,{x:586-i*70,y:y-546,z:110},'inOut']]}>
   <Still src={src}/><Tag>{label}</Tag>
  </Pane>)}
 </Stage>;
}

export function ViewControls(){
 const SWITCH=160;
 return <Stage note={footageNote}>
  <Eyebrow text="02 / Explore" at={2} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="See the whole plan." at={6} out={SWITCH-14} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="Then get closer." at={SWITCH+4} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Pane w={1440} h={1440*CANVAS} keys={[[0,{y:90,z:-260,rz:-3,ry:-10,o:.3}],[8,{o:1}],[48,{y:90,z:0,rz:0,ry:0}],[SWITCH-6,{z:20},'inOut'],[SWITCH+50,{rx:16,ry:-8,z:20,y:100},'inOut'],[300,{rx:9,ry:-4,z:10,y:95},'inOut']]}>
   <Clip file="popup-top.mp4" rate={0.96}/>
  </Pane>
 </Stage>;
}

export function Listening(){
 const f=useCurrentFrame();
 return <Stage note={'Saved scene photograph from the planning report · illustrative spatial design'}>
  <Eyebrow text="Six experience areas" at={2} style={{left:100,top:300}}/>
  <Words text={'Space to listen.\nSpace to connect.'} at={8} step={BEAT/2} size={70} style={{left:96,top:346}}/>
  <div style={{position:'absolute',left:100,top:560,width:interpolate(f,[40,70],[0,72],{...clamp,easing:OUT}),height:5,borderRadius:3,background:T.accent}}/>
  <Pane w={1100} h={619} radius={34} keys={[[0,{x:600,z:-420,ry:-34,rz:3,o:.3}],[10,{o:1}],[70,{x:340,z:0,ry:-8,rz:0}],[300,{x:330,ry:-3,z:40},'inOut']]}
   focus={[[60,{z:1.04}],[300,{z:1.32,cx:.62,cy:.66}]]}>
   <Still src="popup-photo-4.jpg"/>
  </Pane>
  <Pane w={470} h={112} radius={20} z={10} keys={[[96,{x:110,y:310,z:60,ry:-20,o:0}],[104,{o:1}],[140,{x:150,y:330,z:180,ry:-6}],[300,{x:156,y:326,z:190},'inOut']]}>
   <div style={{padding:'20px 28px',fontFamily:font}}>
    <div style={{fontSize:18,color:T.muted,marginBottom:6}}>Listening lounge · from the report</div>
    <div style={{fontSize:32,fontWeight:600,color:T.ink,letterSpacing:-.6}}>13.3 × 6.8 m · 90.44 m²</div>
   </div>
  </Pane>
 </Stage>;
}

