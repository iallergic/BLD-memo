const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
require('../guided-sessions.js');const api=globalThis.BLDMemoGuided;
const pairs=[...'ABCDEFGHIJKLMNOPQRSTUVWX'].flatMap(a=>[...'ABCDEFGHIJKLMNOPQRSTUVWX'].map(b=>a+b));
const stats={AA:{seen:1,streak:0,due:1},AB:{seen:3,streak:3,due:Date.now()+86400000}};const stat=p=>stats[p]||{seen:0,streak:0,due:0};
assert.equal(api.select(pairs,stat,'all').length,576);assert.deepEqual(api.select(pairs,stat,'due'),['AA']);assert.deepEqual(api.select(pairs,stat,'weak'),['AA']);assert.equal(api.select(pairs,stat,'learned').length,2);assert.equal(new Set(api.select(pairs,stat,'mixed')).size,576);
let html='',nodes={},ratings=[];global.document={getElementById:id=>nodes[id]||(nodes[id]={addEventListener:(name,fn)=>{nodes[id][name]=fn;}}),querySelectorAll:()=>[]};global.confirm=()=>true;
const state={settings:{guidedSource:'all',guidedSize:6},cardSession:null,learningPath:{position:42}};
const ctx={pairs,stat,getState:()=>state,assoc:p=>'WORD_'+p,note:()=>'',esc:s=>s,save:()=>{},toast:()=>{},recordRating:(p,r)=>ratings.push([p,r]),openEditor:()=>{},render:()=>guided.render(),mount:s=>{html=s;nodes={};}};
let guided=api.create(ctx);guided.render();nodes.guidedStart.click();assert.equal(state.cardSession.cards.length,12);assert.equal(state.cardSession.phase,'active');assert(!html.includes('WORD_'));assert.equal(new Set(state.cardSession.cards.slice(0,6).map(c=>c.pair)).size,6);
const original=state.cardSession.cards[0].pair;
const key=code=>guided.key({code,preventDefault:()=>{}});
key('Digit3');assert.equal(state.cardSession.index,0);
for(let i=0;i<6;i++){key('Space');key(i===0?'Digit1':'Digit3');}assert.equal(ratings.length,0);assert(html.includes('WORD_'));assert(!html.includes('class="bigpair"'));
nodes.guidedPause.click();assert.equal(state.cardSession.phase,'paused');
state.cardSession=api.sanitize(JSON.parse(JSON.stringify(state.cardSession)));guided=api.create(ctx);guided.render();nodes.guidedResume.click();
while(state.cardSession.phase==='active'){key('Space');key('Digit3');}
assert.equal(ratings.length,6);assert.equal(ratings.find(([p])=>p===original)[1],'again');assert.equal(state.learningPath.position,42);assert.equal(state.cardSession.phase,'finished');assert(api.sanitize(state.cardSession));assert.equal(api.sanitize({...state.cardSession,index:100}),null);
// Validate every inline script and ensure unchanged Learning Path and sync code remain separate.
const page=fs.readFileSync('index.html','utf8');for(const m of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
assert(fs.readFileSync('sw.js','utf8').includes("'./guided-sessions.js'"));
console.log('Guided sessions: selection, concealment, both directions, rating guard, weakest result, pause/resume, serialization, Learning Path preservation, inline syntax and cache checks passed.');
