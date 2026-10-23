import {DAY,dayNumber,isoDate,toEgyptian,toGregorian,monthGrid,festivalHits,nativeNumber} from './calendar.js';
import {LOCALES} from './locales.js';
import {loadScheduler,saveScheduler,createItem,upsertItem,removeItem,itemsForDay,searchItems,createCalendar,updateCalendar,removeCalendar,toggleCompleted} from './scheduler.js';
import {openBackup} from './backup.js';

// Single owner of #app. No observers, shadow views, patched DOM or legacy year board.
const root=document.querySelector('#app'), SETTINGS='renpet.settings.v1', VIEWS='renpet.view.v4';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return dayNumber([d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'));};
const WORDS={
 ar:{day:'يوم',week:'أسبوع',month:'شهر',list:'قائمة',today:'اليوم',calendar:'التقويم',calendars:'التقاويم',festivals:'الأعياد',settings:'الإعدادات',search:'بحث',add:'إضافة',event:'موعد',reminder:'تذكير',title:'العنوان',location:'المكان',notes:'ملاحظات',date:'التاريخ المصري',start:'البداية',end:'النهاية',allDay:'طوال اليوم',repeat:'التكرار',alert:'التنبيه',none:'بدون',daily:'يومي',weekly:'أسبوعي',decan:'كل ١٠ أيام',monthly:'شهري مصري',yearly:'سنوي مصري',save:'حفظ',cancel:'إلغاء',delete:'حذف',confirm:'حذف هذا الموعد؟',noEvents:'لا توجد مواعيد',language:'اللغة',gregorian:'إظهار التاريخ الميلادي',festivalSetting:'إظهار الأعياد المصرية',weekLength:'أيام الأسبوع',backup:'النسخ الاحتياطي وتصدير ICS',manage:'إدارة التقاويم',newCalendar:'تقويم جديد',name:'الاسم',color:'اللون',show:'إظهار',hide:'إخفاء',done:'تم',view:'طريقة العرض',compact:'مختصر',stacked:'متراص',detailed:'تفصيلي',all:'الكل',results:'نتائج البحث',version:'الإصدار',time:'الوقت',minute:'دقيقة',hour:'ساعة',previous:'السابق',next:'التالي'},
 cop:{day:'Ϩⲟⲟⲩ',week:'Ⲉⲃⲇⲟⲙⲁⲥ',month:'Ⲉⲃⲟⲧ',list:'Ⲕⲁⲧⲁⲗⲟⲅⲟⲥ',today:'Ⲫⲟⲟⲩ',calendar:'Ⲡⲓϩⲙⲉ',calendars:'Ⲛⲓϩⲙⲉ',festivals:'Ⲛⲓϣⲁⲓ',settings:'Ⲛⲓⲥⲙⲓⲛⲉ',search:'Ϣⲓⲛⲓ',add:'Ⲧⲱⲟⲩⲛ',event:'Ⲉⲣⲅⲟⲛ',reminder:'Ⲣⲉⲙⲉⲙⲃⲉⲣ',title:'Ⲣⲁⲛ',location:'Ⲙⲁ',notes:'Ⲛⲓⲥⲁϫⲓ',date:'Ⲡⲓⲉϩⲟⲟⲩ',start:'Ⲁⲣⲭⲏ',end:'Ⲑⲁⲏ',allDay:'Ϩⲟⲟⲩ',repeat:'Ⲧⲱⲃϩ',alert:'Ⲁⲗⲉⲣⲧ',none:'—',daily:'Ϩⲟⲟⲩ',weekly:'Ⲉⲃⲇⲟⲙⲁⲥ',decan:'10',monthly:'Ⲉⲃⲟⲧ',yearly:'Ⲣⲟⲙⲡⲓ',save:'Ⲥⲱⲛϩ',cancel:'Ϣⲧⲁⲙ',delete:'Ⲃⲱⲗ',confirm:'Ⲃⲱⲗ?',noEvents:'Ⲙ̀ⲙⲟⲛ',language:'Ⲁⲥⲡⲓ',gregorian:'Gregorian',festivalSetting:'Ⲛⲓϣⲁⲓ',weekLength:'Ⲛⲓⲉϩⲟⲟⲩ',backup:'ICS · Ⲁⲛⲧⲓⲅⲣⲁⲫⲟⲛ',manage:'Ⲛⲓϩⲙⲉ',newCalendar:'Ⲃⲉⲣⲓ',name:'Ⲣⲁⲛ',color:'Ⲟⲩⲣⲱⲙⲓ',show:'Ⲟⲩⲱⲛϩ',hide:'Ϩⲱⲡ',done:'Ⲧⲉⲗⲟⲥ',view:'Ⲟⲩⲱⲛϩ',compact:'Ⲕⲟⲩϫⲓ',stacked:'Ⲥⲱⲟⲩϩ',detailed:'Ⲧⲉⲗⲓⲟⲥ',all:'Ⲧⲏⲣⲟⲩ',results:'Ⲛⲓⲉⲣⲅⲟⲛ',version:'Version',time:'Ⲟⲩⲛⲟⲩ',minute:'min',hour:'hour',previous:'Ϩⲁⲑⲏ',next:'Ⲥⲁ'},
 egy:{day:'𓇳',week:'𓇳𓏥',month:'𓇹',list:'𓏏𓏤',today:'𓇳',calendar:'𓆳𓏏',calendars:'𓆳𓏥',festivals:'𓎛𓂋𓏏',settings:'𓏞',search:'𓁹',add:'𓏭',event:'𓏏𓏤',reminder:'𓏏𓏥',title:'𓂋𓈖',location:'𓊖',notes:'𓏞',date:'𓆳',start:'𓄂',end:'𓏏',allDay:'𓇳',repeat:'𓎛𓂋',alert:'𓏭',none:'—',daily:'𓇳',weekly:'𓇳𓏥',decan:'𓎆',monthly:'𓇹',yearly:'𓆳',save:'𓏞',cancel:'𓐍',delete:'𓂧',confirm:'𓂧 ?',noEvents:'𓏏𓏤 —',language:'𓂋𓈖',gregorian:'Gregorian',festivalSetting:'𓎛𓂋𓏏',weekLength:'𓇳𓏥',backup:'ICS ↓',manage:'𓆳𓏥',newCalendar:'𓆳𓏏',name:'𓂋𓈖',color:'𓇋𓈖',show:'𓁹',hide:'𓏏',done:'𓏞',view:'𓁹',compact:'𓏏',stacked:'𓏥',detailed:'𓂋𓏤',all:'𓏥',results:'𓏏𓏥',version:'v',time:'𓇳',minute:'𓏏',hour:'𓇳',previous:'𓄂',next:'𓏭'}
};
let schedule=loadScheduler();
let previousRenderKey=null;
let data=null,prefs={language:'ar',gregorian:true,festivals:true,weeks:{}},state={view:'month',focus:today(),panel:null,more:false,search:false,query:'',dialog:null,festival:null};
try{const x=JSON.parse(localStorage.getItem(SETTINGS)||'null');if(x){if(LOCALES[x.language])prefs.language=x.language;if(typeof x.gregorian==='boolean')prefs.gregorian=x.gregorian;if(typeof x.festivals==='boolean')prefs.festivals=x.festivals;if(x.weeks&&typeof x.weeks==='object')prefs.weeks=x.weeks;}}catch{}
try{const x=JSON.parse(localStorage.getItem(VIEWS)||'null');if(['year','day','month','list'].includes(x?.view))state.view=x.view;}catch{}
const lang=()=>prefs.language,T=()=>WORDS[lang()],N=n=>nativeNumber(n,lang());
const week=()=>[7,10].includes(prefs.weeks[lang()])?prefs.weeks[lang()]:(lang()==='ar'?7:10);
const min=()=>dayNumber(data.min_date),max=()=>dayNumber(data.max_date),clamp=d=>Math.min(max(),Math.max(min(),d));
const savePrefs=()=>{try{localStorage.setItem(SETTINGS,JSON.stringify(prefs));}catch{}};
const saveView=()=>{try{localStorage.setItem(VIEWS,JSON.stringify({view:state.view}));}catch{}};
const egy=d=>toEgyptian(d,data.years);
const monthName=m=>m===13?LOCALES[lang()].epagomenal:lang()==='egy'?('𓇹 '+N(m)):data.months[lang()][m-1];
const numHtml=n=>lang()==='egy'&&n<=333?'<img class="glyph" src="assets/numerals/'+n+'.svg" alt="'+safe(N(n))+'">':safe(N(n));
const greg=(d,opts={day:'numeric',month:'short'})=>new Intl.DateTimeFormat(lang()==='ar'?'ar-EG-u-nu-arab':'en-GB',{...opts,timeZone:'UTC'}).format(new Date(d*DAY));
const monthDays=e=>e.month===13?data.years.find(y=>y.year===e.year).days-360:30;
const monthStart=e=>toGregorian({year:e.year,month:e.month,day:1},data.years);
const yearStart=y=>dayNumber(data.years.find(v=>v.year===y).start);
const adjacent=(e,delta)=>{let m=e.month+delta,y=e.year;while(m>13){m-=13;y++;}while(m<1){m+=13;y--;}return data.years.some(v=>v.year===y)?{year:y,month:m,day:1}:null;};
const calName=c=>c.name?.[lang()]||c.name?.ar||c.id;
const items=d=>itemsForDay(schedule,d,data.years);
const icon=name=>{const p={back:'<path d="m15 5-7 7 7 7"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',plus:'<path d="M12 4v16M4 12h16"/>',list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',settings:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',star:'<path d="m12 2 3 7 7 .5-5.5 5 1.5 7L12 18l-6 3.5 1.5-7L2 9.5 9 9Z"/>',check:'<path d="m4 12 5 5L20 6"/>'};return '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p[name]+'</svg>';};
function eventRow(i,day=state.focus){
 const cal=schedule.calendars.find(c=>c.id===i.calendarId),color=/^#[0-9a-f]{6}$/i.test(cal?.color)?cal.color:'#187568';
 const clock=i.allDay?T().allDay:String(Math.floor(i.startMinutes/60)).padStart(2,'0')+':'+String(i.startMinutes%60).padStart(2,'0');
 return '<button class="event-row" data-edit="'+safe(i.id)+'" style="--event:'+color+'"><span class="event-clock">'+safe(clock)+'</span><span class="event-copy"><strong>'+safe(i.title)+'</strong>'+(i.location?'<small>'+safe(i.location)+'</small>':'')+'</span>'+(i.kind==='reminder'?'<span class="reminder-box" data-complete="'+safe(i.id)+'">'+icon('check')+'</span>':'')+'</button>';
}
function agenda(d){const a=items(d);return '<section class="agenda"><h3>'+numHtml(egy(d).day)+' '+safe(monthName(egy(d).month))+'</h3>'+(prefs.gregorian?'<p class="subtle">'+safe(greg(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</p>':'')+(a.length?a.map(i=>eventRow(i,d)).join(''):'<p class="empty">'+safe(T().noEvents)+'</p>')+'</section>';}

function dateButton(c){
 if(!c)return '<span class="blank" aria-hidden="true"></span>';
 const d=c.gregorian,ev=items(d),hits=prefs.festivals?festivalHits(d,data.years,data.festivals):[];
 const dots=ev.slice(0,3).map(i=>{
  const col=schedule.calendars.find(x=>x.id===i.calendarId)?.color||'#176C59';
  return '<i style="background:'+( /^#[0-9a-f]{6}$/i.test(col)?col:'#176C59')+'"></i>';
 }).join('');
 return '<button class="date '+(d===state.focus?'chosen ':'')+(d===today()?'is-today':'')+'" data-date="'+d+'" aria-label="'+safe(monthName(egy(d).month))+' '+safe(N(c.day))+'" aria-pressed="'+(d===state.focus)+'"><span class="day-number">'+numHtml(c.day)+'</span>'+(prefs.gregorian?'<small class="greg-day" lang="en">'+safe(greg(d,{day:'numeric'}))+'</small>':'')+'<span class="dots">'+dots+'</span>'+(hits.length?'<em class="fest-mark" aria-label="'+safe(T().festivals)+'">✦</em>':'')+'</button>';
}
function monthSection(e){
 const w=week(),start=monthStart(e),length=monthDays(e);
 const secondary=prefs.gregorian?'<p class="subtle date-range">'+safe(greg(start,{day:'numeric',month:'short'}))+' – '+safe(greg(start+length-1,{day:'numeric',month:'short'}))+'</p>':'';
 if(w===10){
  // Use a shared five-column responsive grid for each real Egyptian decade.
  // The epagomenal period contains only five or six days, never thirty.
  const groups=Array.from({length:Math.ceil(length/10)},(_,i)=>{
   const offset=i*10,size=Math.min(10,length-offset);
   const dates=Array.from({length:size},(_,k)=>dateButton({day:offset+k+1,gregorian:start+offset+k})).join('');
   return '<div class="renpet-decade"><div class="decade-label">'+(e.month===13?safe(LOCALES[lang()].epagomenal):safe(N(i+1))+' / '+safe(N(10)))+'</div><div class="decade-days">'+dates+'</div></div>';
  }).join('');
  return '<section class="month-section ten-day" data-week="10">'+secondary+'<div class="decades">'+groups+'</div></section>';
 }
 const cells=monthGrid(e.year,e.month,7,data.years);
 const headers=Array.from({length:7},(_,i)=>LOCALES[lang()].shortWeekdays?.[i]||N(i+1));
 return '<section class="month-section seven-day" data-week="7">'+secondary+'<div class="week-headers" style="--cols:7">'+headers.map(h=>'<span>'+safe(h)+'</span>').join('')+'</div><div class="dates" style="--cols:7">'+cells.map(dateButton).join('')+'</div></section>';
}
function monthView(){
 const e=egy(state.focus);
 return '<div class="month-scroll">'+monthSection(e)+'<div class="month-agenda">'+agenda(state.focus)+'</div></div>';
}

function yearView(){
 const e=egy(state.focus),w=week();
 const cards=Array.from({length:12},(_,idx)=>{
  const month=idx+1,start=monthStart({year:e.year,month});
  const dates=Array.from({length:30},(_,j)=>{
   const d=start+j;
   return '<span class="'+(d===today()?'mini-today ':'')+(d===state.focus?'mini-selected':'')+'">'+safe(N(j+1))+'</span>';
  }).join('');
  return '<button class="year-month'+(month===e.month?' active-month':'')+'" data-open-month="'+month+'" aria-label="'+safe(monthName(month))+'"><strong>'+safe(monthName(month))+'</strong><div class="mini-grid'+(w===10?' mini-decade':'')+'" style="--cols:'+(w===10?5:7)+'">'+dates+'</div></button>';
 }).join('');
 const epagCount=data.years.find(y=>y.year===e.year).days-360;
 return '<div class="year-overview"><p class="year-caption">'+safe(N(e.year))+' · '+safe(N(12))+' '+safe(T().month)+'</p><div class="year-months">'+cards+'</div><button class="epagomenal-tile" data-open-month="13"><span>✦</span><strong>'+safe(LOCALES[lang()].epagomenal)+'</strong><small>'+safe(N(epagCount))+' '+safe(T().day)+'</small></button></div>';
}
function dayView(){
 const daily=items(state.focus),all=daily.filter(i=>i.allDay),timed=daily.filter(i=>!i.allDay);
 const ordered=[...timed].sort((a,b)=>a.startMinutes-b.startMinutes||a.endMinutes-b.endMinutes);
 const clusters=[];let current=[],end=-1;
 for(const item of ordered){
  if(current.length&&item.startMinutes>=end){clusters.push(current);current=[];end=-1;}
  current.push(item);end=Math.max(end,item.endMinutes||item.startMinutes+60);
 }
 if(current.length)clusters.push(current);
 const layout=new Map();
 for(const cluster of clusters){
  const ends=[];
  for(const item of cluster){
   let col=ends.findIndex(v=>v<=item.startMinutes);
   if(col<0){col=ends.length;ends.push(-1);}
   ends[col]=Math.max(item.endMinutes||item.startMinutes+60,item.startMinutes+15);
   layout.set(item.id,{col,cols:0});
  }
  for(const item of cluster)layout.get(item.id).cols=ends.length;
 }
 const blocks=timed.map(i=>{
  const start=Math.max(0,Math.min(1439,i.startMinutes||0)),end=Math.max(start+15,Math.min(1440,i.endMinutes||start+60));
  const cal=schedule.calendars.find(c=>c.id===i.calendarId);
  const color=/^#[0-9a-f]{6}$/i.test(cal?.color)?cal.color:'#187568';
  const pos=layout.get(i.id)||{col:0,cols:1},width=100/pos.cols;
  return '<div class="timeline-event" role="button" tabindex="0" style="--event:'+color+';top:'+(start/60*64)+'px;height:'+Math.max(27,(end-start)/60*64-3)+'px;left:calc('+width*pos.col+'% + 1px);width:calc('+width+'% - 3px)" data-edit="'+safe(i.id)+'"><span class="event-drag" aria-label="Move event"><strong>'+safe(i.title)+'</strong><small>'+timeString(start)+' – '+timeString(end)+'</small></span><span class="event-resize" aria-label="Resize event"></span></div>';
 }).join('');
 const hours=Array.from({length:24},(_,h)=>'<div class="timeline-hour"><span>'+timeString(h*60)+'</span><button class="timeline-slot" data-hour="'+h+'" aria-label="'+safe(T().add)+' '+timeString(h*60)+'"></button></div>').join('');
 return '<div class="day-page"><div class="day-heading">'+numHtml(egy(state.focus).day)+' '+safe(monthName(egy(state.focus).month))+(prefs.gregorian?'<small>'+safe(greg(state.focus,{weekday:'long',day:'numeric',month:'long'}))+'</small>':'')+'</div>'+(all.length?'<div class="all-day">'+all.map(i=>eventRow(i)).join('')+'</div>':'')+'<div class="timeline"><div class="timeline-hours">'+hours+'</div><div class="timeline-events">'+blocks+'</div></div></div>';
}

function listView(){const groups=[];for(let d=state.focus;d<=Math.min(max(),state.focus+59);d++)if(items(d).length)groups.push(agenda(d));return '<div class="list-page">'+(groups.join('')||'<p class="empty">'+safe(T().noEvents)+'</p>')+'</div>';}
function festivalView(){
 const e=egy(state.focus),start=monthStart(e),found=new Map();
 for(let d=start;d<start+monthDays(e);d++)for(const f of festivalHits(d,data.years,data.festivals))found.set(f.id,f);
 return '<section class="page"><h1>'+safe(T().festivals)+'</h1><p>'+safe(monthName(e.month))+' '+numHtml(e.year)+'</p><div class="festival-list">'+([...found.values()].map(f=>'<button class="festival" data-festival="'+safe(f.id)+'"><span>✦</span><strong>'+safe(lang()==='ar'?f.ar:T().festivals)+'</strong><small>'+safe(greg(f.start))+'</small></button>'+(state.festival===f.id?'<p class="festival-detail">'+safe(lang()==='ar'?f.description_ar:monthName(egy(f.start).month))+'</p>':'')).join('')||'<p class="empty">'+safe(T().noEvents)+'</p>')+'</div></section>';
}

function settingsView(){
 return '<section class="page preferences-page"><h1>'+safe(T().settings)+'</h1><div class="settings-group"><label>'+safe(T().gregorian)+'<input type="checkbox" name="gregorian" '+(prefs.gregorian?'checked':'')+'></label><label>'+safe(T().festivalSetting)+'<input type="checkbox" name="festivals" '+(prefs.festivals?'checked':'')+'></label><label>'+safe(T().weekLength)+'<select name="week">'+[7,10].map(n=>'<option value="'+n+'" '+(n===week()?'selected':'')+'>'+N(n)+'</option>').join('')+'</select></label></div><p class="build-label">'+safe(T().version)+' 2.1.0</p></section>';
}
function managerView(){
 const a=schedule;
 return '<section class="page"><h1>'+safe(T().calendars)+'</h1><div class="settings-group">'+a.calendars.map(c=>'<div class="cal-row"><input type="checkbox" data-visible="'+safe(c.id)+'" '+(c.visible!==false?'checked':'')+'><span class="color-dot" style="background:'+safe(c.color)+'"></span><span>'+safe(calName(c))+'</span>'+(c.custom?'<button data-remove-cal="'+safe(c.id)+'" aria-label="'+safe(T().delete)+'">×</button>':'')+'</div>').join('')+'</div><form id="new-calendar" class="settings-group"><label>'+safe(T().newCalendar)+'<input name="name" required maxlength="80" placeholder="'+safe(T().name)+'"></label><label>'+safe(T().color)+'<input type="color" name="color" value="#187568"></label><button class="primary" type="submit">'+safe(T().add)+'</button></form></section>';
}

function nav(){
 const labels=[['today',T().today],['year',LOCALES[lang()].year],['month',T().month],['list',T().list]];
 const glyphs={today:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',year:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M10 3v18M3 10h18"/>',month:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',list:'<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h1M3 12h1M3 18h1"/>'};
 return '<nav class="bottom-nav ios-bottom ux-bottom" aria-label="'+safe(T().view)+'">'+labels.map(([v,label])=>{
  const active=v==='today'?state.view==='day'&&state.focus===today():state.view===v;
  return '<button type="button" data-primary-view="'+v+'" class="ux-nav-item'+(active?' active':'')+'" aria-current="'+(active?'page':'false')+'"><svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+glyphs[v]+'</svg><span>'+safe(label)+'</span></button>';
 }).join('')+'</nav>';
}

function toolbar(){
 const e=egy(state.focus),year=state.view==='year',month=state.view==='month',isList=state.view==='list';
 const backLabel=month?N(e.year):monthName(e.month);
 const heading=year?numHtml(e.year):month?safe(monthName(e.month)):isList?safe(T().list):numHtml(e.day)+' '+safe(monthName(e.month));
 const options=Object.entries(LOCALES).map(([id,v])=>'<option value="'+id+'" '+(id===lang()?'selected':'')+'>'+safe(v.name)+'</option>').join('');
 const season=e.month===13?LOCALES[lang()].epagomenal:(lang()==='ar'?['آخت','برت','شمو'][Math.floor((e.month-1)/4)]:monthName(e.month));
 return '<header class="toolbar ux-toolbar"><div class="ux-toolbar-top"><div class="ux-back">'+(year?'': '<button data-back aria-label="'+safe(T().previous)+'">'+icon('back')+'<span>'+safe(backLabel)+'</span></button>')+'</div><div class="ux-toolbar-actions"><button data-search aria-label="'+safe(T().search)+'" aria-expanded="'+state.search+'">'+icon('search')+'</button><button data-new aria-label="'+safe(T().add)+'">'+icon('plus')+'</button><button data-more aria-label="'+safe(T().settings)+'" aria-expanded="'+state.more+'">'+icon('settings')+'</button></div></div><div class="ux-toolbar-head"><div class="ux-heading"><h1>'+heading+'</h1><p>'+safe(season)+' · '+safe(LOCALES[lang()].year)+' '+safe(N(e.year))+'</p></div><div class="ux-heading-actions"><label class="ux-language"><span class="sr-only">'+safe(T().language)+'</span><select name="language" aria-label="'+safe(T().language)+'">'+options+'</select></label><div class="ux-period-controls"><button data-prev aria-label="'+safe(T().previous)+'">‹</button><button data-next aria-label="'+safe(T().next)+'">›</button></div></div></div>'+(state.search?'<div class="search-panel"><input type="search" name="query" value="'+safe(state.query)+'" placeholder="'+safe(T().search)+'" autocomplete="off"><div class="search-results">'+searchResults()+'</div></div>':'')+'</header>';
}
function searchResults(){return searchItems(schedule,state.query).slice(0,60).map(i=>'<button data-result="'+i.startDay+'"><strong>'+safe(i.title)+'</strong><small>'+safe(greg(i.startDay))+'</small></button>').join('')||'<p class="empty">'+safe(T().noEvents)+'</p>';}
function dateFields(d){const e=egy(d);return '<div class="date-fields"><input name="egyYear" type="number" min="'+data.years[0].year+'" max="'+data.years.at(-1).year+'" value="'+e.year+'" required><select name="egyMonth">'+Array.from({length:13},(_,i)=>'<option value="'+(i+1)+'" '+(e.month===i+1?'selected':'')+'>'+safe(monthName(i+1))+'</option>').join('')+'</select><select name="egyDay">'+Array.from({length:monthDays(e)},(_,i)=>'<option value="'+(i+1)+'" '+(e.day===i+1?'selected':'')+'>'+N(i+1)+'</option>').join('')+'</select></div><small class="date-preview">'+safe(greg(d,{day:'numeric',month:'long',year:'numeric'}))+'</small>';}
const timeString=n=>String(Math.floor((n||0)/60)).padStart(2,'0')+':'+String((n||0)%60).padStart(2,'0');
function editor(){
 const item=state.dialog?.id?schedule.items.find(i=>i.id===state.dialog.id):null,d=item?.startDay??state.focus,kind=item?.kind||state.dialog?.kind||'event';
 const sched=schedule;
 return '<div class="sheet-overlay"><form id="event-editor" class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><button type="button" data-close>'+safe(T().cancel)+'</button><strong>'+safe(item?T().event:T().add)+'</strong><button class="save-button" type="submit">'+safe(T().save)+'</button></div><div class="sheet-body"><div class="kind-toggle"><label><input type="radio" name="kind" value="event" '+(kind==='event'?'checked':'')+'>'+safe(T().event)+'</label><label><input type="radio" name="kind" value="reminder" '+(kind==='reminder'?'checked':'')+'>'+safe(T().reminder)+'</label></div><label>'+safe(T().title)+'<input name="title" required maxlength="200" value="'+safe(item?.title||'')+'"></label><label>'+safe(T().date)+dateFields(d)+'</label><label class="check-row">'+safe(T().allDay)+'<input type="checkbox" name="allDay" '+(item?.allDay?'checked':'')+'></label><div class="time-fields"><label>'+safe(T().start)+'<input type="time" name="start" value="'+timeString(item?.startMinutes??((state.dialog?.hour??9)*60))+'"></label><label>'+safe(T().end)+'<input type="time" name="end" value="'+timeString(item?.endMinutes??((state.dialog?.hour??9)*60+60))+'"></label></div><label>'+safe(T().location)+'<input name="location" maxlength="300" value="'+safe(item?.location||'')+'"></label><label>'+safe(T().notes)+'<textarea name="notes" rows="3">'+safe(item?.notes||'')+'</textarea></label><label>'+safe(T().calendars)+'<select name="calendarId">'+sched.calendars.map(c=>'<option value="'+safe(c.id)+'" '+(c.id===(item?.calendarId||sched.calendars[0].id)?'selected':'')+'>'+safe(calName(c))+'</option>').join('')+'</select></label><label>'+safe(T().repeat)+'<select name="repeat">'+[['none',T().none],['daily',T().daily],['weekly',T().weekly],['egy10',T().decan],['egyMonthly',T().monthly],['egyYearly',T().yearly]].map(([v,n])=>'<option value="'+v+'" '+((item?.repeat||'none')===v?'selected':'')+'>'+safe(n)+'</option>').join('')+'</select></label><label>'+safe(T().alert)+'<select name="alert">'+[['none',T().none],['atTime','0'],['5min','5'],['15min','15'],['1hour','60'],['1day','1440']].map(([v,n])=>'<option value="'+v+'" '+((item?.alert||'none')===v?'selected':'')+'>'+safe(n)+'</option>').join('')+'</select></label>'+(item?'<button type="button" class="delete" data-delete="'+safe(item.id)+'">'+safe(T().delete)+'</button>':'')+'</div></form></div>';
}

function panelContent(){
 if(!state.panel)return '';
 const panels={settings:settingsView,festivals:festivalView,calendars:managerView};
 const title={settings:T().settings,festivals:T().festivals,calendars:T().calendars};
 const body=panels[state.panel]?.();
 if(!body)return '';
 return '<div class="ux-panel-backdrop" data-dismiss-panel></div><section class="ux-panel" role="dialog" aria-modal="true" aria-label="'+safe(title[state.panel])+'"><div class="ux-panel-head"><strong>'+safe(title[state.panel])+'</strong><button data-close-panel aria-label="'+safe(T().close||T().cancel)+'">×</button></div><div class="ux-panel-body">'+body+'</div></section>';
}
function render(){
 if(!data)return;
 const viewKey=state.view;
 const oldMain=root.querySelector('#main-content');
 const keepScroll=viewKey===previousRenderKey?oldMain?.scrollTop:0;
 schedule=loadScheduler();
 document.documentElement.lang=LOCALES[lang()].html;
 document.documentElement.dir=lang()==='ar'?'rtl':'ltr';
 document.body.dataset.language=lang();
 const content=state.view==='year'?yearView():state.view==='day'?dayView():state.view==='list'?listView():monthView();
 root.innerHTML='<div class="app-shell">'+toolbar()+'<main class="main-scroll" id="main-content">'+content+'</main>'+nav()+'</div>'+(state.more?'<div class="more-scrim" data-dismiss-more></div><div class="more-sheet" role="menu"><button data-open-panel="settings">'+icon('settings')+safe(T().settings)+'</button><button data-open-panel="festivals">'+icon('star')+safe(T().festivals)+'</button><button data-open-panel="calendars">'+icon('calendar')+safe(T().calendars)+'</button><button data-backup>'+icon('calendar')+safe(T().backup)+'</button></div>':'')+panelContent()+(state.dialog?editor():'');
 const main=root.querySelector('#main-content');
 if(main&&keepScroll)main.scrollTop=keepScroll;
 previousRenderKey=viewKey;
}

function navigate(step){
 if(state.view==='year'){const y=egy(state.focus).year+step;if(data.years.some(v=>v.year===y))state.focus=yearStart(y);}
 else if(state.view==='day')state.focus+=step;
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
 if(ev.target.closest('[data-dismiss-more]')){state.more=false;render();return;}
 if(ev.target.closest('[data-dismiss-panel]')){state.panel=null;render();return;}
 const complete=ev.target.closest('[data-complete]');
 if(complete){const sched=loadScheduler(),item=sched.items.find(i=>i.id===complete.dataset.complete);if(item){toggleCompleted(item,state.focus);saveScheduler(sched);render();}return;}
 const b=ev.target.closest('button');if(!b||b.disabled)return;
 if(b.hasAttribute('data-close-panel')){state.panel=null;render();return;}
 if(b.hasAttribute('data-close')){state.dialog=null;render();return;}
 if(b.hasAttribute('data-hour')){state.dialog={kind:'event',hour:Number(b.dataset.hour)};render();return;}
 if(b.hasAttribute('data-new')){state.dialog={kind:'event'};render();root.querySelector('[name="title"]')?.focus();return;}
 if(b.hasAttribute('data-edit')){state.dialog={id:b.dataset.edit};render();return;}
 if(b.hasAttribute('data-delete')){if(confirm(T().confirm)){const v=loadScheduler();removeItem(v,b.dataset.delete);saveScheduler(v);state.dialog=null;render();}return;}
 if(b.hasAttribute('data-search')){state.search=!state.search;state.query='';render();if(state.search)root.querySelector('[name="query"]')?.focus();return;}
 if(b.hasAttribute('data-date')){
  const next=clamp(Number(b.dataset.date));
  if(state.focus===next){state.view='day';saveView();}
  state.focus=next;render();return;
 }
 if(b.hasAttribute('data-open-month')){
  const y=egy(state.focus).year,m=Number(b.dataset.openMonth);
  state.focus=clamp(monthStart({year:y,month:m})+Math.min(egy(state.focus).day,monthDays({year:y,month:m}))-1);
  state.view='month';saveView();render();return;
 }
 if(b.hasAttribute('data-result')){state.focus=clamp(Number(b.dataset.result));state.view='day';state.search=false;saveView();render();return;}
 if(b.hasAttribute('data-prev')){navigate(-1);return;}
 if(b.hasAttribute('data-next')){navigate(1);return;}
 if(b.hasAttribute('data-back')){state.view=state.view==='month'?'year':'month';saveView();render();return;}
 if(b.hasAttribute('data-primary-view')){
  const v=b.dataset.primaryView;
  state.panel=null;state.more=false;state.search=false;
  if(v==='today'){state.focus=clamp(today());state.view='day';}
  else if(['year','month','list'].includes(v))state.view=v;
  saveView();render();return;
 }
 if(b.hasAttribute('data-more')){state.more=!state.more;render();return;}
 if(b.hasAttribute('data-open-panel')){
  if(['settings','festivals','calendars'].includes(b.dataset.openPanel)){state.panel=b.dataset.openPanel;state.more=false;render();}
  return;
 }
 if(b.hasAttribute('data-manage')){state.panel='calendars';state.more=false;render();return;}
 if(b.hasAttribute('data-backup')){state.more=false;render();openBackup();return;}
 if(b.hasAttribute('data-festival')){state.festival=state.festival===b.dataset.festival?null:b.dataset.festival;render();return;}
 if(b.hasAttribute('data-remove-cal')){const v=loadScheduler();removeCalendar(v,b.dataset.removeCal);saveScheduler(v);render();return;}
});

root.addEventListener('change',ev=>{
 const el=ev.target;
 if(el.name==='language'&&LOCALES[el.value])prefs.language=el.value;
 else if(el.name==='gregorian'||el.name==='festivals')prefs[el.name]=el.checked;
 else if(el.name==='week')prefs.weeks[lang()]=Number(el.value);
 else if(el.hasAttribute('data-visible')){const s=loadScheduler();updateCalendar(s,el.dataset.visible,{visible:el.checked});saveScheduler(s);render();return;}
 else if(el.closest('#event-editor')&&['egyYear','egyMonth','egyDay'].includes(el.name)){
  const form=el.form,y=Number(form.elements.egyYear.value),m=Number(form.elements.egyMonth.value),d=Number(form.elements.egyDay.value);
  if(data.years.some(x=>x.year===y)&&m>=1&&m<=13&&el.name!=='egyDay'){
   const count=monthDays({year:y,month:m}),dayField=form.elements.egyDay;
   if(dayField){
    const chosen=Math.min(Math.max(1,d),count);
    dayField.innerHTML=Array.from({length:count},(_,i)=>'<option value="'+(i+1)+'">'+N(i+1)+'</option>').join('');
    dayField.value=String(chosen);
   }
  }
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
// Pointer-based 15-minute drag and resize; commit only on pointer release.
let activeDrag=null,suppressEditUntil=0;
const snap=n=>Math.round(n/15)*15;
root.addEventListener('pointerdown',ev=>{
 const block=ev.target.closest('.timeline-event');
 if(!block||ev.button!==0)return;
 const item=loadScheduler().items.find(i=>i.id===block.dataset.edit);
 if(!item||item.allDay||item.repeat!=='none')return;
 const mode=ev.target.closest('.event-resize')?'resize':'move';
 activeDrag={id:item.id,mode,y:ev.clientY,start:item.startMinutes,end:item.endMinutes||item.startMinutes+60,block,moved:false};
 block.setPointerCapture?.(ev.pointerId);
});
root.addEventListener('pointermove',ev=>{
 const drag=activeDrag;if(!drag)return;
 const delta=snap((ev.clientY-drag.y)/64*60);
 if(Math.abs(ev.clientY-drag.y)>6)drag.moved=true;
 if(!drag.moved)return;
 const duration=Math.max(15,drag.end-drag.start);
 const start=drag.mode==='move'?Math.max(0,Math.min(1440-duration,drag.start+delta)):drag.start;
 const end=drag.mode==='resize'?Math.max(start+15,Math.min(1440,drag.end+delta)):start+duration;
 drag.next={start,end};
 drag.block.style.top=(start/60*64)+'px';
 drag.block.style.height=Math.max(27,(end-start)/60*64-3)+'px';
 const label=drag.block.querySelector('small');if(label)label.textContent=timeString(start)+' – '+timeString(end);
});
function finishDrag(ev,cancel=false){
 const drag=activeDrag;if(!drag)return;
 activeDrag=null;
 if(!drag.moved||cancel){if(drag.moved)render();return;}
 suppressEditUntil=Date.now()+450;
 if(!drag.next){render();return;}
 const sched=loadScheduler(),item=sched.items.find(i=>i.id===drag.id);
 if(item){item.startMinutes=drag.next.start;item.endMinutes=drag.next.end;item.updatedAt=new Date().toISOString();saveScheduler(sched);}
 render();
}
root.addEventListener('pointerup',ev=>finishDrag(ev));
root.addEventListener('pointercancel',ev=>finishDrag(ev,true));
root.addEventListener('click',ev=>{if(Date.now()<suppressEditUntil&&ev.target.closest('[data-edit]')){ev.stopImmediatePropagation();ev.preventDefault();}},true);
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){if(state.dialog)state.dialog=null;else if(state.panel)state.panel=null;else if(state.more)state.more=false;else if(state.search)state.search=false;render();}});
let gesture=null;
root.addEventListener('touchstart',ev=>{
 if(ev.touches.length!==1||state.dialog||state.panel||state.more)return;
 gesture={x:ev.touches[0].clientX,y:ev.touches[0].clientY};
},{passive:true});
root.addEventListener('touchend',ev=>{
 if(!gesture||!ev.changedTouches.length)return;
 const dx=ev.changedTouches[0].clientX-gesture.x,dy=ev.changedTouches[0].clientY-gesture.y;
 gesture=null;
 if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5){
  navigate((document.documentElement.dir==='rtl'?1:-1)*(dx>0?1:-1));
 }
},{passive:true});
async function init(){
 try{const r=await fetch('./data.json');if(!r.ok)throw Error('Calendar data unavailable');data=await r.json();state.focus=clamp(state.focus);render();
  if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(console.warn);}
 }catch(e){root.textContent='Renpet: '+e.message;console.error(e);}
}
init();
