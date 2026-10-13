// Self-contained, offline-first Egyptian PWA shell. No remote APIs needed for calendar dates.
const CACHE='egyptian-calendar-pwa-v1.1.0';
const APP_SHELL=['/','/index.html','/styles.css','/app.js','/calendar-core.mjs','/manifest.webmanifest','/icon.svg','/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE && key.startsWith('egyptian-calendar-pwa-')).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(req,{ignoreSearch:true});
    if(cached)return cached;
    try {
      const response=await fetch(req);
      if(response.ok)cache.put(req,response.clone()).catch(()=>{});
      return response;
    } catch {
      if(req.mode==='navigate'){
        const fallback=await cache.match('/index.html');
        if(fallback)return fallback;
      }
      return new Response('Offline resource unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});