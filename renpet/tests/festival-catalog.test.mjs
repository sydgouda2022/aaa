import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {toGregorian,dayNumber} from '../web/calendar.js';
import {AMUN_SOURCE,loadFestivalCatalog,enabledSourceIds,festivalHitsForDay} from '../web/festival-catalog.js';
import {emptyState,createItem,upsertItem,itemsForDay} from '../web/scheduler.js';

const read=async name=>JSON.parse(await readFile(new URL('../web/'+name,import.meta.url),'utf8'));
const data=await read('data.json');
const actualManifest=await read('festival-sources.json');
const fetchManifest=async u=>({ok:true,json:async()=>
 u==='./festival-sources.json'?actualManifest:read(u.replace('./',''))
});
const catalog=await loadFestivalCatalog(data,fetchManifest);
assert.equal(catalog.sources.length,6,'Six independently selectable source packs are loaded');

// Every festival, including embedded Amun and all five external packs,
// must contain its own native-script title and descriptive interpretation.
// A missing localization must not show Arabic in Coptic/hieroglyphic screens.
const arabic=/[\u0600-\u06ff]/u;
const coptic=/[\u2c80-\u2cff]/u;
const glyph=/[\u{13000}-\u{1345f}]/u;
for(const source of catalog.sources){
 for(const locale of ['cop','egy']){
  const expression=locale==='cop'?coptic:glyph;
  assert.ok(expression.test(source.name[locale]),'Native source title: '+source.id+' '+locale);
  assert.ok(expression.test(source.description[locale]),'Native source description: '+source.id+' '+locale);
  assert.ok(!arabic.test(source.name[locale]+source.description[locale]),'Arabic leaked into native source '+source.id);
 }
 for(const festival of source.events){
  for(const locale of ['cop','egy']){
   const expression=locale==='cop'?coptic:glyph;
   const description=festival['description_'+locale];
   assert.ok(typeof festival[locale]==='string'&&expression.test(festival[locale]),'Native event title missing '+festival.id+' '+locale);
   assert.ok(typeof description==='string'&&description.length>=18&&expression.test(description),'Native description missing '+festival.id+' '+locale);
   assert.ok(!arabic.test(festival[locale]+description),'Arabic leaked into festival '+festival.id+' '+locale);
  }
 }
}
assert.equal(catalog.sources.reduce((n,s)=>n+s.events.length,0),33,'All 33 festival titles and notes localized');

assert.equal(catalog.sources[0].id,AMUN_SOURCE);
assert.equal(catalog.sources[0].events.length,data.festivals.length,'Do not change attested Amun date list');
assert.equal(enabledSourceIds(null,catalog).join(','),AMUN_SOURCE,'Amun enabled for existing users');
assert.deepEqual(enabledSourceIds(null,catalog,false),[],'Legacy festival off migrates to none');
assert.deepEqual(enabledSourceIds([],catalog),[],'Explicitly disabled source persists');
assert.deepEqual(enabledSourceIds([AMUN_SOURCE,AMUN_SOURCE,'nonexistent'],catalog),[AMUN_SOURCE]);

const festival=data.festivals.find(x=>x.month===1&&x.day===1);
const newYear=toGregorian({year:6282,month:1,day:1},data.years);
assert.equal(catalog.sources.find(s=>s.id==='national-egypt').events.length,7);
assert.equal(catalog.sources.find(s=>s.id==='christian-coptic').events.length,6);
assert.equal(catalog.sources.find(s=>s.id==='muslim-egypt').events.length,3);
assert.equal(catalog.sources.find(s=>s.id==='esna-khnum').events.length,3);
assert.equal(catalog.sources.find(s=>s.id==='isis-philae').events.length,1);
assert.ok(festivalHitsForDay(toGregorian({year:6282,month:11,day:13},data.years),data.years,catalog,['esna-khnum']).some(f=>f.id==='esna-neith-visit'));
assert.ok(festivalHitsForDay(toGregorian({year:6282,month:13,day:4},data.years),data.years,catalog,['isis-philae']).some(f=>f.id==='isis-epagomenal-birthday'));
assert.equal(festivalHitsForDay(toGregorian({year:6282,month:13,day:4},data.years),data.years,catalog,[]).length,0,'No historical catalog on opt-out');
assert.ok(festivalHitsForDay(dayNumber('2026-04-13'),data.years,catalog,['national-egypt']).some(f=>f.id==='sham-el-nessim'));
const october6=dayNumber('2026-10-06');
assert.ok(festivalHitsForDay(october6,data.years,catalog,['national-egypt']).some(f=>f.id==='armed-forces'),
 '6 October national festival remains attached to its absolute date on the Egyptian calendar');
assert.equal(festivalHitsForDay(october6,data.years,catalog,[]).length,0,
 'Festival source selection, not Gregorian label display, is the visibility switch');
