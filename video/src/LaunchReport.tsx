import React from 'react';


import {TOKENS as T} from '../../web/lib/ui/tokens';
import {BEAT, Clip, Eyebrow, Group, Pane, Stage, Still, Words, footageNote, DOC, PAGE, type Pose, type Key} from './LaunchKit';

export function Report({file,title,eyebrow,mirror=false}:{file:string;title:string;eyebrow:string;mirror?:boolean}){
 const cw=1680;
 return <Stage note={footageNote}>
  <Eyebrow text={eyebrow} at={2} style={mirror?{left:1290,top:330}:{left:110,top:330}}/>
  <Words text={title} at={8} step={BEAT/2} size={74} style={mirror?{left:1284,top:376}:{left:104,top:376}}/>
  <Pane w={960} h={800} cw={cw} ch={cw*DOC} radius={28}
   keys={mirror?[[0,{x:-330,z:-200,ry:64,rz:-2,o:.3}],[8,{o:1}],[64,{x:-330,z:0,ry:7,rz:0}],[96,{ry:4},'inOut'],[300,{ry:2,z:40},'inOut']]
    :[[0,{x:330,y:200,z:-320,rx:-34,ry:-18,o:.3}],[8,{o:1}],[70,{x:330,y:20,z:0,rx:0,ry:-6}],[100,{ry:-4},'inOut'],[300,{ry:-2,z:40},'inOut']]}
   focus={[[0,{cx:.52,cy:.62,z:1}],[300,{z:1.06}]]}>
   <Clip file={file}/>
  </Pane>
 </Stage>;
}

// Six or eight area-guide pages from the exported PDF, fanned in depth.
function Fan({pages,hero,at,push}:{pages:string[];hero:number;at:number;push:number}){
 const n=pages.length;const w=440,h=w*PAGE;
 return <>{pages.map((src,i)=>{const c=i-(n-1)/2;const t=at+i*5;const isHero=i===hero;
  const fan:Pose={x:330+c*150,y:40+Math.abs(c)*10,z:-40-Math.abs(c)*90,ry:-6-c*9,rz:c*1.5,o:1};
  const keys:Key[]=[[t,{x:330+c*40,y:560,z:-300,ry:-40,rz:c*6,o:0}],[t+8,{o:1}],[t+56,fan]];
  if(isHero)keys.push([push,{}],[push+56,{x:330,y:20,z:380,ry:-4,rz:0},'inOut'],[push+130,{z:400,ry:-2},'inOut']);
  else keys.push([push,{}],[push+56,{z:fan.z!-200},'inOut']);
  return <Pane key={src} w={w} h={h} radius={10} z={isHero?40:20-Math.abs(c)} keys={keys}
   focus={isHero?[[push+10,{z:1,cx:.5,cy:0}],[push+70,{z:1.75,cx:.3,cy:.22}],[push+140,{z:1.8}]]:undefined}>
   <Still src={src} fit="contain"/>
  </Pane>})}</>;
}

export function PopupAreas(){
 const pages=[3,4,5,6,7,8].map(n=>`popup-pdf-p${n}.png`);
 const cw=1700;
 return <Stage note={'App capture, then area-guide pages from the exported planning PDF · saved Muse demo'}>
  <Eyebrow text="Area-by-area guide" at={2} style={{left:110,top:300}}/>
  <Words text={'Photographs.\nDimensions.\nVisitor flow.'} at={8} step={BEAT} size={76} style={{left:104,top:346}}/>
  <Pane w={1000} h={760} cw={cw} ch={cw*DOC} keys={[[0,{x:330,z:-500,ry:-40,rz:3,o:.3}],[8,{o:1}],[60,{x:330,z:0,ry:-8,rz:0}],[124,{x:320,z:20,ry:-6},'inOut'],[170,{x:300,z:-900,ry:14,o:0},'inOut']]}
   focus={[[0,{cx:.52,cy:.62,z:1}],[130,{z:1.06}]]}>
   <Clip file="popup-areas.mp4" trim={2}/>
  </Pane>
  <Fan pages={pages} hero={3} at={140} push={250}/>
 </Stage>;
}

