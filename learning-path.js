// Frequency-first Learning Path, with a practical 3BLD pool and optional full dictionary.
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
  // The 44 zero-observation pairs occur at the end of the full frequency ranking.
  // This preserves the existing position/cycle when switching between pools.
  const practicalOrder=fullCounts?order.filter(p=>(edgeCounts.get(p)||0)+(cornerCounts.get(p)||0)>0):order;
  let revealed=false;
  const state=()=>ctx.getState();
  const path=()=>{
    if(!state().learningPath||state().learningPath.version!==1)
      state().learningPath=blank();
    return state().learningPath;
  };
  const size=()=>VALID_SIZES.includes(Number(state().settings.pathSize))?Number(state().settings.pathSize):24;
  const poolMode=()=>state().settings.pathPool==='all'?'all':'practical';
  const activeOrder=()=>poolMode()==='all'?order:practicalOrder;
  const total=()=>activeOrder().length;
  const tier=position=>Math.min(Math.ceil(total()/96)-1,Math.floor(Math.min(total()-1,position)/96));
  const reviewPairs=()=>{
    const now=Date.now(),allowed=new Set(activeOrder());
    return ctx.pairs.filter(p=>{
      if(!allowed.has(p))return false;
      const s=ctx.stat(p);
      return s.seen>0&&(s.due<=now||s.streak<3);
    }).sort((a,b)=>(ctx.stat(a).due||0)-(ctx.stat(b).due||0)||rankIndex.get(a)-rankIndex.get(b));
  };
  // Keep review selection priority, but test in a different order from preview.
  // Shuffle only when recall begins, so preview remains consistent while studying.
  function shufflePairs(pairs){
    const shuffled=pairs.slice();
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    // Avoid retaining the exact preview order by chance when there are 2+ pairs.
    if(shuffled.length>1&&shuffled.every((pair,i)=>pair===pairs[i]))
      [shuffled[0],shuffled[1]]=[shuffled[1],shuffled[0]];
    return shuffled;
  }
  const current=s=>s.phase==='retry'?s.retry[s.retryIndex]:s.pairs[s.index];
  const commit=()=>{ctx.save();ctx.renderCards();};
  function start(kind){
    const p=path();
    if(p.session&&p.session.phase!=='complete')return;
    let pairs;
    if(kind==='review')pairs=reviewPairs().slice(0,size());
    else{
      if(p.position>=total())return ctx.toast('Begin a new cycle first');
      const end=Math.min(total(),(tier(p.position)+1)*96);
      pairs=activeOrder().slice(p.position,Math.min(p.position+size(),end));
    }
    if(!pairs.length)return ctx.toast('No pairs eligible for review');
    p.session={version:1,kind,pairs,index:0,phase:'preview',resumePhase:null,
      retry:[],retryIndex:0,first:{},final:{},started:Date.now()};
    revealed=false;commit();
  }
  function begin(){
    const s=path().session;if(!s||s.phase!=='preview')return;
    // Persist the shuffled order so pause, reload, and cross-device sync agree.
    if(s.kind==='review')s.pairs=shufflePairs(s.pairs);
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
      if(s.kind==='new')p.position=Math.min(total(),p.position+1);
      if(s.index>=s.pairs.length){
        if(s.kind==='review'&&s.retry.length>1)s.retry=shufflePairs(s.retry);
        s.phase=s.retry.length?'retry':'complete';
      }
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
    const p=path();if(p.position<total())return;
    if(!confirm('Start another '+total()+'-pair cycle? Your saved images and ratings stay intact.'))return;
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
    const p=path(),s=p.session,selected=size(),max=total(),position=Math.min(p.position,max),finished=p.position>=max;
    const tiers=Array.from({length:Math.ceil(max/96)},(_,i)=>{
      const length=Math.min(96,max-i*96),covered=Math.max(0,Math.min(length,position-i*96));
      return '<div class="path-tier '+(!finished&&tier(position)===i?'current':'')+'"><strong>Tier '+(i+1)+'</strong><small>Ranks '+(i*96+1)+'–'+(i*96+length)+' · '+covered+'/'+length+' covered</small><div class="progressbar"><span style="width:'+(covered/length*100)+'%"></span></div></div>';
    }).join('');
    const visited=ctx.pairs.filter(q=>ctx.stat(q).seen>0).length;
    let output='<div class="section-head"><div><h3>Learning Path</h3><p>Frequency first · '+max+' pairs · '+Math.ceil(max/96)+' tiers</p></div><span class="pill">Cycle '+p.cycle+'</span></div>'
      +'<div class="path-toolbar">'+modeButtons+'<label for="pathPool">Study pool <select id="pathPool" class="mini-select" '+(s&&s.phase!=='complete'?'disabled':'')+'><option value="practical" '+(poolMode()==='practical'?'selected':'')+'>Practical 3BLD · '+practicalOrder.length+'</option><option value="all" '+(poolMode()==='all'?'selected':'')+'>Full dictionary · 576</option></select></label><label for="pathSize">Pairs per session <select id="pathSize" class="mini-select">'
      +VALID_SIZES.map(n=>'<option value="'+n+'" '+(selected===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div>'
      +'<div class="progress-meter"><span>Covered in this cycle</span><strong>'+position+' / '+max+'</strong></div>'
      +'<div class="progressbar"><span style="width:'+(100*position/max).toFixed(2)+'%"></span></div>'
      +'<p class="subhint" style="text-align:left;margin:0 0 12px">Coverage means one first attempt, not mastery · '+visited+' distinct pairs practiced across all modes.</p>'
      +'<div class="path-tiers">'+tiers+'</div>'
      +'<p class="subhint" style="text-align:left;margin:0 0 15px">Edge and corner simulations count equally. ' + (fullCounts?'Practical mode excludes '+unobserved+' pairs never observed in '+ctx.sampleCount.toLocaleString()+' simulated traces; the full dictionary remains available. Zero observations do not prove impossibility for other cycle-break conventions.':'Frequency counts are published for '+rankKnown+' distinct pairs. Full dictionary is used until complete simulation data is available.') + '</p>';
    if(!s||s.phase==='complete'){
      const count=s?s.pairs.length:0;
      if(s)output+='<div class="session-panel"><h4>'+(s.kind==='new'?'Batch finished!':'Review finished!')+'</h4><p>'+count+' pairs tested · '+Object.values(s.first).filter(v=>v==='good').length+' immediate recalls · '+s.retry.length+' second looks.</p></div>';
      output+='<div class="session-panel"><h4>'+(finished?'All '+max+' covered!':'Continue your learning path')+'</h4><p>'
        +(finished?'Start another frequency-ordered cycle, or review weak associations.':'Next up: rank '+(p.position+1)+'. Changing the session size never resets progress.')+'</p></div>';
      const countNext=finished?0:Math.min(selected,max-p.position,(tier(p.position)+1)*96-p.position),weak=reviewPairs();
      output+='<div class="controls">'+(finished?'<button class="btn primary" id="pathNextCycle">Start next cycle</button>'
        :'<button class="btn primary" id="pathStart">Study next '+countNext+' · Tier '+(tier(p.position)+1)+'</button>')
        +'<button class="btn" id="pathReview" '+(!weak.length?'disabled':'')+'>Review weak / due ('+weak.length+')</button></div>';
    }else if(s.phase==='paused'){
      output+='<div class="session-panel"><h4>Paused and saved</h4><p>'+s.index+' of '+s.pairs.length+' first-pass pairs completed. Resume this session whenever you like.</p></div><div class="controls"><button class="btn primary" id="pathResume">Resume session</button></div>';
    }else if(s.phase==='preview'){
      output+='<div class="session-panel"><h4>'+ (s.kind==='new'?'Study these '+s.pairs.length+' associations':'Review these '+s.pairs.length+' associations')+'</h4><p>Look over each image. Tap one to edit it, then begin recall without hints.</p></div>'
        +(s.kind==='review'?'<p class="subhint" style="text-align:left;margin:8px 0 12px">Recall order is shuffled after this preview, including any second-look pairs.</p>':'')
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
    document.querySelector('#pathPool')?.addEventListener('change',e=>{
      if(s&&s.phase!=='complete')return; // Do not change the pool mid-session.
      state().settings.pathPool=e.target.value==='all'?'all':'practical';commit();
    });
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
