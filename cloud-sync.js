// Optional, local-first sync for the GitHub Pages BLD Memo app.
// Requires Firebase project credentials in firebase-config.js and owner-only Firestore rules.
// Never replace an existing local progress database without explicit consent.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const panel=document.getElementById('cloudSyncPanel');
const label=document.getElementById('cloudSyncStatus');
const actions=document.getElementById('cloudSyncActions');
const api=window.BLD_SYNC_APP;
const KEY='bld-memo-cloud-meta-v1';
const config=window.BLD_FIREBASE_CONFIG;
const available=config&&['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k].trim());
let auth,db,user,documentRef,remote=null,mode='unconfigured',detail='',busy=false,pending=null,checking=false,changeSerial=0;
let meta=readMeta();

function readMeta(){
  try{const value=JSON.parse(localStorage.getItem(KEY));return value&&typeof value==='object'?value:null;}catch{return null;}
}
function writeMeta(){try{localStorage.setItem(KEY,JSON.stringify(meta));}catch{/* App's own local storage warning handles failures. */}}
function text(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function notify(message,extra=''){
  mode=message;detail=extra;render();
}
function button(action,name,primary=false){
  return '<button type="button" class="btn sm'+(primary?' primary':'')+'" data-cloud-action="'+action+'">'+name+'</button>';
}
function render(){
  if(!panel||!label||!actions)return;
  const who=user?' · '+text(user.email||'Google account'):'';
  let title='',help='',buttons='';
  switch(mode){
    case 'unconfigured':title='Cloud sync not configured';help='Local practice works. One-time Firebase setup is needed.';break;
    case 'signedout':title='Cloud sync off';help='Sign in on your phone first, then on your computer.';buttons=button('signin','Sign in with Google',true);break;
    case 'loading':title='Checking cloud progress'+who;help='Your local progress is safe.';break;
    case 'initial':title='Cloud is empty'+who;help='First, upload the phone with your existing progress. No data will be erased.';buttons=button('upload','Upload this device',true);break;
    case 'choose':title='Two existing progress copies'+who;help='The cloud and this device both have data. Neither has been changed.';buttons=button('download','Use cloud copy',true)+button('upload','Replace cloud copy');break;
    case 'conflict':title='Sync conflict — nothing overwritten'+who;help='Both copies changed. Export a backup before choosing one; no automatic overwrite.';buttons=button('backup','Export backup',true)+button('download','Use cloud copy')+button('upload','Replace cloud copy');break;
    case 'paused':title='Cloud sync paused'+who;help='Local reset did not erase the cloud. Restore from the cloud when ready.';buttons=button('download','Restore cloud copy',true);break;
    case 'offline':title='Cloud unavailable'+who;help='Practice remains saved here. Recheck when online.';buttons=button('check','Try again',true);break;
    case 'pending':title='Local changes waiting to sync'+who;help='Saved on this device. Upload will retry when connected.';buttons=button('check','Check now');break;
    case 'ready':title=(meta?.dirty?'Local changes waiting to sync':'Cloud synced')+who;help='Progress syncs when you practice and when you return to this tab.';buttons=button('check','Check now');break;
    default:title='Cloud sync';help='Local practice works.';break;
  }
  label.textContent=title+(detail?' · '+detail:'');
  panel.querySelector('#cloudSyncHelp').textContent=help;
  if(user&&mode!=='loading')buttons+=button('signout','Sign out');
  actions.innerHTML=buttons;
  actions.querySelectorAll('button').forEach(b=>b.disabled=busy);
}
function markMeta(revision,dirty=false){
  meta={uid:user.uid,rev:revision,dirty,paused:false};
  writeMeta();
}
function userData(){
  const s=api.getState();
  return Object.keys(s.custom||{}).length>0||Object.keys(s.progress||{}).length>0||
    (s.history||[]).length>0||(s.memoLogs||[]).length>0||
    (s.seqRuns||0)>0||(s.learningPath?.position||0)>0||
    !!s.learningPath?.session||(s.cardDaily?.newCount||0)>0||
    !!s.cardSession;
}
function uploadPayload(){
  const {sheet,...userState}=api.getState();
  return JSON.stringify(userState);
}
async function loadRemote(){
  const docSnap=await getDocFromServer(documentRef);
  if(!docSnap.exists())return null;
  const d=docSnap.data();
  if(!Number.isSafeInteger(d.revision)||d.revision<1||typeof d.payload!=='string')throw Error('Invalid cloud data');
  const state=JSON.parse(d.payload);
  if(state?.version!==1||!state.custom||!state.progress||!state.settings)throw Error('Invalid cloud backup');
  return {revision:d.revision,state};
}
function pullCloud(automatic=false){
  if(!remote)return;
  if(!automatic&&userData()){
    if(!confirm('Replace this device\'s local progress with the cloud copy? A backup will download first.'))return;
    api.exportBackup();
  }
  // Keep each device's own published Sheet snapshot: only private learning data syncs.
  api.applyRemote(remote.state);
  markMeta(remote.revision,false);
  changeSerial++;
  notify('ready','Downloaded cloud progress');
}
async function pushCloud(expectedRevision,force=false){
  if(!user||busy||mode==='paused')return;
  busy=true;render();
  const started=changeSerial;
  const payload=uploadPayload();
  try{
    const next=await runTransaction(db,async tx=>{
      const snap=await tx.get(documentRef);
      const actual=snap.exists()?snap.data().revision:null;
      if(actual!==expectedRevision)throw Error('SYNC_CONFLICT');
      const revision=(actual||0)+1;
      tx.set(documentRef,{revision,payload,updatedAt:serverTimestamp()});
      return revision;
    });
    const stillDirty=changeSerial!==started;
    markMeta(next,stillDirty);
    remote={revision:next,state:JSON.parse(payload)};
    notify('ready',stillDirty?'More changes pending':'Changes uploaded');
    if(stillDirty)scheduleUpload();
  }catch(err){
    if(String(err).includes('SYNC_CONFLICT')){
      try{remote=await loadRemote();}catch{/* Keep both local and cloud untouched. */}
      notify('conflict','A second device updated the cloud');
    }else{
      if(meta){meta.dirty=true;writeMeta();}
      notify('offline','Upload will retry');
    }
  }finally{busy=false;render();}
}
function scheduleUpload(){
  clearTimeout(pending);
  pending=setTimeout(()=>{
    if(!user||!meta||meta.uid!==user.uid||meta.paused)return;
    if(mode==='ready'||mode==='pending')pushCloud(meta.rev);
  },1600);
}
function localChanged(){
  changeSerial++;
  if(!meta||meta.paused)return;
  meta.dirty=true;writeMeta();
  if(user&&meta.uid===user.uid){
    if(mode==='ready'||mode==='pending'){
      notify('pending');
      scheduleUpload();
    }
  }
}
async function check(){
  if(!user||checking||busy)return;
  checking=true;
  clearTimeout(pending);
  notify('loading');
  try{
    remote=await loadRemote();
    if(meta?.uid===user.uid&&meta.paused){notify('paused');return;}
    if(!remote){notify('initial');return;}
    if(!meta||meta.uid!==user.uid){
      if(userData())notify('choose');
      else pullCloud(true);
      return;
    }
    if(remote.revision!==meta.rev){
      if(meta.dirty)notify('conflict','Cloud changed since this device last synced');
      else pullCloud(true);
      return;
    }
    if(meta.dirty){
      notify('pending');
      scheduleUpload();
    }else{
      notify('ready');
    }
  }catch(err){notify('offline',String(err?.message||'Network error').slice(0,90));}
  finally{checking=false;}
}
async function uploadSelected(){
  if(!user||busy)return;
  const replacing=!!remote;
  if(replacing){
    if(!confirm('REPLACE the cloud copy with this device\'s progress? Cloud-only changes will be lost. Export a backup first.'))return;
    api.exportBackup();
  }else if(!confirm('Upload this device\'s progress as your first cloud copy? Do this on the PHONE with your existing progress.'))return;
  const expected=remote?remote.revision:null;
  notify('pending');
  await pushCloud(expected,true);
}
function pauseForReset(){
  clearTimeout(pending);
  if(meta){
    meta.paused=true;
    meta.dirty=false;
    writeMeta();
  }
  if(user)notify('paused');
}
panel?.addEventListener('click',async event=>{
  const action=event.target.closest('[data-cloud-action]')?.dataset.cloudAction;
  if(!action||busy)return;
  switch(action){
    case 'signin':
      try{notify('loading');await signInWithPopup(auth,new GoogleAuthProvider());}
      catch(err){notify('signedout',String(err.code||err.message).slice(0,90));}
      break;
    case 'signout':
      if(meta?.dirty&&!confirm('Unsynced changes are saved only on this device. Sign out anyway?'))return;
      await signOut(auth);
      break;
    case 'upload':await uploadSelected();break;
    case 'download':pullCloud();break;
    case 'check':await check();break;
    case 'backup':api.exportBackup();break;
  }
});
window.BLDSync={localChanged,pauseForReset,check};
render();
if(available&&api){
  try{
    const app=initializeApp(config);
    auth=getAuth(app);
    db=getFirestore(app);
    onAuthStateChanged(auth,async nextUser=>{
      user=nextUser;
      if(!user){remote=null;notify('signedout');return;}
      documentRef=doc(db,'users',user.uid,'appData','state');
      await check();
    },err=>notify('offline',String(err.message).slice(0,90)));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)check();});
    window.addEventListener('focus',()=>{if(user)check();});
    window.addEventListener('online',()=>{if(user)check();});
    setInterval(()=>{if(user&&!document.hidden)check();},90000);
  }catch(error){notify('unconfigured',String(error.message).slice(0,90));}
}else{
  notify('unconfigured');
}
