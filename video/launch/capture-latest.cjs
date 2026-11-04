// Actual current-app captures. Requires a separately installed Playwright browser.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'out/latest-captures');fs.mkdirSync(out,{recursive:true});
const origin=process.env.FILM_ORIGIN||'http://localhost:3121';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-gpu-rasterization','--ignore-gpu-blocklist']});
 // 1440×810 CSS at 1.5× → 2160×1215 frames (2× halves the screenshot rate), so panels and push-ins in the film stay sharp.
 const W=Number(process.env.FILM_W||1440),H=Number(process.env.FILM_H||810),DPR=Number(process.env.FILM_DPR||1.5);
 const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:DPR});
 await context.addInitScript(()=>localStorage.setItem('muvilion.settings.language.v1','en'));
 const page=await context.newPage();let cdp=await context.newCDPSession(page);
 // A raw CDP session drops Playwright's device scale; set it explicitly for every shot.
 const metrics=dpr=>cdp.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:dpr,mobile:false});
 const hold=ms=>page.waitForTimeout(ms);
 // CDP screencast frames are delivered at CSS-pixel size in headless Chrome, so record with
 // back-to-back device-scale screenshots instead (about 25–30 fps) and keep their wall-clock times.
// Buttons are activated with DOM click events: CDP shows no pointer, and the sticky report header
 // can overlap the hit point of the report tabs after scrolling.
 async function shot(name,action,dpr=DPR){
  await metrics(dpr);await hold(300);
  const dir=path.join(out,name);fs.mkdirSync(dir,{recursive:true});let index=0,recording=true;const frames=[];const start=Date.now();
  const loop=(async()=>{while(recording){const t=Date.now();const {data}=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:92,optimizeForSpeed:true});const file=`f${String(index++).padStart(6,'0')}.jpg`;fs.writeFileSync(path.join(dir,file),Buffer.from(data,'base64'));frames.push({name:file,time:(t+Date.now())/2000});}})();
  await hold(400);await action();await hold(1200);recording=false;await loop;await page.screenshot({path:path.join(out,name+'.png')});
  fs.writeFileSync(path.join(dir,'frames.json'),JSON.stringify({duration:(Date.now()-start)/1000,frames}));console.log(name,frames.length,(frames.length/((Date.now()-start)/1000)).toFixed(1)+'fps');
 }
 async function orbit(seconds,dx,dy=0){const box=await page.locator('canvas').boundingBox();const x=box.x+box.width*.52,y=box.y+box.height*.52;await page.mouse.move(x,y);await page.mouse.down();const start=Date.now();while(Date.now()-start<seconds*1000){const f=Math.min(1,(Date.now()-start)/(seconds*1000));await page.mouse.move(x+dx*f,y+dy*f);await hold(16)}await page.mouse.up()}
 const ids={};
 for(const sample of ['popup','kintex']){
  const response=await page.request.post(origin+'/api/projects/samples',{data:{id:sample}});if(!response.ok())throw Error(await response.text());const project=await response.json();ids[sample]=project.id;
  await page.goto(origin+'/?project='+project.id);await page.waitForSelector('[data-testid="planning-artifact"]');await hold(2000);
  await page.addStyleTag({content:'nextjs-portal { display:none !important; }'});
  await page.getByRole('button',{name:'Minimize Muse',exact:true}).dispatchEvent('click');
  await shot(sample+'-report',async()=>{await hold(3000);await page.mouse.move(W*.5,H*.62);for(let i=0;i<70;i++){await page.mouse.wheel(0,12);await hold(30)}await hold(2500)});
  await shot(sample+'-areas',async()=>{await page.getByRole('button',{name:'Participation guide',exact:true}).dispatchEvent('click');await hold(3000);await page.mouse.move(W*.5,H*.62);for(let i=0;i<160;i++){await page.mouse.wheel(0,9);await hold(30)}await hold(2500)});
  await page.getByRole('button',{name:'Project overview',exact:true}).dispatchEvent('click');
  await shot(sample+'-export',async()=>{await hold(1200);const opened=context.waitForEvent('page');await page.getByRole('button',{name:'Open planning PDF',exact:true}).dispatchEvent('click');const pdfPage=await opened;await pdfPage.waitForLoadState('domcontentloaded');await pdfPage.waitForTimeout(1500);await pdfPage.pdf({path:path.join(out,sample+'-planning.pdf'),printBackground:true,preferCSSPageSize:true});fs.writeFileSync(path.join(out,sample+'-report.html'),await pdfPage.content());await pdfPage.screenshot({path:path.join(out,sample+'-pdf.png'),fullPage:false});await pdfPage.close();await hold(2000)});
  await page.getByRole('button',{name:'Back to space',exact:true}).dispatchEvent('click');await page.waitForSelector('canvas');await hold(2500);
  console.log(sample+' CONTROLS',await page.getByRole('button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')||e.innerText)));
  await shot(sample+'-overview',async()=>{await hold(1500);await orbit(10,120,-12);await hold(2000)});
  await shot(sample+'-top',async()=>{await page.getByRole('button',{name:'Top',exact:true}).dispatchEvent('click');await hold(4500);await page.getByRole('button',{name:'Overview',exact:true}).dispatchEvent('click');await hold(3500)});
  await shot(sample+'-detail',async()=>{const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.53,box.y+box.height*.55);for(let i=0;i<8;i++){await page.mouse.wheel(0,-35);await hold(100)}await hold(1500);await orbit(8,-65,15);await hold(2500)});
  await page.getByRole('button',{name:'Sources',exact:true}).dispatchEvent('click');await hold(500);
  console.log(sample+' SOURCES',await page.locator('body').innerText());
  await shot(sample+'-sources',async()=>{await hold(6000)});
 }
 fs.writeFileSync(path.join(out,'projects.json'),JSON.stringify(ids,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
