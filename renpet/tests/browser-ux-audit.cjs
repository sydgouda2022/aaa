/* Renpet human-style browser QA. Isolated browser context, no user cookies/data. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const out=path.resolve(process.cwd(),'renpet-ux-audit');
fs.mkdirSync(out,{recursive:true});
const report={version:'Renpet 2.1',source:'isolated mobile Chromium browser',started:new Date().toISOString(),steps:[],findings:[],consoleErrors:[],screenshots:[],controls:[],checks:{}};
let counter=0;
const note=(kind,detail,extra={})=>{report.findings.push({kind,detail,...extra}); console.log('FINDING',kind,detail)};
async function step(label,fn){
 try{
  const result=await fn();
  report.steps.push({label,status:'OK',result});
  console.log('STEP PASS',label,typeof result==='string'?result.slice(0,200):'');
 }catch(e){
  const error=String(e?.message||e).slice(0,380);
  report.steps.push({label,status:'FAIL',error});
  note('broken',label+' — '+error);
  console.log('STEP FAIL',label,error);
 }
}
const pause=async page=>{await page.waitForTimeout(150)};
async function screenshot(page,name){
 const file=path.join(out,String(++counter).padStart(2,'0')+'-'+name+'.png');
 await page.screenshot({path:file,fullPage:true});
 report.screenshots.push(path.basename(file));
}
async function measure(page,label){
 const info=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
  const visible=e=>{const r=e.getBoundingClientRect();const st=getComputedStyle(e);return r.width>0&&r.height>0&&st.visibility!=='hidden'&&st.display!=='none'};
  const controls=[...document.querySelectorAll('button,select,input')].filter(visible).map(e=>({label:(e.getAttribute('aria-label')||e.innerText||e.name||e.title||'').trim().slice(0,70),tag:e.tagName,action:[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join(';'),...rect(e)}));
  const tiny=controls.filter(x=>x.w<36||x.h<36).slice(0,20);
  const body=document.body;
  return {viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},shell:document.querySelector('.app-shell')?rect(document.querySelector('.app-shell')):null,controls:controls.length,tiny,tinyCount:controls.filter(x=>x.w<36||x.h<36).length,nav:[...document.querySelectorAll('.ux-bottom button')].map(e=>(e.textContent||'').trim()),calendarCells:document.querySelectorAll('[data-date]').length,sections:document.querySelectorAll('.month-section,.year-overview,.day-page,.list-page').length,rootText:body.innerText.slice(0,1000)};
 });
 report.controls.push({screen:label,...info});
 if(info.document.width>info.viewport.width+3)note('layout',label+' has horizontal overflow '+info.document.width+'px vs '+info.viewport.width+'px');
 if(info.tinyCount)note('touch-target',label+' has '+info.tinyCount+' clickable controls below 36px in one dimension', {examples:info.tiny.slice(0,6)});
 console.log('MEASURE',label,JSON.stringify({nav:info.nav,cells:info.calendarCells,tiny:info.tinyCount,sections:info.sections,docW:info.document.width,viewport:info.viewport.width}));
 return info;
}
async function safeClick(page,selector){
 const x=page.locator(selector).first();
 await x.waitFor({state:'visible',timeout:6000});
 await x.click({timeout:6000});
 await pause(page);
}
async function switchLocale(page,locale){
 await page.locator('header select[name=language]').selectOption(locale);
 await pause(page);
}
async function auditBrowser(base){
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 for(const cfg of [{name:'iphone',width:390,height:844},{name:'small-iphone',width:375,height:667}]){
  const context=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-GB',serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',error=>{report.consoleErrors.push(String(error.message).slice(0,500)); console.log('PAGEERROR',error.message)});
  page.on('dialog',async dialog=>{await dialog.accept()});
  await step(cfg.name+' app opens',async()=>{
   const resp=await page.goto(base,{waitUntil:'domcontentloaded',timeout:25000});
   await page.locator('.month-agenda').waitFor({timeout:12000});
   if(resp.status()>=400)throw Error('HTTP '+resp.status());
   await screenshot(page,cfg.name+'-month');
   return (await page.title())+' '+resp.status();
  });
  await step(cfg.name+' initial navigation and controls',()=>measure(page,cfg.name+'-month'));
  if(cfg.name==='iphone'){
   await step('Year navigation',async()=>{await safeClick(page,'[data-primary-view=year]');await page.locator('.year-overview').waitFor();const n=await page.locator('.year-month').count();await screenshot(page,'year');if(n!==12)note('structure','Year grid has '+n+' tiles instead of 12');return 'months='+n;});
   await step('Year month tap',async()=>{await safeClick(page,'[data-open-month="1"]');await page.locator('.month-agenda').waitFor();await screenshot(page,'selected-month');return await page.locator('.ux-heading h1').innerText();});
   await step('Month date tap',async()=>{const ds=page.locator('[data-date]');await ds.nth(Math.min(4,await ds.count()-1)).click();await pause(page);await screenshot(page,'selected-day');return 'month agenda '+await page.locator('.month-agenda').count();});
   await step('Day opens on second date tap',async()=>{await safeClick(page,'[data-date][aria-pressed=true]');await page.locator('.day-page').waitFor();await screenshot(page,'day');return 'timeline hours='+await page.locator('.timeline-hour').count();});
   await step('Schedule',async()=>{await safeClick(page,'[data-primary-view=list]');await page.locator('.list-page').waitFor();await screenshot(page,'schedule-empty');return (await page.locator('.list-page').innerText()).slice(0,160);});
   await step('Today returns to current day',async()=>{await safeClick(page,'[data-primary-view=today]');await page.locator('.day-page').waitFor();return await page.locator('.day-heading').innerText();});
   await step('Search empty behavior',async()=>{await safeClick(page,'[data-search]');const el=page.locator('input[name=query]');await el.fill('this-will-not-exist');await pause(page);await screenshot(page,'search-no-results');return await page.locator('.search-results').innerText();});
   await step('Search closes',async()=>{await safeClick(page,'[data-search]');return 'input remaining='+await page.locator('input[name=query]').count();});
   await step('New appointment and event editor',async()=>{
    await safeClick(page,'[data-primary-view=month]');
    await safeClick(page,'[data-new]');
    await page.locator('#event-editor').waitFor();
    await screenshot(page,'event-editor');
    const labels=await page.locator('#event-editor label').allInnerTexts();
    await page.locator('#event-editor input[name=title]').fill('UX AUDIT TEST EVENT');
    await page.locator('#event-editor button[type=submit]').click();
    await pause(page);
    const present=await page.getByText('UX AUDIT TEST EVENT',{exact:true}).count();
    if(!present)throw Error('Test appointment not visible after save');
    await screenshot(page,'saved-appointment');
    return 'saved=true; fields='+labels.map(x=>x.slice(0,25)).join('|');
   });
   await step('Edit and delete test appointment',async()=>{
    await safeClick(page,'.event-row:has-text("UX AUDIT TEST EVENT")');
    await page.locator('#event-editor').waitFor();
    await safeClick(page,'#event-editor [data-delete]');
    const c=await page.getByText('UX AUDIT TEST EVENT',{exact:true}).count();
    if(c>0)throw Error('Deleted appointment still visible');
    return 'deleted successfully';
   });
   await step('Coptic language and decade',async()=>{await switchLocale(page,'cop');await safeClick(page,'[data-primary-view=month]');await screenshot(page,'coptic-decade');const n=await page.locator('.renpet-decade').count();return 'decades='+n+' first label '+(await page.locator('.decade-label').first().innerText());});
   await step('Hieroglyphic language and decade',async()=>{await switchLocale(page,'egy');await screenshot(page,'hieroglyphic-decade');return 'date glyphs='+await page.locator('.date .glyph').count();});
   await step('Secondary menu inventory',async()=>{await safeClick(page,'[data-more]');await screenshot(page,'secondary-menu');return await page.locator('.more-sheet button').allInnerTexts();});
   await step('Settings panel usability',async()=>{await safeClick(page,'[data-open-panel=settings]');await screenshot(page,'settings');const items=await page.locator('.settings-group label').allInnerTexts();return items;});
   await step('Gregorian overlay toggle',async()=>{
    const check=page.locator('input[name=gregorian]');
    if(await check.isChecked())await check.uncheck();else await check.check();
    await safeClick(page,'[data-close-panel]');await safeClick(page,'[data-primary-view=month]');
    const hidden=await page.locator('.greg-day').count()===0;
    await safeClick(page,'[data-more]');await safeClick(page,'[data-open-panel=settings]');
    await page.locator('input[name=gregorian]').check();
    await safeClick(page,'[data-close-panel]');
    return 'hide worked='+hidden;
   });
   await step('Week length change 7 versus 10',async()=>{
    await safeClick(page,'[data-more]');await safeClick(page,'[data-open-panel=settings]');
    await page.locator('select[name=week]').selectOption('7');
    await safeClick(page,'[data-close-panel]');await screenshot(page,'hieroglyphic-seven-day');
    const cols=await page.locator('.seven-day').count();
    await safeClick(page,'[data-more]');await safeClick(page,'[data-open-panel=settings]');
    await page.locator('select[name=week]').selectOption('10');
    await safeClick(page,'[data-close-panel]');
    return 'seven-day changed='+cols;
   });
   await step('Festivals panel',async()=>{await safeClick(page,'[data-more]');await safeClick(page,'[data-open-panel=festivals]');await screenshot(page,'festivals');const s=(await page.locator('.ux-panel').innerText()).slice(0,400);await safeClick(page,'[data-close-panel]');return s;});
   await step('Calendars management',async()=>{await safeClick(page,'[data-more]');await safeClick(page,'[data-open-panel=calendars]');await screenshot(page,'calendar-manager');const labels=await page.locator('.cal-row').allInnerTexts();await safeClick(page,'[data-close-panel]');return labels;});
   await step('Backup and ICS panel',async()=>{await safeClick(page,'[data-more]');await safeClick(page,'[data-backup]');await pause(page);await screenshot(page,'backup');const dialogText=(await page.locator('body').innerText()).slice(-1000);const buttons=await page.locator('button').allInnerTexts();return {dialogText,backupButtons:buttons.filter(s=>/ICS|تصدير|نسخ|استعادة|Ⲁ/.test(s)).slice(-10)};});
   await step('Return to Arabic and verify nav',async()=>{await switchLocale(page,'ar');await page.reload({waitUntil:'domcontentloaded'});await page.locator('.app-shell').waitFor();await screenshot(page,'arabic-return');return await measure(page,'arabic-return');});
  }else{
   await step('Small viewport month geometry',async()=>measure(page,'small-iphone-month'));
   await step('Small viewport 10-day Coptic',async()=>{await switchLocale(page,'cop');await screenshot(page,'small-coptic');return await measure(page,'small-coptic-month');});
   await step('Small viewport editor',async()=>{await safeClick(page,'[data-new]');await screenshot(page,'small-editor');return await measure(page,'small-editor');});
  }
  await context.close();
 }
 await browser.close();
}
(async()=>{
 const base=process.env.RENPET_AUDIT_URL||'http://127.0.0.1:8765/';
 try{await auditBrowser(base);}catch(e){note('fatal','Browser infrastructure: '+String(e.message||e))}
 const failed=report.steps.filter(x=>x.status==='FAIL').length;
 report.finished=new Date().toISOString();
 report.summary={totalSteps:report.steps.length,passed:report.steps.length-failed,failed,findings:report.findings.length,consoleErrors:report.consoleErrors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'summary.txt'),[JSON.stringify(report.summary,null,2),...report.steps.map(x=>x.status+' '+x.label+(x.error?' '+x.error:'')),...report.findings.map(x=>'FINDING '+x.kind+' '+x.detail)].join('\n'));
 console.log('RENpet_AUDIT_SUMMARY',JSON.stringify(report.summary));
 console.log('RENpet_AUDIT_FINDINGS',JSON.stringify(report.findings));
 console.log('RENpet_AUDIT_ERRORS',JSON.stringify(report.consoleErrors));
 if(report.steps.length<10)process.exitCode=1;
})();
