import {ensureLexicon} from '/lexicon-install.mjs';
/* Dedicated browser adapter. ALL content/geometry decisions remain Python. */
const LAYOUT_ONLY = new URL(self.location.href).searchParams.get('role') === 'layout';
const CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.8/full/';
const LOCAL = '/vendor/pyodide/';
let initialized = false;
let handler = null;
let bootPromise = null;
async function boot() {
  if (initialized) return;
  if (bootPromise) return bootPromise;
  bootPromise = (async()=>{
    // Pyodide v0.27.8 (CPython 3.12) is loaded as an ES module in a module worker.
    // A local distribution is authoritative when installed; otherwise online
    // development may use the pinned CDN. Production/offline must vendor ALL assets.
    let local = false;
    try {
      const statusResponse=await fetch('/runtime-status.json',{cache:'no-store'});
      if(statusResponse.ok){
        const status=await statusResponse.json();
        local=status.pyodide_version==='0.27.8' && status.runtime_ready===true;
      }
    }catch (_) { /* offline shell without a local runtime produces explicit error below */ }
    const runtime = local ? LOCAL : CDN;
    let loadPyodide;
    try { ({loadPyodide} = await import(runtime+'pyodide.mjs')); }
    catch (error) {
      throw new Error('Python runtime unavailable. For offline use, run tools/vendor_runtime.py on a connected developer machine, rebuild and install the PWA. '+String(error));
    }
    const pyodide = await loadPyodide({indexURL:runtime});
    const pythonVersion=pyodide.runPython('import sys; sys.version.split()[0]');
    if (!pythonVersion.startsWith('3.12.')) {
      throw new Error('Wrong browser Python runtime: expected 3.12, found '+pythonVersion);
    }
    const names=['__init__.py','document.py','quadrat.py','silhouette.py','tables.py','cartouches.py','typography.py','layout.py','prediction.py','lexicon.py','history.py','session.py','layout_sync.py','api.py'];
    pyodide.FS.mkdirTree('/home/pyodide/mdwnfr');
    for (const filename of names) {
      const response=await fetch('/core/mdwnfr/'+filename,{cache:'force-cache'});
      if (!response.ok) throw new Error('Cannot load Python core: '+filename);
      pyodide.FS.writeFile('/home/pyodide/mdwnfr/'+filename,await response.text());
    }
    pyodide.FS.mkdirTree('/home/pyodide/mdwnfr/data');
    const artwork=await fetch('/core/mdwnfr/data/artwork_catalog.json',{cache:'force-cache'});
    if(!artwork.ok)throw new Error('Installed clip-art metadata not available');
    pyodide.FS.writeFile('/home/pyodide/mdwnfr/data/artwork_catalog.json',await artwork.text());
    const contour=await fetch('/core/mdwnfr/data/artwork_silhouettes.json',{cache:'force-cache'});
    if(!contour.ok)throw new Error('Installed artwork silhouettes not available');
    pyodide.FS.writeFile('/home/pyodide/mdwnfr/data/artwork_silhouettes.json',await contour.text());
    // Layout worker does not load the lexicon or personal vocabulary.
    if (!LAYOUT_ONLY) {
    // First-run verified installation: local IndexedDB -> integrity check -> atomic repair.
    // No source corpora at runtime. Never touch document/user profile stores.
    const installed=await ensureLexicon();
    // Until the complete compiler release is published, preserve the explicit
    // development warning rather than claiming these 728 spellings are complete.
    pyodide.FS.writeFile('/home/pyodide/mdwnfr/data/lexicon.json',new Uint8Array(installed.bytes));
    }
    pyodide.runPython("import sys;sys.path.insert(0, '/home/pyodide')");
    handler=pyodide.runPython('from mdwnfr.api import handle_json; handle_json');
    initialized=true;
    self.postMessage({type:'ready',python:pythonVersion});
  })();
  return bootPromise;
}
self.onmessage = async ev => {
  const {id,method,payload}=ev.data;
  try {
    await boot();
    if (method === 'boot') return;
    const layoutMethods=['layout','layout_open','layout_sync','layout_page','layout_columns'];
    if (LAYOUT_ONLY && !layoutMethods.includes(method)) throw new Error('Layout worker accepts only layout jobs');
    if (!LAYOUT_ONLY && layoutMethods.includes(method)) throw new Error('Layout jobs belong to their isolated worker');
    const response=JSON.parse(handler(JSON.stringify({method,...payload})));
    self.postMessage({id,...response});
  } catch(err) {
    const explanation=String(err?.message||err);
    if(method==='boot') self.postMessage({type:'fatal',error:explanation});
    else self.postMessage({id,ok:false,error:explanation});
  }
};