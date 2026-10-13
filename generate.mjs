// Zero-dependency calendar generator; Node.js 20+
// Reference epoch: 11 Sep 2026 = 1 Thout 6282. No festivals.
import fs from 'node:fs';
import path from 'node:path';
const MONTHS={"ar":["توت","بابه","هاتور","كيهك","طوبة","أمشير","برمهات","برمودة","بشنس","بؤونة","أبيب","مسرى"],"en":["Thout","Paopi","Hathor","Koiak","Tobi","Meshir","Paremhat","Parmoute","Pashons","Paoni","Epip","Mesori"],"cop":["Ⲑⲱⲟⲩⲧ","Ⲡⲁⲱⲡⲉ","Ⲁⲑⲱⲣ","Ⲭⲟⲓⲁⲕ","Ⲧⲱⲃⲉ","Ⲙⲉϣⲓⲣ","Ⲡⲁⲣⲉⲙϩⲁⲧ","Ⲡⲁⲣⲙⲟⲩⲧⲉ","Ⲡⲁϣⲟⲛⲥ","Ⲡⲁⲱⲛⲉ","Ⲉⲡⲏⲡ","Ⲙⲉⲥⲱⲣⲏ"]};
const SEAS=["أخت","برت","شمو"],SEASEN=["Akhet","Peret","Shemu"],HI_SEAS=["𓈌","𓊪𓂋𓏏","𓈙𓅓𓅱"];
const CO_U=["","ⲁ","ⲃ","ⲅ","ⲇ","ⲉ","ⲋ","ⲍ","ⲏ","ⲑ"],CO_T=["","ⲓ","ⲕ","ⲗ","ⲙ","ⲛ","ⲝ","ⲟ","ⲡ","ϥ"],CO_H=["","ⲣ","ⲥ","ⲧ","ⲩ","ⲫ","ⲭ","ⲯ","ⲱ","ⳁ"];
function utc(s){return new Date(s+"T00:00:00.000Z");}

function addDays(d,n){return new Date(d.getTime()+n*86400000);}

function iso(d){return d.toISOString().slice(0,10).replace(/-/g,"");}

function leap(y){return (y-6282)%4===0;}

function yearStart(y){let n=0;if(y>=6282){for(let k=6282;k<y;k++)n+=365+Number(leap(k));}else{for(let k=y;k<6282;k++)n-=365+Number(leap(k));}return addDays(utc("2026-09-11"),n);}

function egypt(d){let y=6282+d.getUTCFullYear()-2026;while(yearStart(y)>d)y--;while(yearStart(y+1)<=d)y++;const diff=(d-yearStart(y))/86400000;const month=diff>=360?13:Math.floor(diff/30)+1;return {y,m:month,day:month===13?diff-359:diff%30+1,season:month===13?null:Math.floor((month-1)/4),decade:month===13?null:Math.floor((diff%30)/10)+1};}

function hi(n){let s="";for(const [a,v] of [[1000,"𓆼"],[100,"𓍢"],[10,"𓎆"],[1,"𓏺"]]){const q=Math.floor(n/a);s+=v.repeat(q);n%=a;}return s;}

function cop(n){let s="";if(n>=1000){const q=Math.floor(n/1000);s="͵"+CO_U[q]+"̅";n%=1000;}for(const [v,a] of [[100,CO_H],[10,CO_T],[1,CO_U]]){const q=Math.floor(n/v);if(q)s+=a[q]+"̅";n%=v;}return s;}

function ar(n){return String(n).replace(/[0-9]/g,c=>"٠١٢٣٤٥٦٧٨٩"[Number(c)]);}

function label(e,l){const {y,m,day,season}=e;if(m===13){if(l==="ar")return `${ar(day)} نسيء ${ar(y)}`;if(l==="en")return `Epagomenal ${day} · ${y}`;if(l==="cop")return `${cop(day)} Ⲡⲓⲕⲟⲩϫⲓ ⲛ̀ⲁ̀ⲃⲟⲧ ${cop(y)}`;return `${hi(day)} 𓈖𓊪𓏏 · ${hi(y)}`;}if(l==="ar")return `${ar(day)} ${MONTHS.ar[m-1]} ${ar(y)}`;if(l==="en")return `${day} ${MONTHS.en[m-1]} ${y}`;if(l==="cop")return `${cop(day)} ${MONTHS.cop[m-1]} ${cop(y)}`;return `${hi(day)} 𓇹${hi((m-1)%4+1)} ${HI_SEAS[season]} · ${hi(y)}`;}

