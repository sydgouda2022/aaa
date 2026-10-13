import {DAY,dayNumber,isoDate,toEgyptian,toGregorian,nativeNumber,monthGrid,festivalHits} from './calendar.js';
import {LOCALES} from './locales.js';

const root=document.querySelector('#app');
const STORE='renpet.settings.v1';
let data,selected,viewYear,viewMonth,tab='calendar',mode='month',openedFestival=null;
let prefs={language:'ar',gregorian:true,festivals:true,weeks:{}};
try{
 const saved=JSON.parse(localStorage.getItem(STORE)||'null');
 if(saved&&LOCALES[saved.language]){
  prefs.language=saved.language;
  for(const key of ['gregorian','festivals'])if(typeof saved[key]==='boolean')prefs[key]=saved[key];
  for(const lang of Object.keys(LOCALES))if([7,10].includes(saved.weeks?.[lang]))prefs.weeks[lang]=saved.weeks[lang];
 }
}catch{/* A restricted browser can still use Renpet in-memory. */}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>prefs.language,L=()=>LOCALES[lang()];
const week=()=>prefs.weeks[lang()]||(lang()==='ar'?7:10);
const num=n=>nativeNumber(n,lang());
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(prefs));}catch{}};
const today=()=>{const d=new Date();return dayNumber(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);};
const min=()=>dayNumber(data.min_date),max=()=>dayNumber(data.max_date);
const clamp=d=>Math.max(min(),Math.min(max(),d));
const icon=name=>{
 const shapes={calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h1M15 14h1M8 17h1M15 17h1"/>',star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.3l-5.7 2.9 1.1-6.2L2.9 9.6l6.3-.9Z"/>',settings:'<path d="m9.5 3-.6 2.4-2 .9-2.1-.7-2 3.4 1.7 1.8v2.4L2.8 15l2 3.4 2.1-.7 2 .9.6 2.4h5l.6-2.4 2-.9 2.1.7 2-3.4-1.7-1.8v-2.4l1.7-1.8-2-3.4-2.1.7-2-.9L14.5 3Z"/><circle cx="12" cy="12" r="3"/>',left:'<path d="m14 5-7 7 7 7"/>',right:'<path d="m10 5 7 7-7 7"/>'};
 return `<svg viewBox="0 0 24 24" aria-hidden="true" class="${['left','right'].includes(name)?'directional':''}">${shapes[name]}</svg>`;
};
function numberMarkup(n){
 if(lang()!=='egy')return esc(num(n));
 return `<img class="egy-numeral" src="assets/numerals/${n}.svg" alt="${esc(num(n))}">`;
}
function monthName(m){
 if(m===13)return L().epagomenal;
 if(lang()==='egy')return '𓇹'+nativeNumber((m-1)%4+1,'egy')+' '+data.seasons[Math.floor((m-1)/4)];
 return data.months[lang()][m-1];
}
function egyptianLabel(e){return `${num(e.day)} ${monthName(e.month)} · ${num(e.year)}`;}
function gregorianLabel(day,options={day:'numeric',month:'long',year:'numeric'}){
 return new Intl.DateTimeFormat(lang()==='ar'?'ar-EG-u-nu-arab':'en-GB',{...options,timeZone:'UTC'}).format(new Date(day*DAY));
}
function gregorianMarkup(day,options){
 if(!prefs.gregorian)return '';
 return `<div class="gregorian" lang="${lang()==='ar'?'ar':'en'}" dir="${lang()==='ar'?'rtl':'ltr'}">${esc(gregorianLabel(day,options))}</div>`;
}
function weekdayName(day){
 const i=(new Date(day*DAY).getUTCDay()+6)%7;
 // No invented ancient seven-day weekday lexicon: see LOCALIZATION.md.
 return L().weekdays?.[i]||'𓇳𓏤 '+num(i+1);
}
function rangeMarkup(y,m){
 if(!prefs.gregorian)return '';
 const start=toGregorian({year:y,month:m,day:1},data.years);
 const count=m===13?data.years.find(v=>v.year===y).days-360:30;
 return `<div class="range gregorian" lang="${lang()==='ar'?'ar':'en'}" dir="${lang()==='ar'?'rtl':'ltr'}">${esc(gregorianLabel(start,{day:'numeric',month:'long'}))} – ${esc(gregorianLabel(start+count-1,{day:'numeric',month:'long',year:'numeric'}))}</div>`;
}
function festivalName(f){
 // Arabic source names are preserved. Native labels plus IDs are used in the
 // other scripts until the festival-specific translations have been reviewed.
 return lang()==='ar'?f.ar:`${L().festival} ${num(data.festivals.findIndex(v=>v.id===f.id)+1)}`;
}
function festivalList(hits){
 return `<div class="festival-list">${hits.map(f=>{
  const e=toEgyptian(f.start,data.years);
  return `<div><button class="festival-item" data-festival="${esc(f.id)}" aria-expanded="${openedFestival===f.id}"><span class="star" aria-hidden="true">✦</span><span class="item-text">${esc(festivalName(f))}<small>${esc(num(e.day)+' '+monthName(e.month))}</small>${gregorianMarkup(f.start,{day:'numeric',month:'long'})}</span>${icon('right')}</button>${openedFestival===f.id?`<div class="festival-detail">${esc(lang()==='ar'?f.description_ar:egyptianLabel(e))}</div>`:''}</div>`;
 }).join('')}</div>`;
}
function header(){
 return `<header class="top"><div class="brand"><img src="assets/icon-180.png" alt=""><span>${esc(L().brand)}</span></div><button class="today-button" data-action="today">${esc(L().today)}</button></header>`;
}
function navigation(){
 return `<nav class="bottom-nav" aria-label="${esc(L().brand)}">${['calendar','festivals','settings'].map(t=>`<button data-tab="${t}" class="${t===tab?'active':''}" ${t===tab?'aria-current="page"':''}>${icon(t==='festivals'?'star':t)}<span>${esc(L()[t])}</span></button>`).join('')}</nav>`;
}
function arrows(){
 let previous=toGregorian({year:viewYear,month:viewMonth,day:1},data.years)-1;
 let next=toGregorian({year:viewYear,month:viewMonth,day:1},data.years)+(viewMonth===13?data.years.find(v=>v.year===viewYear).days-360:30);
 if(mode==='year'&&tab==='calendar'){
  previous=toGregorian({year:viewYear,month:1,day:1},data.years)-1;
  next=toGregorian({year:viewYear+1,month:1,day:1},data.years);
 }
 return `<div class="arrows"><button class="icon-button" data-action="previous" aria-label="${esc(L().previous)}" ${previous<min()?'disabled':''}>${icon('left')}</button><button class="icon-button" data-action="next" aria-label="${esc(L().next)}" ${next>max()?'disabled':''}>${icon('right')}</button></div>`;
}
function calendarView(){
 let html=`<div class="month-head"><div class="month-title"><h1>${esc(mode==='year'?L().year:monthName(viewMonth))}</h1><div class="year-line">${numberMarkup(viewYear)}</div></div>${arrows()}</div>`;
 html+=mode==='month'?rangeMarkup(viewYear,viewMonth):'';
 html+=`<div class="segments" aria-label="${esc(L().calendar)}">${['month','year'].map(v=>`<button data-mode="${v}" class="${mode===v?'active':''}" aria-pressed="${mode===v}">${esc(L()[v])}</button>`).join('')}</div>`;
 if(mode==='year'){
  html+='<div class="year-grid">';
  for(let m=1;m<=13;m++)html+=`<button class="month-tile" data-month="${m}"><div>${esc(monthName(m))}</div>${gregorianMarkup(toGregorian({year:viewYear,month:m,day:1},data.years),{day:'numeric',month:'short'})}</button>`;
  return html+'</div>';
 }
 const w=week(),cells=monthGrid(viewYear,viewMonth,w,data.years);
 const headers=Array.from({length:w},(_,i)=>{
  if(w===7)return `<div class="weekday ${lang()}" title="${esc(L().weekdays?.[i]||'𓇳𓏤 '+num(i+1))}">${esc(L().shortWeekdays?.[i]||'𓇳 '+num(i+1))}</div>`;
  const ordinal=lang()==='ar'?L().ordinal[i]:lang()==='cop'?'ⲙⲉϩ'+num(i+1):'𓎔'+num(i+1);
  return `<div class="weekday ${lang()}" title="${esc(ordinal)}">${lang()==='ar'?esc(num(i+1)):lang()==='egy'?'<span>𓎔</span>'+numberMarkup(i+1):esc(ordinal)}</div>`;
 }).join('');
 html+=`<section class="calendar-wrap ${w===10?'decade':''}" aria-label="${esc(monthName(viewMonth))}" style="--columns:${w}"><div class="grid headers">${headers}</div><div class="grid dates">${cells.map(cell=>{
  if(!cell)return '<div class="cell empty" aria-hidden="true"></div>';
  const day=cell.gregorian,disabled=day<min()||day>max(),hits=prefs.festivals?festivalHits(day,data.years,data.festivals):[];
  const e={year:viewYear,month:viewMonth,day:cell.day};
  return `<button class="cell ${day===selected?'selected':''} ${day===today()?'today':''}" data-day="${day}" aria-pressed="${day===selected}" aria-label="${esc(egyptianLabel(e)+(prefs.gregorian?' · '+gregorianLabel(day):'')+(hits.length?' · '+hits.map(festivalName).join(' · '):''))}" ${disabled?'disabled':''}><span class="primary">${numberMarkup(cell.day)}</span>${prefs.gregorian?`<span class="secondary" lang="${lang()==='ar'?'ar':'en'}" dir="${lang()==='ar'?'rtl':'ltr'}">${esc(lang()==='ar'?num(new Date(day*DAY).getUTCDate()):String(new Date(day*DAY).getUTCDate()))}</span>`:''}${hits.length?'<span class="festival-dot" aria-hidden="true"></span>':''}</button>`;
 }).join('')}</div></section>`;
 const e=toEgyptian(selected,data.years);
 html+=`<section class="selected-card" aria-live="polite"><h2>${numberMarkup(e.day)} <span>${esc(monthName(e.month))}</span></h2>${week()===7?`<div class="weekday-name">${esc(weekdayName(selected))}</div>`:''}${gregorianMarkup(selected)}</section>`;
 if(prefs.festivals)html+=festivalList(festivalHits(selected,data.years,data.festivals));
 return html;
}
function festivalsView(){
 let html=`<div class="month-head"><h1>${esc(L().festivals)}</h1>${arrows()}</div><div class="year-line">${esc(monthName(viewMonth))} · ${num(viewYear)}</div>${rangeMarkup(viewYear,viewMonth)}`;
 if(!prefs.festivals)return html+`<p class="empty-message">${esc(L().disabled)}</p>`;
 const first=toGregorian({year:viewYear,month:viewMonth,day:1},data.years),length=viewMonth===13?data.years.find(v=>v.year===viewYear).days-360:30;
 const hits=new Map();
 for(let d=first;d<first+length;d++)for(const f of festivalHits(d,data.years,data.festivals))hits.set(f.id,f);
 return html+(hits.size?festivalList([...hits.values()]):`<p class="empty-message">${esc(L().none)}</p>`);
}
function settingsView(){
 const label=(name,inner)=>`<div class="setting-row"><label class="setting-label" for="${name}">${esc(L()[name==='gregorian'?'gregorian':name==='festivals'?'festivalSetting':'week'])}</label>${inner}</div>`;
 return `<h1 class="view-title">${esc(L().settings)}</h1><section class="settings-section"><div class="setting-row"><label for="language">${esc(L().language)}</label><select id="language">${Object.entries(LOCALES).map(([id,l])=>`<option value="${id}" ${id===lang()?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div></section><section class="settings-section">${['gregorian','festivals'].map(name=>label(name,`<input type="checkbox" role="switch" class="switch" id="${name}" ${prefs[name]?'checked':''} aria-label="${esc(L()[name==='gregorian'?'gregorian':'festivalSetting'])}">`)).join('')}${label('week',`<select id="week"><option value="7" ${week()===7?'selected':''}>${esc(L().seven)}</option><option value="10" ${week()===10?'selected':''}>${esc(L().ten)}</option></select>`)}</section>`;
}
function render(){
 document.documentElement.lang=L().html;document.documentElement.dir=lang()==='ar'?'rtl':'ltr';document.body.dataset.language=lang();
 root.innerHTML=`<div class="shell">${header()}<main>${tab==='settings'?settingsView():tab==='festivals'?festivalsView():calendarView()}</main>${navigation()}</div>`;
}
root.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.tab){tab=button.dataset.tab;openedFestival=null;render();return;}
 if(button.dataset.mode){mode=button.dataset.mode;render();return;}
 if(button.dataset.month){viewMonth=Number(button.dataset.month);selected=clamp(toGregorian({year:viewYear,month:viewMonth,day:1},data.years));mode='month';render();return;}
 if(button.dataset.day){selected=Number(button.dataset.day);openedFestival=null;render();return;}
 if(button.dataset.festival){openedFestival=openedFestival===button.dataset.festival?null:button.dataset.festival;render();return;}
 const action=button.dataset.action;if(!action)return;
 if(action==='today'){selected=clamp(today());({year:viewYear,month:viewMonth}=toEgyptian(selected,data.years));tab='calendar';mode='month';}
 else if(action==='previous'||action==='next'){
  const offset=action==='previous'?-1:1;
  if(tab==='calendar'&&mode==='year'){viewYear+=offset;}
  else{viewMonth+=offset;if(viewMonth<1){viewMonth=13;viewYear--;}if(viewMonth>13){viewMonth=1;viewYear++;}}
  selected=clamp(toGregorian({year:viewYear,month:viewMonth,day:1},data.years));
 }
 openedFestival=null;render();
});
root.addEventListener('change',event=>{
 const input=event.target;
 if(input.id==='language'&&LOCALES[input.value])prefs.language=input.value;
 else if(input.id==='gregorian'||input.id==='festivals')prefs[input.id]=input.checked;
 else if(input.id==='week')prefs.weeks[lang()]=Number(input.value);
 save();render();
});
async function init(){
 try{
  const response=await fetch('./data.json');if(!response.ok)throw new Error('Calendar unavailable');data=await response.json();
  selected=clamp(today());({year:viewYear,month:viewMonth}=toEgyptian(selected,data.years));render();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Offline install:',error));
 }catch(error){root.innerHTML='<div class="error">رنبت · Ⲣⲉⲛⲡⲉⲧ · 𓆳𓏏𓏤<br>↻</div>';console.error(error);}
}
init();
