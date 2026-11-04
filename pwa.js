/* Installable shell only. School data and authentication remain online. */
(()=>{
 let pendingInstall=null,button;
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 function updateButton(){if(button)button.hidden=standalone()}
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pendingInstall=event;updateButton()});
 window.addEventListener('appinstalled',()=>{pendingInstall=null;updateButton()});
 function instructions(){
  if(document.getElementById('souvenir-install-help'))return;
  const dialog=document.createElement('dialog');dialog.id='souvenir-install-help';dialog.setAttribute('aria-labelledby','souvenir-install-title');dialog.style.cssText='max-width:430px;width:90%;padding:26px;border:1px solid #c8d7da;border-radius:14px;background:#fff;color:#12313e;font:16px/1.5 system-ui,sans-serif';
  dialog.innerHTML='<img src="assets/app-icon-192.png" alt="Souvenir app icon" width="72" height="72" style="border-radius:16px"><h2 id="souvenir-install-title">Install Souvenir</h2><p>On Android, open this website in Chrome, tap the three-dot menu, then <b>Install app</b> or <b>Add to Home screen</b>.</p><p>On iPhone or iPad, open it in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</p><p>School records need an internet connection.</p><form method="dialog"><button class="btn" style="background:#087e7c;color:white;padding:10px 18px;border:0;border-radius:7px;cursor:pointer">Close</button></form>';
  dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }
 async function install(){
  if(!pendingInstall){instructions();return}
  const event=pendingInstall;pendingInstall=null;
  try{await event.prompt();await event.userChoice}catch{instructions()}finally{updateButton()}
 }
 function ready(){
  button=document.createElement('button');button.id='souvenir-install';button.type='button';button.textContent='Install app';button.setAttribute('aria-label','Install Souvenir app');button.style.cssText='position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:20;border:1px solid #dfb95b;border-radius:24px;background:#12313e;color:#fff;box-shadow:0 3px 12px #12313e33;padding:12px 18px;font:600 14px system-ui,sans-serif;cursor:pointer';button.onclick=install;document.body.append(button);updateButton();
  const media=window.matchMedia('(display-mode: standalone)');media.addEventListener?.('change',updateButton);
  if('serviceWorker'in navigator&&window.isSecureContext)navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{/* Browser menu can still offer installation. */});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
