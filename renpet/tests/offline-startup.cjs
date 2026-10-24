const {webkit,chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const dir='renpet-mobile-evidence';fs.mkdirSync(dir,{recursive:true});
const results=[],errors=[];
const ROOT='http://127.0.0.1:8765/';

async function scenario(engine,name) {
 const browser=await engine.launch(name==='chromium'?{channel:'chrome',headless:true,args:['--no-sandbox']}:{headless:true});
 try {
  // This scenario enables service workers (unlike other UI tests) to catch
  // the old ?v= asset cache miss which caused a lone hieroglyphic splash.
  for(const width of [375,390]){
   const ctx=await browser.newContext({
    viewport:{width,height:width===375?667:844},deviceScaleFactor:2,
    isMobile:true,hasTouch:true,serviceWorkers:'allow',timezoneId:'Africa/Cairo'
   });
   const p=await ctx.newPage();
   p.setDefaultTimeout(18000);
   try {
    await p.goto(ROOT,{waitUntil:'domcontentloaded'});
    await p.locator('.month-section').waitFor();
    await p.evaluate(()=>localStorage.setItem('renpet.startup-preserve','test-value'));
    // Wait for the entire SW installation, not just registration.
    await p.waitForFunction(()=>navigator.serviceWorker?.controller &&
      navigator.serviceWorker.controller.state==='activated',null,{timeout:100000});
    const cacheNames=await p.evaluate(()=>caches.keys());
    if(!cacheNames.some(s=>s.startsWith('renpet-6.5.0-')))throw Error('6.5 service worker did not precache all assets');
    // Linux Playwright WebKit's context.setOffline() rejects even cache-hit
    // fetches before their active SW can respond. Simulate a disconnected
    // origin with network route aborts in WebKit; Chromium uses true offline.
    if(name==='webkit')await p.route('**/*',route=>route.abort('failed'));
    else await ctx.setOffline(true);
    const asset=await p.evaluate(async()=>{
     const cacheKeys=await caches.keys();
     const fullUrl=new URL('./app.js',location.href).href;
     const cached=await caches.match(fullUrl);
     const matchWithVersion=await caches.match(fullUrl+'?v=6.4.0',{ignoreSearch:true});
     try{
      const response=await fetch('./app.js?v=6.4.0');
      return {ok:response.ok,type:response.headers.get('content-type'),text:(await response.text()).slice(0,65),
       cacheHit:!!cached,queryCacheHit:!!matchWithVersion,cacheKeys};
     }catch(error){
      return {ok:false,error:String(error),cacheHit:!!cached,queryCacheHit:!!matchWithVersion,cacheKeys};
     }
    });
    if(!asset.ok||!asset.text?.includes('import '))throw Error('Offline query-string module failed: '+JSON.stringify(asset));
    await p.reload({waitUntil:'domcontentloaded'});
    await p.locator('.month-section').waitFor({timeout:24000});
    const preserved=await p.evaluate(()=>localStorage.getItem('renpet.startup-preserve'));
    if(preserved!=='test-value')throw Error('Offline reload lost local storage');
    await p.screenshot({path:path.join(dir,'offline-'+name+'-'+width+'.png'),fullPage:true});
    results.push({engine:name,width,offline:true,queryModule:true,dataPreserved:true});
   }catch(e){
    errors.push({engine:name,width,scenario:'offline',error:String(e.stack||e).slice(0,1200)});
    await p.screenshot({path:path.join(dir,'offline-'+name+'-'+width+'-FAILED.png'),fullPage:true}).catch(()=>{});
   }finally{await ctx.close();}
  }
  // Simulate a module graph failure. The user must not be left with a blank
  // screen; retry must restore the calendar without deleting local records.
  const ctx=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const p=await ctx.newPage();
  try {
   await p.goto(ROOT);await p.locator('.month-section').waitFor();
   await p.evaluate(()=>localStorage.setItem('renpet.startup-preserve','not-deleted'));
   await p.route('**/app.js?v=6.5.0',route=>route.abort('failed'));
   await p.reload({waitUntil:'domcontentloaded'});
   await p.locator('.renpet-startup-failed').waitFor({timeout:14000});
   const text=await p.locator('.renpet-startup-failed').innerText();
   if(!text.includes('Retry'))throw Error('No retry button for failed modules');
   await p.screenshot({path:path.join(dir,'recovery-'+name+'.png'),fullPage:true});
   await p.unroute('**/app.js?v=6.5.0');
   await p.locator('[data-retry]').click();
   await p.locator('.month-section').waitFor();
   if(await p.evaluate(()=>localStorage.getItem('renpet.startup-preserve'))!=='not-deleted')throw Error('Retry deleted local data');
   results.push({engine:name,recovery:true,retry:true,dataPreserved:true});
  }catch(e){errors.push({engine:name,scenario:'failed-module',error:String(e.stack||e).slice(0,1300)});}
  finally{await ctx.close();}
 }finally{await browser.close();}
}
async function main(){
 await scenario(webkit,'webkit');
 await scenario(chromium,'chromium');
 fs.writeFileSync(path.join(dir,'boot-offline-report.json'),JSON.stringify({results,errors},null,2));
 console.log('RENPET_OFFLINE_BOOT',JSON.stringify({results,errors}).slice(0,14000));
 if(errors.length||results.length!==6)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
