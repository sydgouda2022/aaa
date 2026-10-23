import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dayNumber} from '../web/calendar.js';

const handlers={};
const root={innerHTML:'',addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn);},querySelector:()=>null};
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
globalThis.document={
 querySelector:s=>s==='#app'?root:null,
 addEventListener:()=>{},
 documentElement:{lang:'ar',dir:'rtl'},
 body:{dataset:{}}
};
globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../web/data.json',import.meta.url),'utf8'))});
await import('../web/app.js');
for(let i=0;i<50&&!root.innerHTML;i++)await new Promise(resolve=>setTimeout(resolve,20));

const has=value=>root.innerHTML.includes(value);
const buttonClick=(name,value='')=>{
 const button={disabled:false,dataset:{[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:String(value)},hasAttribute:k=>k===name};
 for(const listener of handlers.click||[])listener({target:{closest:selector=>selector==='button'?button:null,stopImmediatePropagation(){},preventDefault(){}}});
};
const change=(name,value,checked)=>{
 const el={name,value,checked,hasAttribute:()=>false,closest:()=>null};
 for(const listener of handlers.change||[])listener({target:el});
};
assert.ok(has('class="app-shell"'),'One persistent app shell');
assert.ok(has('ux-toolbar-top'),'Only new navigation toolbar remains');
assert.ok(has('class="ux-bottom"'),'One bottom bar');
assert.ok(has('month-section')&&has('month-agenda'),'Month and agenda are integrated');
assert.ok(has('data-week="7"'),'Arabic defaults to seven weekdays');
assert.ok(!has('data-menu')&&!has('ios-view-popover'),'Old view menu is gone');
assert.ok(!has('settings-group'),'Settings is not another main page');
assert.ok(!has('year-grid')&&!has('year-tile'),'Old annual grid is gone');
for(const name of ['today','year','month','list'])assert.ok(has('data-primary-view="'+name+'"'),'Primary view: '+name);
assert.equal((root.innerHTML.match(/class="ux-bottom"/g)||[]).length,1,'Exactly one primary navigation');

const selected=dayNumber('2026-10-17');
buttonClick('data-date',selected);
assert.ok(has('month-agenda')&&has('data-date="'+selected+'"'),'First tap selects and keeps month');
buttonClick('data-date',selected);
assert.ok(has('timeline-hour'),'Second tap opens the one day timeline');
buttonClick('data-back');
assert.ok(has('month-agenda'),'Day back returns to Month');
buttonClick('data-back');
assert.ok(has('year-overview'),'Month back returns to Year');
assert.equal((root.innerHTML.match(/class="year-month/g)||[]).length>=12,true,'Twelve month tiles exist');
assert.ok(has('epagomenal-tile'),'Five/six epagomenal days separate from regular months');
buttonClick('data-open-month',13);
assert.ok(has('month-agenda'),'Epagomenal month opens');
const epagCount=(root.innerHTML.match(/class="date /g)||[]).length;
assert.ok(epagCount===5||epagCount===6,'Epagomenal month contains exactly five or six days');

buttonClick('data-primary-view','month');
assert.ok(has('month-section'),'Month always reachable');
buttonClick('data-primary-view','list');
assert.ok(has('list-page'),'Schedule is an alternative rendering of the same events');
buttonClick('data-primary-view','year');
assert.ok(has('year-overview'),'Year navigation works');
buttonClick('data-primary-view','today');
assert.ok(has('timeline-hour'),'Today opens current day');

buttonClick('data-primary-view','month');
buttonClick('data-date',selected);
change('language','cop');
assert.equal(document.body.dataset.language,'cop');
assert.ok(has('data-week="10"')&&has('renpet-decade'),'Coptic uses three Egyptian decades');
assert.ok(has('data-date="'+selected+'"'),'Changing scripts preserves the selected absolute date');
change('language','egy');
assert.equal(document.body.dataset.language,'egy');
assert.ok(has('data-week="10"'),'Hieroglyphic defaults to 10-day calendar');
change('week','7');
assert.ok(has('data-week="7"'),'Week-length preference is independent from language');
change('language','ar');
assert.equal(document.body.dataset.language,'ar');
assert.ok(has('data-week="7"'),'Arabic defaults to seven columns');
change('gregorian','',false);
assert.ok(!has('class="greg-day"'),'Gregorian overlay obeys settings');
change('gregorian','',true);
assert.ok(has('class="greg-day"'),'Gregorian overlay can be restored');

buttonClick('data-more');
assert.ok(has('class="more-sheet"'),'One secondary feature menu');
for(const name of ['settings','festivals','calendars'])assert.ok(has('data-open-panel="'+name+'"'),'Menu contains '+name);
buttonClick('data-open-panel','settings');
assert.ok(has('ux-panel')&&has('preferences-page')&&has('month-section'),'Settings panel overlays, rather than replacing, the calendar');
assert.equal((root.innerHTML.match(/class="app-shell"/g)||[]).length,1,'Settings retains original application shell');
buttonClick('data-close-panel');
assert.ok(!has('preferences-page'),'Settings closes without navigating');
buttonClick('data-more');
buttonClick('data-open-panel','festivals');
assert.ok(has('festival-list')&&has('month-section'),'Festivals accessible in same app shell');
buttonClick('data-close-panel');
buttonClick('data-more');
buttonClick('data-open-panel','calendars');
assert.ok(has('id="new-calendar"')&&has('month-section'),'Calendar management opens as an auxiliary panel');
buttonClick('data-close-panel');

buttonClick('data-new');
assert.ok(has('id="event-editor"'),'Existing appointment editor is retained');
buttonClick('data-close');
assert.ok(!has('id="event-editor"'),'Editor closes');
assert.ok(!has('Renpet:'),'No runtime error on any tested navigation');
assert.ok(memory.has('renpet.view.v4'),'View state persisted');
const css=await readFile(new URL('../web/ui.css',import.meta.url),'utf8');
assert.ok(!css.includes('Renpet 1.3')&&!css.includes('.ios-view-popover'),'No obsolete design overlay in CSS');
assert.ok(css.includes('.ux-panel')&&css.includes('.decade-days'),'Styles for new unified screen and Egyptian decades exist');
console.log('Renpet 2.1 streamlining UI regression tests passed');
