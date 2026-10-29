(function(){
'use strict';
const KEY='bld-ceec-active-v1',ABC='ABCDEFGHIJKLMNOPQRSTUVWX';
let current=null;
try{const x=JSON.parse(localStorage.getItem(KEY));if(x&&Array.isArray(x.corners)&&Array.isArray(x.edges)&&['corners','edges','recallEdges','recallCorners','result'].includes(x.phase))current=x;}catch(e){}
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').toUpperCase().replace(/[^A-X]/g,'');
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pair=()=>ABC[Math.random()*24|0]+ABC[Math.random()*24|0];
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
function render(root,ctx){
 if(window.ceecClock)clearInterval(window.ceecClock);
 const liveTime=()=>current?.started?((current.phase==='result'?current.elapsed:Date.now()-current.started)/1000).toFixed(2):'0.00';
 const lengths=ctx.state.settings.ceecLengths||{cmin:2,cmax:3,emin:2,emax:3};
 const history=Array.isArray(ctx.state.ceecHistory)?ctx.state.ceecHistory:[];
 const select=(id,value)=>'<select class="mini-select" id="'+id+'">'+Array.from({length:10},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(n===value?'selected':'')+'>'+n+'</option>').join('')+'</select>';
 let out='<div class="section-head"><div><h3>CEEC memo trainer</h3><p>Memorize corners then edges; recall edges then corners. Use your own letter-pair dictionary.</p></div><span class="pill">CEEC</span></div>';
 out+='<div class="controls" style="justify-content:flex-start;margin-bottom:18px"><button class="btn" id="ceecOld">Single sequence</button><button class="btn primary" disabled>CEEC trainer</button></div>';
 if(!current||current.phase==='result'){
 out+='<div class="options-row"><label>Corners '+select('ceecCMin',lengths.cmin)+' to '+select('ceecCMax',lengths.cmax)+' pairs</label><label>Edges '+select('ceecEMin',lengths.emin)+' to '+select('ceecEMax',lengths.emax)+' pairs</label></div><div class="controls" style="margin:18px 0"><button class="btn primary" id="ceecStart">Generate memo</button></div>';
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
 if(history.length){
  out+='<div class="session-panel"><h4>Previous attempts</h4><p>Saved on this device. Tap an attempt to review the original memo and your answers.</p><div class="controls">'+history.slice(0,15).map((x,i)=>'<button class="btn sm" data-ceec-history="'+i+'">'+escape(new Date(x.at).toLocaleString())+' · '+(x.perfect?'✓':'Review')+'</button>').join('')+'</div><div id="ceecReview"></div></div>';
 }
 root.innerHTML=out;
 $('ceecOld')?.addEventListener('click',ctx.showOriginal);
 $('ceecStart')?.addEventListener('click',()=>{
  const cmin=+$('ceecCMin').value,cmax=+$('ceecCMax').value,emin=+$('ceecEMin').value,emax=+$('ceecEMax').value;
  if(cmin>cmax||emin>emax){ctx.toast('Minimum cannot exceed maximum');return;}
  ctx.state.settings.ceecLengths={cmin,cmax,emin,emax};ctx.save();
  current={corners:Array.from({length:range(cmin,cmax)},pair),edges:Array.from({length:range(emin,emax)},pair),phase:'corners',revealed:{},started:Date.now(),answers:{edges:'',corners:''}};
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
 root.querySelectorAll('[data-ceec-history]').forEach(b=>b.addEventListener('click',()=>{const x=history[+b.dataset.ceecHistory];$('ceecReview').innerHTML=compare(x.edges,x.answers.edges,'Edges',ctx.word)+compare(x.corners,x.answers.corners,'Corners',ctx.word);}));
}
window.BLDMemoCEEC={render};
})();
