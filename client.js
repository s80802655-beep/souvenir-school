/* HTTPS adapter. Database credentials never belong in this file. */
(function(){
 if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0'));return h.slice(0,4).join('')+'-'+h.slice(4,6).join('')+'-'+h.slice(6,8).join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('')};
 let session=null;const storageKey='souvenir-session-'+(window.SOUVENIR_CONFIG?.apiUrl||'unconfigured');
 try{session=JSON.parse(localStorage.getItem(storageKey)||'null')}catch(e){}
 const setSession=s=>{session=s;try{s?localStorage.setItem(storageKey,JSON.stringify(s)):localStorage.removeItem(storageKey)}catch(e){}};
 const alive=()=>session&&session.expires_at*1000>Date.now();
 async function invoke(request){
 const url=window.SOUVENIR_CONFIG?.apiUrl;
 if(!url||!/^https:\/\//.test(url))throw Error('The school app is not connected yet. Set apiUrl in config.js to your Cloudflare Worker HTTPS address.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
 try{const response=await fetch(url.replace(/\/$/,'')+'/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.signal,cache:'no-store'});let result;try{result=await response.json()}catch{throw Error('The school server did not return data. Check the Worker address.')}if(!response.ok)throw Error(result.error?.message||'The school server could not complete the request.');return result}finally{clearTimeout(timeout)}
 }

 let publicSchoolPromise;
 async function publicSchool(){if(!window.SOUVENIR_CONFIG?.apiUrl)return;return publicSchoolPromise??=(async()=>{try{const r=await fetch(window.SOUVENIR_CONFIG.apiUrl.replace(/\/$/,'')+'/health',{cache:'no-store',signal:AbortSignal.timeout(8000)}),data=await r.json();if(data.schoolName&&window.STANDALONE_BOOT)window.STANDALONE_BOOT.schoolName=data.schoolName}catch{}})()}
 let pending=[],timer=null;
 function send(item){return new Promise(resolve=>{pending.push({item,resolve});if(timer)return;timer=setTimeout(async()=>{timer=null;const batch=pending;pending=[];try{const r=await invoke({kind:'batch',token:alive()?session.access_token:'',items:batch.map(v=>v.item)});if(r.error){batch.forEach(v=>v.resolve({data:null,error:r.error}));if(/AUTH_REQUIRED/.test(r.error.message)){setSession(null);if(typeof NEEDLOGIN!=='undefined'){NEEDLOGIN=true;render()}}}else batch.forEach((v,i)=>v.resolve(r.data[i]))}catch(e){batch.forEach(v=>v.resolve({data:null,error:{message:e.message}}))}},0)})}
 class Query{
  constructor(table){this.q={kind:'query',table,operation:'select',filters:[],orders:[]};this.promise=null}
  select(columns='*'){this.q.columns=columns;return this}eq(k,v){this.q.filters.push(['eq',k,v]);return this}in(k,v){this.q.filters.push(['in',k,v]);return this}gt(k,v){this.q.filters.push(['gt',k,v]);return this}
  order(k,o={}){this.q.orders.push([k,o.ascending!==false]);return this}range(a,b){this.q.range=[a,b];return this}
  single(){this.q.single=true;return this}maybeSingle(){this.q.single=true;this.q.maybeSingle=true;return this}
  insert(values){this.q.operation='insert';this.q.values=values;return this}update(values){this.q.operation='update';this.q.values=values;return this}delete(){this.q.operation='delete';return this}
  upsert(values,o={}){this.q.operation='upsert';this.q.values=values;this.q.conflict=o.onConflict;this.q.ignoreDuplicates=!!o.ignoreDuplicates;return this}
  then(ok,no){return(this.promise??=send(this.q)).then(ok,no)}catch(no){return(this.promise??=send(this.q)).catch(no)}
 }
 async function deriveStoredKey(password,saltHex){
  const salt=Uint8Array.from(saltHex.match(/../g),h=>parseInt(h,16));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},key,256);
  const h=await crypto.subtle.importKey('raw',bits,{name:'HMAC',hash:'SHA-256'},false,['sign']);new Uint8Array(bits).fill(0);
  const ck=await crypto.subtle.sign('HMAC',h,new TextEncoder().encode('Client Key'));
  const out=await crypto.subtle.digest('SHA-256',ck);new Uint8Array(ck).fill(0);
  return [...new Uint8Array(out)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 window.SouvenirPassword={deriveStoredKey};
 async function makeLoginProof(password,challenge){
  const salt=new Uint8Array(challenge.salt.match(/.{2}/g).map(h=>parseInt(h,16)));
  const passwordKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:challenge.iterations,hash:'SHA-256'},passwordKey,256);
  const saltedKey=await crypto.subtle.importKey('raw',bits,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  new Uint8Array(bits).fill(0);
  const clientKey=new Uint8Array(await crypto.subtle.sign('HMAC',saltedKey,new TextEncoder().encode('Client Key')));
  const storedKey=await crypto.subtle.digest('SHA-256',clientKey);
  const proofKey=await crypto.subtle.importKey('raw',storedKey,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const message='Souvenir login v1\n'+challenge.nonce+'\n'+challenge.phone;
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',proofKey,new TextEncoder().encode(message)));
  const proof=clientKey.map((b,i)=>b^signature[i]);clientKey.fill(0);
  return [...proof].map(b=>b.toString(16).padStart(2,'0')).join('');
 }
 async function auth(action,p={}){try{
  const hint=document.getElementById('lerr');if(hint)hint.textContent=action==='signup'?'Creating your account. Please wait…':'Signing in. Please wait…';
  let r;
  if(action==='login'&&crypto.subtle){
   const c=await invoke({kind:'auth',action:'challenge',email:p.email});
   if(c.error)return{data:{session:null},error:c.error};
   const proof=await makeLoginProof(p.password,c.data);
   r=await invoke({kind:'auth',action:'loginProof',email:p.email,nonce:c.data.nonce,proof});
   }else if(action==='signup'){
   if(!p.password||p.password.length<8||p.password.length>256)throw Error('Use a password of 8–256 characters.');
   const salt=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const key=await deriveStoredKey(p.password,salt);
   r=await invoke({kind:'auth',action:'signup',email:p.email,code:p.code,salt,storedKey:key});
  }else throw Error('Use an up-to-date browser with HTTPS to sign in.');
  if(r.error)return{data:{session:null},error:r.error};setSession(r.data.session);return{data:{session:r.data.session},error:null};
 }catch(e){return{data:{session:null},error:{message:e.message}}}}

 window.SOUVENIR_DB={from:t=>new Query(t),rpc:(name,args)=>send({kind:'rpc',name,args}),auth:{getSession:async()=>{if(!alive())await publicSchool();return{data:{session:alive()?session:null},error:null}},signInWithPassword:p=>auth('login',p),signUp:p=>auth('signup',{...p,code:document.getElementById('lcode')?.value||''}),signOut:async()=>{setSession(null);return{error:null}}}};
})();
