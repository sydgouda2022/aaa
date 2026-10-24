import {COPTIC_LETTERS,COP_NUMBERS,EGY_NUMBERS,wordRange,suggestions,deleteGrapheme} from './keyboard-core.js';

const STORAGE='renpet.keyboard.personal.v1';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog={cop:null,egy:null};
let active=null,keyboard=null,locale=()=>document.body.dataset.language,tab='uni',upper=false,personal={};
try{personal=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{personal={};}

const eligible=el=>(el instanceof HTMLTextAreaElement)||(el instanceof HTMLInputElement&&['text','search'].includes(el.type));
const keyboardLanguage=()=>{const x=locale();return x==='cop'||x==='egy'?x:null;};
function persist(){
 try{localStorage.setItem(STORAGE,JSON.stringify(Object.fromEntries(Object.entries(personal).sort((a,b)=>b[1]-a[1]).slice(0,1500))));}catch{}
}
function remember(text){
 if(!text)return;
 const lang=keyboardLanguage();if(!lang)return;
 const k=lang+':'+text;personal[k]=(personal[k]||0)+1;persist();
}
async function load(lang){
 if(catalog[lang])return;
 const endpoint=lang==='cop'?'coptic.json':'signs.json';
 try{
  const res=await fetch('./assets/dictionaries/'+endpoint);
  if(!res.ok)throw new Error(res.status);
  catalog[lang]=await res.json();
 }catch(err){console.warn('Renpet dictionary unavailable offline:',endpoint,err);catalog[lang]={rows:[],pages:{uni:[],bi:[],tri:[]}};}
 if(active&&keyboardLanguage()===lang)draw();
}
function pageButtons(lang){
 if(lang!=='egy')return '';
 return '<div class="kb-tabs" role="tablist" aria-label="Hieroglyphic sign classes">'+[
  ['uni','𓄿','Uniliterals'],['bi','𓉐','Biliterals'],['tri','𓆣','Triliterals']
 ].map(([p,icon,label])=>'<button type="button" role="tab" aria-selected="'+(tab===p)+'" class="'+(p===tab?'selected':'')+'" data-kb-tab="'+p+'" aria-label="'+label+'"><span>'+icon+'</span><small>'+(p==='uni'?'𓏺':p==='bi'?'𓏺𓏺':'𓏺𓏺𓏺')+'</small></button>').join('')+'</div>';
}
function numberButtons(lang){
 const values=lang==='cop'?COP_NUMBERS:EGY_NUMBERS;
 return '<div class="kb-numbers" aria-label="Number signs">'+values.map(n=>'<button type="button" class="kb-num" data-kb-insert="'+escape(n.text)+'" title="'+n.value+'" aria-label="'+n.value+'">'+n.text+'</button>').join('')+'</div>';
}
function keys(lang){
 const options=lang==='cop'?COPTIC_LETTERS.map(ch=>[upper?ch.toLocaleUpperCase():ch,'']):(catalog.egy?.pages?.[tab]||[]);
 // Each sign key shows the actual Unicode sign. Gardiner IDs are available as tooltips,
 // not transliteration prompts or invented lexical equivalences.
 return '<div class="kb-signs '+(lang==='egy'?'kb-hiero':'kb-coptic')+'">'+options.map(([x,y])=>'<button type="button" class="kb-sign" data-kb-insert="'+escape(x)+'" aria-label="'+escape(y||x)+'" title="'+escape(y||x)+'">'+x+'</button>').join('')+'</div>';
}
function current(){
 if(!active||!active.isConnected)return {raw:'',start:0,end:0};
 return wordRange(active.value,active.selectionStart??active.value.length,keyboardLanguage());
}
function predictBar(lang){
 const raw=current().raw;
 const options=suggestions(raw,lang,catalog[lang],personal,4);
 if(!options.length)return '<div class="kb-suggestions kb-quiet" role="status"><span> '+(lang==='cop'?'Ⲥⲁϩⲓⲇⲓⲕⲏ · Ⲃⲟϩⲁⲓⲣⲓⲕⲏ':'𓏭 𓄿 𓆣')+' </span></div>';
 return '<div class="kb-suggestions" role="listbox" aria-label="Prediction candidates">'+options.map((o,i)=>{
  const dialects=o.dialects===3?'S+B':o.dialects===1?'S':o.dialects===2?'B':o.personal?'★':'';
  return '<button type="button" role="option" data-kb-pick="'+i+'" aria-selected="'+(i===0)+'"><span>'+escape(o.text)+'</span><small>'+(o.raw?'✓':dialects)+'</small></button>';
 }).join('')+'</div>';
}
function draw(){
 if(!keyboard)return;
 const lang=keyboardLanguage();
 if(!active||!active.isConnected||!lang){hide();return;}
 keyboard.hidden=false;
 document.body.classList.add('keyboard-open');
 const title=lang==='cop'?'Ⲥⲁϩⲓⲇⲓⲕⲏ · Ⲃⲟϩⲁⲓⲣⲓⲕⲏ':'𓄿 · 𓉐 · 𓆣';
 keyboard.setAttribute('aria-label',title);
 keyboard.innerHTML='<div class="kb-top"><span class="kb-name">'+title+'</span><button type="button" data-kb-done aria-label="Close keyboard">✓</button></div>'
  +predictBar(lang)+pageButtons(lang)+numberButtons(lang)+keys(lang)
  +'<div class="kb-controls">'+(lang==='cop'?'<button type="button" data-kb-shift aria-pressed="'+upper+'">⇧</button>':'')
  +'<button type="button" data-kb-insert="،">،</button><button type="button" class="kb-space" data-kb-space>Space</button>'
  +'<button type="button" data-kb-back aria-label="Backspace">⌫</button></div>';
 // Leave form controls above the dock rather than obscuring them.
 requestAnimationFrame(()=>{if(active?.isConnected)active.scrollIntoView({block:'nearest',behavior:'instant'});});
}
function hide(){
 if(!keyboard)return;keyboard.hidden=true;
 document.body.classList.remove('keyboard-open');active=null;
}
function edit(text,range=null){
 if(!active||!active.isConnected){hide();return;}
 const st=range?.start??active.selectionStart??active.value.length;
 const end=range?.end??active.selectionEnd??st;
 active.setRangeText(text,st,end,'end');
 active.dispatchEvent(new Event('input',{bubbles:true}));
 const old=active;
 queueMicrotask(()=>{
  if(!old.isConnected){
   const candidate=old.name?document.querySelector('[name="'+CSS.escape(old.name)+'"]'):null;
   if(eligible(candidate))active=candidate;
  }
  if(active?.isConnected){active.focus({preventScroll:true});draw();}else hide();
 });
}
function click(ev){
 const btn=ev.target.closest('button');if(!btn||!keyboard.contains(btn))return;
 const lang=keyboardLanguage();if(!lang)return;
 if(btn.hasAttribute('data-kb-done')){active?.blur();hide();return;}
 if(btn.hasAttribute('data-kb-tab')){tab=btn.dataset.kbTab;draw();return;}
 if(btn.hasAttribute('data-kb-shift')){upper=!upper;draw();return;}
 if(btn.hasAttribute('data-kb-back')){edit('',deleteGrapheme(active.value,active.selectionStart,active.selectionEnd));return;}
 if(btn.hasAttribute('data-kb-space')){remember(current().raw);edit(' ');return;}
 if(btn.hasAttribute('data-kb-pick')){
  const list=suggestions(current().raw,lang,catalog[lang],personal,4),pick=list[Number(btn.dataset.kbPick)];
  if(!pick)return;
  remember(pick.text);
  const range=current();
  edit(pick.text+' ',{start:range.start,end:range.end});
  return;
 }
 if(btn.hasAttribute('data-kb-insert')){edit(btn.dataset.kbInsert);return;}
}
export function initKeyboard(getLanguage){
 if(keyboard||typeof document.createElement!=='function')return;
 locale=getLanguage;
 keyboard=document.createElement('section');
 keyboard.id='renpet-keyboard';
 keyboard.className='renpet-keyboard';
 keyboard.hidden=true;
 keyboard.setAttribute('role','group');
 document.body.appendChild(keyboard);
 // Dock pointer events cannot take focus away from the field being edited.
 keyboard.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();});
 keyboard.addEventListener('click',click);
 document.addEventListener('pointerdown',e=>{
  if(keyboardLanguage()&&eligible(e.target))e.target.setAttribute('inputmode','none');
 },true);
 document.addEventListener('focusin',e=>{
  const lang=keyboardLanguage();if(!lang||!eligible(e.target))return;
  active=e.target;
  active.setAttribute('inputmode','none');
  void load(lang);
  draw();
 });
 document.addEventListener('input',e=>{
  if(e.target===active)draw();
 });
 document.addEventListener('pointerdown',e=>{
  if(!keyboard.hidden&&!keyboard.contains(e.target)&&e.target!==active&&!eligible(e.target)){
   if(!e.target.closest('.sheet,.search-panel'))hide();
  }
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!keyboard.hidden)hide();
 });
}
// Leave space for the appointment time sheet rather than covering it.
export function closeKeyboard(){hide();}
export function syncKeyboard(){
 if(!keyboard)return;
 if(keyboardLanguage()==='ar'){hide();return;}
 if(active?.isConnected)draw();else hide();
}
