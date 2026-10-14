import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dayNumber} from '../web/calendar.js';
const handlers={};
const root={innerHTML:'',addEventListener:(name,fn)=>{handlers[name]=fn;},querySelector:()=>null};
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
assert.ok(root.innerHTML.includes('month-section'),'Month view must render');
assert.ok(!root.innerHTML.includes('year-grid'),'Legacy year grid must not render');
assert.ok(root.innerHTML.includes('apple-bottom'),'Apple-style bottom bar must render');
assert.ok(!root.innerHTML.includes('Renpet:'),'App must not display runtime error');
const click=(name,value)=>{
 const button={disabled:false,dataset:{[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value},hasAttribute:k=>k===name};
 handlers.click({target:{closest:selector=>selector==='button'?button:null}});
};
assert.ok(root.innerHTML.includes('month-agenda'),'Month view must include selected-day agenda');
click('data-date',String(dayNumber('2026-10-16')));
assert.ok(root.innerHTML.includes('month-agenda'),'First date tap must select, not navigate');
click('data-date',String(dayNumber('2026-10-16')));
assert.ok(root.innerHTML.includes('hour-row'),'Second date tap opens day timeline');
click('data-back','');
assert.ok(root.innerHTML.includes('month-agenda'),'Back from day returns to month');
click('data-back','');
assert.ok(root.innerHTML.includes('year-overview'),'Back from month opens year overview');
click('data-open-month','2');
assert.ok(root.innerHTML.includes('month-agenda'),'Year tile opens selected Egyptian month');
click('data-more','');
assert.ok(root.innerHTML.includes('more-sheet'),'More opens secondary destinations');
click('data-tab','settings');
assert.ok(root.innerHTML.includes('settings-group'),'Settings view must render');
handlers.change({target:{name:'language',value:'cop'}});
assert.equal(document.body.dataset.language,'cop');
click('data-tab','calendar');
click('data-new','');
assert.ok(root.innerHTML.includes('id="event-editor"'),'Event editor must open');
console.log('Renpet single-renderer UI smoke test OK');
