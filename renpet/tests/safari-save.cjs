const {webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const dir='renpet-mobile-evidence';fs.mkdirSync(dir,{recursive:true});
const trace=[],issues=[];
async function run(){
 const browser=await webkit.launch({headless:true});
 try {
 for(const [width,height] of [[375,667],[390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-US',timezoneId:'Africa/Cairo',serviceWorkers:'block'});
  const page=await ctx.newPage();page.setDefaultTimeout(6500);
  const report=(type,detail)=>trace.push({width,type,detail:String(detail).slice(0,600)});
  page.on('pageerror',e=>report('error',e.stack||e));
  page.on('console',m=>{if(m.type()==='error')report('console',m.text())});
  page.on('dialog',d=>d.accept());
  const snap=async(id)=>{await page.screenshot({path:path.join(dir,'safari-'+width+'-'+id+'.png'),fullPage:true});};
  for(const lang of ['ar','cop','egy']){
   const title={ar:'تجربة حفظ عربية',cop:'ⲣⲉⲛⲡⲉⲧ ⲁ',egy:'𓆓𓏏𓇳'}[lang]+' '+width;
   try{
    await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
    await page.locator('.month-section').waitFor();
    await page.locator('[data-open-panel=settings]').click();
    await page.locator('select[name=language]').selectOption(lang);
    await page.locator('.ux-panel-backdrop').click({position:{x:9,y:9}});
    await page.locator('header [data-new]').click();
    const form=page.locator('#event-editor'),input=form.locator('[name=title]');
    await input.fill(title);
    if(lang!=='ar'){
     await input.focus();
     await page.locator('.renpet-keyboard:not([hidden])').waitFor();
     await snap(lang+'-keyboard');
    }
    const pre=await form.evaluate(f=>({checkValidity:f.checkValidity(),title:f.elements.title.value,date:f.elements.egyYear.value+'-'+f.elements.egyMonth.value+'-'+f.elements.egyDay.value,
      start:f.elements.start.value,end:f.elements.end.value,kb:getComputedStyle(document.getElementById('renpet-keyboard')).display,
      save:(()=>{const b=f.querySelector('.save-button').getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()}));
    report(lang+'-before',JSON.stringify(pre));
    const save=form.locator('.save-button');
    const rect=await save.boundingBox();
    await page.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.waitForTimeout(200);
    const after=await page.evaluate((title)=>({editor:!!document.querySelector('#event-editor'),
      err:document.querySelector('.event-error')?.textContent,view:document.querySelector('.day-page')?.className,
      scheduler:JSON.parse(localStorage.getItem('renpet.scheduler.v1')||'null')?.items?.filter(x=>x.title===title),
      btn:document.querySelector('.save-button')?.outerHTML}),title);
    report(lang+'-after',JSON.stringify(after));
    await snap(lang+'-postsave');
    if(after.editor||!after.scheduler?.length)throw Error('Save did not persist and dismiss in '+lang+': '+JSON.stringify(after));
    await page.reload();
    const persists=await page.evaluate(title=>JSON.parse(localStorage.getItem('renpet.scheduler.v1')||'null')?.items?.some(i=>i.title===title),title);
    if(!persists)throw Error('Lost saved '+lang+' appointment on WebKit reload');
   }catch(e){issues.push({width,lang,error:String(e.stack||e).slice(0,900)});await snap(lang+'-failed').catch(()=>{});}
  }
  await ctx.close();
 }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(dir,'safari-save-report.json'),JSON.stringify({trace,issues},null,2));
 console.log('SAFARI_SAVE_RESULTS',JSON.stringify({trace,issues}).slice(0,12000));
 if(issues.length)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