function desc(e,l){const {y,m,day,season,decade}=e;if(m===13){if(l==="ar")return `أيام النسيء، اليوم ${ar(day)} من ${leap(y)?6:5}. خارج الشهور والفصول والعشريات.`;if(l==="en")return `Epagomenal day ${day} of ${leap(y)?6:5}. Outside months, seasons and decades.`;if(l==="cop")return `Ⲡⲓⲕⲟⲩϫⲓ ⲛ̀ⲁ̀ⲃⲟⲧ ${cop(day)} / ${cop(leap(y)?6:5)}.`;return `${hi(day)} · ${hi(y)}. Epagomenal day, outside months and seasons.`;}if(l==="ar")return `الفصل ${SEAS[season]}، الشهر ${ar(m)}، العشرية ${ar(decade)}. التقويم السكندري، السنة المصرية ${ar(y)}.`;if(l==="en")return `Season ${SEASEN[season]}, month ${m}/12, decade ${decade}. Alexandrian calendar, Egyptian year ${y}.`;if(l==="cop")return `${MONTHS.cop[m-1]} · ${cop(day)} · ${cop(y)}. ${SEASEN[season]}, decade ${decade}.`;return `𓇹${hi((m-1)%4+1)} ${HI_SEAS[season]} · ${hi(day)} · ${hi(y)}. Historical ordinal month of season (without royal cartouche).`;}

function esc(s){return s.replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");}

function fold(s){const out=[];let b="",count=0;for(const ch of s){const len=new TextEncoder().encode(ch).length;if(count+len>75){out.push(b);b=" ";count=1;}b+=ch;count+=len;}out.push(b);return out.join("\r\n");}

function feed(l,mode){const current=new Date().getUTCFullYear();const start=utc(Math.max(2026,current-1)+"-01-01"),end=utc(Math.max(2032,current+6)+"-01-01");const nm={ar:"التقويم المصري",en:"Ancient Egyptian Calendar",cop:"Ⲡⲓⲭⲣⲟⲛⲟⲥ ⲛ̀Ⲭⲏⲙⲓ",egy:"𓇳𓏺 𓆼"}[l];const lines=["BEGIN:VCALENDAR","VERSION:2.0","CALSCALE:GREGORIAN","PRODID:-//Ancient Egyptian Calendar//Alexandrian Era 6282//EN","X-WR-CALNAME:"+esc(nm+" ("+mode+")"),"METHOD:PUBLISH","REFRESH-INTERVAL;VALUE=DURATION:P1D","X-PUBLISHED-TTL:PT24H"];for(let d=start;d<end;d=addDays(d,1)){const e=egypt(d);if(mode==="compact"&&e.day!==1)continue;let s=label(e,l);if(e.m===1&&e.day===1)s=({ar:"رأس السنة المصرية — ",en:"Egyptian New Year — ",cop:"Ⲁⲣⲭⲏ ⲛ̀ⲣⲟⲙⲡⲉ — ",egy:"𓇳𓏺 — "}[l])+s;else if(mode==="compact"&&e.day===1)s=({ar:"بداية شهر — ",en:"Month begins — ",cop:"Ⲁⲣⲭⲏ ⲛ̀ⲁⲃⲟⲧ — ",egy:"𓇹 — "}[l])+s;lines.push("BEGIN:VEVENT",`UID:egypt-${mode}-${iso(d)}@egyptian-calendar`,"DTSTAMP:20261013T000000Z","DTSTART;VALUE=DATE:"+iso(d),"DTEND;VALUE=DATE:"+iso(addDays(d,1)),"SUMMARY:"+esc(s),"DESCRIPTION:"+esc(desc(e,l)),"TRANSP:TRANSPARENT","STATUS:CONFIRMED","CLASS:PUBLIC","END:VEVENT");}lines.push("END:VCALENDAR");return lines.map(fold).join("\r\n")+"\r\n";}
for(const l of ['ar','en','cop','egy'])for(const mode of ['full','compact']){
const p=path.join('calendar',l,mode+'.ics');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,feed(l,mode),'utf8');console.log(p);
}
