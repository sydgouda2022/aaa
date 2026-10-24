"""Apply user-approved MdwNfr composer + icon corrections to the CI source."""
from pathlib import Path
from PIL import Image
import re,sys
root=Path(sys.argv[1])
icons=root/'web/icons'; icons.mkdir(parents=True,exist_ok=True)
source=Path(__file__).with_name('mdwnfr-brand-source.png')
with Image.open(source) as raw:
 for size,name in [(192,'192'),(512,'512'),(180,'apple-touch')]:
  raw.convert('RGB').resize((size,size),Image.Resampling.LANCZOS).save(icons/f'brand-v046-{name}.png',optimize=True)
def edit(name,fn):
 p=root/name; old=p.read_text();new=fn(old)
 if old==new:raise RuntimeError('No changes: '+name)
 p.write_text(new)
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('Unexpected source anchor '+a[:55])
 return s.replace(a,b)
def rx(s,pat,repl):
 out,n=re.subn(pat,repl,s,flags=re.S)
 if n!=1:raise RuntimeError('Unexpected source regex '+pat[:65]+': '+str(n))
 return out
def html(s):
 s=once(s,'/icons/apple-touch-icon.png','/icons/brand-v046-apple-touch.png')
 s=once(s,'<link rel="manifest" href="/manifest.webmanifest" />','<link rel="manifest" href="/manifest.webmanifest" />\n  <link rel="icon" type="image/png" sizes="192x192" href="/icons/brand-v046-192.png" />')
 if s.count('/icons/app_icon.svg')!=2:raise RuntimeError('Old icon path count')
 s=s.replace('/icons/app_icon.svg','/icons/brand-v046-192.png')
 s=once(s,'/style.css"','/style.css?v=046"')
 s=rx(s,r'<div id="composer" class="composer"[^\n]*</div>','<div id="composer" class="composer" aria-label="Uncommitted hieroglyphic signs"></div>')
 s=rx(s,r'\s*<div class="lexicon-status" id="lexicon-status"[^\n]*</div>','')
 s=once(s,'<div class="suggestion-toolbar">','<div class="suggestion-toolbar" id="suggestion-toolbar" hidden>')
 s=rx(s,r'<div class="suggestions" id="suggestions"[^\n]*</div>','<div class="suggestions" id="suggestions" hidden></div>')
 return once(s,'/app.js"></script>','/app.js?v=046"></script>')
def app(s):
 s=rx(s,r'\s*const nativeForms=lexiconMeta.unique_native_surfaces\|\|lexiconMeta.spelling_records;.*?(?=const notice=\$\(\'lexicon-notice\'\);)','\n  ')
 s=rx(s,r'\s*else\{const span=document.createElement\(\'span\'\);span.className=\'placeholder\';.*?area.append\(span\);\}','\n $(\'suggestion-toolbar\').hidden=!buffer.length;\n $(\'suggestions\').hidden=!buffer.length;')
 s=once(s," $('expand-predictions').disabled=!buffer.length;"," $('expand-predictions').disabled=!buffer.length;\n $('expand-predictions').textContent='All suggestions';")
 s=rx(s,r'\s*button.title=candidate.source===\'user\'.*?;\s*(?=button.onclick=\(\)=>commit\(candidate\);)','\n ')
 if 'button.append(tag)' in s:
  s=rx(s,r'\s*if\(rtc\)\{\s*button.classList.add\(\'ramses-choice\'\);.*?button.append\(tag\);\s*\}','\n ')
 s=rx(s,r'if\(!candidates.length\)\{const hint=.*?wrap.append\(hint\);return;\}','if(!candidates.length)return;')
 return once(s,"navigator.serviceWorker.register('/sw.js').catch(()=>{});","navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});")
def sw(s):
 s=rx(s,r"const CACHE = 'mdwnfr-offline-[^']+';","const CACHE = 'mdwnfr-offline-0.1.46';")
 s=once(s,'const match=await caches.match(request,{ignoreSearch:false});',"const active=await caches.open(CACHE);\n    if(request.mode==='navigate'){try{const fresh=await fetch(request,{cache:'no-store'});if(fresh.ok)return fresh;}catch(e){/* offline */}}\n    const match=await active.match(request,{ignoreSearch:false});")
 return once(s,"const index=await caches.match('/index.html');","const index=await active.match('/index.html');")
edit('web/index.html',html)
edit('web/app.js',app)
edit('web/sw.js',sw)
edit('web/style.css',lambda s:s+'\n/* Single approved square icon. */\n.library-logo,.editor-app-icon{border:0!important;box-shadow:none!important;background:transparent!important;object-fit:cover}\n[hidden]{display:none!important}\n')
edit('web/manifest.webmanifest',lambda s:once(once(s,'/icons/icon-192.png','/icons/brand-v046-192.png'),'/icons/icon-512.png','/icons/brand-v046-512.png'))
# Older tests hardcoded the now-retired logo/cache; update the checks, not their coverage.
if (root/'tests/test_panel_shell.py').is_file():
 edit('tests/test_panel_shell.py',lambda s:once(s,"'/icons/app_icon.svg'","'/icons/brand-v046-192.png'"))
if (root/'tests/test_offline_publication.py').is_file():
 edit('tests/test_offline_publication.py',lambda s:once(s,'"caches.match(\'/index.html\')"','"active.match(\'/index.html\')"'))
print('Applied MdwNfr v046 user-interface/brand update; dictionary unchanged.')