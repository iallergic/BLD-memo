(function(){
'use strict';
const KEY='bld-ceec-active-v1',ABC='ABCDEFGHIJKLMNOPQRSTUVWX';
let current=null;
try{const x=JSON.parse(localStorage.getItem(KEY));if(x&&Array.isArray(x.corners)&&Array.isArray(x.edges)&&['corners','edges','recallEdges','recallCorners','result'].includes(x.phase))current=x;}catch(e){}
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').toUpperCase().replace(/[^A-X]/g,'');
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Use the same edge/corner observation data as the Learning Path and Matrix.
function eventPool(event){
 const counts=window.BLD_REALISTIC?.[event+'Counts'];
 if(!Array.isArray(counts)||counts.length!==576||counts.some(n=>!Number.isInteger(n)||n<0))return [];
 return counts.flatMap((n,i)=>n>0?[ABC[Math.floor(i/24)]+ABC[i%24]]:[]);
}
const cornerPool=eventPool('corner'),edgePool=eventPool('edge');
function samplePairs(pool,count){
 // Distinct pairs within an event. Every individual pair was observed in the
 // correct memo type; these practice sequences are not full legal cube traces.
 const copy=pool.slice();
 for(let i=0;i<count;i++){
   const j=i+(Math.random()*(copy.length-i)|0);
   [copy[i],copy[j]]=[copy[j],copy[i]];
 }
 return copy.slice(0,count);
}
const range=(a,b)=>a+(Math.random()*(b-a+1)|0);
const saveRun=()=>{try{localStorage.setItem(KEY,JSON.stringify(current));}catch(e){}};
function grade(answer,pairs){const actual=clean(answer),expected=pairs.join('');let correct=0;for(let i=0;i<expected.length;i++)correct+=actual[i]===expected[i]?1:0;return {actual,expected,correct,perfect:actual===expected};}
function compare(pairs,answer,label,word){
 const g=grade(answer,pairs);
 return '<h4>'+label+': '+g.correct+'/'+g.expected.length+' letters</h4><div class="sequence">'+pairs.map((p,i)=>{
 const got=g.actual.slice(i*2,i*2+2),ok=got===p;
 return '<div class="seqpair '+(ok?'correct':'wrong')+'"><strong>'+escape(got||'—')+'</strong><div class="answer">'+(ok?'Correct':'Expected '+p)+'</div><span>'+escape(word(p))+'</span></div>';
 }).join('')+'</div>';
}

let historyRange=25;
function historyRecord(x,index){
 if(!x||!Array.isArray(x.corners)||!Array.isArray(x.edges))return null;
 const e=grade(x.answers?.edges||'',x.edges),c=grade(x.answers?.corners||'',x.corners);
 const letters=e.expected.length+c.expected.length,correct=e.correct+c.correct;
 if(!letters)return null;
 const pairs=x.corners.length+x.edges.length;
 const seconds=Number.isFinite(x.elapsed)&&x.elapsed>0?x.elapsed/1000:null;
 return {index,at:x.at,edges:e,corners:c,letters,correct,pairs,seconds,
  accuracy:100*correct/letters,edgeAccuracy:e.expected.length?100*e.correct/e.expected.length:0,
  cornerAccuracy:c.expected.length?100*c.correct/c.expected.length:0,
  perfect:e.perfect&&c.perfect,secondsPerPair:seconds!==null&&pairs?seconds/pairs:null};
}
function historyAccuracyChart(rows){
 const w=620,l=40,r=14,t=12,b=208,pw=w-l-r,ph=b-t,n=rows.length;
 const x=i=>l+(n===1?pw/2:i*pw/(n-1));
 const y=v=>b-(Math.max(0,Math.min(100,v))/100)*ph;
 let svg='<svg viewBox="0 0 620 240" role="img" aria-label="Recall accuracy by attempt, overall, edges and corners" preserveAspectRatio="xMidYMid meet">';
 for(const v of [0,25,50,75,100]){
  svg+='<line x1="'+l+'" y1="'+y(v)+'" x2="'+(w-r)+'" y2="'+y(v)+'" stroke="var(--line)" stroke-width="1"/>';
  svg+='<text x="'+(l-8)+'" y="'+(y(v)+4)+'" text-anchor="end" fill="var(--muted)" font-size="12">'+v+'%</text>';
 }
 for(const [field,color,label] of [['accuracy','var(--accent2)','Overall'],['edgeAccuracy','var(--green)','Edges'],['cornerAccuracy','var(--amber)','Corners']]){
  if(n>1)svg+='<polyline fill="none" stroke="'+color+'" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" points="'+rows.map((row,i)=>x(i).toFixed(2)+','+y(row[field]).toFixed(2)).join(' ')+'"/>';
  svg+=rows.map((row,i)=>'<circle cx="'+x(i).toFixed(2)+'" cy="'+y(row[field]).toFixed(2)+'" r="3.6" fill="'+color+'"><title>'+label+' · '+row[field].toFixed(1)+'% · '+new Date(row.at).toLocaleString()+'</title></circle>').join('');
 }
 svg+='<text x="'+l+'" y="231" fill="var(--muted)" font-size="12">Oldest</text><text x="'+(w-r)+'" y="231" text-anchor="end" fill="var(--muted)" font-size="12">Newest</text></svg>';
 return svg;
}
function historyPaceChart(rows){
 const w=620,l=40,r=14,t=12,b=208,pw=w-l-r,ph=b-t,n=rows.length;
 const values=rows.map(row=>row.secondsPerPair).filter(v=>v!==null);
 if(!values.length)return '<p class="ceec-chart-empty">No timed attempts yet.</p>';
 const max=Math.max(5,Math.ceil(Math.max(...values)*1.15/5)*5);
 const x=i=>l+(i+.5)*pw/n;
 const y=v=>b-Math.max(0,Math.min(max,v))/max*ph;
 const bw=Math.min(24,pw/n*.7);
 let svg='<svg viewBox="0 0 620 240" role="img" aria-label="Elapsed seconds per letter pair, by attempt" preserveAspectRatio="xMidYMid meet">';
 for(const v of [0,max/2,max]){
  svg+='<line x1="'+l+'" y1="'+y(v)+'" x2="'+(w-r)+'" y2="'+y(v)+'" stroke="var(--line)" stroke-width="1"/>';
  svg+='<text x="'+(l-8)+'" y="'+(y(v)+4)+'" text-anchor="end" fill="var(--muted)" font-size="12">'+v.toFixed(v%1?1:0)+'s</text>';
 }
 svg+=rows.map((row,i)=>row.secondsPerPair===null?'':'<rect x="'+(x(i)-bw/2).toFixed(2)+'" y="'+y(row.secondsPerPair).toFixed(2)+'" width="'+bw.toFixed(2)+'" height="'+(b-y(row.secondsPerPair)).toFixed(2)+'" rx="3" fill="'+(row.perfect?'var(--green)':'var(--accent)')+'"><title>'+row.secondsPerPair.toFixed(1)+' seconds per pair · '+row.pairs+' pairs · '+new Date(row.at).toLocaleString()+'</title></rect>').join('');
 svg+='<text x="'+l+'" y="231" fill="var(--muted)" font-size="12">Oldest</text><text x="'+(w-r)+'" y="231" text-anchor="end" fill="var(--muted)" font-size="12">Newest</text></svg>';
 return svg;
}
function historyDashboard(history){
 const data=history.slice(0,historyRange).map(historyRecord).filter(Boolean);
 if(!data.length)return '';
 const totalLetters=data.reduce((s,r)=>s+r.letters,0),correct=data.reduce((s,r)=>s+r.correct,0);
 const avg=Math.round(100*correct/totalLetters);
 const perfect=data.filter(r=>r.perfect).length;
 const timed=data.filter(r=>r.seconds!==null);
 const pace=timed.reduce((s,r)=>s+r.seconds,0)/timed.reduce((s,r)=>s+r.pairs,0);
 const eLetters=data.reduce((s,r)=>s+r.edges.expected.length,0),cLetters=data.reduce((s,r)=>s+r.corners.expected.length,0);
 const eCorrect=data.reduce((s,r)=>s+r.edges.correct,0),cCorrect=data.reduce((s,r)=>s+r.corners.correct,0);
 const pct=(c,t)=>t?(100*c/t).toFixed(1)+'%':'—';
 const reversed=data.slice().reverse();
 const missed=new Map();
 for(const r of data){
  const attempt=history[r.index];
  for(const kind of ['edges','corners']){
   const pairs=attempt[kind],actual=clean(attempt.answers?.[kind]||'');
   pairs.forEach((pair,i)=>{if(actual.slice(i*2,i*2+2)!==pair)missed.set(pair,(missed.get(pair)||0)+1);});
  }
 }
 const difficult=[...missed].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,6);
 let out='<div class="session-panel ceec-dashboard"><div class="ceec-dash-head"><div><h4>Memo progress</h4><p>Accuracy and pace from your saved CEEC attempts</p></div><div class="ceec-range" aria-label="History range">'+[10,25,50].map(v=>'<button class="btn sm'+(historyRange===v?' primary':'')+'" aria-pressed="'+(historyRange===v)+'" data-ceec-range="'+v+'">Last '+v+'</button>').join('')+'</div></div>';
 out+='<div class="ceec-metrics">'+[
  ['Attempts',String(data.length)],
  ['Letter accuracy',pct(correct,totalLetters)],
  ['Perfect recalls',String(perfect)],
  ['Time / pair',Number.isFinite(pace)?pace.toFixed(1)+'s':'—']
 ].map(([label,value])=>'<div class="ceec-metric"><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+'</div>';
 out+='<div class="ceec-substats"><span>Edges <strong>'+pct(eCorrect,eLetters)+'</strong></span><span>Corners <strong>'+pct(cCorrect,cLetters)+'</strong></span><span>Accuracy is weighted by letters, not by attempts</span></div>';
 out+='<div class="ceec-charts"><div class="ceec-chart"><h5>Recall accuracy</h5><div class="ceec-legend"><span><i class="overall"></i>Overall</span><span><i class="edges"></i>Edges</span><span><i class="corners"></i>Corners</span></div>'+historyAccuracyChart(reversed)+'</div><div class="ceec-chart"><h5>Time per pair</h5><p>Full memo + recall time ÷ pairs attempted</p>'+historyPaceChart(reversed)+'</div></div>';
 out+='<p class="ceec-note">Time per pair normalizes drills of different lengths; lower is faster. A perfect recall is shown in green on the time chart.</p>';
 if(difficult.length)out+='<div class="ceec-trouble"><strong>Most missed pairs</strong><div>'+difficult.map(([pair,count])=>'<span>'+escape(pair)+' <small>×'+count+'</small></span>').join('')+'</div><p>Based on incorrect two-letter slots in these attempts. An omitted letter can shift later answers.</p></div>';
 out+='<div class="ceec-attempts"><h5>Previous attempts</h5><p>Tap an attempt to review its original memo and answers. History keeps up to 50 attempts.</p><div class="ceec-history-list">'+data.map(r=>'<button class="ceec-history-row" data-ceec-history="'+r.index+'"><span class="ceec-history-date">'+escape(new Date(r.at).toLocaleString())+'</span><span class="ceec-history-score">'+r.correct+'/'+r.letters+' letters · '+r.accuracy.toFixed(0)+'%</span><span class="ceec-history-meta">'+(r.seconds===null?'—':r.seconds.toFixed(1)+'s')+' · '+r.pairs+' pairs '+(r.perfect?'✓':'')+'</span></button>').join('')+'</div><div id="ceecReview" aria-live="polite"></div></div></div>';
 return out;
}

function render(root,ctx){
 if(window.ceecClock)clearInterval(window.ceecClock);
 const liveTime=()=>current?.started?((current.phase==='result'?current.elapsed:Date.now()-current.started)/1000).toFixed(2):'0.00';
 const lengths=ctx.state.settings.ceecLengths||{cmin:2,cmax:3,emin:2,emax:3};
 const history=Array.isArray(ctx.state.ceecHistory)?ctx.state.ceecHistory:[];
 const select=(id,value)=>'<select class="mini-select" id="'+id+'">'+Array.from({length:10},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(n===value?'selected':'')+'>'+n+'</option>').join('')+'</select>';
 let out='<div class="section-head"><div><h3>CEEC memo trainer</h3><p>Memorize corners then edges; recall edges then corners. Use your own letter-pair dictionary.</p></div><span class="pill">CEEC</span></div>';
 out+='<div class="controls" style="justify-content:flex-start;margin-bottom:18px"><button class="btn" id="ceecOld">Single sequence</button><button class="btn primary" disabled>CEEC trainer</button></div>';
 if(!current||current.phase==='result'){
 out+='<div class="options-row"><label>Corners '+select('ceecCMin',lengths.cmin)+' to '+select('ceecCMax',lengths.cmax)+' pairs</label><label>Edges '+select('ceecEMin',lengths.emin)+' to '+select('ceecEMax',lengths.emax)+' pairs</label></div><div class="controls" style="margin:18px 0"><button class="btn primary" id="ceecStart" '+(!cornerPool.length||!edgePool.length?'disabled':'')+'>Generate memo</button></div>';
 out+='<p class="subhint" style="text-align:left">'+(cornerPool.length&&edgePool.length?'Only memo pairs observed in the simulation: '+cornerPool.length+' corner pairs and '+edgePool.length+' edge pairs. Each pair is valid for its section; the combined sequence is a memory drill, not a full cube trace.':'Simulation frequency data unavailable. CEEC generation is disabled to avoid invalid pair selections.')+'</p>';
 }
 if(current){
  out+='<div class="session-panel" style="text-align:center"><strong style="font-size:29px;font-variant-numeric:tabular-nums" id="ceecTimer">'+liveTime()+'s</strong></div>';
  if(current.phase==='corners'||current.phase==='edges'){
   const isCorners=current.phase==='corners',items=isCorners?current.corners:current.edges;
   out+='<div class="callout">Memorize <strong>'+(isCorners?'corners':'edges')+'</strong> only. The other sequence is hidden.</div>';
   out+='<div class="sequence">'+items.map(p=>'<div class="seqpair" style="min-width:100px"><strong>'+p+'</strong><span>'+(current.revealed?.[p]?escape(ctx.word(p)):'Word hidden')+'</span><button class="btn sm" data-ceec-pair="'+p+'">Reveal</button><button class="btn sm" data-ceec-edit="'+p+'">Edit</button></div>').join('')+'</div>';
   out+='<div class="controls"><button class="btn primary" id="ceecNext">'+(isCorners?'Hide corners · memorize edges':'Hide edges · recall edges')+'</button></div>';
  }else if(current.phase==='recallEdges'||current.phase==='recallCorners'){
   const isEdges=current.phase==='recallEdges',field=isEdges?'edges':'corners';
   out+='<div class="callout">Recall <strong>'+field+'</strong> now. The original memo stays hidden.</div><label class="fieldlabel" for="ceecAnswer">'+(isEdges?'Edges':'Corners')+'</label><textarea id="ceecAnswer" rows="2" spellcheck="false" autocapitalize="characters" placeholder="Type the letters in order"></textarea><div class="controls" style="margin-top:15px"><button class="btn primary" id="ceecNextRecall">'+(isEdges?'Save edges · recall corners':'Finish & check')+'</button></div>';
  }else{
   const e=grade(current.answers.edges,current.edges),c=grade(current.answers.corners,current.corners);
   out+='<div class="session-panel"><h4>'+(e.perfect&&c.perfect?'Perfect recall!':'Review your attempt')+'</h4><p>Edges '+e.correct+'/'+e.expected.length+' letters · Corners '+c.correct+'/'+c.expected.length+' letters · '+(current.elapsed/1000).toFixed(1)+' seconds</p></div>';
   out+=compare(current.edges,current.answers.edges,'Edges',ctx.word)+compare(current.corners,current.answers.corners,'Corners',ctx.word);
   out+='<div class="controls"><button class="btn" id="ceecRetry">Study same memo</button></div>';
  }
 }
 if(history.length)out+=historyDashboard(history);
 root.innerHTML=out;
 $('ceecOld')?.addEventListener('click',ctx.showOriginal);
 $('ceecStart')?.addEventListener('click',()=>{
  const cmin=+$('ceecCMin').value,cmax=+$('ceecCMax').value,emin=+$('ceecEMin').value,emax=+$('ceecEMax').value;
  if(cmin>cmax||emin>emax){ctx.toast('Minimum cannot exceed maximum');return;}
  ctx.state.settings.ceecLengths={cmin,cmax,emin,emax};ctx.save();
  if(!cornerPool.length||!edgePool.length){ctx.toast('Simulation data unavailable; cannot generate event-specific pairs');return;}
  current={corners:samplePairs(cornerPool,range(cmin,cmax)),edges:samplePairs(edgePool,range(emin,emax)),phase:'corners',revealed:{},started:Date.now(),answers:{edges:'',corners:''}};
  saveRun();render(root,ctx);
 });
 root.querySelectorAll('[data-ceec-pair]').forEach(b=>b.addEventListener('click',()=>{current.revealed=current.revealed||{};current.revealed[b.dataset.ceecPair]=!current.revealed[b.dataset.ceecPair];saveRun();render(root,ctx);}));
 root.querySelectorAll('[data-ceec-edit]').forEach(b=>b.addEventListener('click',()=>ctx.edit(b.dataset.ceecEdit)));
 $('ceecNext')?.addEventListener('click',()=>{current.phase=current.phase==='corners'?'edges':'recallEdges';current.revealed={};saveRun();render(root,ctx);if(current.phase==='recallEdges')$('ceecAnswer')?.focus();});
 if(current?.phase==='recallEdges'||current?.phase==='recallCorners'){
  const field=current.phase==='recallEdges'?'edges':'corners';
  $('ceecAnswer').value=current.answers[field]||'';
  $('ceecAnswer').addEventListener('input',e=>{current.answers[field]=e.target.value;saveRun();});
 }
 $('ceecNextRecall')?.addEventListener('click',()=>{
  const field=current.phase==='recallEdges'?'edges':'corners';
  current.answers[field]=$('ceecAnswer').value;
  if(field==='edges'){current.phase='recallCorners';saveRun();render(root,ctx);$('ceecAnswer')?.focus();return;}
  const e=grade(current.answers.edges,current.edges),c=grade(current.answers.corners,current.corners);
  current.elapsed=Date.now()-current.started;current.phase='result';
  ctx.state.ceecHistory=Array.isArray(ctx.state.ceecHistory)?ctx.state.ceecHistory:[];
  ctx.state.ceecHistory.unshift({at:Date.now(),corners:current.corners.slice(),edges:current.edges.slice(),answers:{...current.answers},perfect:e.perfect&&c.perfect,elapsed:current.elapsed});
  ctx.state.ceecHistory=ctx.state.ceecHistory.slice(0,50);ctx.save();saveRun();render(root,ctx);
 });
 $('ceecRetry')?.addEventListener('click',()=>{current.phase='corners';current.started=Date.now();current.revealed={};current.answers={edges:'',corners:''};saveRun();render(root,ctx);});
 if(current&&current.phase!=='result')window.ceecClock=setInterval(()=>{const timer=$('ceecTimer');if(timer)timer.textContent=liveTime()+'s';},100);
 root.querySelectorAll('[data-ceec-range]').forEach(b=>b.addEventListener('click',()=>{historyRange=+b.dataset.ceecRange;render(root,ctx);}));
 root.querySelectorAll('[data-ceec-history]').forEach(b=>b.addEventListener('click',()=>{const x=history[+b.dataset.ceecHistory];$('ceecReview').innerHTML=compare(x.edges,x.answers.edges,'Edges',ctx.word)+compare(x.corners,x.answers.corners,'Corners',ctx.word);}));
}
window.BLDMemoCEEC={render};
})();
