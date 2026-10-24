'use strict';
// Full 3BLD Speffz letter-pair simulation. Run with Node:
// node scripts/simulate_memo_frequency.js 1000000 20261024
// Uniform LEGAL cubie states (matching permutation parity, zero net
// edge flip/corner twist), not biased random face-turn scrambles.
// Edge buffer DF Speffz U; corner buffer ULB Speffz A.
// Alphabetical cycle breaks, including flipped/twisted non-buffer pieces.
// Each event's memo is paired separately, dropping an unpaired last letter.
const ABC="ABCDEFGHIJKLMNOPQRSTUVWX",FACES="ULFRBD";
const EDGE=[
["U6","R2"],["U8","F2"],["U4","L2"],["U2","B2"],
["D6","R8"],["D2","F8"],["D4","L8"],["D8","B8"],
["F6","R4"],["F4","L6"],["B6","L4"],["B4","R6"]
];
const CORNER=[
["U9","R1","F3"],["U7","F1","L3"],["U1","L1","B3"],["U3","B1","R3"],
["D3","F9","R7"],["D1","L9","F7"],["D7","B9","L7"],["D9","R9","B7"]
];
function letter(facelet,n){
 const q=n===3?{1:0,3:1,9:2,7:3}:{2:0,6:1,8:2,4:3};
 const offset=FACES.indexOf(facelet[0])*4,sub=q[Number(facelet[1])];
 if(offset<0||sub===undefined)throw Error("Bad facelet "+facelet);
 return offset+sub;
}
function makePieces(facelets){
 const n=facelets[0].length,pieces=facelets.map(part=>part.map(f=>letter(f,n)));
 const pieceOf=new Uint8Array(24),seen=new Set();
 for(let p=0;p<pieces.length;p++)for(const k of pieces[p]){
   if(seen.has(k))throw Error("Duplicate Speffz sticker");seen.add(k);pieceOf[k]=p;
 }
 if(seen.size!==24)throw Error("Bad Speffz map");
 return {n,pieces,pieceOf,buffer:letter(n===2?"D2":"U1",n)};
}
const edges=makePieces(EDGE),corners=makePieces(CORNER);
function rng(seed){
 let t=seed>>>0;return ()=>{
 t=(t+0x6D2B79F5)>>>0;let x=t;
 x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);
 return ((x^(x>>>14))>>>0)/4294967296;
 };
}
function shuffle(n,r){const a=Array.from({length:n},(_,i)=>i);
 for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
function parity(a){let p=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)p^=(a[i]>a[j])?1:0;return p;}
function randomState(r){
 const ep=shuffle(12,r),cp=shuffle(8,r);
 if(parity(ep)!==parity(cp))[cp[0],cp[1]]=[cp[1],cp[0]];
 const eo=new Uint8Array(12),co=new Uint8Array(8);
 let ef=0,ct=0;
 for(let i=0;i<11;i++){eo[i]=Math.floor(r()*2);ef^=eo[i];}eo[11]=ef;
 for(let i=0;i<7;i++){co[i]=Math.floor(r()*3);ct+=co[i];}co[7]=(3-ct%3)%3;
 return {ep,cp,eo,co};
}
function placePieces(type,perm,ori){
 const stickers=new Uint8Array(24),n=type.n;
 for(let p=0;p<perm.length;p++){
   const source=type.pieces[perm[p]],dest=type.pieces[p],o=ori[p];
   for(let j=0;j<n;j++)stickers[dest[(j+o)%n]]=source[j];
 }
 return stickers;
}
function trace(type,state){
 const {pieceOf,pieces,buffer}=type,bp=pieceOf[buffer];
 const seen=new Uint8Array(pieces.length),memo=[];seen[bp]=1;
 const solved=p=>pieces[p].every(sticker=>state[sticker]===sticker);
 let from=buffer,step=0;
 while(true){
   if(++step>48)throw Error("Buffer cycle infinite");
   const target=state[from],piece=pieceOf[target];
   if(piece===bp)break;
   memo.push(target);seen[piece]=1;from=target;
 }
 for(let code=0;code<24;code++){
   const startPiece=pieceOf[code];
   if(seen[startPiece]||solved(startPiece))continue;
   seen[startPiece]=1;memo.push(code);from=code;
   while(true){
     if(++step>100)throw Error("Cycle break infinite");
     const target=state[from],piece=pieceOf[target];memo.push(target);
     if(piece===startPiece)break;
     seen[piece]=1;from=target;
   }
 }
 for(let p=0;p<pieces.length;p++)if(p!==bp&&!seen[p]&&!solved(p))throw Error("Unvisited unsolved");
 return memo;
}
function countPairs(arr,memo){
 for(let i=0;i+1<memo.length;i+=2)arr[memo[i]*24+memo[i+1]]++;
}
function seenHex(a){let out="";for(let i=0;i<576;i+=4){
 let nib=0;for(let j=0;j<4;j++)nib=(nib<<1)+Number(a[i+j]>0);
 out+=nib.toString(16);
}return out;}
function test(){
 const id=(n)=>Array.from({length:n},(_,i)=>i);
 if(trace(edges,placePieces(edges,id(12),new Uint8Array(12))).length)throw Error("Solved edge memo");
 if(trace(corners,placePieces(corners,id(8),new Uint8Array(8))).length)throw Error("Solved corner memo");
 const r=rng(12345);
 for(let i=0;i<1500;i++){
   const s=randomState(r);
   if(parity(s.ep)!==parity(s.cp)||s.eo.reduce((a,b)=>a+b,0)%2||s.co.reduce((a,b)=>a+b,0)%3)throw Error("Illegal cubie state");
   const em=trace(edges,placePieces(edges,s.ep,s.eo)),cm=trace(corners,placePieces(corners,s.cp,s.co));
   if(em.length%2!==cm.length%2)throw Error("Memo parity inconsistent");
   if(em.some(c=>edges.pieceOf[c]===edges.pieceOf[edges.buffer]))throw Error("Targeted edge buffer");
   if(cm.some(c=>corners.pieceOf[c]===corners.pieceOf[corners.buffer]))throw Error("Targeted corner buffer");
 }
}
function simulate(samples=1000000,seed=20261024){
 if(!Number.isInteger(samples)||samples<1||samples>20000000||!Number.isSafeInteger(seed))throw Error("Bad arguments");
 test();
 const r=rng(seed),ec=new Uint32Array(576),cc=new Uint32Array(576);
 let edgeTotal=0,cornerTotal=0,edgeOdd=0,cornerOdd=0,parityErrors=0,edgeLetters=0,cornerLetters=0;
 for(let i=0;i<samples;i++){
   const s=randomState(r);
   const em=trace(edges,placePieces(edges,s.ep,s.eo)),cm=trace(corners,placePieces(corners,s.cp,s.co));
   if((em.length%2)!==(cm.length%2))parityErrors++;
   edgeTotal+=Math.floor(em.length/2);cornerTotal+=Math.floor(cm.length/2);
   edgeOdd+=em.length%2;cornerOdd+=cm.length%2;
   edgeLetters+=em.length;cornerLetters+=cm.length;
   countPairs(ec,em);countPairs(cc,cm);
 }
 if(parityErrors||edgeTotal!==ec.reduce((a,b)=>a+b,0)||cornerTotal!==cc.reduce((a,b)=>a+b,0))throw Error("Invalid simulation counts");
 const edgeCounts=Array.from(ec),cornerCounts=Array.from(cc);
 return {samples,seed,method:"uniform-legal-cube-states",buffers:{edges:"DF (Speffz U)",corners:"ULB (Speffz A)"},
   memo:"Speffz A-X, alphabetical cycle breaks, separately paired edge/corner memos",
   edgeTotal,cornerTotal,edgeOdd,cornerOdd,edgeLetters,cornerLetters,parityErrors,
   edgeCounts,cornerCounts,edgeSeenHex:seenHex(edgeCounts),cornerSeenHex:seenHex(cornerCounts),perEventLimit:576};
}
if(typeof module!=="undefined")module.exports={simulate,test,edges,corners,trace,placePieces,randomState,rng,parity};
if(typeof require!=="undefined"&&typeof module!=="undefined"&&require.main===module){
 const fs=require("fs"),path=require("path");
 const data=simulate(Number(process.argv[2]||1000000),Number(process.argv[3]||20261024));
 const target=path.join(__dirname,"..","frequency-data.js");
 fs.writeFileSync(target,"// Generated with scripts/simulate_memo_frequency.js. Seeded uniform legal cube states.\nwindow.BLD_REALISTIC="+JSON.stringify(data)+";\n");
 console.log(JSON.stringify({samples:data.samples,edgeTotal:data.edgeTotal,cornerTotal:data.cornerTotal,
   edgeObserved:data.edgeCounts.filter(Boolean).length,cornerObserved:data.cornerCounts.filter(Boolean).length,parityErrors:data.parityErrors},null,2));
}