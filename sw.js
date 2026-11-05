/* Only public app-shell files are cached, for fast opening. API answers, tokens and school records are never cached. */
const VERSION='2026-11-04-fast';
const ROOT=new URL('./',self.location.href);
const PREFIX='souvenir-pwa-'+encodeURIComponent(ROOT.pathname)+'-';
const CACHE=PREFIX+'shell-'+VERSION;
const SHELL=['index.html','client.js','config.js','pwa.js','teacher-math.js','teacher-tools.js','teacher-tools.css','manifest.webmanifest','vendor/jspdf.umd.min.js','vendor/jspdf.plugin.autotable.min.js','assets/school-logo.jpg','assets/app-icon-32.png','assets/app-icon-180.png','assets/app-icon-192.png','assets/app-icon-512.png','assets/app-icon-maskable-512.png'];
const ASSETS=new Set(SHELL.map(path=>new URL(path,ROOT).href));
const INDEX=new URL('index.html',ROOT).href;
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 /* 'reload' makes sure the newest files are fetched, not an older copy kept by the browser */
 await Promise.allSettled(SHELL.map(async path=>{const url=new URL(path,ROOT).href,r=await fetch(new Request(url,{cache:'reload'}));if(r.ok)await cache.put(url,r)}));
 await self.skipWaiting();
})())});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==ROOT.origin)return;
 const shellNavigation=request.mode==='navigate'&&(url.pathname===ROOT.pathname||url.pathname===new URL('index.html',ROOT).pathname);
 /* The setup page, backups, database requests and unrelated GitHub sites never enter the cache. */
 if(!shellNavigation&&!ASSETS.has(url.href))return;
 const key=shellNavigation?INDEX:url.href;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),saved=await cache.match(key);
  /* Open instantly from the saved copy and refresh it quietly for next time. */
  const refresh=fetch(shellNavigation?INDEX:request,{cache:'no-cache'}).then(r=>{if(r.ok)cache.put(key,r.clone());return r}).catch(()=>null);
  if(saved){event.waitUntil(refresh);return saved}
  const r=await refresh;
  return r||new Response('Connect to the internet to open Souvenir.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 })());
});
