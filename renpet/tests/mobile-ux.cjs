const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const out='renpet-mobile-evidence';fs.mkdirSync(out,{recursive:true});
const results=[],findings=[],errors=[];let idx=0;
const step=async(name,cb)=>{try{const value=await cb();results.push({name,ok:true,value});console.log('PASS',name,JSON.stringify(value||'').slice(0,300));}catch(e){results.push({name,ok:false,error:String(e.message).slice(0,250)});console.log('FAIL',name,e.message);}};
async function screenshot(p,label){let file=path.join(out,String(++idx).padStart(2,'0')+'-'+label+'.png');await p.screenshot({path:file,fullPage:true});}
async function inspect(p,label){
 const o=await p.evaluate(()=>{
  const rs=s=>{let r=document.querySelector(s)?.getBoundingClientRect();return r?{top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height),left:Math.round(r.left),right:Math.round(r.right)}:null};
  return {viewport:{w:innerWidth,h:innerHeight},documentWidth:document.documentElement.scrollWidth,header:rs('.ux-toolbar'),main:rs('.main-scroll'),nav:rs('.ux-bottom'),calendar:rs('.month-section'),agenda:rs('.month-agenda'),agendaHeading:rs('.agenda-heading'),year:rs('.year-overview'),buttons:[...document.querySelectorAll('header button,header select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0}).map(e=>({label:e.getAttribute('aria-label')||e.innerText,w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)})),hieroglyphFont:document.fonts.check('16px RenpetEgyptian')};
 });
 if(o.documentWidth>o.viewport.w+2)findings.push({type:'overflow',screen:label,detail:o});
 if(o.agendaHeading && o.agendaHeading.top>o.viewport.h-80)findings.push({type:'agenda-below-fold',screen:label,detail:o});
 if(o.buttons.some(x=>x.w<40||x.h<40))findings.push({type:'small-control',screen:label,controls:o.buttons.filter(x=>x.w<40||x.h<40)});
 return o;
}
async function run(){
 const b=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 for(const [name,w,h] of [['iphone-375',375,667],['iphone-390',390,844]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Africa/Cairo'});
  const p=await ctx.newPage();await p.clock.install({time:new Date('2026-10-24T06:30:15.000Z')});p.on('pageerror',e=>errors.push(String(e)));p.on('dialog',d=>d.accept());
  await step(name+' initial',async()=>{await p.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});await p.locator('.month-agenda').waitFor();await p.evaluate(()=>document.fonts.ready);await screenshot(p,name+'-month');return inspect(p,name+'-month');});
  await step(name+' Year picker',async()=>{await p.locator('[data-open-year]').click();await p.locator('.year-season').first().waitFor();await screenshot(p,name+'-year');return {seasonCount:await p.locator('.year-season').count(),monthCount:await p.locator('.year-month').count()};});
  await step(name+' month selection',async()=>{await p.locator('[data-open-month="1"]').click();await screenshot(p,name+'-month-from-year');return inspect(p,name+'-month-from-year');});
  await step(name+' day tap',async()=>{const day=p.locator('[data-date]').nth(4);await day.click();await p.locator('[data-date][aria-pressed="true"]').click();await p.locator('.timeline-hour').first().waitFor();await screenshot(p,name+'-day');return await p.locator('.timeline-hour').count();});
  await step(name+' Today goes to month',async()=>{await p.locator('[data-primary-view="today"]').click();await p.locator('.month-agenda').waitFor();return inspect(p,name+'-today');});

  await step(name+' localized Day clock and minute-accurate live red line',async()=>{
   await p.locator('[data-date][aria-pressed="true"]').click();
   await p.locator('.timeline-now').waitFor();
   const hourLabel=await p.locator('.timeline-hour>span').nth(9).innerText();
   if(!hourLabel.includes('٠٩'))throw Error('Arabic timeline hour still uses Latin digits: '+hourLabel);
   const current=await p.locator('[data-now-line]').getAttribute('aria-label');
   if(!current.includes('٠٩:٣٠'))throw Error('Live red time marker wrong: '+current);
   const first=Number.parseFloat((await p.locator('[data-now-line]').getAttribute('style')).match(/top:\s*([0-9.]+)px/)[1]);
   await screenshot(p,name+'-arabic-live-red-line');
   await p.clock.fastForward(65000);
   const next=Number.parseFloat((await p.locator('[data-now-line]').getAttribute('style')).match(/top:\s*([0-9.]+)px/)[1]);
   if(!(next>first+0.5))throw Error('Red line did not move as time advanced: '+first+' → '+next);
   // Full-hour coverage: image assets 31–59 must exist and load offline.
   await p.clock.fastForward(28*60*1000);
   const at59=await p.locator('[data-now-line]').getAttribute('aria-label');
   if(!at59.includes('٥٩'))throw Error('Red marker did not reach minute 59: '+at59);
   await p.locator('[data-open-panel=settings]').click();
   await p.locator('[name=language]').selectOption('egy');
   await p.locator('[data-close-panel]').click();
   await p.locator('.timeline-now-clock img[src$="/59.svg"]').waitFor({timeout:4000});
   const loaded=await p.locator('.timeline-now-clock img[src$="/59.svg"]').evaluate(img=>img.complete&&img.naturalWidth>0);
   if(!loaded)throw Error('Hieroglyphic minute 59 SVG is missing or failed to load');
   await screenshot(p,name+'-hieroglyphic-minute59');
   await p.locator('[data-open-panel=settings]').click();
   await p.locator('[name=language]').selectOption('ar');
   await p.locator('[data-close-panel]').click();
   await p.locator('[data-next]').click();
   if(await p.locator('[data-now-line]').count())throw Error('Red time line appears on future date');
   await p.locator('[data-prev]').click();
   if(!(await p.locator('[data-now-line]').count()))throw Error('Red line absent when returning to today');
   await p.locator('[data-open-panel=settings]').click();
   await p.locator('[name=language]').selectOption('cop');
   await p.locator('[data-close-panel]').click();
   const cop=await p.locator('.timeline-hour>span').nth(9).innerText();
   if(/[0-9]/.test(cop))throw Error('Coptic hour still has Western digits: '+cop);
   await screenshot(p,name+'-coptic-clock');
   await p.locator('[data-open-panel=settings]').click();
   await p.locator('[name=language]').selectOption('egy');
   await p.locator('[data-close-panel]').click();
   const pictograms=await p.locator('.timeline-hour .clock-glyph').count();
   if(pictograms!==23||!(await p.locator('.timeline-hour .clock-zero').count()))throw Error('Missing hieroglyphic numeral artwork or midnight zero marker: '+pictograms);
   if(!(await p.locator('[data-now-line]').count()))throw Error('Live red line absent after language change');
   await screenshot(p,name+'-hieroglyphic-clock');
   await p.locator('[data-open-panel=settings]').click();
   await p.locator('[name=language]').selectOption('ar');
   await p.locator('[data-close-panel]').click();
   await p.locator('[data-back]').click();
   return {arabicHour:hourLabel,arabicNow:current,copticHour:cop,hieroglyphics:pictograms,oldY:first,newY:next};
  });

  await step(name+' schedule empty action',async()=>{await p.locator('[data-primary-view="list"]').click();await screenshot(p,name+'-empty-schedule');return {empty:await p.locator('.schedule-empty').count(),newButton:await p.locator('.schedule-empty [data-new]').count()};});
  await step(name+' event save / advanced / delete',async()=>{
   await p.locator('.schedule-empty [data-new]').click();
   await p.locator('#event-editor').waitFor();
   const details=p.locator('details.advanced-fields');
   const closed=!(await details.getAttribute('open'));
   await screenshot(p,name+'-new-event');
   await p.locator('#event-editor [name=title]').fill('RENPET QA TEMP EVENT');
   await p.locator('#event-editor [type=submit]').click();
   await p.locator('.event-row:has-text("RENPET QA TEMP EVENT")').first().waitFor();
   await p.locator('.event-row:has-text("RENPET QA TEMP EVENT")').first().click();
   await p.locator('#event-editor [data-delete]').click();
   return {advancedInitiallyClosed:closed,deleted:(await p.locator('.event-row:has-text("RENPET QA TEMP EVENT")').count())===0};
  });
  await step(name+' settings compact and language',async()=>{
   await p.locator('[data-open-panel=settings]').first().click();
   await screenshot(p,name+'-settings');
   const first=await inspect(p,name+'-settings');
   await p.locator('[name=language]').selectOption('cop');
   await p.locator('[data-close-panel]').click();
   await p.locator('[data-primary-view=month]').click();
   await screenshot(p,name+'-coptic');
   return {panelHeight:first.viewport.h,decades:await p.locator('.renpet-decade').count()};
  });
  await step(name+' Egyptian font and dates',async()=>{
   await p.locator('[data-open-panel=settings]').first().click();
   await p.locator('[name=language]').selectOption('egy');
   await p.locator('[data-close-panel]').click();
   await p.evaluate(()=>document.fonts.ready);
   await screenshot(p,name+'-hieroglyphic');
   return {font:await p.evaluate(()=>document.fonts.check('16px RenpetEgyptian')),numerals:await p.locator('.date .glyph').count(),metric:await inspect(p,name+'-hieroglyphic')};
  });
  await step(name+' week toggle / Gregorian',async()=>{
   await p.locator('[data-open-panel=settings]').first().click();
   await p.locator('[name=week]').selectOption('7');
   await p.locator('[name=gregorian]').uncheck();
   await p.locator('[data-close-panel]').click();
   const n=await p.locator('.seven-day').count();
   const hidden=(await p.locator('.greg-day').count())===0;
   await screenshot(p,name+'-hieroglyphic-7');
   return {seven:n,gregorianHidden:hidden};
  });
  await step(name+' calendar management and backup',async()=>{
   await p.locator('[data-open-panel=settings]').first().click();
   await p.locator('[data-open-panel=calendars]').click();
   const manage=await p.locator('#new-calendar').count();
   await screenshot(p,name+'-manage');
   await p.locator('[data-close-panel]').click();
   await p.locator('[data-open-panel=settings]').first().click();
   await p.locator('[data-backup]').click();
   const backup=await p.locator('.renpet-backup-panel').count();
   await screenshot(p,name+'-backup');
   return {manage,backup};
  });
  await ctx.close();
 }
 await b.close();
}
(async()=>{try{await run()}catch(e){errors.push('FATAL '+String(e.stack||e))}
const report={results,findings,errors,summary:{total:results.length,pass:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,findings:findings.length,errors:errors.length}};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log('RENPET3_REPORT',JSON.stringify(report).slice(0,20000));
if(report.summary.failed||report.summary.errors)process.exitCode=1;})();
