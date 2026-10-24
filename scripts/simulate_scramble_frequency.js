'use strict';
// Reproducible random-MOVE 3BLD memo frequency simulation.
// Usage: node scripts/simulate_scramble_frequency.js [scrambles] [seed]
// Default: 1,000,000 independent 30-turn scrambles, seed 20261024.
// Moves are randomly chosen U/D/L/R/F/B with no consecutive moves on the
// same axis, and 1/2/3 quarter turns chosen uniformly.
// For each scramble, actually apply sticker moves to a solved cube and trace
// the M2 DF-edge (Speffz U) and OP ULB-corner (Speffz A) memo, breaking
// cycles at the alphabetical first unsolved sticker. Pair letters separately
// within the edge and corner memo, never crossing an odd-length boundary.
//
// Scramble sequences are NOT uniformly sampled cube states. This simulates
// the random-turn procedure, which is the specific requested methodology.

const ABC='ABCDEFGHIJKLMNOPQRSTUVWX',FACES='ULFRBD';
const FACE_DEFS={
 U:{n:[0,1,0],r:[1,0,0],d:[0,0,1]},L:{n:[-1,0,0],r:[0,0,1],d:[0,-1,0]},
 F:{n:[0,0,1],r:[1,0,0],d:[0,-1,0]},R:{n:[1,0,0],r:[0,0,-1],d:[0,-1,0]},
 B:{n:[0,0,-1],r:[-1,0,0],d:[0,-1,0]},D:{n:[0,-1,0],r:[1,0,0],d:[0,0,-1]}
};
const facelets=[],lookup=new Map(),posKey=(p,n)=>p.join(',')+'|'+n.join(',');
for(const f of FACES){const d=FACE_DEFS[f];
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
   const p=[0,1,2].map(i=>3*d.n[i]+2*(col-1)*d.r[i]+2*(row-1)*d.d[i]);
   const index=facelets.length,fl={face:f,row,col,p,n:d.n};
   facelets.push(fl);lookup.set(posKey(p,d.n),index);
 }}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const rotate=(axis,v)=>{const d=dot(axis,v),c=cross(axis,v);return axis.map((a,i)=>a*d-c[i]);};
