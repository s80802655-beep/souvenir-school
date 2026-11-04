/* Only public app-shell assets are cached. No API responses, tokens or school records. */
const ROOT=new URL('./',self.location.href);
const PREFIX='souvenir-pwa-'+encodeURIComponent(ROOT.pathname)+'-';
const CACHE=PREFIX+'shell-v2';
const SHELL=['teacher-math.js','teacher-tools.js','teacher-tools.css','offline-policy.js','offline-store.js','vendor/jspdf.umd.min.js','vendor/jspdf.plugin.autotable.min.js','assets/school-logo.jpg','index.html','client.js','config.js','pwa.js','manifest.webmanifest','assets/app-icon-32.png','assets/app-icon-180.png','assets/app-icon-192.png','assets/app-icon-512.png','assets/app-icon-maskable-512.png'];
const ASSETS=new Set(SHELL.map(path=>new URL(path,ROOT).href));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll([...ASSETS])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==ROOT.origin)return;
 const shellNavigation=request.mode==='navigate'&&(url.pathname===ROOT.pathname||url.pathname===new URL('index.html',ROOT).pathname);
 // The setup page, backups, database requests and unrelated GitHub sites never enter cache.
 if(!shellNavigation&&!ASSETS.has(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),key=shellNavigation?new URL('index.html',ROOT).href:request.url;
  try{const response=await fetch(request,{cache:'no-cache'});if(response.ok)await cache.put(key,response.clone());return response}
  catch{const saved=await cache.match(key);if(saved)return saved;return new Response('Connect to the internet to open Souvenir.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
 })());
});
