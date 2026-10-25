import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1024,height:768}});
try {
 await page.goto('http://127.0.0.1:8123/',{waitUntil:'domcontentloaded'});
 const diagnostics=await page.evaluate(async()=>{
  await document.fonts.load('100px "MdwNfr Hieroglyphs"');
  await document.fonts.ready;
  const source=await fetch('/core/mdwnfr/data/glyph_geometry.json').then(r=>r.json());
  if(source.format!=='mdwnfr-glyph-ink-v2')throw new Error('Not the installed silhouette font');
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  Object.assign(svg.style,{position:'fixed',left:'-50000px',top:'-50000px'});
  svg.setAttribute('width','500');svg.setAttribute('height','300');
  document.body.append(svg);
  const bad=[],samples=[],threshold=1;
  for(const [sign,[left,bottom,right,top]] of Object.entries(source.glyphs)){
   const glyph=document.createElementNS(ns,'text');
   glyph.setAttribute('x','0');glyph.setAttribute('y','150');
   glyph.setAttribute('font-family','MdwNfr Hieroglyphs');
   glyph.setAttribute('font-size','100');glyph.textContent=sign;svg.append(glyph);
   const measured=glyph.getBBox();glyph.remove();
   const target={x:left*100,y:150-top*100,width:(right-left)*100,height:(top-bottom)*100};
   const diffs={x:measured.x-target.x,y:measured.y-target.y,
    width:measured.width-target.width,height:measured.height-target.height};
   const error=Math.max(...Object.values(diffs).map(Math.abs));
   if(error>threshold)bad.push({sign,code:sign.codePointAt(0).toString(16),error,diffs,measured,target});
   if('𓅓𓇋𓈖𓏏𓏺'.includes(sign))samples.push({sign,error,diffs});
  }
  svg.remove();
  bad.sort((a,b)=>b.error-a.error);
  return {count:Object.keys(source.glyphs).length,bad:bad.length,
   maxError:bad[0]?.error??0,worst:bad.slice(0,12),samples};
 });
 console.log('Actual browser ink geometry:',JSON.stringify(diagnostics));
 assert.equal(diagnostics.count,1072);
 assert.equal(diagnostics.bad,0,'SVG visible bounds deviate from the Python font outline; vertical spacing cannot match');
} finally {
 await browser.close();
}
