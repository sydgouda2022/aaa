import {
  MONTHS, SEASONS, daysInMonth, leap, toGregorian, fromGregorian,
  localTodayUtc, addUtcDays, gregorianIso, nextMonth,
  digits, monthName, dateLabel
} from './calendar-core.mjs';

const $ = id => document.getElementById(id);
const SUPPORTED = new Set(['ar', 'en', 'cop', 'egy']);
const UI = {
  ar: {
    app:'التقويم المصري', today:'اليوم', eyebrow:'التاريخ المصري اليوم',
    month:'الشهر المصري', season:'فصل', monthIndex:'الشهر',
    otherDays:'أيام النسيء', outside:'خارج الفصول والعشريات',
    decade:'العشرية', selected:'التاريخ المحدد', egypt:'التاريخ المصري',
    greg:'الموافق الميلادي', todayLegend:'اليوم', jump:'الانتقال إلى تاريخ ميلادي',
    language:'لغة التاريخ', prev:'الشهر السابق', next:'الشهر التالي',
    footer:'التقويم السكندري · ١٢ شهرًا + النسيء · يعمل دون اتصال',
    install:'تثبيت التقويم', installIos:'لتثبيت التقويم على iPhone: افتح قائمة المشاركة في Safari واختر «إضافة إلى الشاشة الرئيسية».',
    decades:['الأولى','الثانية','الثالثة'],
    weekdays:['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة']
  },
  en: {
    app:'Egyptian Calendar', today:'Today', eyebrow:'Today in the Egyptian calendar',
    month:'Egyptian month', season:'Season', monthIndex:'Month',
    otherDays:'Epagomenal days', outside:'Outside seasons and decades',
    decade:'Decade', selected:'Selected date', egypt:'Egyptian date',
    greg:'Gregorian date', todayLegend:'Today', jump:'Jump to Gregorian date',
    language:'Display language', prev:'Previous month', next:'Next month',
    footer:'Alexandrian calendar · 12 months + epagomenal days · works offline',
    install:'Install app', installIos:'On iPhone, open Safari’s Share menu and choose “Add to Home Screen”.',
    decades:['first','second','third'],
    weekdays:['Sat','Sun','Mon','Tue','Wed','Thu','Fri']
  }
};
const language = () => state.language;
const strings = () => UI[language()==='en' || language()==='cop' ? 'en' : 'ar'];
function storedLanguage() {
  try { const l=localStorage.getItem('egyptian-calendar-language'); return SUPPORTED.has(l) ? l : 'ar'; }
  catch { return 'ar'; }
}
function remember(l) {try {localStorage.setItem('egyptian-calendar-language',l)}catch {}}
const today = localTodayUtc();
const first = fromGregorian(today);
const state = {language:storedLanguage(), year:first.year, month:first.month, chosen:today};
const gregLocale = () => language()==='ar' ? 'ar-EG' : 'en-GB';
const formatGregorian = (date, options) => new Intl.DateTimeFormat(gregLocale(), {...options, timeZone:'UTC'}).format(date);
const formatNumber = (value) => digits(value, language());
function egyptianTitle(e) {return monthName(e.month,language())+' '+formatNumber(e.year);}
function renderStaticStrings() {
  const tr=strings(), html=document.documentElement;
  const lang=language();
  html.lang=lang;
  html.dir=lang==='en' || lang==='cop' ? 'ltr' : 'rtl';
  html.classList.toggle('is-hieroglyphic',lang==='egy');
  html.classList.toggle('is-coptic',lang==='cop');
  document.title=tr.app;
  $('appName').textContent=tr.app;
  $('heading').textContent=tr.app;
  $('heroEyebrow').textContent=tr.eyebrow;
  $('sectionEyebrow').textContent=tr.month;
  $('today').textContent=tr.today;
  $('detailHeading').textContent=tr.selected;
  $('legendEgyptian').textContent=tr.egypt;
  $('legendGregorian').textContent=tr.greg;
  $('legendToday').textContent=tr.todayLegend;
  $('jumpLabel').textContent=tr.jump;
  $('languageLabel').textContent=tr.language;
  $('prevMonth').ariaLabel=$('prevMonth').title=tr.prev;
  $('nextMonth').ariaLabel=$('nextMonth').title=tr.next;
  $('footerText').textContent=tr.footer;
  $('installButton').textContent=tr.install;
  $('weekdays').replaceChildren();
  tr.weekdays.forEach((day,i)=>{
    const label=document.createElement('span');
    label.className='weekday-cell'+(i===0 || i===6?' weekend':'');
    label.textContent=day;
    $('weekdays').append(label);
  });
}
function renderHero() {
  const e=fromGregorian(localTodayUtc());
  $('heroDate').textContent=dateLabel(e,language());
  $('heroGregorian').textContent=formatGregorian(localTodayUtc(),{day:'numeric',month:'long',year:'numeric',weekday:'long'});
  $('heroSeason').textContent=e.season===null?strings().otherDays:SEASONS[language()==='egy'?'egy':language()][e.season];
  $('heroDecade').textContent=e.decade===null?strings().outside:
    (language()==='ar' || language()==='egy' ? 'العشرية '+UI.ar.decades[e.decade-1] : 'Decade '+e.decade);
}
function updateToolbar() {
  const tr=strings(), s=state;
  $('monthTitle').textContent=egyptianTitle(s);
  const firstDay=toGregorian(s.year,s.month,1);
  const last=toGregorian(s.year,s.month,daysInMonth(s.year,s.month));
  const a=formatGregorian(firstDay,{day:'numeric',month:'short',year:'numeric'});
  const b=formatGregorian(last,{day:'numeric',month:'short',year:'numeric'});
  $('monthSpan').textContent=a+' — '+b;
  if(s.month===13){
    $('seasonLabel').textContent=tr.otherDays;
    $('monthIndex').textContent=tr.outside;
  }else{
    const season=SEASONS[language()==='egy'?'egy':language()][Math.floor((s.month-1)/4)];
    $('seasonLabel').textContent=tr.season+' '+season;
    $('monthIndex').textContent=tr.monthIndex+' '+formatNumber(s.month)+' / '+formatNumber(12);
  }
}
function dayCell(date) {
  const e=fromGregorian(date), el=document.createElement('button');
  const isToday=gregorianIso(date)===gregorianIso(localTodayUtc());
  const isChosen=gregorianIso(date)===gregorianIso(state.chosen);
  el.type='button';
  el.className='day-button'+(isChosen?' selected':'')+(isToday?' today':'')+
    ([0,6].includes(date.getUTCDay())?' weekend':'');
  el.setAttribute('role','gridcell');
  el.setAttribute('aria-selected',String(isChosen));
  if(isToday) el.setAttribute('aria-current','date');
  el.setAttribute('aria-label',dateLabel(e,language())+' — '+
    formatGregorian(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
  const eg=document.createElement('span');
  eg.className='egy-day';
  eg.dir='auto';
  eg.textContent=formatNumber(e.day);
  const gr=document.createElement('span');
  gr.className='greg-day';
  const span=document.createElement('span');
  span.textContent=formatGregorian(date,{day:'numeric'});
  const month=document.createElement('span');
  month.className='greg-month';
  month.textContent=new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(date).toUpperCase();
  gr.append(span,month);
  el.append(eg,gr);
  el.addEventListener('click',()=>{
    state.chosen=date;
    renderMonth();
  });
  return el;
}
function renderMonth() {
  updateToolbar();
  const start=toGregorian(state.year,state.month,1);
  const days=daysInMonth(state.year,state.month);
  const leading=(start.getUTCDay()+1)%7; // Saturday is first day of the Egyptian workweek grid.
  const slotCount=Math.ceil((leading+days)/7)*7;
  const container=$('days');
  const fragment=document.createDocumentFragment();
  for(let i=0;i<slotCount;i++){
    const offset=i-leading;
    if(offset<0 || offset>=days){
      const blank=document.createElement('span');
      blank.className='day-blank';
      blank.setAttribute('aria-hidden','true');
      fragment.append(blank);
    }else {
      fragment.append(dayCell(addUtcDays(start,offset)));
    }
  }
  container.replaceChildren(fragment);
  $('days').setAttribute('aria-label',egyptianTitle(state));
  renderDetails();
}
function renderDetails(){
  const e=fromGregorian(state.chosen), tr=strings();
  $('detailDate').textContent=dateLabel(e,language());
  $('detailGregorian').textContent=formatGregorian(state.chosen,{
    weekday:'long',day:'numeric',month:'long',year:'numeric'
  });
  const meta=$('detailMeta');
  meta.replaceChildren();
  const values=e.month===13
    ? [tr.otherDays,tr.outside]
    : [tr.season+' '+SEASONS[language()==='egy'?'egy':language()][e.season],
       language()==='ar' || language()==='egy'?'العشرية '+UI.ar.decades[e.decade-1]:tr.decade+' '+e.decade,
       tr.monthIndex+' '+formatNumber(e.month)];
  values.forEach(v=>{
    const chip=document.createElement('span');
    chip.textContent=v;
    meta.append(chip);
  });
}
function render(){
  $('language').value=state.language;
  renderStaticStrings();
  renderHero();
  renderMonth();
  $('jumpDate').value=gregorianIso(state.chosen);
}
function moveMonth(step){
  const {year,month}=nextMonth(state.year,state.month,step);
  if(year<6000 || year>6500) return; // Practical interactive range; engine supports a wider period.
  state.year=year;
  state.month=month;
  state.chosen=toGregorian(year,month,1);
  renderMonth();
  $('jumpDate').value=gregorianIso(state.chosen);
}
$('prevMonth').addEventListener('click',()=>moveMonth(-1));
$('nextMonth').addEventListener('click',()=>moveMonth(+1));
$('today').addEventListener('click',()=>{
  const d=localTodayUtc(),e=fromGregorian(d);
  state.year=e.year; state.month=e.month; state.chosen=d;
  render();
});
$('jumpDate').addEventListener('change',event=>{
  if(!event.target.value) return;
  const parts=event.target.value.split('-').map(Number);
  const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
  if(!Number.isFinite(date.valueOf()) || gregorianIso(date)!==event.target.value) return;
  const e=fromGregorian(date);
  state.year=e.year;state.month=e.month;state.chosen=date;
  render();
});
$('language').addEventListener('change',event=>{
  if(!SUPPORTED.has(event.target.value)) return;
  state.language=event.target.value;
  remember(state.language);
  render();
});
document.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if(event.key==='ArrowLeft')moveMonth(+1);
  if(event.key==='ArrowRight')moveMonth(-1);
});
let touchStart=null;
const swipeArea=$('swipeArea');
swipeArea.addEventListener('touchstart',event=>{
  if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
},{passive:true});
swipeArea.addEventListener('touchend',event=>{
  if(!touchStart || event.changedTouches.length!==1)return;
  const dx=event.changedTouches[0].clientX-touchStart.x;
  const dy=event.changedTouches[0].clientY-touchStart.y;
  touchStart=null;
  if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.5)
    moveMonth(dx<0?+1:-1);
},{passive:true});
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  $('installButton').hidden=false;
});
$('installButton').addEventListener('click',async()=>{
  if(!installPrompt)return;
  const prompt=installPrompt; installPrompt=null;
  $('installButton').hidden=true;
  await prompt.prompt();
});
window.addEventListener('appinstalled',()=>{
  $('installButton').hidden=true;
  $('installNote').hidden=true;
});
if(/iPhone|iPad|iPod/i.test(navigator.userAgent) && !navigator.standalone){
  $('installNote').hidden=false;
  $('installNote').textContent=strings().installIos;
}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
  });
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderHero();});
render();
