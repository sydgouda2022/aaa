// Renpet 0.6.1: working day/week/month/list calendar views.
// Replaces the legacy month/year overview only in the calendar tab.
import { DAY, dayNumber, isoDate, toEgyptian, toGregorian, monthGrid, festivalHits, nativeNumber } from './calendar.js';
import { LOCALES } from './locales.js';
import { loadScheduler, saveScheduler, createItem, occursOn } from './scheduler.js';

const root = document.querySelector('#app');
const STORE = 'renpet.view.v3';
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
  try { const visible=new Set(state.calendars.filter(c=>c.visible!==false).map(c=>c.id)); return state.items.filter(i=>visible.has(i.calendarId)&&occursOn(i,day,data.years)).sort((a,b)=>a.startMinutes-b.startMinutes); } catch { return []; }
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
function renderMonth(e,firstSection=false){
  const start=toGregorian({year:e.year,month:e.month,day:1},data.years);
  const count=monthLength(e),w=weekLength(),grid=monthGrid(e.year,e.month,w,data.years);
  const names=Array.from({length:w},(_,i)=>w===7?esc(LOCALES[language()].shortWeekdays?.[i]||number(i+1)):numberHtml(i+1)).map(n=>`<span>${n}</span>`).join('');
  const cells=grid.map(cell=>{
    if(!cell)return '<span class="renpet-blank" aria-hidden="true"></span>';
    const d=cell.gregorian,items=getItems(d),fest=showFestivals()?festivalHits(d,data.years,data.festivals):[];
    const dot=items.length?`<span class="renpet-dots">${items.slice(0,3).map(i=>`<i style="background:${/^#[0-9a-f]{6}$/i.test(itemColor(i))?itemColor(i):'#187568'}"></i>`).join('')}</span>`:'';
    return `<button type="button" class="renpet-month-cell ${d===focus?'selected':''} ${d===localToday()?'is-today':''}" data-renpet-date="${d}" aria-pressed="${d===focus}" aria-label="${esc(greg(d,{day:'numeric',month:'long',year:'numeric'}))}"><span class="renpet-primary-day">${numberHtml(cell.day)}</span>${showGregorian()?`<small>${esc(greg(d,{day:'numeric'}))}</small>`:''}${dot}${fest.length?'<i class="renpet-festival-mark">•</i>':''}</button>`;
  }).join('');
  const range=showGregorian()?`<span class="renpet-greg-range">${esc(greg(start,{day:'numeric',month:'short'}))} – ${esc(greg(start+count-1,{day:'numeric',month:'short'}))}</span>`:'';
  return `<section class="renpet-month-section" data-month-start="${start}"><div class="renpet-section-heading"><h2>${esc(nameMonth(e.month))}<span>${numberHtml(e.year)}</span></h2>${range}</div><div class="renpet-week-headers" style="--renpet-columns:${w}">${names}</div><div class="renpet-month-days" style="--renpet-columns:${w}">${cells}</div></section>`;
}
function nextMonth(e,step=1){
  let m=e.month+step,y=e.year;
  while(m>13){m-=13;y++;}
  while(m<1){m+=13;y--;}
  return data.years.some(v=>v.year===y)?{year:y,month:m,day:1}:null;
}
function monthMarkup(){
  const e=toEgyptian(focus,data.years);
  const next=nextMonth(e);
  const next2=next&&nextMonth(next);
  const months=[renderMonth(e,true),next?renderMonth(next):'',next2?renderMonth(next2):''].join('');
  return `<div class="renpet-month-scroll">${months}</div><div class="renpet-selected-agenda" aria-live="polite">${dateHeading(focus)}${eventsFor(focus)}</div>`;
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
function appleIcon(name){
 const paths={
 search:'<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r=".7"/><circle cx="3.5" cy="12" r=".7"/><circle cx="3.5" cy="18" r=".7"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 back:'<path d="m15 5-7 7 7 7"/>',
 options:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'
 };
 return `<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.grid}</svg>`;
}
function paint(){
 if(!data||!root)return;
 const main=root.querySelector('main'),nav=root.querySelector('[data-tab="calendar"]');
 if(!main||!nav||!nav.classList.contains('active')){
   if(activeMain)activeMain.classList.remove('renpet-views-active');
   activeMain=null;return;
 }
 if(main===activeMain&&main.querySelector('.renpet-view-controls'))return;
 activeMain=main;main.classList.add('renpet-views-active');main.dataset.renpetView=view;
 const e=toEgyptian(focus,data.years);
 const controls=document.createElement('div');controls.className='renpet-view-controls';
 controls.innerHTML=`<div class="renpet-apple-topbar"><button type="button" class="renpet-year-back" data-renpet-year="-1" aria-label="${esc(t().previous)}">${appleIcon('back')}<span>${number(e.year)}</span></button><div class="renpet-top-actions"><button type="button" data-renpet-search aria-label="${language()==='ar'?'بحث':'Search'}">${appleIcon('search')}</button><button type="button" data-renpet-options aria-label="${esc(t().views)}">${appleIcon('list')}</button><button type="button" data-renpet-add aria-label="${language()==='ar'?'إضافة موعد':'Add event'}">${appleIcon('plus')}</button></div></div><div class="renpet-view-navigation"><h1 class="renpet-view-title">${esc(nameMonth(e.month))}</h1><div class="renpet-step-buttons"><button type="button" data-renpet-move="-1" aria-label="${esc(t().previous)}">‹</button><button type="button" data-renpet-move="1" aria-label="${esc(t().next)}">›</button></div></div><div class="renpet-view-menu" hidden><div class="renpet-view-switch" role="group" aria-label="${esc(t().views)}">${['day','week','month','list'].map(v=>`<button type="button" data-renpet-view="${v}" aria-pressed="${v===view}" class="${v===view?'active':''}">${esc(t()[v])}</button>`).join('')}</div><div class="renpet-display-picker"><label for="renpet-display-style">${esc(t().views)}</label><select id="renpet-display-style">${['compact','stacked','detailed'].map(v=>`<option value="${v}" ${display===v?'selected':''}>${esc(t()[v])}</option>`).join('')}</select></div></div><div class="renpet-search-panel" hidden><input type="search" id="renpet-search-input" autocomplete="off" placeholder="${language()==='ar'?'بحث في المواعيد':'Search events'}" aria-label="${language()==='ar'?'بحث في المواعيد':'Search events'}"><div class="renpet-search-results"></div></div>`;
 const panel=document.createElement('div');panel.className='renpet-view-panel';
 main.prepend(panel);main.prepend(controls);
 for(const child of [...main.children]){
  if(child===controls||child===panel||child.matches('[role="dialog"],.modal,.sheet,form')||child.querySelector('[role="dialog"]'))continue;
  child.remove();
 }
 updatePanel();
}
function updatePanel(){
 if(!activeMain||!data)return;
 activeMain.dataset.renpetView=view;
 const panel=activeMain.querySelector('.renpet-view-panel');
 if(!panel)return;
 const e=toEgyptian(focus,data.years);
 const title=activeMain.querySelector('.renpet-view-title');
 if(title)title.textContent=view==='day'?`${number(e.day)} ${nameMonth(e.month)}`:view==='list'?t().list:nameMonth(e.month);
 const yr=activeMain.querySelector('.renpet-year-back span');if(yr)yr.textContent=number(e.year);
 for(const b of activeMain.querySelectorAll('[data-renpet-view]')){b.classList.toggle('active',b.dataset.renpetView===view);b.setAttribute('aria-pressed',String(b.dataset.renpetView===view));}
 panel.innerHTML=view==='day'?dayMarkup():view==='week'?weekMarkup():view==='list'?listMarkup():monthMarkup();
}
function move(n){
 if(view==='day')focus+=n;
 else if(view==='week')focus+=n*weekLength();
 else if(view==='list')focus+=n*30;
 else{
  const e=toEgyptian(focus,data.years),next=nextMonth(e,n);
  if(next)focus=toGregorian({...next,day:Math.min(e.day,monthLength(next))},data.years);
 }
 focus=clamp(focus,data);updatePanel();
 if(activeMain)activeMain.scrollTop=0;
}
function appendMonthOnScroll(){
 if(!activeMain||view!=='month'||!data)return;
 const main=activeMain,panel=main.querySelector('.renpet-view-panel');
 if(!panel||main.scrollHeight-main.scrollTop-main.clientHeight>550)return;
 const last=panel.querySelector('.renpet-month-section:last-of-type');
 if(!last)return;
 const e=toEgyptian(Number(last.dataset.monthStart),data.years);
 const next=nextMonth(e);
 if(!next)return;
 const wrap=panel.querySelector('.renpet-month-scroll');
 if(wrap&&wrap.querySelectorAll('.renpet-month-section').length<36)wrap.insertAdjacentHTML('beforeend',renderMonth(next));
}
function searchItems(query){
 const q=String(query||'').trim().toLocaleLowerCase();
 const box=activeMain?.querySelector('.renpet-search-results');
 if(!box)return;
 if(!q){box.innerHTML='';return;}
 const matches=loadScheduler().items.filter(i=>[i.title,i.location,i.notes].some(x=>String(x||'').toLocaleLowerCase().includes(q))).slice(0,50);
 box.innerHTML=matches.length?matches.map(i=>`<button type="button" data-renpet-result="${i.startDay}"><strong>${esc(i.title)}</strong><small>${esc(greg(i.startDay,{day:'numeric',month:'short',year:'numeric'}))}</small></button>`).join(''):`<p class="renpet-empty">${esc(t().noEvents)}</p>`;
}
function quickAdd(){
 const header=root.querySelector('header.top');
 const existing=[...header?.querySelectorAll('button')||[]].find(b=>b.matches('[data-action="add"],[data-action="new"],[data-action="create"],[class*="add"],[class*="plus"]')||/إضافة|Add|\\+/.test((b.getAttribute('aria-label')||'')+' '+(b.title||'')+' '+(b.textContent||'')));
 if(existing){existing.click();return;}
 // Fallback only when the bundled scheduler editor is not available.
 const overlay=document.createElement('div');overlay.className='renpet-quick-overlay';
 overlay.innerHTML=`<form class="renpet-quick-sheet" role="dialog" aria-modal="true"><div class="renpet-sheet-head"><button type="button" data-close>×</button><h2>${language()==='ar'?'موعد جديد':'New event'}</h2><button type="submit">${language()==='ar'?'حفظ':'Save'}</button></div><label>${language()==='ar'?'العنوان':'Title'}<input name="title" required maxlength="200" autofocus></label><label>${language()==='ar'?'التاريخ':'Date'}<input name="date" type="date" required value="${isoDate(focus)}"></label><label>${language()==='ar'?'الوقت':'Time'}<input name="time" type="time" value="09:00"></label><label>${language()==='ar'?'ملاحظات':'Notes'}<textarea name="notes" rows="3"></textarea></label></form>`;
 overlay.addEventListener('click',ev=>{if(ev.target===overlay||ev.target.closest('[data-close]'))overlay.remove();});
 overlay.querySelector('form').addEventListener('submit',ev=>{
  ev.preventDefault();
  const form=new FormData(ev.currentTarget),day=dayNumber(String(form.get('date'))),time=String(form.get('time')||'09:00').split(':').map(Number);
  if(!Number.isInteger(day)||!form.get('title'))return;
  const startMinutes=time[0]*60+time[1],state=loadScheduler();
  state.items.push(createItem({title:form.get('title'),notes:form.get('notes'),startDay:day,endDay:day,startMinutes,endMinutes:Math.min(startMinutes+60,1439),calendarId:state.calendars[0]?.id||'personal'}));
  saveScheduler(state);overlay.remove();focus=clamp(day,data);updatePanel();
 });
 document.body.append(overlay);overlay.querySelector('[name="title"]').focus();
}
function installListeners(){
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.renpetView){event.stopImmediatePropagation();view=b.dataset.renpetView;persist();activeMain.querySelector('.renpet-view-menu').hidden=true;updatePanel();return;}
  if(b.hasAttribute('data-renpet-options')){event.stopImmediatePropagation();const menu=activeMain.querySelector('.renpet-view-menu');menu.hidden=!menu.hidden;return;}
  if(b.hasAttribute('data-renpet-search')){event.stopImmediatePropagation();const p=activeMain.querySelector('.renpet-search-panel');p.hidden=!p.hidden;if(!p.hidden)p.querySelector('input').focus();return;}
  if(b.hasAttribute('data-renpet-add')){event.stopImmediatePropagation();quickAdd();return;}
  if(b.dataset.renpetResult){event.stopImmediatePropagation();focus=clamp(Number(b.dataset.renpetResult),data);view='day';persist();activeMain.querySelector('.renpet-search-panel').hidden=true;updatePanel();return;}
  if(b.dataset.renpetYear){event.stopImmediatePropagation();const e=toEgyptian(focus,data.years);const y=e.year+Number(b.dataset.renpetYear);if(data.years.some(v=>v.year===y)){focus=toGregorian({year:y,month:e.month,day:Math.min(e.day,monthLength({year:y,month:e.month}))},data.years);updatePanel();}return;}
  if(b.dataset.renpetMove){event.stopImmediatePropagation();move(Number(b.dataset.renpetMove));return;}
  if(b.dataset.renpetDate){event.stopImmediatePropagation();const scroll=activeMain?.scrollTop||0;focus=clamp(Number(b.dataset.renpetDate),data);updatePanel();if(activeMain)activeMain.scrollTop=scroll;return;}
  if(b.dataset.action==='today'){focus=clamp(localToday(),data);setTimeout(()=>{activeMain=null;paint();},0);}
 },true);
 root.addEventListener('change',event=>{if(event.target.id==='renpet-display-style'){display=event.target.value;persist();updatePanel();}},true);
 root.addEventListener('input',event=>{if(event.target.id==='renpet-search-input')searchItems(event.target.value);},true);
 root.addEventListener('scroll',event=>{if(event.target===activeMain)appendMonthOnScroll();},true);
 let touchX=0,touchY=0;
 root.addEventListener('touchstart',e=>{if(!activeMain?.contains(e.target))return;touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;},{passive:true});
 root.addEventListener('touchend',e=>{if(!activeMain?.contains(e.target))return;const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;if(Math.abs(dx)>85&&Math.abs(dx)>Math.abs(dy)*1.7){move(dx>0?1:-1);}},{passive:true});
 const observer=new MutationObserver(()=>{if(painting)return;painting=true;try{paint();}finally{painting=false;}});
 observer.observe(root,{childList:true,subtree:true});
 fetch('./data.json').then(r=>{if(!r.ok)throw Error('Calendar data unavailable');return r.json();}).then(d=>{data=d;focus=clamp(focus,data);paint();}).catch(console.error);
 window.addEventListener('storage',event=>{if(['renpet.scheduler.v1','renpet.settings.v1'].includes(event.key)){activeMain=null;paint();}});
}
if(root)installListeners();
