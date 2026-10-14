import {DAY,dayNumber,isoDate,toEgyptian,toGregorian,monthGrid,festivalHits,nativeNumber} from './calendar.js';
import {LOCALES} from './locales.js';
import {loadScheduler,saveScheduler,createItem,upsertItem,removeItem,itemsForDay,searchItems,createCalendar,updateCalendar,removeCalendar,toggleCompleted} from './scheduler.js';
import {openBackup} from './backup.js';

// Single owner of #app. No observers, shadow views, patched DOM or legacy year board.
const root=document.querySelector('#app'), SETTINGS='renpet.settings.v1', VIEWS='renpet.view.v3';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return dayNumber([d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'));};
const WORDS={
 ar:{day:'يوم',week:'أسبوع',month:'شهر',list:'قائمة',today:'اليوم',calendar:'التقويم',calendars:'التقاويم',festivals:'الأعياد',settings:'الإعدادات',search:'بحث',add:'إضافة',event:'موعد',reminder:'تذكير',title:'العنوان',location:'المكان',notes:'ملاحظات',date:'التاريخ المصري',start:'البداية',end:'النهاية',allDay:'طوال اليوم',repeat:'التكرار',alert:'التنبيه',none:'بدون',daily:'يومي',weekly:'أسبوعي',decan:'كل ١٠ أيام',monthly:'شهري مصري',yearly:'سنوي مصري',save:'حفظ',cancel:'إلغاء',delete:'حذف',confirm:'حذف هذا الموعد؟',noEvents:'لا توجد مواعيد',language:'اللغة',gregorian:'إظهار التاريخ الميلادي',festivalSetting:'إظهار الأعياد المصرية',weekLength:'أيام الأسبوع',backup:'النسخ الاحتياطي وتصدير ICS',manage:'إدارة التقاويم',newCalendar:'تقويم جديد',name:'الاسم',color:'اللون',show:'إظهار',hide:'إخفاء',done:'تم',view:'طريقة العرض',compact:'مختصر',stacked:'متراص',detailed:'تفصيلي',all:'الكل',results:'نتائج البحث',version:'الإصدار',time:'الوقت',minute:'دقيقة',hour:'ساعة',previous:'السابق',next:'التالي'},
 cop:{day:'Ϩⲟⲟⲩ',week:'Ⲉⲃⲇⲟⲙⲁⲥ',month:'Ⲉⲃⲟⲧ',list:'Ⲕⲁⲧⲁⲗⲟⲅⲟⲥ',today:'Ⲫⲟⲟⲩ',calendar:'Ⲡⲓϩⲙⲉ',calendars:'Ⲛⲓϩⲙⲉ',festivals:'Ⲛⲓϣⲁⲓ',settings:'Ⲛⲓⲥⲙⲓⲛⲉ',search:'Ϣⲓⲛⲓ',add:'Ⲧⲱⲟⲩⲛ',event:'Ⲉⲣⲅⲟⲛ',reminder:'Ⲣⲉⲙⲉⲙⲃⲉⲣ',title:'Ⲣⲁⲛ',location:'Ⲙⲁ',notes:'Ⲛⲓⲥⲁϫⲓ',date:'Ⲡⲓⲉϩⲟⲟⲩ',start:'Ⲁⲣⲭⲏ',end:'Ⲑⲁⲏ',allDay:'Ϩⲟⲟⲩ',repeat:'Ⲧⲱⲃϩ',alert:'Ⲁⲗⲉⲣⲧ',none:'—',daily:'Ϩⲟⲟⲩ',weekly:'Ⲉⲃⲇⲟⲙⲁⲥ',decan:'10',monthly:'Ⲉⲃⲟⲧ',yearly:'Ⲣⲟⲙⲡⲓ',save:'Ⲥⲱⲛϩ',cancel:'Ϣⲧⲁⲙ',delete:'Ⲃⲱⲗ',confirm:'Ⲃⲱⲗ?',noEvents:'Ⲙ̀ⲙⲟⲛ',language:'Ⲁⲥⲡⲓ',gregorian:'Gregorian',festivalSetting:'Ⲛⲓϣⲁⲓ',weekLength:'Ⲛⲓⲉϩⲟⲟⲩ',backup:'ICS · Ⲁⲛⲧⲓⲅⲣⲁⲫⲟⲛ',manage:'Ⲛⲓϩⲙⲉ',newCalendar:'Ⲃⲉⲣⲓ',name:'Ⲣⲁⲛ',color:'Ⲟⲩⲣⲱⲙⲓ',show:'Ⲟⲩⲱⲛϩ',hide:'Ϩⲱⲡ',done:'Ⲧⲉⲗⲟⲥ',view:'Ⲟⲩⲱⲛϩ',compact:'Ⲕⲟⲩϫⲓ',stacked:'Ⲥⲱⲟⲩϩ',detailed:'Ⲧⲉⲗⲓⲟⲥ',all:'Ⲧⲏⲣⲟⲩ',results:'Ⲛⲓⲉⲣⲅⲟⲛ',version:'Version',time:'Ⲟⲩⲛⲟⲩ',minute:'min',hour:'hour',previous:'Ϩⲁⲑⲏ',next:'Ⲥⲁ'},
 egy:{day:'𓇳',week:'𓇳𓏥',month:'𓇹',list:'𓏏𓏤',today:'𓇳',calendar:'𓆳𓏏',calendars:'𓆳𓏥',festivals:'𓎛𓂋𓏏',settings:'𓏞',search:'𓁹',add:'𓏭',event:'𓏏𓏤',reminder:'𓏏𓏥',title:'𓂋𓈖',location:'𓊖',notes:'𓏞',date:'𓆳',start:'𓄂',end:'𓏏',allDay:'𓇳',repeat:'𓎛𓂋',alert:'𓏭',none:'—',daily:'𓇳',weekly:'𓇳𓏥',decan:'𓎆',monthly:'𓇹',yearly:'𓆳',save:'𓏞',cancel:'𓐍',delete:'𓂧',confirm:'𓂧 ?',noEvents:'𓏏𓏤 —',language:'𓂋𓈖',gregorian:'Gregorian',festivalSetting:'𓎛𓂋𓏏',weekLength:'𓇳𓏥',backup:'ICS ↓',manage:'𓆳𓏥',newCalendar:'𓆳𓏏',name:'𓂋𓈖',color:'𓇋𓈖',show:'𓁹',hide:'𓏏',done:'𓏞',view:'𓁹',compact:'𓏏',stacked:'𓏥',detailed:'𓂋𓏤',all:'𓏥',results:'𓏏𓏥',version:'v',time:'𓇳',minute:'𓏏',hour:'𓇳',previous:'𓄂',next:'𓏭'}
};
let schedule=loadScheduler();
let data=null,prefs={language:'ar',gregorian:true,festivals:true,weeks:{}},state={tab:'calendar',view:'month',focus:today(),display:'compact',menu:false,search:false,query:'',dialog:null,festival:null,manage:false};
try{const x=JSON.parse(localStorage.getItem(SETTINGS)||'null');if(x){if(LOCALES[x.language])prefs.language=x.language;if(typeof x.gregorian==='boolean')prefs.gregorian=x.gregorian;if(typeof x.festivals==='boolean')prefs.festivals=x.festivals;if(x.weeks&&typeof x.weeks==='object')prefs.weeks=x.weeks;}}catch{}
try{const x=JSON.parse(localStorage.getItem(VIEWS)||'null');if(['day','week','month','list'].includes(x?.view))state.view=x.view;if(['compact','stacked','detailed'].includes(x?.display))state.display=x.display;}catch{}
const lang=()=>prefs.language,T=()=>WORDS[lang()],N=n=>nativeNumber(n,lang());
const week=()=>[7,10].includes(prefs.weeks[lang()])?prefs.weeks[lang()]:(lang()==='ar'?7:10);
const min=()=>dayNumber(data.min_date),max=()=>dayNumber(data.max_date),clamp=d=>Math.min(max(),Math.max(min(),d));
const savePrefs=()=>{try{localStorage.setItem(SETTINGS,JSON.stringify(prefs));}catch{}};
const saveView=()=>{try{localStorage.setItem(VIEWS,JSON.stringify({view:state.view,display:state.display}));}catch{}};
const egy=d=>toEgyptian(d,data.years);
const monthName=m=>m===13?LOCALES[lang()].epagomenal:lang()==='egy'?('𓇹 '+N(m)):data.months[lang()][m-1];
const numHtml=n=>lang()==='egy'?'<img class="glyph" src="assets/numerals/'+n+'.svg" alt="'+safe(N(n))+'">':safe(N(n));
const greg=(d,opts={day:'numeric',month:'short'})=>new Intl.DateTimeFormat(lang()==='ar'?'ar-EG-u-nu-arab':'en-GB',{...opts,timeZone:'UTC'}).format(new Date(d*DAY));
const monthDays=e=>e.month===13?data.years.find(y=>y.year===e.year).days-360:30;
const monthStart=e=>toGregorian({year:e.year,month:e.month,day:1},data.years);
const adjacent=(e,delta)=>{let m=e.month+delta,y=e.year;while(m>13){m-=13;y++;}while(m<1){m+=13;y--;}return data.years.some(v=>v.year===y)?{year:y,month:m,day:1}:null;};
const calName=c=>c.name?.[lang()]||c.name?.ar||c.id;
const items=d=>itemsForDay(schedule,d,data.years);
const icon=name=>{const p={back:'<path d="m15 5-7 7 7 7"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',plus:'<path d="M12 4v16M4 12h16"/>',list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',settings:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',star:'<path d="m12 2 3 7 7 .5-5.5 5 1.5 7L12 18l-6 3.5 1.5-7L2 9.5 9 9Z"/>',check:'<path d="m4 12 5 5L20 6"/>'};return '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p[name]+'</svg>';};
function eventRow(i,day=state.focus){
 const cal=schedule.calendars.find(c=>c.id===i.calendarId),color=/^#[0-9a-f]{6}$/i.test(cal?.color)?cal.color:'#187568';
 const clock=i.allDay?T().allDay:String(Math.floor(i.startMinutes/60)).padStart(2,'0')+':'+String(i.startMinutes%60).padStart(2,'0');
 return '<button class="event-row" data-edit="'+safe(i.id)+'" style="--event:'+color+'"><span class="event-clock">'+safe(clock)+'</span><span class="event-copy"><strong>'+safe(i.title)+'</strong>'+(state.display==='detailed'&&i.location?'<small>'+safe(i.location)+'</small>':'')+'</span>'+(i.kind==='reminder'?'<span class="reminder-box" data-complete="'+safe(i.id)+'">'+icon('check')+'</span>':'')+'</button>';
}
function agenda(d){const a=items(d);return '<section class="agenda"><h3>'+numHtml(egy(d).day)+' '+safe(monthName(egy(d).month))+'</h3>'+(prefs.gregorian?'<p class="subtle">'+safe(greg(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</p>':'')+(a.length?a.map(i=>eventRow(i,d)).join(''):'<p class="empty">'+safe(T().noEvents)+'</p>')+'</section>';}
function monthSection(e){
 const start=monthStart(e),w=week(),cells=monthGrid(e.year,e.month,w,data.years);
 const headers=Array.from({length:w},(_,i)=>w===7?(LOCALES[lang()].shortWeekdays?.[i]||N(i+1)):N(i+1)).map(v=>'<span>'+safe(v)+'</span>').join('');
 const grid=cells.map(c=>{if(!c)return '<span class="blank"></span>';const d=c.gregorian,ev=items(d),hits=prefs.festivals?festivalHits(d,data.years,data.festivals):[];
 return '<button class="date '+(d===state.focus?'chosen ':'')+(d===today()?'is-today':'')+'" data-date="'+d+'" aria-pressed="'+(d===state.focus)+'"><span class="day-number">'+numHtml(c.day)+'</span>'+(prefs.gregorian?'<small>'+safe(greg(d,{day:'numeric'}))+'</small>':'')+'<span class="dots">'+ev.slice(0,3).map(i=>{const col=schedule.calendars.find(x=>x.id===i.calendarId)?.color||'#187568';return '<i style="background:'+(/^#[0-9a-f]{6}$/i.test(col)?col:'#187568')+'"></i>';}).join('')+'</span>'+(hits.length?'<em class="fest-mark">✦</em>':'')+'</button>';}).join('');
 return '<section class="month-section"><h2>'+safe(monthName(e.month))+' <small>'+numHtml(e.year)+'</small></h2>'+(prefs.gregorian?'<p class="subtle">'+safe(greg(start,{day:'numeric',month:'short'}))+' – '+safe(greg(start+monthDays(e)-1,{day:'numeric',month:'short'}))+'</p>':'')+'<div class="week-headers" style="--cols:'+w+'">'+headers+'</div><div class="dates" style="--cols:'+w+'">'+grid+'</div></section>';
}
function monthView(){const e=egy(state.focus),next=adjacent(e,1);return '<div class="month-scroll">'+monthSection(e)+(next?monthSection(next):'')+'</div>';}
function dayView(){
 const all=items(state.focus).filter(i=>i.allDay),timed=items(state.focus).filter(i=>!i.allDay);
 const rows=Array.from({length:24},(_,h)=>'<div class="hour-row"><span>'+String(h).padStart(2,'0')+':00</span><div>'+timed.filter(i=>Math.floor(i.startMinutes/60)===h).map(i=>eventRow(i)).join('')+'</div></div>').join('');
 return '<div class="day-page">'+agenda(state.focus)+(all.length?'<div class="all-day">'+all.map(i=>eventRow(i)).join('')+'</div>':'')+'<div class="hours">'+rows+'</div></div>';
}
function weekView(){
 const w=week(),e=egy(state.focus),start=w===10?state.focus-(e.day-1)%10:state.focus-(new Date(state.focus*DAY).getUTCDay()+6)%7;
 return '<div class="week-page"><div class="week-strip" style="--cols:'+w+'">'+Array.from({length:w},(_,i)=>{const d=start+i;return '<button class="'+(d===state.focus?'active':'')+'" data-pick="'+d+'"><small>'+(w===7?safe(LOCALES[lang()].shortWeekdays?.[i]||N(i+1)):numHtml(i+1))+'</small><strong>'+numHtml(egy(d).day)+'</strong></button>';}).join('')+'</div>'+agenda(state.focus)+'</div>';
}
function listView(){const groups=[];for(let d=state.focus;d<=Math.min(max(),state.focus+59);d++)if(items(d).length)groups.push(agenda(d));return '<div class="list-page">'+(groups.join('')||'<p class="empty">'+safe(T().noEvents)+'</p>')+'</div>';}
function festivalView(){
 if(!prefs.festivals)return '<p class="empty">'+safe(T().noEvents)+'</p>';
 const e=egy(state.focus),start=monthStart(e),found=new Map();
 for(let d=start;d<start+monthDays(e);d++)for(const f of festivalHits(d,data.years,data.festivals))found.set(f.id,f);
 return '<section class="page"><h1>'+safe(T().festivals)+'</h1><p>'+safe(monthName(e.month))+' '+numHtml(e.year)+'</p><div class="festival-list">'+([...found.values()].map(f=>'<button class="festival" data-festival="'+safe(f.id)+'"><span>✦</span><strong>'+safe(lang()==='ar'?f.ar:T().festivals)+'</strong><small>'+safe(greg(f.start))+'</small></button>'+(state.festival===f.id?'<p class="festival-detail">'+safe(lang()==='ar'?f.description_ar:monthName(egy(f.start).month))+'</p>':'')).join('')||'<p class="empty">'+safe(T().noEvents)+'</p>')+'</div></section>';
}
function settingsView(){
 return '<section class="page"><h1>'+safe(T().settings)+'</h1><div class="settings-group"><label>'+safe(T().language)+'<select name="language">'+Object.entries(LOCALES).map(([id,v])=>'<option value="'+id+'" '+(id===lang()?'selected':'')+'>'+safe(v.name)+'</option>').join('')+'</select></label><label>'+safe(T().gregorian)+'<input type="checkbox" name="gregorian" '+(prefs.gregorian?'checked':'')+'></label><label>'+safe(T().festivalSetting)+'<input type="checkbox" name="festivals" '+(prefs.festivals?'checked':'')+'></label><label>'+safe(T().weekLength)+'<select name="week">'+[7,10].map(n=>'<option value="'+n+'" '+(n===week()?'selected':'')+'>'+N(n)+'</option>').join('')+'</select></label></div><div class="settings-group"><button class="setting-action" data-backup>'+safe(T().backup)+' ›</button><button class="setting-action" data-manage>'+safe(T().manage)+' ›</button></div><p class="build-label">'+safe(T().version)+' 0.9.0</p></section>';
}
function managerView(){
 const a=schedule;
 return '<section class="page"><h1>'+safe(T().calendars)+'</h1><div class="settings-group">'+a.calendars.map(c=>'<div class="cal-row"><input type="checkbox" data-visible="'+safe(c.id)+'" '+(c.visible!==false?'checked':'')+'><span class="color-dot" style="background:'+safe(c.color)+'"></span><span>'+safe(calName(c))+'</span>'+(c.custom?'<button data-remove-cal="'+safe(c.id)+'" aria-label="'+safe(T().delete)+'">×</button>':'')+'</div>').join('')+'</div><form id="new-calendar" class="settings-group"><label>'+safe(T().newCalendar)+'<input name="name" required maxlength="80" placeholder="'+safe(T().name)+'"></label><label>'+safe(T().color)+'<input type="color" name="color" value="#187568"></label><button class="primary" type="submit">'+safe(T().add)+'</button></form></section>';
}
function nav(){return '<nav class="bottom-nav"><button data-today>'+safe(T().today)+'</button><button data-tab="calendar" class="'+(state.tab==='calendar'?'active':'')+'">'+icon('calendar')+'<small>'+safe(T().calendar)+'</small></button><button data-manage>'+safe(T().calendars)+'</button><button data-tab="festivals" class="'+(state.tab==='festivals'?'active':'')+'">'+icon('star')+'<small>'+safe(T().festivals)+'</small></button><button data-tab="settings" class="'+(state.tab==='settings'?'active':'')+'">'+icon('settings')+'<small>'+safe(T().settings)+'</small></button></nav>';}
function toolbar(){
 const e=egy(state.focus);
 return '<header class="toolbar"><div class="tool-row"><button data-back aria-label="'+safe(T().previous)+'">'+icon('back')+'<span>'+numHtml(e.year)+'</span></button><div class="tool-actions"><button data-search aria-label="'+safe(T().search)+'">'+icon('search')+'</button><button data-menu aria-label="'+safe(T().view)+'">'+icon('list')+'</button><button data-new aria-label="'+safe(T().add)+'">'+icon('plus')+'</button></div></div><div class="headline"><h1>'+(state.view==='day'?numHtml(e.day)+' ':'')+safe(monthName(e.month))+'</h1><div><button data-prev aria-label="'+safe(T().previous)+'">‹</button><button data-next aria-label="'+safe(T().next)+'">›</button></div></div>'+(state.menu?'<div class="view-menu"><div class="segmented">'+['day','week','month','list'].map(v=>'<button data-view="'+v+'" class="'+(v===state.view?'active':'')+'">'+safe(T()[v])+'</button>').join('')+'</div><label>'+safe(T().view)+'<select name="display">'+['compact','stacked','detailed'].map(v=>'<option value="'+v+'" '+(state.display===v?'selected':'')+'>'+safe(T()[v])+'</option>').join('')+'</select></label></div>':'')+(state.search?'<div class="search-panel"><input type="search" name="query" value="'+safe(state.query)+'" placeholder="'+safe(T().search)+'" autocomplete="off"><div class="search-results">'+searchResults()+'</div></div>':'')+'</header>';
}
function searchResults(){return searchItems(schedule,state.query).slice(0,60).map(i=>'<button data-result="'+i.startDay+'"><strong>'+safe(i.title)+'</strong><small>'+safe(greg(i.startDay))+'</small></button>').join('')||'<p class="empty">'+safe(T().noEvents)+'</p>';}
function dateFields(d){const e=egy(d);return '<div class="date-fields"><input name="egyYear" type="number" min="'+data.years[0].year+'" max="'+data.years.at(-1).year+'" value="'+e.year+'" required><select name="egyMonth">'+Array.from({length:13},(_,i)=>'<option value="'+(i+1)+'" '+(e.month===i+1?'selected':'')+'>'+safe(monthName(i+1))+'</option>').join('')+'</select><select name="egyDay">'+Array.from({length:30},(_,i)=>'<option value="'+(i+1)+'" '+(e.day===i+1?'selected':'')+'>'+N(i+1)+'</option>').join('')+'</select></div><small class="date-preview">'+safe(greg(d,{day:'numeric',month:'long',year:'numeric'}))+'</small>';}
const timeString=n=>String(Math.floor((n||0)/60)).padStart(2,'0')+':'+String((n||0)%60).padStart(2,'0');
function editor(){
 const item=state.dialog?.id?schedule.items.find(i=>i.id===state.dialog.id):null,d=item?.startDay??state.focus,kind=item?.kind||state.dialog?.kind||'event';
 const sched=schedule;
 return '<div class="sheet-overlay"><form id="event-editor" class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><button type="button" data-close>'+safe(T().cancel)+'</button><strong>'+safe(item?T().event:T().add)+'</strong><button class="save-button" type="submit">'+safe(T().save)+'</button></div><div class="sheet-body"><div class="kind-toggle"><label><input type="radio" name="kind" value="event" '+(kind==='event'?'checked':'')+'>'+safe(T().event)+'</label><label><input type="radio" name="kind" value="reminder" '+(kind==='reminder'?'checked':'')+'>'+safe(T().reminder)+'</label></div><label>'+safe(T().title)+'<input name="title" required maxlength="200" value="'+safe(item?.title||'')+'"></label><label>'+safe(T().date)+dateFields(d)+'</label><label class="check-row">'+safe(T().allDay)+'<input type="checkbox" name="allDay" '+(item?.allDay?'checked':'')+'></label><div class="time-fields"><label>'+safe(T().start)+'<input type="time" name="start" value="'+timeString(item?.startMinutes??540)+'"></label><label>'+safe(T().end)+'<input type="time" name="end" value="'+timeString(item?.endMinutes??600)+'"></label></div><label>'+safe(T().location)+'<input name="location" maxlength="300" value="'+safe(item?.location||'')+'"></label><label>'+safe(T().notes)+'<textarea name="notes" rows="3">'+safe(item?.notes||'')+'</textarea></label><label>'+safe(T().calendars)+'<select name="calendarId">'+sched.calendars.map(c=>'<option value="'+safe(c.id)+'" '+(c.id===(item?.calendarId||sched.calendars[0].id)?'selected':'')+'>'+safe(calName(c))+'</option>').join('')+'</select></label><label>'+safe(T().repeat)+'<select name="repeat">'+[['none',T().none],['daily',T().daily],['weekly',T().weekly],['egy10',T().decan],['egyMonthly',T().monthly],['egyYearly',T().yearly]].map(([v,n])=>'<option value="'+v+'" '+((item?.repeat||'none')===v?'selected':'')+'>'+safe(n)+'</option>').join('')+'</select></label><label>'+safe(T().alert)+'<select name="alert">'+[['none',T().none],['atTime','0'],['5min','5'],['15min','15'],['1hour','60'],['1day','1440']].map(([v,n])=>'<option value="'+v+'" '+((item?.alert||'none')===v?'selected':'')+'>'+safe(n)+'</option>').join('')+'</select></label>'+(item?'<button type="button" class="delete" data-delete="'+safe(item.id)+'">'+safe(T().delete)+'</button>':'')+'</div></form></div>';
}
function render(){
 if(!data)return;
 schedule=loadScheduler();
 document.documentElement.lang=LOCALES[lang()].html;document.documentElement.dir=lang()==='ar'?'rtl':'ltr';document.body.dataset.language=lang();
 const content=state.manage?managerView():state.tab==='settings'?settingsView():state.tab==='festivals'?festivalView():state.view==='day'?dayView():state.view==='week'?weekView():state.view==='list'?listView():monthView();
 root.innerHTML='<div class="app-shell">'+(state.tab==='calendar'&&!state.manage?toolbar():'<header class="simple-header"><button data-return>'+icon('back')+'</button><span>Renpet</span></header>')+'<main class="main-scroll" id="main-content">'+content+'</main>'+nav()+'</div>'+(state.dialog?editor():'');
}
function navigate(step){
 if(state.view==='day')state.focus+=step;
 else if(state.view==='week')state.focus+=step*week();
 else if(state.view==='list')state.focus+=step*30;
 else{const e=egy(state.focus),next=adjacent(e,step);if(next)state.focus=monthStart(next)+Math.min(e.day,monthDays(next))-1;}
 state.focus=clamp(state.focus);render();
}
function submitEvent(form){
 const f=new FormData(form),y=Number(f.get('egyYear')),m=Number(f.get('egyMonth')),d=Number(f.get('egyDay'));
 if(!data.years.some(x=>x.year===y)||m<1||m>13||d<1||d>monthDays({year:y,month:m})){alert('Invalid Egyptian date');return;}
 const startDay=toGregorian({year:y,month:m,day:d},data.years);
 const time=v=>{const [h,min]=String(v||'09:00').split(':').map(Number);return h*60+min;};
 const startMinutes=time(f.get('start')),endMinutes=time(f.get('end'));
 if(!f.has('allDay')&&endMinutes<=startMinutes){alert('End time must follow start time');return;}
 const vals={kind:f.get('kind'),title:f.get('title'),startDay,endDay:startDay,startMinutes,endMinutes,allDay:f.has('allDay'),location:f.get('location'),notes:f.get('notes'),calendarId:f.get('calendarId'),repeat:f.get('repeat'),alert:f.get('alert')};
 const sched=loadScheduler(),existing=state.dialog?.id?sched.items.find(i=>i.id===state.dialog.id):null;
 const item=existing?{...existing,...vals,updatedAt:new Date().toISOString()}:createItem(vals);
 upsertItem(sched,item);
 if(!saveScheduler(sched)){alert('Unable to save event');return;}
 state.dialog=null;state.focus=clamp(startDay);render();
}
root.addEventListener('click',ev=>{
 const complete=ev.target.closest('[data-complete]');
 if(complete){const sched=loadScheduler(),item=sched.items.find(i=>i.id===complete.dataset.complete);if(item){toggleCompleted(item,state.focus);saveScheduler(sched);render();}return;}
 const b=ev.target.closest('button');if(!b||b.disabled)return;
 if(b.hasAttribute('data-close')){state.dialog=null;render();return;}
 if(b.hasAttribute('data-new')){state.dialog={kind:'event'};render();root.querySelector('[name="title"]')?.focus();return;}
 if(b.hasAttribute('data-edit')){state.dialog={id:b.dataset.edit};render();return;}
 if(b.hasAttribute('data-delete')){if(confirm(T().confirm)){const s=loadScheduler();removeItem(s,b.dataset.delete);saveScheduler(s);state.dialog=null;render();}return;}
 if(b.hasAttribute('data-complete')){const s=loadScheduler(),item=s.items.find(i=>i.id===b.dataset.complete);if(item){toggleCompleted(item,state.focus);saveScheduler(s);render();}return;}
 if(b.hasAttribute('data-menu')){state.menu=!state.menu;render();return;}
 if(b.hasAttribute('data-search')){state.search=!state.search;state.query='';render();if(state.search)root.querySelector('[name="query"]')?.focus();return;}
 if(b.hasAttribute('data-view')){state.view=b.dataset.view;state.menu=false;saveView();render();return;}
 if(b.hasAttribute('data-date')){state.focus=clamp(Number(b.dataset.date));state.view='day';saveView();render();return;}
 if(b.hasAttribute('data-pick')){state.focus=clamp(Number(b.dataset.pick));render();return;}
 if(b.hasAttribute('data-result')){state.focus=clamp(Number(b.dataset.result));state.view='day';state.search=false;saveView();render();return;}
 if(b.hasAttribute('data-prev')){navigate(-1);return;}
 if(b.hasAttribute('data-next')){navigate(1);return;}
 if(b.hasAttribute('data-back')){if(state.view!=='month'){state.view='month';saveView();render();}else{const e=egy(state.focus),p=adjacent(e,-1);if(p){state.focus=monthStart(p);render();}}return;}
 if(b.hasAttribute('data-today')){state.focus=clamp(today());state.tab='calendar';state.manage=false;state.view='day';saveView();render();return;}
 if(b.hasAttribute('data-tab')){state.tab=b.dataset.tab;state.manage=false;state.menu=false;state.search=false;render();return;}
 if(b.hasAttribute('data-return')){state.tab='calendar';state.manage=false;render();return;}
 if(b.hasAttribute('data-manage')){state.manage=true;render();return;}
 if(b.hasAttribute('data-backup')){openBackup();return;}
 if(b.hasAttribute('data-festival')){state.festival=state.festival===b.dataset.festival?null:b.dataset.festival;render();return;}
 if(b.hasAttribute('data-remove-cal')){const s=loadScheduler();removeCalendar(s,b.dataset.removeCal);saveScheduler(s);render();return;}
});
root.addEventListener('change',ev=>{
 const el=ev.target;
 if(el.name==='language'&&LOCALES[el.value])prefs.language=el.value;
 else if(el.name==='gregorian'||el.name==='festivals')prefs[el.name]=el.checked;
 else if(el.name==='week')prefs.weeks[lang()]=Number(el.value);
 else if(el.name==='display'){state.display=el.value;saveView();render();return;}
 else if(el.hasAttribute('data-visible')){const s=loadScheduler();updateCalendar(s,el.dataset.visible,{visible:el.checked});saveScheduler(s);render();return;}
 else if(el.closest('#event-editor')&&['egyYear','egyMonth','egyDay'].includes(el.name)){
  const form=el.form,y=Number(form.elements.egyYear.value),m=Number(form.elements.egyMonth.value),d=Number(form.elements.egyDay.value);
  const preview=form.querySelector('.date-preview');
  if(preview)preview.textContent=data.years.some(x=>x.year===y)&&d<=monthDays({year:y,month:m})?greg(toGregorian({year:y,month:m,day:d},data.years),{day:'numeric',month:'long',year:'numeric'}):'—';
  return;
 }else return;
 savePrefs();render();
});
root.addEventListener('input',ev=>{if(ev.target.name==='query'){state.query=ev.target.value;const r=root.querySelector('.search-results');if(r)r.innerHTML=searchResults();}});
root.addEventListener('submit',ev=>{
 if(ev.target.id==='event-editor'){ev.preventDefault();submitEvent(ev.target);}
 if(ev.target.id==='new-calendar'){ev.preventDefault();const f=new FormData(ev.target),s=loadScheduler();if(createCalendar(s,f.get('name'),f.get('color'))){saveScheduler(s);render();}}
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&state.dialog){state.dialog=null;render();}});
async function init(){
 try{const r=await fetch('./data.json');if(!r.ok)throw Error('Calendar data unavailable');data=await r.json();state.focus=clamp(state.focus);render();
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(console.warn);}
 }catch(e){root.textContent='Renpet: '+e.message;console.error(e);}
}
init();
