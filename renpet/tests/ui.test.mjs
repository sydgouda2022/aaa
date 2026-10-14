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
globalThis.navigator={};
globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../web/data.json',import.meta.url),'utf8'))});
await import('../web/app.js');
await new Promise(resolve=>setImmediate(resolve));
assert.ok(root.innerHTML.includes('month-section'),'Month view must render');
assert.ok(!root.innerHTML.includes('year-grid'),'Legacy year grid must not render');
assert.ok(!root.innerHTML.includes('Renpet:'),'App must not display runtime error');
const click=(name,value)=>{
 const button={disabled:false,dataset:{[name.slice(5)]:value},hasAttribute:k=>k===name};
 handlers.click({target:{closest:selector=>selector==='button'?button:null}});
};
click('data-date',String(dayNumber('2026-10-14')));
assert.ok(root.innerHTML.includes('hour-row'),'Day timeline must render after selecting a date');
click('data-tab','settings');
assert.ok(root.innerHTML.includes('settings-group'),'Settings view must render');
handlers.change({target:{name:'language',value:'cop'}});
assert.equal(document.body.dataset.language,'cop');
click('data-tab','calendar');
click('data-new','');
assert.ok(root.innerHTML.includes('id="event-editor"'),'Event editor must open');
console.log('Renpet single-renderer UI smoke test OK');