export function KintexAreas(){
 const pages=[3,4,5,6,7,8,9,10].map(n=>`kintex-pdf-p${n}.png`);
 const cw=1400;
 return <Stage note={'Actual app capture over area-guide pages from the exported planning PDF · saved Muse demo'} perspective={2400}>
  <Eyebrow text="Design intent / operations / review" at={2} style={{left:110,top:110}}/>
  <Words text={'Ready for the next\nconversation.'} at={8} step={4} size={70} style={{left:104,top:154}}/>
  <Group keys={[[0,{x:300,y:330,z:-700,rx:44,rz:-12,o:.3}],[12,{o:1}],[90,{x:100,y:300,z:-480,rx:36,rz:-10}],[375,{x:-240,y:290,z:-440,rx:34,rz:-9},'inOut']]}>
   {pages.map((src,i)=>{const col=i%4,row=Math.floor(i/4);const w=420,h=w*PAGE;
    return <div key={src} style={{position:'absolute',left:960-w/2+(col-1.5)*460,top:540-h/2+(row-.5)*620,width:w,height:h,borderRadius:8,overflow:'hidden',background:T.surface,border:`1px solid ${T.hairline}`,boxShadow:`0 30px 60px ${T.shadowColor}`}}>
     <Still src={src} fit="contain"/>
    </div>})}
  </Group>
  <Pane w={820} h={600} cw={cw} ch={cw*DOC} z={30} keys={[[60,{x:520,y:120,z:-200,ry:-36,rx:10,o:0}],[68,{o:1}],[130,{x:430,y:90,z:110,ry:-12,rx:2}],[375,{x:420,y:80,z:130,ry:-6,rx:0},'inOut']]}
   focus={[[0,{cx:.52,cy:.62,z:1}],[375,{z:1.06}]]}>
   <Clip file="kintex-areas.mp4" trim={1.5}/>
  </Pane>
 </Stage>;
}

export function Export(){
 const PRESS=68;
 return <Stage note={'Actual app capture and the PDF it opened · saved Muse demo · English edition'}>
  <Eyebrow text="04 / Share" at={2} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="Open your planning PDF." at={8} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Pane w={1440} h={1440*DOC} keys={[[0,{y:110,z:-320,rx:16,rz:-4,o:.3}],[8,{o:1}],[50,{y:100,z:0,rx:0,rz:0}],[PRESS+40,{}],[PRESS+90,{x:-250,z:-320,ry:16},'inOut'],[225,{x:-260,z:-340,ry:18},'inOut']]}
   focus={[[14,{z:1,cx:.5,cy:.5}],[54,{z:1.6,cx:.75,cy:.2}],[PRESS+40,{z:1.6}],[PRESS+90,{z:1,cx:.5,cy:.5}]]}>
   <Clip file="popup-export.mp4" rate={0.88}/>
  </Pane>
  <Pane w={1180} h={1180*1080/1920} z={20} keys={[[PRESS+44,{x:700,y:160,z:-200,ry:-40,o:0}],[PRESS+52,{o:1}],[PRESS+100,{x:300,y:140,z:160,ry:-10}],[225,{x:290,y:136,z:180,ry:-7},'inOut']]}
   focus={[[PRESS+100,{z:1,cx:.5,cy:.3}],[225,{z:1.15}]]}>
   <Still src="popup-pdf.png"/>
  </Pane>
 </Stage>;
}

export function Documents(){
 const decks:[string,string,number[]][]=[['popup','Seongsu pop-up · 16-page proposal',[16,8,6,5,3,2,1]],['kintex','KINTEX creator day · 20-page proposal',[20,9,7,5,3,2,1]]];
 return <Stage note={'Pages rendered from PDFs exported by the current app · planning material, not construction certification'} perspective={2600}>
  <Eyebrow text="Ready to share" at={2} style={{left:0,right:0,top:52,justifyContent:'center'}}/>
  <Words text="A complete proposal. A clear next step." at={8} size={60} style={{left:0,right:0,top:86,textAlign:'center'}}/>
  <Words text="Design intent, area guides, photographs and review notes." at={44} step={1.5} size={25} weight={400} color={T.inkSoft} style={{left:0,right:0,top:166,textAlign:'center'}}/>
  <Group keys={[[0,{ry:-22,z:-260,y:20}],[375,{ry:14,z:-60,y:10},'inOut']]}>
   {decks.map(([name,label,pages],d)=>{const cx=(d-.5)*900;return <React.Fragment key={name}>
    {pages.map((n,i)=>{const k=pages.length-1-i;const w=320,h=w*PAGE;const at=d*6+i*2;
     return <Pane key={n} w={w} h={h} radius={8} soft keys={[[at,{x:cx,y:620,z:-200,rz:(d?4:-4),o:0}],[at+8,{o:1}],[at+46,{x:cx,y:60,z:-k*6,rz:0},'out'],[150+d*10,{}],[230+d*10+i*4,{x:cx+(k-3)*50,y:40+Math.abs(k-3)*8,z:(3-Math.abs(k-3))*24,rz:(k-3)*3},'inOut']]}>
      <Still src={`${name}-pdf-p${n}.png`} fit="contain"/>
     </Pane>})}
   </React.Fragment>})}
  </Group>
  {decks.map(([name,label],d)=><Words key={name} text={label} at={120+d*8} step={2} size={24} weight={500} color={T.inkSoft} style={{left:d?1010:10,width:900,top:900,textAlign:'center'}}/>)}
 </Stage>;
}