assert.equal(festivalHitsForDay(october6,data.years,catalog,['national-egypt']).some(f=>f.id==='armed-forces'),true,
 'Hide-Gregorian mode must use the same independent absolute-date catalog');

assert.ok(festivalHitsForDay(dayNumber('2026-04-12'),data.years,catalog,['christian-coptic']).some(f=>f.id==='coptic-easter'));
assert.ok(festivalHitsForDay(dayNumber('2027-05-02'),data.years,catalog,['christian-coptic']).some(f=>f.id==='coptic-easter'));
assert.ok(festivalHitsForDay(dayNumber('2028-04-16'),data.years,catalog,['christian-coptic']).some(f=>f.id==='coptic-easter'));
assert.ok(festivalHitsForDay(dayNumber('2027-05-03'),data.years,catalog,['national-egypt']).some(f=>f.id==='sham-el-nessim'));
assert.ok(festivalHitsForDay(dayNumber('2027-04-30'),data.years,catalog,['christian-coptic']).some(f=>f.id==='coptic-good-friday'));
assert.ok(festivalHitsForDay(dayNumber('2026-03-20'),data.years,catalog,['muslim-egypt']).some(f=>f.id==='eid-al-fitr-2026'));
assert.equal(festivalHitsForDay(dayNumber('2027-03-20'),data.years,catalog,['muslim-egypt']).length,0,'Movable lunar festivals are never repeated speculatively');
assert.deepEqual(enabledSourceIds(['national-egypt','christian-coptic','muslim-egypt'],catalog).sort(),['christian-coptic','muslim-egypt','national-egypt']);
assert.ok(festival,'Existing Amun list contains Wepet Renpet');
const defaultHits=festivalHitsForDay(newYear,data.years,catalog,[AMUN_SOURCE]);
assert.ok(defaultHits.some(x=>x.id===festival.id),'Amun calendar dates remain intact');
assert.equal(festivalHitsForDay(newYear,data.years,catalog,[]).length,0,'Disabling Amun removes festival overlays');

// Personal data remains independent when all festival sources are disabled.
const personal=emptyState(),appointment=createItem({title:'Birthday',kind:'event',
 startDay:newYear,endDay:newYear,startMinutes:540,endMinutes:600,calendarId:'personal'});
upsertItem(personal,appointment);
assert.equal(itemsForDay(personal,newYear,data.years).length,1,'Personal appointments unaffected by festival filtering');

// Simulate how future Christian, national and other fixed/lunar dates can be
// registered using only manifest entries + packs. No UI changes are needed.
const nextManifest={schema:1,sources:[
 actualManifest.sources[0],
 {id:'national',status:'available',category:'national',name:{ar:'أعياد وطنية'},
  calendarRule:'gregorian-annual',data:{type:'file',path:'./festival-packs/national.json'}},
 {id:'christian',status:'available',category:'christian',name:{ar:'أعياد مسيحية'},
  calendarRule:'dated',data:{type:'file',path:'./festival-packs/christian.json'}}
]};
const packs={
 './festival-packs/national.json':{schema:1,sourceId:'national',events:[{id:'nat-1',ar:'عيد تجريبي وطني',month:12,day:25,duration:1}]},
 './festival-packs/christian.json':{schema:1,sourceId:'christian',events:[{id:'chr-1',ar:'عيد تجريبي متغير التاريخ',date:'2026-12-25',duration:2}]}
};
const future=await loadFestivalCatalog(data,async url=>({ok:!!(url==='./festival-sources.json'||packs[url]),
 json:async()=>url==='./festival-sources.json'?nextManifest:packs[url]}));
assert.equal(future.sources.length,3,'Multiple independent catalogs can be loaded');
assert.deepEqual(enabledSourceIds(null,future),[AMUN_SOURCE],'Future catalogs require opt-in');
const christmas=dayNumber('2026-12-25');
assert.deepEqual(festivalHitsForDay(christmas,data.years,future,['national']).map(x=>x.id),['nat-1']);
assert.deepEqual(festivalHitsForDay(christmas,data.years,future,['christian']).map(x=>x.id),['chr-1']);
assert.deepEqual(festivalHitsForDay(christmas,data.years,future,['national','christian']).map(x=>x.id),['nat-1','chr-1']);
assert.equal(festivalHitsForDay(christmas+1,data.years,future,['national']).length,0);
assert.equal(festivalHitsForDay(christmas+1,data.years,future,['christian']).length,1);
assert.equal(festivalHitsForDay(christmas,data.years,future,[]).length,0);

const fallback=await loadFestivalCatalog(data,async()=>{throw Error('offline registry blocked')});
assert.equal(fallback.sources[0].events.length,data.festivals.length,'Amun remains readable if registry request fails');
console.log('Six-source registry, per-event fixed/dated rules and calendar isolation passed');
