(function(){
'use strict';
const KEY='bld-ceec-active-v1',ABC='ABCDEFGHIJKLMNOPQRSTUVWX';
let current=null;
try{const x=JSON.parse(localStorage.getItem(KEY));if(x&&Array.isArray(x.corners)&&Array.isArray(x.edges)&&['study','recall','result'].includes(x.phase))current=x;}catch(e){}
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
 const lengths=ctx.state.settings.ceecLengths||{cmin:2,cmax:3,emin:2,emax:3};
 const history=Array.isArray(ctx.state.ceecHistory)?ctx.state.ceecHistory:[];
 const select=(id,value)=>'<select class="mini-select" id="'+id+'">'+Array.from({length:10},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(n===value?'selected':'')+'>'+n+'</option>').join('')+'</select>';
 let out='<div class="section-head"><div><h3>CEEC memo trainer</h3><p>Memorize corners then edges; recall edges then corners. Use your own letter-pair dictionary.</p></div><span class="pill">CEEC</span></div>';
 out+='<div class="controls" style="justify-content:flex-start;margin-bottom:18px"><button class="btn" id="ceecOld">Single sequence</button><button class="btn primary" disabled>CEEC trainer</button></div>';
 if(!current||current.phase==='result'){
 out+='<div class="options-row"><label>Corners '+select('ceecCMin',lengths.cmin)+' to '+select('ceecCMax',lengths.cmax)+' pairs</label><label>Edges '+select('ceecEMin',lengths.emin)+' to '+select('ceecEMax',lengths.emax)+' pairs</label></div><div class="controls" style="margin:18px 0"><button class="btn primary" id="ceecStart">Generate memo</button></div>';
 }
 if(current){
  if(current.phase==='study'){
   out+='<div class="callout">Memorize <strong>corners first, then edges</strong>. Tap a pair to see its word. When ready, hide both sequences.</div>';
   for(const [label,items] of [['Corners',current.corners],['Edges',current.edges]]){
    out+='<h4>'+label+'</h4><div class="sequence">'+items.map(p=>'<button type="button" class="seqpair" data-ceec-pair="'+p+'" style="color:var(--text);cursor:pointer"><strong>'+p+'</strong><span>'+escape(current.hints?ctx.word(p):'Tap for word')+'</span></button>').join('')+'</div>';
   }
   out+='<div class="controls"><button class="btn" id="ceecHints">'+(current.hints?'Hide word hints':'Show word hints')+'</button><button class="btn primary" id="ceecHide">Hide & recall</button></div>';
  }else if(current.phase==='recall'){
   out+='<div class="callout">Recall <strong>edges first</strong>, then corners. Type letters with or without spaces.</div><label class="fieldlabel" for="ceecEdges">Edges</label><textarea id="ceecEdges" rows="2" spellcheck="false" autocapitalize="characters" placeholder="ME TX A…"></textarea><label class="fieldlabel" for="ceecCorners">Corners</label><textarea id="ceecCorners" rows="2" spellcheck="false" autocapitalize="characters" placeholder="NK JD BU F…"></textarea><div class="controls" style="margin-top:15px"><button class="btn primary" id="ceecCheck">Check recall</button><button class="btn" id="ceecBack">Back to memo</button></div>';
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
  current={corners:Array.from({length:range(cmin,cmax)},pair),edges:Array.from({length:range(emin,emax)},pair),phase:'study',hints:true,started:Date.now(),answers:{edges:'',corners:''}};
  saveRun();render(root,ctx);
 });
 $('ceecHints')?.addEventListener('click',()=>{current.hints=!current.hints;saveRun();render(root,ctx);});
 root.querySelectorAll('[data-ceec-pair]').forEach(b=>b.addEventListener('click',()=>ctx.toast(b.dataset.ceecPair+' · '+ctx.word(b.dataset.ceecPair))));
 $('ceecHide')?.addEventListener('click',()=>{current.phase='recall';saveRun();render(root,ctx);$('ceecEdges')?.focus();});
 if(current?.phase==='recall'){
  $('ceecEdges').value=current.answers.edges;$('ceecCorners').value=current.answers.corners;
  for(const [field,id] of [['edges','ceecEdges'],['corners','ceecCorners']])$(id).addEventListener('input',e=>{current.answers[field]=e.target.value;saveRun();});
 }
 $('ceecBack')?.addEventListener('click',()=>{current.phase='study';saveRun();render(root,ctx);});
 $('ceecCheck')?.addEventListener('click',()=>{
  current.answers={edges:$('ceecEdges').value,corners:$('ceecCorners').value};
  const e=grade(current.answers.edges,current.edges),c=grade(current.answers.corners,current.corners);
  current.elapsed=Date.now()-current.started;current.phase='result';
  ctx.state.ceecHistory=Array.isArray(ctx.state.ceecHistory)?ctx.state.ceecHistory:[];
  ctx.state.ceecHistory.unshift({at:Date.now(),corners:current.corners.slice(),edges:current.edges.slice(),answers:{...current.answers},perfect:e.perfect&&c.perfect,elapsed:current.elapsed});
  ctx.state.ceecHistory=ctx.state.ceecHistory.slice(0,50);ctx.save();saveRun();render(root,ctx);
 });
 $('ceecRetry')?.addEventListener('click',()=>{current.phase='study';current.started=Date.now();current.answers={edges:'',corners:''};saveRun();render(root,ctx);});
 root.querySelectorAll('[data-ceec-history]').forEach(b=>b.addEventListener('click',()=>{const x=history[+b.dataset.ceecHistory];$('ceecReview').innerHTML=compare(x.edges,x.answers.edges,'Edges',ctx.word)+compare(x.corners,x.answers.corners,'Corners',ctx.word);}));
}
window.BLDMemoCEEC={render};
})();