const letterIndex=(face,row,col,type)=>{
 const k=FACES.indexOf(face)*4;
 const slot=type==='corner'?({'0,0':0,'0,2':1,'2,2':2,'2,0':3})[row+','+col]
                           :({'0,1':0,'1,2':1,'2,1':2,'1,0':3})[row+','+col];
 return slot===undefined?-1:k+slot;
};
function makeType(type){
 const n=type==='corner'?3:2,letterFacelet=new Int8Array(24),faceletLetter=new Int8Array(54).fill(-1);
 const pieceMap=new Map(),pieceOf=new Int8Array(24),pieces=[];
 for(let i=0;i<facelets.length;i++){
   const fl=facelets[i],l=letterIndex(fl.face,fl.row,fl.col,type);
   if(l<0)continue;letterFacelet[l]=i;faceletLetter[i]=l;
   const key=fl.p.map(Math.sign).join(',');
   if(!pieceMap.has(key)){pieceMap.set(key,pieces.length);pieces.push([]);}
   const p=pieceMap.get(key);pieceOf[l]=p;pieces[p].push(l);
 }
 if(pieces.length!==(type==='corner'?8:12)||pieces.some(x=>x.length!==n))throw Error('Invalid cubie geometry');
 return {type,n,letterFacelet,faceletLetter,pieceOf,pieces,buffer:type==='corner'?0:20};
}
const edges=makeType('edge'),corners=makeType('corner');
function permutationsFor(face,type){
 const axis=FACE_DEFS[face].n,base=new Int8Array(24);
 for(let src=0;src<24;src++){
   const faceletIndex=type.letterFacelet[src],fl=facelets[faceletIndex];
   const destFacelet=dot(fl.p,axis)>=2?lookup.get(posKey(rotate(axis,fl.p),rotate(axis,fl.n))):faceletIndex;
   const dest=type.faceletLetter[destFacelet];
   if(dest<0)throw Error('Sticker changed piece type');
   base[src]=dest;
 }
 const out=[null];
 for(let t=1;t<=3;t++){
   const perm=new Int8Array(24);
   for(let src=0;src<24;src++){let d=src;for(let k=0;k<t;k++)d=base[d];perm[src]=d;}
   const used=new Uint8Array(24),cycles=[];
   for(let src=0;src<24;src++){
     if(used[src])continue;const cycle=[];let current=src;
     do{cycle.push(current);used[current]=1;current=perm[current];}while(current!==src);
     if(cycle.length>1)cycles.push(cycle);
   }
   out.push(cycles);
 }
 return out;
}
const MOVES={};
for(const face of FACES)MOVES[face]={edge:permutationsFor(face,edges),corner:permutationsFor(face,corners)};
function applyCycleMove(state,cycles){
 for(const cycle of cycles){
   const last=cycle.length-1,temp=state[cycle[last]];
   for(let j=last;j>=1;j--)state[cycle[j]]=state[cycle[j-1]];
   state[cycle[0]]=temp;
 }
}
function applyMove(edgeState,cornerState,face,turns){
 applyCycleMove(edgeState,MOVES[face].edge[turns]);
 applyCycleMove(cornerState,MOVES[face].corner[turns]);
}
function reset(state){for(let i=0;i<24;i++)state[i]=i;}
function trace(type,state){
 const bp=type.pieceOf[type.buffer],visited=new Uint8Array(type.pieces.length),memo=[];
 const solved=piece=>type.pieces[piece].every(code=>state[code]===code);
 visited[bp]=1;let ref=type.buffer,steps=0;
 while(true){
   if(++steps>60)throw Error('Infinite buffer cycle');
   const target=state[ref],piece=type.pieceOf[target];
   if(piece===bp)break;
   memo.push(target);visited[piece]=1;ref=target;
 }
 for(let start=0;start<24;start++){
   const startPiece=type.pieceOf[start];
   if(visited[startPiece]||solved(startPiece))continue;
   visited[startPiece]=1;memo.push(start);ref=start;
   while(true){
     if(++steps>110)throw Error('Infinite cycle break');
     const target=state[ref],piece=type.pieceOf[target];
     memo.push(target);
     if(piece===startPiece)break;
     visited[piece]=1;ref=target;
   }
 }
 for(let i=0;i<type.pieces.length;i++)if(i!==bp&&!visited[i]&&!solved(i))throw Error('Missed unsolved piece');
 return memo;
}
function countPairs(counts,memo){
 for(let i=0;i+1<memo.length;i+=2)counts[memo[i]*24+memo[i+1]]++;
}
function mulberry32(seed){
 let t=seed>>>0;return ()=>{t=(t+0x6D2B79F5)>>>0;let x=t;x=Math.imul(x^(x>>>15),x|1);
 x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};
}
const AXIS={U:0,D:0,L:1,R:1,F:2,B:2};
function randomScramble(rand,turns=30){
 const out=[];let lastAxis=-1;
 for(let i=0;i<turns;i++){
   let face;do{face=FACES[Math.floor(rand()*6)];}while(AXIS[face]===lastAxis);
   lastAxis=AXIS[face];out.push({face,turns:1+Math.floor(rand()*3)});
 }
 return out;
}
function seenHex(a){
 let result='';for(let i=0;i<576;i+=4){let nibble=0;
 for(let j=0;j<4;j++)nibble=(nibble<<1)+Number(a[i+j]>0);
 result+=nibble.toString(16);
 }return result;
}
function tests(){
 const e=new Int8Array(24),c=new Int8Array(24);reset(e);reset(c);
 if(trace(edges,e).length||trace(corners,c).length)throw Error('Solved memo not empty');
 for(const face of FACES){
   for(let i=0;i<4;i++)applyMove(e,c,face,1);
   if(e.some((v,i)=>v!==i)||c.some((v,i)=>v!==i))throw Error('Four turns not identity: '+face);
   applyMove(e,c,face,1);applyMove(e,c,face,3);
   if(e.some((v,i)=>v!==i)||c.some((v,i)=>v!==i))throw Error('Inverse move not identity: '+face);
   applyMove(e,c,face,2);applyMove(e,c,face,2);
   if(e.some((v,i)=>v!==i)||c.some((v,i)=>v!==i))throw Error('Half turn inverse not identity: '+face);
 }
 const rand=mulberry32(8249);
 for(let i=0;i<1500;i++){
   const scramble=randomScramble(rand,30);
   if(scramble.some((m,j)=>j>0&&AXIS[m.face]===AXIS[scramble[j-1].face]))throw Error('Repeated axis');
   reset(e);reset(c);
   for(const move of scramble)applyMove(e,c,move.face,move.turns);
   const em=trace(edges,e),cm=trace(corners,c);
   if(em.length%2!==cm.length%2)throw Error('Edge/corner parity mismatch');
   if(em.some(sticker=>edges.pieceOf[sticker]===edges.pieceOf[edges.buffer]))throw Error('Targeted edge buffer');
   if(cm.some(sticker=>corners.pieceOf[sticker]===corners.pieceOf[corners.buffer]))throw Error('Targeted corner buffer');
   for(let j=scramble.length-1;j>=0;j--)applyMove(e,c,scramble[j].face,4-scramble[j].turns);
   if(e.some((v,j)=>v!==j)||c.some((v,j)=>v!==j))throw Error('Scramble inverse not identity');
 }
 return true;
}
function simulate(samples=1000000,seed=20261024,turns=30){
 if(!Number.isSafeInteger(samples)||samples<1||samples>20000000||!Number.isSafeInteger(seed)||!Number.isInteger(turns)||turns<1||turns>200)throw Error('Invalid args');
 tests();
 const rand=mulberry32(seed),ec=new Uint32Array(576),cc=new Uint32Array(576);
 const e=new Int8Array(24),c=new Int8Array(24);
 let edgeTotal=0,cornerTotal=0,edgeOdd=0,cornerOdd=0,parityErrors=0;
 for(let n=0;n<samples;n++){
   reset(e);reset(c);
   // Generate each move and apply it; axis alternation prevents move cancellation.
   let lastAxis=-1;
   for(let i=0;i<turns;i++){
     let face;do{face=FACES[Math.floor(rand()*6)];}while(AXIS[face]===lastAxis);
     lastAxis=AXIS[face];
     const amount=1+Math.floor(rand()*3);
     applyMove(e,c,face,amount);
   }
   const em=trace(edges,e),cm=trace(corners,c);
   if(em.length%2!==cm.length%2)parityErrors++;
   edgeOdd+=em.length%2;cornerOdd+=cm.length%2;
   edgeTotal+=Math.floor(em.length/2);cornerTotal+=Math.floor(cm.length/2);
   countPairs(ec,em);countPairs(cc,cm);
 }
 if(parityErrors)throw Error('Memo parity errors: '+parityErrors);
 const edgeCounts=Array.from(ec),cornerCounts=Array.from(cc);
 if(edgeCounts.reduce((a,b)=>a+b,0)!==edgeTotal||cornerCounts.reduce((a,b)=>a+b,0)!==cornerTotal)throw Error('Counts mismatch');
 return {samples,seed,turns,method:'seeded-axis-alternating-random-move-scrambles',
   moveChoice:'uniform among 6 faces excluding previous axis; turns 1, 2, or 3 equally likely',
   buffers:{edges:'DF / Speffz U',corners:'ULB / Speffz A'},traceMethod:'M2/OP cycles with alphabetical break-ins; pair edges and corners separately',
   edgeTotal,cornerTotal,edgeOdd,cornerOdd,parityErrors,perEventLimit:576,
   edgeCounts,cornerCounts,edgeSeenHex:seenHex(edgeCounts),cornerSeenHex:seenHex(cornerCounts)};
}
if(typeof module!=='undefined')module.exports={simulate,tests,randomScramble,applyMove,trace,edges,corners,mulberry32};
if(typeof require!=='undefined'&&typeof module!=='undefined'&&require.main===module){
 const fs=require('fs'),path=require('path');
 const data=simulate(Number(process.argv[2]||1000000),Number(process.argv[3]||20261024),Number(process.argv[4]||30));
 const destination=path.join(__dirname,'..','frequency-data.js');
 fs.writeFileSync(destination,'// Generated by scripts/simulate_scramble_frequency.js. Random-move scrambles traced for M2/OP.\nwindow.BLD_REALISTIC='+JSON.stringify(data)+';\n');
 console.log(JSON.stringify({samples:data.samples,turns:data.turns,edgeTotal:data.edgeTotal,cornerTotal:data.cornerTotal,
 edgeNonzero:data.edgeCounts.filter(Boolean).length,cornerNonzero:data.cornerCounts.filter(Boolean).length,parityErrors:data.parityErrors},null,2));
}