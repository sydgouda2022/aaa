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

  await step(name+' native Coptic and hieroglyphic keyboards',async()=>{
   const k=await ctx.newPage();
   k.on('dialog',d=>d.accept());
   await k.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await k.locator('.month-agenda').waitFor();
   await k.locator('[data-open-panel="settings"]').click();
   await k.locator('select[name="language"]').selectOption('cop');
   await k.locator('[data-close-panel]').click();
   await k.locator('header [data-new]').click();
   await k.locator('input[name="title"]').focus();
   await k.locator('.renpet-keyboard:not([hidden])').waitFor({timeout:5000});
   const ckeys=await k.locator('.kb-coptic .kb-sign').count();
   const numeric=await k.locator('.kb-numbers .kb-num').count();
   if(ckeys!==32||numeric!==12)throw Error('Incorrect single-page Coptic keyboard key counts: '+ckeys+'/'+numeric);
   await screenshot(k,name+'-coptic-keyboard');
   await k.locator('.kb-coptic [data-kb-insert="ⲡ"]').click();
   const suggestions=await k.locator('.kb-suggestions [data-kb-pick]').count();
   if(suggestions<3)throw Error('Coptic dictionary predictions absent for ⲡ: '+suggestions);
   const labels=await k.locator('.kb-suggestions small').allInnerTexts();
   if(!labels.some(x=>x.includes('S'))||!labels.some(x=>x.includes('B')))throw Error('Both dialects are not offered: '+labels.join('|'));
   await screenshot(k,name+'-coptic-predictions');
   await k.locator('[data-kb-pick="1"]').click();
   const predictionInserted=await k.locator('input[name="title"]').inputValue();
   if(!predictionInserted.trim().startsWith('ⲡ'))throw Error('Coptic prediction not inserted: '+predictionInserted);
   await k.locator('[data-kb-done]').click();
   await k.locator('#event-editor [data-close]').click();
   await k.locator('[data-open-panel="settings"]').click();
   await k.locator('select[name="language"]').selectOption('egy');
   await k.locator('[data-close-panel]').click();
   await k.locator('header [data-new]').click();
   await k.locator('input[name="title"]').focus();
   await k.locator('.renpet-keyboard:not([hidden])').waitFor({timeout:5000});
   if((await k.locator('[role=tab][data-kb-tab]').count())!==3)throw Error('Missing MDWNFR-style 3 pages');
   if((await k.locator('.kb-numbers .kb-num').count())!==15)throw Error('Egyptian numbers not available');
   await k.locator('[data-kb-tab="bi"]').click();
   const biliterals=await k.locator('.kb-hiero .kb-sign').count();
   await k.locator('[data-kb-tab="tri"]').click();
   const triliterals=await k.locator('.kb-hiero .kb-sign').count();
   await k.locator('[data-kb-tab="uni"]').click();
   const uniliterals=await k.locator('.kb-hiero .kb-sign').count();
   if(biliterals<70||triliterals<45||uniliterals<20)throw Error('Too few Unicode signs: '+[uniliterals,biliterals,triliterals]);
   const first=k.locator('.kb-hiero .kb-sign').first();
   const sign=await first.getAttribute('data-kb-insert');
   await first.click();
   const actual=await k.locator('input[name="title"]').inputValue();
   if(actual!==sign)throw Error('Unicode sign input did not preserve the chosen hieroglyph');
   if(!(await k.locator('.kb-suggestions [data-kb-pick="0"]').count()))throw Error('Raw input not first hieroglyphic suggestion');
   await screenshot(k,name+'-hieroglyphic-keyboard');
   await k.close();
   return {copticKeys:ckeys,copticPredictions:suggestions,bothDialectLabels:labels,uniliterals,biliterals,triliterals,numerals:numeric};
  });


  await step(name+' localized Arabic, Coptic and hieroglyphic event time controls',async()=>{
   const q=await ctx.newPage();
   q.on('dialog',d=>d.accept());
   await q.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await q.locator('.month-agenda').waitFor();
   // Other tests in this browser context may have selected Coptic/Egyptian.
   await q.locator('[data-open-panel=settings]').click();
   await q.locator('select[name=language]').selectOption('ar');
   await q.locator('[data-close-panel]').click();
   await q.locator('header [data-new]').click();
   const form=q.locator('#event-editor');
   await form.waitFor();
   if(await form.locator('input[type=time]').count())throw Error('iOS native English time inputs still exist');
   if(!((await form.locator('[data-time-open=start]').innerText()).includes('٠٩:٠٠')))throw Error('Arabic start is not Arabic-Indic');
   await screenshot(q,name+'-arabic-event-time');
   await form.locator('[data-time-open=start]').click();
   await q.locator('.time-picker-host:not([hidden])').waitFor();
   await q.locator('[data-time-hour="14"]').click();
   await q.locator('[data-time-minute="37"]').click();
   await screenshot(q,name+'-arabic-time-picker');
   await q.locator('[data-time-confirm]').click();
   if((await form.locator('input[name=start]').inputValue())!=='14:37')throw Error('Localized picker did not write hidden canonical time');
   if(!((await form.locator('[data-time-open=start]').innerText()).includes('١٤:٣٧')))throw Error('Arabic clock display did not update');
   await form.locator('[data-time-open=end]').click();
   await q.locator('[data-time-hour="15"]').click();
   await q.locator('[data-time-minute="8"]').click();
   await q.locator('[data-time-confirm]').click();
   await form.locator('input[name=title]').fill('RENPET LOCAL TIME QA');
   await form.locator('[type=submit]').click();
   await q.locator('.event-row:has-text("RENPET LOCAL TIME QA")').waitFor();
   await q.locator('.event-row:has-text("RENPET LOCAL TIME QA")').click();
   if((await q.locator('#event-editor input[name=start]').inputValue())!=='14:37')throw Error('Saved start time not roundtripped');
   if((await q.locator('#event-editor input[name=end]').inputValue())!=='15:08')throw Error('Saved end time not roundtripped');
   await q.locator('#event-editor [data-delete]').click();
   for(const lang of ['cop','egy']){
    await q.locator('[data-open-panel=settings]').click();
    await q.locator('select[name=language]').selectOption(lang);
    await q.locator('[data-close-panel]').click();
    await q.locator('header [data-new]').click();
    const start=q.locator('#event-editor [data-time-open=start]');
    const end=q.locator('#event-editor [data-time-open=end]');
    if(await q.locator('#event-editor input[type=time]').count())throw Error(lang+' retains native HTML time');
    if(lang==='cop'){
     const a=await start.innerText(),b=await end.innerText();
     if(/[0-9]/.test(a+b)||a.includes('AM')||b.includes('AM'))throw Error('Coptic time still shows English: '+a+' / '+b);
     if(!a.includes('○'))throw Error('Coptic zero not localized');
    }else{
     if((await q.locator('.local-time-fields .clock-glyph').count())<2)throw Error('Egyptian time signs absent');
    }
    await screenshot(q,name+'-'+lang+'-event-time');
    await start.click();
    await q.locator('.time-picker-host:not([hidden])').waitFor();
    await q.locator('[data-time-hour="10"]').click();
    await q.locator('[data-time-minute="59"]').click();
    if(lang==='egy'){
     const glyph=q.locator('.time-picker-preview img[src$="/59.svg"]');
     await glyph.waitFor();
     const valid=await glyph.evaluate(img=>img.complete&&img.naturalWidth>0);
     if(!valid)throw Error('Hieroglyphic minute 59 glyph failed');
    }
    await screenshot(q,name+'-'+lang+'-time-selector');
    await q.locator('[data-time-confirm]').click();
    if((await q.locator('#event-editor input[name=start]').inputValue())!=='10:59')throw Error(lang+' hidden time changed incorrectly');
    await q.locator('#event-editor [data-close]').click();
   }
   await q.close();
   return {languageSystems:['ar','cop','egy'],start:'14:37',end:'15:08',savedAndRestored:true};
  });


  await step(name+' event year uses selected language, not English number input',async()=>{
   const q=await ctx.newPage();
   q.on('dialog',d=>d.accept());
   await q.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await q.locator('.month-agenda').waitFor();
   const results={};
   for(const language of ['ar','cop','egy']){
    await q.locator('[data-open-panel=settings]').click();
    await q.locator('select[name=language]').selectOption(language);
    await q.locator('[data-close-panel]').click();
    await q.locator('header [data-new]').click();
    const field=q.locator('#event-editor select[name=egyYear]');
    await field.waitFor();
    if(await q.locator('input[name=egyYear][type=number]').count())throw Error('Untranslated numeric year input survives in '+language);
    const year=Number(await field.inputValue());
    const display=await field.locator('option:checked').innerText();
    if(language==='ar'&&!/[٠-٩]/.test(display))throw Error('Arabic year uses Latin digits: '+display);
    if(language==='cop'&&(!/[\u2c80-\u2cff\u03e2-\u03ef]/u.test(display)||/[0-9]/.test(display)))throw Error('Coptic year uses Latin digits: '+display);
    if(language==='egy'&&(!/[\u{13000}-\u{1342f}]/u.test(display)||/[0-9]/.test(display)))throw Error('Egyptian year uses Latin digits: '+display);
    await screenshot(q,name+'-'+language+'-localized-year');
    await field.selectOption(String(year+1));
    if(Number(await field.inputValue())!==year+1)throw Error('Year selection failed in '+language);
    const preview=await q.locator('#event-editor .date-preview').innerText();
    if(!preview.trim())throw Error('Date preview missing after year selection');
    if((await q.locator('#event-editor select[name=egyYear] option:checked').innerText())===display)throw Error('Year display did not change in '+language);
    results[language]={original:display,selected:year+1};
    await q.locator('#event-editor [data-close]').click();
   }
   await q.close();
   return results;
  });


  await step(name+' shared red rubric and readable hieroglyphic controls',async()=>{
   const q=await ctx.newPage();
   q.on('dialog',d=>d.accept());
   await q.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await q.locator('.month-agenda').waitFor();
   await q.evaluate(()=>document.fonts.ready);
   const palette={},rubric='rgb(150, 55, 46)',screens=[];
   for(const language of ['ar','cop','egy']){
    await q.locator('[data-open-panel=settings]').click();
    await q.locator('select[name=language]').selectOption(language);
    if(language==='egy'||language==='cop')await q.locator('select[name=week]').selectOption('10');
    await q.locator('[data-close-panel]').click();
    const month=q.locator('.month-section');
    await month.waitFor();
    await screenshot(q,name+'-'+language+'-red-labels-month');
    const monthLabel=q.locator('.decade-label').first();
    if(language!=='ar'&&await monthLabel.count()){
      const labelColor=await monthLabel.evaluate(el=>getComputedStyle(el).color);
      if(labelColor!==rubric)throw Error(language+' decade label not rubric red: '+labelColor);
    }
    await q.locator('header [data-new]').click();
    await q.locator('#event-editor').waitFor();
    const done=q.locator('.renpet-keyboard:not([hidden]) [data-kb-done]');
    if(await done.count())await done.click();
    await q.locator('#event-editor select[name=egyYear]').scrollIntoViewIfNeeded();
    const info=await q.evaluate(()=>{
     const form=document.querySelector('#event-editor');
     const el=form.querySelector('select[name=egyYear]');
     const date=form.querySelector('.date-fields');
     const label=form.querySelector('.sheet-body>label');
     const time=form.querySelector('.local-time-label');
     const css=selector=>{const x=document.querySelector(selector);if(!x)return null;const c=getComputedStyle(x);return {font:c.fontSize,color:c.color,height:Math.round(x.getBoundingClientRect().height)};};
     const st=getComputedStyle(el);
     const canvas=document.createElement('canvas'),ct=canvas.getContext('2d');
     ct.font=st.font;
     return {
      label:css('#event-editor .sheet-body>label'),
      timeLabel:css('#event-editor .local-time-label'),
      year:css('#event-editor select[name=egyYear]'),
      yearWidth:Math.round(el.getBoundingClientRect().width),
      dateWidth:Math.round(date.getBoundingClientRect().width),
      yearText:el.selectedOptions[0].textContent,
      yearTextWidth:Math.round(ct.measureText(el.selectedOptions[0].textContent).width),
      dateGridColumns:getComputedStyle(date).gridTemplateColumns,
      selectedTime:css('.local-time-value'),
      formWidth:Math.round(form.getBoundingClientRect().width),
      viewportWidth:innerWidth
     };
    });
    if(info.label.color!==rubric||info.timeLabel.color!==rubric)throw Error(language+' labels lack shared red ink: '+JSON.stringify(info));
    if(info.formWidth>info.viewportWidth+2)throw Error(language+' form overflows viewport');
    if(language==='egy'){
      if(parseFloat(info.label.font)<22||parseFloat(info.timeLabel.font)<22)throw Error('Egyptian form labels still microscopic: '+JSON.stringify(info));
      if(parseFloat(info.year.font)<18||info.year.height<58)throw Error('Egyptian long year still shrunk: '+JSON.stringify(info));
      if(info.yearWidth<info.dateWidth*.90)throw Error('Egyptian year not allocated full line: '+JSON.stringify(info));
    }
    await screenshot(q,name+'-'+language+'-red-labels-editor');
    palette[language]=info;
    await q.locator('#event-editor [data-close]').click();
    if(language==='egy'){
     const grid=await q.locator('.month-section').evaluate(el=>({scroll:el.scrollHeight,client:el.clientHeight,top:el.getBoundingClientRect().top}));
     const agenda=await q.locator('.month-agenda').evaluate(el=>({top:el.getBoundingClientRect().top,visible:el.getBoundingClientRect().top<innerHeight-80}));
     if(!agenda.visible||agenda.top>670)throw Error('Selected-day agenda still below fold: '+JSON.stringify({grid,agenda}));
     const num=q.locator('.decade-days .date .day-number').first();
     const infoNum=await num.evaluate(el=>({size:getComputedStyle(el).fontSize,lines:getComputedStyle(el).lineHeight,images:el.querySelectorAll('img').length}));
     if(parseFloat(infoNum.size)<26||infoNum.images)throw Error('Egyptian day numerals remain too small or scaled SVG: '+JSON.stringify(infoNum));
     await q.locator('[data-open-year]').click();
     const card=q.locator('.year-month-name').first();
     if(parseFloat(await card.evaluate(el=>getComputedStyle(el).fontSize))<28)throw Error('Egyptian year month title still tiny');
     await screenshot(q,name+'-hieroglyphic-readable-year');
     await q.locator('[data-primary-view=month]').click();
     await q.locator('header [data-new]').click();
     await q.locator('input[name=title]').focus();
     await q.locator('.renpet-keyboard:not([hidden])').waitFor();
     const glyphs=await q.evaluate(()=>{
      const key=document.querySelector('.kb-hiero .kb-sign'),grid=document.querySelector('.kb-hiero'),name=document.querySelector('.kb-name');
      return {signFont:getComputedStyle(key).fontSize,nameColor:getComputedStyle(name).color,
       columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
       keyWidth:Math.round(key.getBoundingClientRect().width)};
     });
     if(parseFloat(glyphs.signFont)<35||glyphs.nameColor!==rubric||glyphs.columns!==6)throw Error('Hieroglyphic keyboard unreadable: '+JSON.stringify(glyphs));
     await screenshot(q,name+'-hieroglyphic-rubric-keyboard');
     await q.locator('[data-kb-done]').click();
     await q.locator('#event-editor [data-close]').click();
     palette.keyboard=glyphs;
    }
   }
   await q.close();
   return {sharedPalette:rubric,palette};
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
