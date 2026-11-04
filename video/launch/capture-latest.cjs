// Actual current-app captures, rendered frame by frame. Requires a separately installed Playwright.
//
// Every recorded frame is exactly 1/30 s of film time. While a 3D clip records, the scene's
// react-three-fiber root is switched to frameloop "never" and advanced by 1/30 s before each
// device-scale screenshot, so camera damping, Muvi and transitions step deterministically and
// no frame is duplicated or dropped, however long a screenshot takes. Orbit, zoom and view
// changes are real pointer/wheel input and DOM clicks delivered between frames. Interior
// walkthroughs move the app's own camera controls (the Explore view, ceiling shown) along a
// scripted eye-level path. No web code is changed: an init script only remembers the R3F root.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'out/latest-captures');fs.mkdirSync(out,{recursive:true});
const origin=process.env.FILM_ORIGIN||'http://localhost:3121';
const only=process.env.FILM_ONLY?new Set(process.env.FILM_ONLY.split(',')):null;const want=name=>!only||only.has(name);
const FPS=30;
// Interior walkthroughs (`<sample>-interior-*`) are planned by plan-interior-paths.ts into
// out/latest-captures/interior-paths.json: each is framed on a feature wall surface of the demo, and the
// eye glides from `from` to `to` (scene metres, eye height 1.65 m) while it keeps looking at `target`
// (plus a small yaw drift), a slow parallax dolly checked with the app's walk rules.
const INTERIOR_SECONDS=9;
const INTERIOR_FOV=Number(process.env.FILM_INTERIOR_FOV||60); // the app's interior report photos use 60°
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-gpu-rasterization','--ignore-gpu-blocklist','--disable-smooth-scrolling']});
 // 1440×810 CSS at 1.5× → 2160×1215 frames, so panels and push-ins in the film stay sharp.
 const W=Number(process.env.FILM_W||1440),H=Number(process.env.FILM_H||810),DPR=Number(process.env.FILM_DPR||1.5);
 const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:DPR});
 await context.addInitScript(()=>{
  localStorage.setItem('muvilion.settings.language.v1','en');
  // react-three-fiber keeps its roots in a module Map keyed by canvas; remember them for frame stepping.
  const set=Map.prototype.set;window.__filmRoots=new Map();
  Map.prototype.set=function(key,value){if(typeof HTMLCanvasElement!=='undefined'&&key instanceof HTMLCanvasElement&&value&&value.store&&value.fiber)set.call(window.__filmRoots,key,value);return set.call(this,key,value)};
 });
 const page=await context.newPage();let cdp=await context.newCDPSession(page);
 // A raw CDP session drops Playwright's device scale; set it explicitly for every shot.
 const metrics=dpr=>cdp.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:dpr,mobile:false});
 const wait=ms=>page.waitForTimeout(ms);
 // Buttons are activated with DOM click events: CDP shows no pointer, and the sticky report header
 // can overlap the hit point of the report tabs after scrolling.
 const click=name=>page.getByRole('button',{name,exact:true}).dispatchEvent('click');
 const step3d=()=>page.evaluate(fps=>{const r=[...window.__filmRoots].find(([c])=>c.isConnected);if(!r||!window.__filmStepping)return;window.__filmT+=1/fps;r[1].store.getState().advance(window.__filmT)},FPS);
 const stepping=on=>page.evaluate(on=>{const r=[...window.__filmRoots].find(([c])=>c.isConnected);if(!r)return false;const s=r[1].store.getState();if(on){s.setFrameloop('never');window.__filmT=0;window.__filmStepping=true;s.advance(0)}else{window.__filmStepping=false;s.setFrameloop('demand');s.invalidate()}return true},on);
 let rec=null;
 async function frame(){await step3d();const {data}=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:95});const file=`f${String(rec.index++).padStart(6,'0')}.jpg`;fs.writeFileSync(path.join(rec.dir,file),Buffer.from(data,'base64'));rec.frames.push({name:file,time:(rec.index-1)/FPS})}
 async function hold(seconds){for(let i=Math.round(seconds*FPS);i>0;i--)await frame()}
 const ease=t=>.5-.5*Math.cos(Math.PI*Math.min(1,Math.max(0,t)));
 async function shot(name,action,{threeD=false}={}){
  if(!want(name))return;
  await metrics(DPR);await page.evaluate(()=>document.activeElement instanceof HTMLElement&&document.activeElement.blur());await wait(300);
  const dir=path.join(out,name);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  if(threeD&&!(await stepping(true)))throw Error(name+': no 3D canvas');
  rec={dir,index:0,frames:[]};const started=Date.now();
  await hold(.4);await action();await hold(1.2);
  if(threeD)await stepping(false);
  await wait(400);await page.screenshot({path:path.join(out,name+'.png')});
  fs.writeFileSync(path.join(dir,'frames.json'),JSON.stringify({stepped:true,fps:FPS,duration:rec.frames.length/FPS,frames:rec.frames}));
  console.log(name,rec.frames.length,'frames',(rec.frames.length/FPS).toFixed(2)+'s','captured in',((Date.now()-started)/1000).toFixed(0)+'s');rec=null;
 }
 // Drag on the canvas with one pointer move per frame (eased), as a person orbiting the view would.
 async function orbit(seconds,dx,dy=0){const box=await page.locator('canvas').boundingBox();const x=box.x+box.width*.52,y=box.y+box.height*.52;await page.mouse.move(x,y);await page.mouse.down();const n=Math.round(seconds*FPS);for(let i=1;i<=n;i++){const f=ease(i/n);await page.mouse.move(x+dx*f,y+dy*f);await frame()}await page.mouse.up()}
 async function scroll(px,seconds){await page.mouse.move(W*.5,H*.62);const n=Math.round(seconds*FPS);let done=0;for(let i=1;i<=n;i++){const to=Math.round(px*ease(i/n));if(to>done){await page.mouse.wheel(0,to-done);done=to}await frame()}}
 const setFov=fov=>page.evaluate(fov=>{const s=[...window.__filmRoots].find(([c])=>c.isConnected)[1].store.getState();s.camera.fov=fov;s.camera.updateProjectionMatrix();s.invalidate()},fov);
 function walkPose(spec,t){
  const f=ease(t),x=spec.from[0]+(spec.to[0]-spec.from[0])*f,z=spec.from[1]+(spec.to[1]-spec.from[1])*f;
  const [tx,ty,tz]=spec.target,drift=(spec.drift??3)*(2*f-1)*Math.PI/180;
  const yaw=Math.atan2(tz-z,tx-x)+drift,pitch=Math.atan2(ty-1.65,Math.hypot(tx-x,tz-z))+(3+1.5*Math.sin(Math.PI*t))*Math.PI/180;
  return [x,z,Math.cos(yaw)*Math.cos(pitch)*.01,Math.sin(pitch)*.01,Math.sin(yaw)*Math.cos(pitch)*.01];
 }
 const lookAt=pose=>page.evaluate(([x,z,lx,ly,lz])=>{const s=[...window.__filmRoots].find(([c])=>c.isConnected)[1].store.getState();s.controls.setLookAt(x,1.65,z,x+lx,1.65+ly,z+lz,false);s.invalidate()},pose);
 async function walk(spec){const n=Math.round(INTERIOR_SECONDS*FPS);for(let i=0;i<=n;i++){await lookAt(walkPose(spec,i/n));await frame()}}
 const paths=JSON.parse(fs.readFileSync(path.join(out,'interior-paths.json'),'utf8'));
 const ids={};
 for(const sample of ['popup','kintex']){
    const response=await page.request.post(origin+'/api/projects/samples',{data:{id:sample}});if(!response.ok())throw Error(await response.text());const project=await response.json();ids[sample]=project.id;
  await page.goto(origin+'/?project='+project.id);await page.waitForSelector('[data-testid="planning-artifact"]');await wait(2000);
  await page.addStyleTag({content:'nextjs-portal { display:none !important; }'});
  await click('Minimize Muse');
  await shot(sample+'-report',async()=>{await hold(3);await scroll(840,2.8);await hold(2.5)});
  await shot(sample+'-areas',async()=>{await click('Participation guide');await hold(3);await scroll(1440,4.5);await hold(2.5)});
  await click('Project overview');
  if(want(sample+'-export'))await shot(sample+'-export',async()=>{await hold(1.2);const opened=context.waitForEvent('page');await click('Open planning PDF');await hold(.6);const pdfPage=await opened;await pdfPage.waitForLoadState('domcontentloaded');await pdfPage.waitForTimeout(1500);await pdfPage.pdf({path:path.join(out,sample+'-planning.pdf'),printBackground:true,preferCSSPageSize:true});fs.writeFileSync(path.join(out,sample+'-report.html'),await pdfPage.content());await pdfPage.screenshot({path:path.join(out,sample+'-pdf.png'),fullPage:false});await pdfPage.close();await hold(2)});
  await click('Back to space');await page.waitForSelector('canvas');await wait(2500);
  await shot(sample+'-overview',async()=>{await hold(1.5);await orbit(10,120,-12);await hold(2)},{threeD:true});
  await shot(sample+'-top',async()=>{await click('Top');await hold(4.5);await click('Overview');await hold(3.5)},{threeD:true});
  await shot(sample+'-detail',async()=>{const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.53,box.y+box.height*.55);for(let i=0;i<8;i++){await page.mouse.wheel(0,-35);await hold(.1)}await hold(1.5);await orbit(8,-65,15);await hold(2.5)},{threeD:true});
  const interiors=Object.entries(paths).filter(([name,spec])=>spec.sample===sample&&want(name));
  if(interiors.length){
   await click('Explore');await wait(2500);
   for(const [name,spec] of interiors){
    spec.drift=interiors.indexOf(interiors.find(([n])=>n===name))%2?-3:3;
    await setFov(INTERIOR_FOV);await lookAt(walkPose(spec,0));await wait(800);
    await shot(name,async()=>{await walk(spec)},{threeD:true});}
   await click('Overview');await wait(2500);
  }
  if(want(sample+'-sources')){await click('Sources');await wait(500);await shot(sample+'-sources',async()=>{await hold(6)});await page.keyboard.press('Escape')}
 }
 fs.writeFileSync(path.join(out,'projects.json'),JSON.stringify(ids,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
