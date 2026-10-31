(function(global){
'use strict';
const SOURCES=['learned','due','weak','all','mixed'], DIRECTIONS=['both','forward','reverse'];
const labels={learned:'Learned / practiced',due:'Due for review',weak:'Weak recall',all:'All dictionary',mixed:'Mixed · reviews + dictionary'};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const valid=p=>typeof p==='string'&&/^[A-X]{2}$/.test(p);
function sanitize(s){
  if(!s||s.version!==2||!Array.isArray(s.cards)||!s.cards.length||s.cards.length>48||!s.cards.every(c=>c&&valid(c.pair)&&['forward','reverse'].includes(c.direction))||!Number.isInteger(s.index)||s.index<0||s.index>s.cards.length)return null;
  const ratings={};for(const [p,r] of Object.entries(s.ratings||{}))if(valid(p)&&['again','hard','good'].includes(r))ratings[p]=r;
  return {version:2,cards:s.cards.map(c=>({pair:c.pair,direction:c.direction})),index:s.index,phase:s.index===s.cards.length?'finished':s.phase==='paused'?'paused':'active',ratings,source:SOURCES.includes(s.source)?s.source:'all',direction:DIRECTIONS.includes(s.direction)?s.direction:'both',group:s.group==='all'||/^[A-X]$/.test(s.group)?s.group:'all'};
}
function select(pairs,stat,source,now=Date.now(),size=12){
  const learned=pairs.filter(p=>stat(p).seen>0),due=learned.filter(p=>!stat(p).due||stat(p).due<=now),weak=learned.filter(p=>stat(p).streak<3);
  if(source==='learned')return shuffle(learned);
  if(source==='due')return shuffle(due);
  if(source==='weak')return shuffle(weak);
  if(source==='mixed'){const priority=shuffle([...new Set([...due,...weak])]);return [...priority.slice(0,Math.ceil(size/2)),...shuffle(pairs.filter(p=>!priority.slice(0,Math.ceil(size/2)).includes(p)))];}
  return shuffle(pairs);
}
function create(ctx){
  let revealed=false;
  const state=()=>ctx.getState();
  const current=()=>state().cardSession;
  function options(){const x=state().settings;return {source:SOURCES.includes(x.guidedSource)?x.guidedSource:'learned',direction:DIRECTIONS.includes(x.guidedDirection)?x.guidedDirection:'both',size:[6,12,24].includes(+x.guidedSize)?+x.guidedSize:12,group:x.guidedGroup==='all'||/^[A-X]$/.test(x.guidedGroup)?x.guidedGroup:'all'};}
  function start(legacy=false){
    const o=options(),old=current();
    let pairs=legacy?[...new Set([old.current,...(old.queue||[]),...(old.retryQueue||[]),...(old.batch||[])].filter(valid))]:select(ctx.pairs.filter(p=>o.group==='all'||p[0]===o.group),ctx.stat,o.source,Date.now(),o.size).slice(0,o.size);
    if(!pairs.length)return ctx.toast('No matching pairs. Try All dictionary or Learning Path to learn new images.');
    const cards=o.direction==='both'?[...shuffle(pairs).map(pair=>({pair,direction:'forward'})),...shuffle(pairs).map(pair=>({pair,direction:'reverse'}))]:shuffle(pairs).map(pair=>({pair,direction:o.direction}));
    state().cardSession={version:2,cards,index:0,phase:'active',ratings:{},source:o.source,direction:o.direction,group:o.group};revealed=false;ctx.save();ctx.render();
  }
  function rate(r){const s=current();if(s?.version!==2||s.phase!=='active'||!revealed||!['again','hard','good'].includes(r))return;
    const c=s.cards[s.index],rank={good:0,hard:1,again:2},previous=s.ratings[c.pair];
    s.ratings[c.pair]=previous&&rank[previous]>rank[r]?previous:r;
    // One durable rating per pair: use the weaker direction, without promoting immediate recognition.
    if(!s.cards.slice(s.index+1).some(x=>x.pair===c.pair))ctx.recordRating(c.pair,s.ratings[c.pair]);
    s.index++;if(s.index===s.cards.length)s.phase='finished';revealed=false;ctx.save();ctx.render();
  }
  function render(){
    const o=options(),s=current(),esc=ctx.esc;
    const selectHTML=(id,values,value,names)=>`<select class="mini-select" id="${id}">${values.map(v=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${names?.[v]||v}</option>`).join('')}</select>`;
    let body=`<div class="options-row"><label>Selection ${selectHTML('guidedSource',SOURCES,o.source,labels)}</label><label>Direction ${selectHTML('guidedDirection',DIRECTIONS,o.direction,{both:'Both directions',forward:'Pair → image',reverse:'Image → pair'})}</label><label>Pairs ${selectHTML('guidedSize',[6,12,24],o.size)}</label><label>First letter ${selectHTML('guidedGroup',['all',...'ABCDEFGHIJKLMNOPQRSTUVWX'],o.group,{all:'All letters'})}</label></div>`;
    const buttons='<button class="btn primary" id="guidedStart">Start cold session</button>';
    if(s&&s.version!==2){body+='<div class="session-panel"><h4>Saved session from the previous version</h4><p>Your ratings are preserved. Resume its pairs as cold retrieval with your selected direction.</p></div><div class="controls"><button class="btn primary" id="guidedLegacy">Resume saved pairs</button>'+buttons+'</div>';}
    else if(!s||s.phase==='finished'){
      const counts=s?Object.values(s.ratings):[];
      body+=`<div class="session-panel"><h4>${s?'Session complete':'Cold retrieval'}</h4><p>${s?`${counts.filter(r=>r==='good').length} recalled · ${counts.filter(r=>r==='hard').length} hard · ${counts.filter(r=>r==='again').length} missed. The weaker direction determines each pair’s review schedule.`:'Recall before revealing. Both directions tests every selected pair each way, in separate shuffled passes. Learned means previously rated, not mastered.'}</p><p>No previews. Use Learning Path when you want to learn new images. Duplicate dictionary words can map to multiple pairs; check the intended pair after revealing.</p></div><div class="controls">${buttons}</div>`;
    }else if(s.phase==='paused')body+='<div class="session-panel"><h4>Paused — your place is saved</h4></div><div class="controls"><button class="btn primary" id="guidedResume">Resume session</button>'+buttons+'</div>';
    else {const c=s.cards[s.index],reverse=c.direction==='reverse';body+=`<div class="session-head"><span>${esc(labels[s.source])} · ${s.direction==='both'?'Both directions':s.direction==='reverse'?'Image → pair':'Pair → image'}</span><span>${s.index+1} / ${s.cards.length}</span></div><div class="practice-area"><p class="subhint">${reverse?'Image → letter pair':'Letter pair → image'} · Recall before revealing</p><${revealed?'div':'button type="button" id="guidedReveal"'} class="flashcard${revealed?'':' reveal-card'}"><div class="micro">${reverse?'Which letter pair?':'Picture this pair'}</div><div class="${reverse?'meaning':'bigpair'}" style="overflow-wrap:anywhere">${esc(reverse?ctx.assoc(c.pair):c.pair)}</div>${revealed?`<div class="${reverse?'bigpair':'meaning'}">${esc(reverse?c.pair:ctx.assoc(c.pair))}</div>${ctx.note(c.pair)?`<div class="note">${esc(ctx.note(c.pair))}</div>`:''}`:'<div class="concealed">Tap to reveal the answer</div>'}</${revealed?'div':'button'}><div class="controls">${revealed?'<button class="btn again" data-guided-rate="again">↻ Again</button><button class="btn warn" data-guided-rate="hard">◷ Hard</button><button class="btn good" data-guided-rate="good">✓ Got it</button><button class="btn" id="guidedEdit">✎ Edit</button>':''}<button class="btn" id="guidedPause">Pause & save</button></div></div>`;}
    body+='<p class="subhint">Controls apply to the next session. In both-direction sessions, answers stay saved with your place; each pair updates progress after both attempts.</p>';
    ctx.mount(body);
    for(const key of ['Source','Direction','Size','Group'])document.getElementById('guided'+key).onchange=e=>{state().settings['guided'+key]=key==='Size'?+e.target.value:e.target.value;ctx.save();};
    const bind=(id,fn)=>document.getElementById(id)?.addEventListener('click',fn);
    bind('guidedStart',()=>{if(current()&&current().phase!=='finished'&&!confirm('Replace this session? Completed ratings stay saved.'))return;start();});
    bind('guidedLegacy',()=>start(true));bind('guidedReveal',()=>{revealed=true;render();});
    bind('guidedPause',()=>{s.phase='paused';revealed=false;ctx.save();render();});bind('guidedResume',()=>{s.phase='active';revealed=false;ctx.save();render();});
    bind('guidedEdit',()=>ctx.openEditor(s.cards[s.index].pair));document.querySelectorAll('[data-guided-rate]').forEach(b=>b.onclick=()=>rate(b.dataset.guidedRate));
  }
  return {render,hide:()=>{revealed=false;},key:e=>{if(e.code==='Space'){e.preventDefault();if(current()?.phase==='active'){revealed=true;render();}}else if(['Digit1','Digit2','Digit3'].includes(e.code))rate({Digit1:'again',Digit2:'hard',Digit3:'good'}[e.code]);}};
}
global.BLDMemoGuided={create,sanitize,select};
})(typeof window==='undefined'?globalThis:window);
