// Frequency-first, persistent 576-pair Learning Path.
// This file deliberately does not write to Google Sheets.
(function(global){
'use strict';
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWX';
const VALID_SIZES=[12,24,48];
const isPair=p=>typeof p==='string'&&p.length===2&&[...p].every(c=>ALPHABET.includes(c));
const blank=()=>({version:1,cycle:1,position:0,session:null});
function sanitize(raw){
  if(!raw||raw.version!==1)return blank();
  const path={
    version:1,
    cycle:Number.isInteger(raw.cycle)?Math.max(1,Math.min(100000,raw.cycle)):1,
    position:Number.isInteger(raw.position)?Math.max(0,Math.min(576,raw.position)):0,
    session:null
  };
  const s=raw.session;
  if(!s||s.version!==1||!['new','review'].includes(s.kind)
     ||!Array.isArray(s.pairs)||!s.pairs.length||s.pairs.length>48
     ||!s.pairs.every(isPair)||new Set(s.pairs).size!==s.pairs.length
     ||!Number.isInteger(s.index)||s.index<0||s.index>s.pairs.length
     ||!['preview','active','retry','paused','complete'].includes(s.phase))return path;
  const first={},final={};
  for(const p of s.pairs){
    if(['good','hard','again'].includes(s.first?.[p]))first[p]=s.first[p];
    if(['good','hard','again'].includes(s.final?.[p]))final[p]=s.final[p];
  }
  const retry=Array.isArray(s.retry)?[...new Set(s.retry.filter(p=>s.pairs.includes(p)&&first[p]!=='good'))].slice(0,48):[];
  path.session={
    version:1,kind:s.kind,pairs:s.pairs.slice(),index:s.index,phase:s.phase,
    resumePhase:['preview','active','retry'].includes(s.resumePhase)?s.resumePhase:null,
    retry,retryIndex:Number.isInteger(s.retryIndex)?Math.max(0,Math.min(retry.length,s.retryIndex)):0,
    first,final,started:Number.isFinite(s.started)?s.started:Date.now()
  };
  return path;
}
function create(ctx){
  const edgeCounts=new Map(ctx.simEdge.map(x=>[x.pair,x.count]));
  const cornerCounts=new Map(ctx.simCorner.map(x=>[x.pair,x.count]));
  const edgeTotal=ctx.edgeTotal||1,cornerTotal=ctx.cornerTotal||1;
  const score=p=>(edgeCounts.get(p)||0)/edgeTotal+(cornerCounts.get(p)||0)/cornerTotal;
  const observed=p=>Number(ctx.observed(p,'edge')===true)+Number(ctx.observed(p,'corner')===true);
  const order=ctx.pairs.slice().sort((a,b)=>score(b)-score(a)||observed(b)-observed(a)||a.localeCompare(b));
  const rankKnown=new Set([...edgeCounts.keys(),...cornerCounts.keys()]).size;
  const fullCounts=ctx.simEdge.length===576&&ctx.simCorner.length===576;
  const unobserved=order.filter(pair=>(edgeCounts.get(pair)||0)+(cornerCounts.get(pair)||0)===0).length;
  const rankIndex=new Map(order.map((p,i)=>[p,i]));
  let revealed=false;
  const state=()=>ctx.getState();
  const path=()=>{
    if(!state().learningPath||state().learningPath.version!==1)
      state().learningPath=blank();
    return state().learningPath;
  };
  const size=()=>VALID_SIZES.includes(Number(state().settings.pathSize))?Number(state().settings.pathSize):24;
  const tier=position=>Math.min(5,Math.floor(Math.min(575,position)/96));
  const reviewPairs=()=>{
    const now=Date.now();
    return ctx.pairs.filter(p=>{
      const s=ctx.stat(p);
      return s.seen>0&&(s.due<=now||s.streak<3);
    }).sort((a,b)=>(ctx.stat(a).due||0)-(ctx.stat(b).due||0)||rankIndex.get(a)-rankIndex.get(b));
  };
  const current=s=>s.phase==='retry'?s.retry[s.retryIndex]:s.pairs[s.index];
  const commit=()=>{ctx.save();ctx.renderCards();};
  function start(kind){
    const p=path();
    if(p.session&&p.session.phase!=='complete')return;
    let pairs;
    if(kind==='review')pairs=reviewPairs().slice(0,size());
    else{
      if(p.position>=576)return ctx.toast('Begin a new cycle first');
      const end=(tier(p.position)+1)*96;
      pairs=order.slice(p.position,Math.min(p.position+size(),end));
    }
    if(!pairs.length)return ctx.toast('No pairs eligible for review');
    p.session={version:1,kind,pairs,index:0,phase:'preview',resumePhase:null,
      retry:[],retryIndex:0,first:{},final:{},started:Date.now()};
    revealed=false;commit();
  }
  function begin(){
    const s=path().session;if(!s||s.phase!=='preview')return;
    s.phase='active';revealed=false;commit();
  }
  function pause(){
    const s=path().session;
    if(!s||!['preview','active','retry'].includes(s.phase))return;
    s.resumePhase=s.phase;s.phase='paused';revealed=false;commit();
  }
  function resume(){
    const s=path().session;if(!s||s.phase!=='paused')return;
    s.phase=['preview','active','retry'].includes(s.resumePhase)?s.resumePhase:'active';
    s.resumePhase=null;revealed=false;commit();
  }
  function rate(rating){
    const p=path(),s=p.session;
    if(!s||!['active','retry'].includes(s.phase)||!revealed
       ||!['good','hard','again'].includes(rating))return;
    const pair=current(s);if(!isPair(pair))return;
    ctx.recordRating(pair,rating);
    if(s.phase==='active'){
      s.first[pair]=rating;s.final[pair]=rating;
      if(rating!=='good')s.retry.push(pair);
      s.index++;
      if(s.kind==='new')p.position=Math.min(576,p.position+1);
      if(s.index>=s.pairs.length)s.phase=s.retry.length?'retry':'complete';
    }else{
      s.final[pair]=rating;s.retryIndex++;
      if(s.first[pair]!=='good'){
        const progress=state().progress[pair];
        progress.streak=Math.min(progress.streak,1);
        progress.due=Math.min(progress.due,Date.now()+86400000);
      }
      if(s.retryIndex>=s.retry.length)s.phase='complete';
    }
    revealed=false;commit();
  }
  function nextCycle(){
    const p=path();if(p.position<576)return;
    if(!confirm('Start another 576-pair cycle? Your saved images and ratings stay intact.'))return;
    p.cycle++;p.position=0;p.session=null;revealed=false;commit();
  }
  const modeButtons='<div class="seg" aria-label="Flashcard mode"><button data-cardmode="guided">Guided session</button><button data-cardmode="unlimited">Unlimited</button><button data-cardmode="path" class="active" aria-pressed="true">Learning Path</button></div>';
  const htmlPair=(pair,isRevealed)=>{
    return '<div class="micro">'+(isRevealed?'Your visual association':'Recall the image')+'</div>'
      +'<div class="bigpair">'+pair+'</div>'
      +(isRevealed?'<div class="meaning">'+ctx.esc(ctx.assoc(pair))+'</div>'
      +(ctx.note(pair)?'<div class="note">'+ctx.esc(ctx.note(pair))+'</div>':'')
      :'<div class="concealed">Tap to reveal</div>');
  };
  function render(){
    const p=path(),s=p.session,selected=size(),finished=p.position===576;
    const tiers=Array.from({length:6},(_,i)=>{
      const covered=Math.max(0,Math.min(96,p.position-i*96));
      return '<div class="path-tier '+(!finished&&tier(p.position)===i?'current':'')+'"><strong>Tier '+(i+1)+'</strong><small>Ranks '+(i*96+1)+'–'+((i+1)*96)+' · '+covered+'/96 covered</small><div class="progressbar"><span style="width:'+(covered/96*100)+'%"></span></div></div>';
    }).join('');
    const visited=ctx.pairs.filter(q=>ctx.stat(q).seen>0).length;
    let output='<div class="section-head"><div><h3>Learning Path</h3><p>Frequency first · 576 pairs · 6 tiers of 96</p></div><span class="pill">Cycle '+p.cycle+'</span></div>'
      +'<div class="path-toolbar">'+modeButtons+'<label for="pathSize">Pairs per session <select id="pathSize" class="mini-select">'
      +VALID_SIZES.map(n=>'<option value="'+n+'" '+(selected===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div>'
      +'<div class="progress-meter"><span>Covered in this cycle</span><strong>'+p.position+' / 576</strong></div>'
      +'<div class="progressbar"><span style="width:'+(100*p.position/576).toFixed(2)+'%"></span></div>'
      +'<p class="subhint" style="text-align:left;margin:0 0 12px">Coverage means one first attempt, not mastery · '+visited+' distinct pairs practiced across all modes.</p>'
      +'<div class="path-tiers">'+tiers+'</div>'
      +'<p class="subhint" style="text-align:left;margin:0 0 15px">Edge and corner simulations count equally. ' + (fullCounts?'Full counts cover all 576 pairs across '+ctx.sampleCount.toLocaleString()+' legal states. '+unobserved+' pairs were never observed; these are ranked last with alphabetical ties. Zero observations do not prove impossibility.':'Frequency counts are published for '+rankKnown+' distinct pairs. Remaining pairs use observed/not-observed grouping and alphabetical ties.') + '</p>';
    if(!s||s.phase==='complete'){
      const count=s?s.pairs.length:0;
      if(s)output+='<div class="session-panel"><h4>'+(s.kind==='new'?'Batch finished!':'Review finished!')+'</h4><p>'+count+' pairs tested · '+Object.values(s.first).filter(v=>v==='good').length+' immediate recalls · '+s.retry.length+' second looks.</p></div>';
      output+='<div class="session-panel"><h4>'+(finished?'All 576 covered!':'Continue your learning path')+'</h4><p>'
        +(finished?'Start another frequency-ordered cycle, or review weak associations.':'Next up: rank '+(p.position+1)+'. Changing the session size never resets progress.')+'</p></div>';
      const countNext=Math.min(selected,(tier(p.position)+1)*96-p.position),weak=reviewPairs();
      output+='<div class="controls">'+(finished?'<button class="btn primary" id="pathNextCycle">Start next cycle</button>'
        :'<button class="btn primary" id="pathStart">Study next '+countNext+' · Tier '+(tier(p.position)+1)+'</button>')
        +'<button class="btn" id="pathReview" '+(!weak.length?'disabled':'')+'>Review weak / due ('+weak.length+')</button></div>';
    }else if(s.phase==='paused'){
      output+='<div class="session-panel"><h4>Paused and saved</h4><p>'+s.index+' of '+s.pairs.length+' first-pass pairs completed. Resume this session whenever you like.</p></div><div class="controls"><button class="btn primary" id="pathResume">Resume session</button></div>';
    }else if(s.phase==='preview'){
      output+='<div class="session-panel"><h4>'+ (s.kind==='new'?'Study these '+s.pairs.length+' associations':'Review these '+s.pairs.length+' associations')+'</h4><p>Look over each image. Tap one to edit it, then begin recall without hints.</p></div>'
        +'<div class="path-preview">'+s.pairs.map(q=>'<button data-path-edit="'+q+'"><strong>'+q+'</strong><span>'+ctx.esc(ctx.assoc(q))+'</span></button>').join('')+'</div>'
        +'<div class="controls"><button class="btn primary" id="pathBegin">Start recall · '+s.pairs.length+'</button><button class="btn" id="pathPause">Pause & save</button></div>';
    }else if(s.phase==='active'||s.phase==='retry'){
      const retrying=s.phase==='retry',i=retrying?s.retryIndex:s.index,denom=retrying?s.retry.length:s.pairs.length,q=current(s);
      output+='<div class="session-head"><span>'+(retrying?'Second look · missed pairs':s.kind==='review'?'Review':'Frequency-first learning')+'</span><span>'+(i+1)+' / '+denom+'</span></div>'
        +'<div class="session-meter"><span style="width:'+(i/denom*100)+'%"></span></div>'
        +'<div class="practice-area"><'+(revealed?'div':'button type="button" id="pathReveal"')+' class="flashcard'+(revealed?'':' reveal-card')+'">'
        +htmlPair(q,revealed)+'</'+(revealed?'div':'button')+'><div class="controls">'
        +(revealed?'<button class="btn again" data-path-rate="again">↻ Again</button><button class="btn warn" data-path-rate="hard">◷ Hard</button><button class="btn good" data-path-rate="good">✓ Got it</button><button class="btn" id="pathEdit">✎ Edit</button>':'')
        +'<button class="btn" id="pathPause">Pause & save</button></div>'
        +'<p class="subhint">No random repeats: every pair appears once, then missed pairs get a second look.</p></div>';
    }
    document.querySelector('#app').innerHTML=output;
    document.querySelectorAll('[data-cardmode]').forEach(b=>b.addEventListener('click',()=>{revealed=false;ctx.changeMode(b.dataset.cardmode);}));
    const on=(id,fn)=>document.querySelector('#'+id)?.addEventListener('click',fn);
    document.querySelector('#pathSize')?.addEventListener('change',e=>{state().settings.pathSize=Number(e.target.value);commit();});
    on('pathStart',()=>start('new'));on('pathReview',()=>start('review'));on('pathBegin',begin);
    on('pathPause',pause);on('pathResume',resume);on('pathNextCycle',nextCycle);
    on('pathReveal',()=>{revealed=true;render();});
    on('pathEdit',()=>ctx.openEditor(current(s)));
    document.querySelectorAll('[data-path-rate]').forEach(b=>b.addEventListener('click',()=>rate(b.dataset.pathRate)));
    document.querySelectorAll('[data-path-edit]').forEach(b=>b.addEventListener('click',()=>ctx.openEditor(b.dataset.pathEdit)));
  }
  return {render,rankedPairs:order.slice(),rankKnown,start,rate,begin,pause,resume,hide:()=>{revealed=false},getPath:path};
}
global.BLDMemoPath={create,sanitize,blank};
})(window);
