// Renpet 0.6.1: working day/week/month/list calendar views.
// Replaces the legacy month/year overview only in the calendar tab.
import { DAY, dayNumber, isoDate, toEgyptian, toGregorian, monthGrid, festivalHits, nativeNumber } from './calendar.js';
import { LOCALES } from './locales.js';
import { loadScheduler, itemsForDay } from './scheduler.js';

const root = document.querySelector('#app');
const STORE = 'renpet.view.v2';
const LABELS = {
  ar:{day:'يوم',week:'أسبوع',month:'شهر',list:'قائمة',previous:'السابق',next:'التالي',noEvents:'لا توجد مواعيد',events:'المواعيد',allDay:'طوال اليوم',views:'طريقة العرض',compact:'مختصر',stacked:'متراص',detailed:'تفصيلي'},
  cop:{day:'Ϩⲟⲟⲩ',week:'Ⲉⲃⲇⲟⲙⲁⲥ',month:'Ⲉⲃⲟⲧ',list:'Ⲕⲁⲧⲁⲗⲟⲅⲟⲥ',previous:'Ϩⲁⲑⲏ',next:'Ⲥⲁ',noEvents:'Ⲙ̀ⲙⲟⲛ',events:'Ⲉⲣⲅⲟⲛ',allDay:'Ϩⲟⲟⲩ',views:'Ⲟⲩⲱⲛϩ',compact:'Ⲕⲟⲩϫⲓ',stacked:'Ⲥⲱⲟⲩϩ',detailed:'Ⲧⲉⲗⲓⲟⲥ'},
  egy:{day:'𓇳',week:'𓇳𓏥',month:'𓇹',list:'𓏏𓏤',previous:'𓄂𓏏',next:'𓐍𓂋',noEvents:'𓏏𓏤 —',events:'𓏏𓏤',allDay:'𓇳',views:'𓁹',compact:'𓏏',stacked:'𓏥',detailed:'𓂋𓏤'}
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localToday = () => { const d = new Date(); return dayNumber(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); };
const clamp = (d, data) => Math.max(dayNumber(data.min_date), Math.min(dayNumber(data.max_date), d));
let view = 'month', focus = localToday(), display = 'compact', data = null, activeMain = null, painting = false;
try { const s=JSON.parse(localStorage.getItem(STORE)||'{}'); if(['day','week','month','list'].includes(s.view)) view=s.view; if(['compact','stacked','detailed'].includes(s.display)) display=s.display; }
catch {}
function persist(){ try { localStorage.setItem(STORE, JSON.stringify({view,display})); } catch {} }
function prefs(){try {return JSON.parse(localStorage.getItem('renpet.settings.v1')||'{}');}catch{return {};}}
function language(){const id=document.body.dataset.language;return LABELS[id]?id:'ar';}
function t(){return LABELS[language()];}
function number(n){return nativeNumber(n,language());}
function numberHtml(n){return language()==='egy'? `<img class="renpet-glyph-number" src="assets/numerals/${n}.svg" alt="${esc(number(n))}">` : esc(number(n));}
function nameMonth(m){
  if(m===13)return LOCALES[language()].epagomenal;
  if(language()==='egy')return '𓇹 '+number(m);
  return data.months[language()][m-1];
}
function greg(day,options={day:'numeric',month:'short'}){
  const code=language()==='ar'?'ar-EG-u-nu-arab':'en-GB';
  return new Intl.DateTimeFormat(code,{...options,timeZone:'UTC'}).format(new Date(day*DAY));
}
function showGregorian(){return prefs().gregorian!==false;}
function showFestivals(){return prefs().festivals!==false;}
function weekLength(){const p=prefs();return [7,10].includes(p.weeks?.[language()])?p.weeks[language()]:(language()==='ar'?7:10);}
function startWeek(day){
  if(weekLength()===7)return day-(new Date(day*DAY).getUTCDay()+6)%7;
  const e=toEgyptian(day,data.years);return day-((e.day-1)%10);
}
function monthStart(day){const e=toEgyptian(day,data.years);return toGregorian({year:e.year,month:e.month,day:1},data.years);}
function monthLength(e){return e.month===13?data.years.find(y=>y.year===e.year).days-360:30;}
function formatTitle(day){const e=toEgyptian(day,data.years);return `${nameMonth(e.month)} · ${number(e.year)}`;}
function getItems(day){
  const state=loadScheduler();
  try{return itemsForDay(state,day,data.years);}catch{return [];}
}
function itemColor(item){const state=loadScheduler();return state.calendars.find(c=>c.id===item.calendarId)?.color||'#1034A6';}
function itemClock(item){
  if(item.allDay)return t().allDay;
  const n=item.startMinutes||0;
  const h=String(Math.floor(n/60)).padStart(2,'0'),m=String(n%60).padStart(2,'0');
  return `${h}:${m}`;
}
function eventMarkup(item){
  const title=esc(item.title||t().events);
  return `<div class="renpet-appointment" style="--event-color:${/^#[0-9a-f]{6}$/i.test(itemColor(item))?itemColor(item):'#1034A6'}"><span class="renpet-event-time">${esc(itemClock(item))}</span><div class="renpet-event-body"><strong>${title}</strong>${display==='detailed'&&item.location?`<small>${esc(item.location)}</small>`:''}${display==='detailed'&&item.notes?`<small>${esc(item.notes)}</small>`:''}</div>${item.kind==='reminder'?'☑':''}</div>`;
}
function eventsFor(day){
  const items=getItems(day);
  return items.length?`<div class="renpet-events renpet-${display}">${items.map(eventMarkup).join('')}</div>`:`<p class="renpet-empty">${esc(t().noEvents)}</p>`;
}
function dateHeading(day){const e=toEgyptian(day,data.years);return `<div class="renpet-date-heading"><strong>${numberHtml(e.day)} ${esc(nameMonth(e.month))}</strong><span>${numberHtml(e.year)}</span>${showGregorian()?`<small>${esc(greg(day,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</small>`:''}</div>`;}
function monthMarkup(){
  const e=toEgyptian(focus,data.years),first=monthStart(focus),count=monthLength(e),w=weekLength();
  const grid=monthGrid(e.year,e.month,w,data.years);
  const headers=Array.from({length:w},(_,i)=>{
    if(w===10)return `<span>${numberHtml(i+1)}</span>`;
    const l=LOCALES[language()];return `<span>${esc(l.shortWeekdays?.[i]||number(i+1))}</span>`;
  }).join('');
  const cells=grid.map(cell=>{
    if(!cell)return '<span class="renpet-blank"></span>';
    const d=cell.gregorian,items=getItems(d),festivals=showFestivals()?festivalHits(d,data.years,data.festivals):[];
    const marks=items.length? (display==='compact'?`<span class="renpet-dots">${items.slice(0,3).map(i=>`<i style="background:${/^#[0-9a-f]{6}$/i.test(itemColor(i))?itemColor(i):'#1034A6'}"></i>`).join('')}</span>`:display==='stacked'?`<span class="renpet-stacked-mark">${items.slice(0,2).map(i=>`<b>${esc(i.title)}</b>`).join('')}</span>`:`<span class="renpet-detailed-mark">${items.slice(0,2).map(i=>`<b>${esc(itemClock(i))} ${esc(i.title)}</b>`).join('')}</span>`):'';
    return `<button class="renpet-month-cell ${d===focus?'selected':''} ${d===localToday()?'is-today':''}" data-renpet-date="${d}" aria-label="${esc(greg(d,{day:'numeric',month:'long',year:'numeric'}))}"><span class="renpet-primary-day">${numberHtml(cell.day)}</span>${showGregorian()?`<small>${esc(greg(d,{day:'numeric'}))}</small>`:''}${marks}${festivals.length?'<i class="renpet-festival-mark">✦</i>':''}</button>`;
  }).join('');
  return `<div class="renpet-month-grid" style="--renpet-columns:${w}"><div class="renpet-week-headers">${headers}</div><div class="renpet-month-days">${cells}</div></div>${dateHeading(focus)}<h3 class="renpet-events-title">${esc(t().events)}</h3>${eventsFor(focus)}`;
}
function weekMarkup(){
  const start=startWeek(focus),w=weekLength();
  const days=Array.from({length:w},(_,i)=>{
    const d=start+i,e=toEgyptian(d,data.years),items=getItems(d);
    return `<button class="renpet-week-day ${d===focus?'selected':''}" data-renpet-date="${d}"><small>${w===7?esc(LOCALES[language()].shortWeekdays?.[i]||number(i+1)):numberHtml(i+1)}</small><strong>${numberHtml(e.day)}</strong>${items.length?`<span class="renpet-count">${numberHtml(items.length)}</span>`:''}</button>`;
  }).join('');
  return `<div class="renpet-week-strip" style="--renpet-columns:${w}">${days}</div>${dateHeading(focus)}<h3 class="renpet-events-title">${esc(t().events)}</h3>${eventsFor(focus)}`;
}
function dayMarkup(){return `${dateHeading(focus)}<h3 class="renpet-events-title">${esc(t().events)}</h3>${eventsFor(focus)}`;}
function listMarkup(){
  const last=Math.min(focus+59,dayNumber(data.max_date)),groups=[];
  for(let d=focus;d<=last;d++){const items=getItems(d);if(items.length)groups.push(`<section class="renpet-list-group">${dateHeading(d)}<div class="renpet-events renpet-${display}">${items.map(eventMarkup).join('')}</div></section>`);}
  return groups.length?groups.join(''):`<p class="renpet-empty">${esc(t().noEvents)}</p>`;
}
function paint(){
  if(!data||!root)return;
  const main=root.querySelector('main');
  const nav=root.querySelector('[data-tab="calendar"]');
  if(!main||!nav||!nav.classList.contains('active')){
    if(activeMain)activeMain.classList.remove('renpet-views-active');
    activeMain=null;return;
  }
  if(main===activeMain&&main.querySelector('.renpet-view-controls'))return;
  activeMain=main;
  main.classList.add('renpet-views-active');
  main.setAttribute('data-renpet-view',view);
  const controls=document.createElement('div');
  controls.className='renpet-view-controls';
  controls.innerHTML=`<div class="renpet-view-switch" role="group" aria-label="${esc(t().views)}">${['day','week','month','list'].map(v=>`<button type="button" data-renpet-view="${v}" aria-pressed="${v===view}" class="${v===view?'active':''}">${esc(t()[v])}</button>`).join('')}</div><div class="renpet-view-navigation"><button type="button" data-renpet-move="-1" aria-label="${esc(t().previous)}">‹</button><strong class="renpet-view-title">${esc(formatTitle(focus))}</strong><button type="button" data-renpet-move="1" aria-label="${esc(t().next)}">›</button></div><div class="renpet-display-picker"><label for="renpet-display-style">${esc(t().views)}</label><select id="renpet-display-style">${['compact','stacked','detailed'].map(v=>`<option value="${v}" ${display===v?'selected':''}>${esc(t()[v])}</option>`).join('')}</select></div>`;
  const panel=document.createElement('div');panel.className='renpet-view-panel';
  main.prepend(panel);main.prepend(controls);
  updatePanel();
}
function updatePanel(){
  if(!activeMain||!data)return;
  activeMain.dataset.renpetView=view;
  const panel=activeMain.querySelector('.renpet-view-panel');
  if(!panel)return;
  const title=activeMain.querySelector('.renpet-view-title');
  if(title)title.textContent=view==='day'?greg(focus,{weekday:'long',day:'numeric',month:'long'}):formatTitle(focus);
  for(const b of activeMain.querySelectorAll('[data-renpet-view]')){b.classList.toggle('active',b.dataset.renpetView===view);b.setAttribute('aria-pressed',String(b.dataset.renpetView===view));}
  panel.innerHTML=view==='day'?dayMarkup():view==='week'?weekMarkup():view==='list'?listMarkup():monthMarkup();
}
function move(n){
  if(view==='day')focus+=n;
  else if(view==='week')focus+=n*weekLength();
  else if(view==='list')focus+=n*30;
  else {
    const e=toEgyptian(focus,data.years);
    let m=e.month+n,y=e.year;
    if(m<1){m=13;y--;}if(m>13){m=1;y++;}
    if(data.years.some(v=>v.year===y))focus=toGregorian({year:y,month:m,day:Math.min(e.day,m===13?data.years.find(v=>v.year===y).days-360:30)},data.years);
  }
  focus=clamp(focus,data);updatePanel();
}
if(root){
  root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.renpetView){event.stopImmediatePropagation();view=b.dataset.renpetView;persist();updatePanel();return;}
    if(b.dataset.renpetMove){event.stopImmediatePropagation();move(Number(b.dataset.renpetMove));return;}
    if(b.dataset.renpetDate){event.stopImmediatePropagation();focus=clamp(Number(b.dataset.renpetDate),data);updatePanel();return;}
    if(b.dataset.action==='today'){focus=clamp(localToday(),data);setTimeout(()=>{activeMain=null;paint();},0);}
    else if(b.dataset.day){focus=clamp(Number(b.dataset.day),data);}
  },true);
  root.addEventListener('change',event=>{
    if(event.target.id==='renpet-display-style'){
      display=event.target.value;persist();updatePanel();
    }
  },true);
  const observer=new MutationObserver(()=>{if(painting)return;painting=true;try{paint();}finally{painting=false;}});
  observer.observe(root,{childList:true,subtree:false});
  // Root's top-level shell is replaced by the original renderer on each navigation.
  // The observer is re-attached to the current main without polling.
  const mainObserver=new MutationObserver(()=>{if(!painting){painting=true;try{paint();}finally{painting=false;}}});
  mainObserver.observe(root,{childList:true,subtree:true});
  fetch('./data.json').then(r=>{if(!r.ok)throw Error('Calendar data unavailable');return r.json();}).then(d=>{data=d;focus=clamp(focus,data);paint();}).catch(console.error);
  window.addEventListener('storage',event=>{if(['renpet.scheduler.v1','renpet.settings.v1'].includes(event.key)){activeMain=null;paint();}});
}
