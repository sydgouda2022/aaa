// One subscription per person, editable display language. Cloudflare Workers + D1.
const LANG={ar:'العربية',en:'English',cop:'Ⲙⲉⲧⲣⲉⲙⲛ̀ⲭⲏⲙⲓ',egy:'Hieroglyphic / 𓏺'};
const SRC='https://raw.githubusercontent.com/sydgouda2022/aaa/main/calendar';
const good=(x)=>Object.prototype.hasOwnProperty.call(LANG,x);
const HEAD={'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"};
const page=(s,status=200)=>new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>التقويم المصري</title><style>body{font:18px system-ui;background:#f4f5f7;padding:2em}main{background:white;max-width:650px;padding:2em;margin:auto;border-radius:20px}button,select{font:inherit;padding:.6em}button{background:#183c70;color:white;border:0;border-radius:8px}a{word-break:break-all}p{line-height:1.5}</style><main>'+s+'</main></html>',{status,headers:HEAD});
const sel=(choice)=>Object.entries(LANG).map(([id,label])=>'<option value="'+id+'" '+(id===choice?'selected':'')+'>'+label+'</option>').join('');
const bytes=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
async function sha(s){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join('');}
async function row(db,id){return db.prepare('SELECT id, edit_hash, language FROM calendars WHERE id=?').bind(id).first();}
async function auth(db,id,key){if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{48}$/.test(key))return null;const r=await row(db,id);return r&&r.edit_hash===(await sha(key))?r:null;}
const error=()=>page('<h1>رابط الإعدادات غير صالح</h1>',403);
async function newCal(request,db){
  const data=await request.formData(),lang=String(data.get('language')||'ar');
  if(!good(lang))return page('لغة غير مدعومة',400);
  const id=crypto.randomUUID(),secret=bytes();
  await db.prepare('INSERT INTO calendars (id,edit_hash,language) VALUES (?,?,?)').bind(id,await sha(secret),lang).run();
  const origin=new URL(request.url).origin,subscription=origin+'/calendar/'+id+'.ics',settings=origin+'/settings/'+id+'?key='+secret;
  return page('<h1>تم إنشاء تقويمك</h1><p>استخدم رابط الاشتراك مرة واحدة فقط داخل Apple Calendar:</p><p dir="ltr"><a href="'+subscription+'">'+subscription+'</a></p><p><a href="'+subscription.replace(/^https:/,'webcal:')+'">اشترك مباشرة في Apple Calendar</a></p><hr><p>احتفظ برابط الإعدادات السري لتغيير اللغة في المستقبل دون إعادة الاشتراك:</p><p dir="ltr"><a href="'+settings+'">'+settings+'</a></p><p>يظهر التغيير عند المزامنة التالية حسب Apple.</p>');
}
async function editPage(request,db,id){
  const key=new URL(request.url).searchParams.get('key')||'',r=await auth(db,id,key);
  if(!r)return error();
  return page('<h1>تغيير لغة التقويم</h1><p>اللغة الحالية: '+LANG[r.language]+'</p><form method="POST" action="/settings/'+id+'"><input type="hidden" name="key" value="'+key+'"><label>اختر اللغة <select name="language">'+sel(r.language)+'</select></label><p><button>حفظ اللغة</button></p></form><p>رابط الاشتراك لا يتغير. قد يتأخر ظهور التحديث وفق دورة مزامنة Apple.</p>');
}
async function update(request,db,id){
  const form=await request.formData(),key=String(form.get('key')||''),lang=String(form.get('language')||'');
  if(!(await auth(db,id,key)))return error();
  if(!good(lang))return page('لغة غير مدعومة',400);
  await db.prepare("UPDATE calendars SET language=?,updated_at=datetime('now') WHERE id=?").bind(lang,id).run();
  return Response.redirect(new URL(request.url).origin+'/settings/'+id+'?key='+key,303);
}
async function calendar(db,id){
  const r=await row(db,id);
  if(!r)return new Response('Not found',{status:404});
  const data=await fetch(SRC+'/'+r.language+'/full.ics',{headers:{accept:'text/calendar'}});
  if(!data.ok)return new Response('Temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}});
  return new Response(data.body,{headers:{'content-type':'text/calendar; charset=utf-8','content-disposition':'inline; filename="egyptian-calendar.ics"','cache-control':'private, no-store, no-cache, must-revalidate','x-content-type-options':'nosniff'}});
}
export default {async fetch(request,env){
  try {
    const url=new URL(request.url),path=url.pathname,method=request.method;
    if(method==='GET'&&path==='/')return page('<h1>التقويم المصري القديم</h1><p>تقويم واحد مع لغة قابلة للتغيير دون إعادة اشتراك. السنة 6282 بدأت يوم 11 سبتمبر 2026.</p><form method="POST" action="/new"><label>لغة العرض <select name="language">'+sel('ar')+'</select></label><p><button>إنشاء اشتراك التقويم</button></p></form>');
    if(method==='POST'&&path==='/new')return newCal(request,env.DB);
    let match=path.match(/^\/calendar\/([0-9a-f-]{36})\.ics$/);
    if(method==='GET'&&match)return calendar(env.DB,match[1]);
    match=path.match(/^\/settings\/([0-9a-f-]{36})$/);
    if(match&&method==='GET')return editPage(request,env.DB,match[1]);
    if(match&&method==='POST')return update(request,env.DB,match[1]);
    return page('Not found',404);
  }catch(e){return new Response('Service unavailable',{status:503,headers:{'cache-control':'no-store'}});}
}};