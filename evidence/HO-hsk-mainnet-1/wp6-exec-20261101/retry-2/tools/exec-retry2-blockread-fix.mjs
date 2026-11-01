// HSK WP6 executor, retry-2 + post-run block-timestamp read fix (NOT the exact file that ran; see exec-retry2.mjs) (receipt-blockHash gate removed; post-state pinned by block NUMBER). Never prints or writes private keys.
// Fix vs v1: all post-tx state checks are pinned to the receipt block (same RPC re-read up to 10x/20s, then cross-check the other RPC at that block);
// estimates/quotes are pinned to a block >= the previous receipt; nonce check polls until the node reflects the last tx.
import {createPublicClient,createWalletClient,http,parseAbi,encodeFunctionData,decodeEventLog,keccak256,toHex,defineChain,recoverTypedDataAddress,hashTypedData,formatEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import fs from 'node:fs';
const MODE=process.argv[2]; const OUT=process.argv[3]; const PREFLIGHT_FILE=process.argv[4];
if(!['fork','mainnet'].includes(MODE)||!OUT||!PREFLIGHT_FILE) throw new Error('usage');
const PRIMARY = MODE==='fork' ? 'http://127.0.0.1:8547' : 'https://mainnet.hsk.xyz';
const SECONDARY = MODE==='fork' ? null : 'https://hashkey.drpc.org';
const A={guard:'0xe2172A17223BDa552e0CC101591C8893c4B65c81',test:'0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E',payout:'0x54145b97d5CeCf72b9900C702a02774171574171',
WHSK:'0xB210D2120d57b758EE163cFfb43e73728c471Cf1',USDT:'0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029',router:'0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3',quoter:'0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD',gpo:'0x420000000000000000000000000000000000000F'};
const E18=10n**18n, PRINCIPAL=E18, GWEI=10n**9n;
const PRIOR_WP6_FEE_WEI=332865537232057469n;
const GAS_CAP=467100000000000000n;   // retry-2 cap 0.4671 HSK (overall 0.8 with prior 0.332866)
const MAX_FEE=550n*GWEI;
const EXPECTED_START_NONCE=7;
const PREFLIGHT_QUOTE=BigInt(JSON.parse(fs.readFileSync(PREFLIGHT_FILE)).rpcs['https://mainnet.hsk.xyz']['quote.SELL_1WHSK_USDTraw']);
const PLAN_LIMIT={2:64282n,3:469070n,4:359486n,5:53065n,6:111063n};
const chain=defineChain({id:177,name:'HashKey Chain',nativeCurrency:{name:'HSK',symbol:'HSK',decimals:18},rpcUrls:{default:{http:[PRIMARY]}}});
const mk=u=>createPublicClient({chain,transport:http(u,{timeout:30000,retryCount:2})});
const pub=mk(PRIMARY), pub2=SECONDARY?mk(SECONDARY):null;
const NAME=c=>c===pub?'primary':'secondary';
const gAbi=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/contracts/abi/TradingSessionGuard.json'));
const types=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/config/trade-intent-types.json'));
const erc=parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function transfer(address,uint256) returns (bool)']);
const qAbi=parseAbi(['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)']);
const gpoAbi=parseAbi(['function getL1FeeUpperBound(uint256) view returns (uint256)']);
const norm=k=>{k=k.trim();return k.startsWith('0x')?k:'0x'+k};
const testAcct=privateKeyToAccount(norm(process.env.DREAMSHIELD_G1_PRIVATE_KEY));
if(testAcct.address!==A.test) throw new Error('TEST key mismatch');
const env=Object.fromEntries(fs.readFileSync('/home/box/.omp/secrets/hsk-wp6-signers.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const sAcct=privateKeyToAccount(env.HSK_WP6_STRATEGY_PRIVATE_KEY), rAcct=privateKeyToAccount(env.HSK_WP6_RISK_PRIVATE_KEY);
if(sAcct.address!=='0x96c06E98CE98F342aF2E2c7a030cFf15cBC8eC69'||rAcct.address!=='0x92501bA2F20422184b22D176F78f40B1AbB32FED') throw new Error('S/R mismatch');
const wallet=createWalletClient({chain,transport:http(PRIMARY,{timeout:30000}),account:testAcct});
const ser=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?v.toString():v));
const log={schema:'hsk-wp6-exec-retry/2',mode:MODE==='fork'?'LOCAL_ANVIL_FORK_REHEARSAL_NOT_MAINNET':'MAINNET_BROADCAST_RETRY_2',chainId:177,primaryRpc:PRIMARY,secondaryRpc:SECONDARY,startedAt:new Date().toISOString(),
 sender:A.test,strategySigner:sAcct.address,riskSigner:rAcct.address,retryGasCapHSK:'0.4671',priorWp6FeeHSK:formatEther(PRIOR_WP6_FEE_WEI),principal:'1 WHSK (already held by TEST; wrap skipped)',txs:[],checks:{},warnings:[],anomaly:null,result:null};
const save=()=>fs.writeFileSync(OUT,JSON.stringify(ser(log),null,1));
const say=(...a)=>console.log(new Date().toISOString(),...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
class Anomaly extends Error{}
let spentWei=0n, nonce=EXPECTED_START_NONCE, fundsInGuard=false, withdrawn=false, lastBlock=0n;
const isRevert=e=>/revert/i.test((e.shortMessage||'')+(e.message||''));

// Pinned state reader
const R=async(c,bn,tok,fn,args)=>c.readContract({address:tok,abi:tok===A.guard?gAbi:erc,functionName:fn,args,blockNumber:bn});
async function readGuardState(c,bn){
 const pol=await R(c,bn,A.guard,'policy');
 return {status:await R(c,bn,A.guard,'status'),owner:await R(c,bn,A.guard,'owner'),pendingOwner:await R(c,bn,A.guard,'pendingOwner'),sessionId:await R(c,bn,A.guard,'sessionId'),policyVersion:await R(c,bn,A.guard,'policyVersion'),intentNonce:await R(c,bn,A.guard,'intentNonce'),
  allocatedQuoteRaw:await R(c,bn,A.guard,'allocatedQuoteRaw'),allocatedRiskRaw:await R(c,bn,A.guard,'allocatedRiskRaw'),strategySigner:pol[3],riskSigner:pol[4],strategyPolicyHash:pol[5],
  guardHSK:await c.getBalance({address:A.guard,blockNumber:bn}),guardWHSK:await R(c,bn,A.WHSK,'balanceOf',[A.guard]),guardUSDT:await R(c,bn,A.USDT,'balanceOf',[A.guard]),
  testHSK:await c.getBalance({address:A.test,blockNumber:bn}),testWHSK:await R(c,bn,A.WHSK,'balanceOf',[A.test]),testUSDT:await R(c,bn,A.USDT,'balanceOf',[A.test]),
  allow_WHSK_Guard_router:await R(c,bn,A.WHSK,'allowance',[A.guard,A.router]),allow_USDT_Guard_router:await R(c,bn,A.USDT,'allowance',[A.guard,A.router]),
  allow_WHSK_TEST_router:await R(c,bn,A.WHSK,'allowance',[A.test,A.router]),allow_USDT_TEST_router:await R(c,bn,A.USDT,'allowance',[A.test,A.router]),
  allow_WHSK_TEST_Guard:await R(c,bn,A.WHSK,'allowance',[A.test,A.guard]),allow_USDT_TEST_Guard:await R(c,bn,A.USDT,'allowance',[A.test,A.guard])};
}
// Confirm state at a pinned block (receipt block). Same-RPC re-read up to 10x/20s, then cross-check the other RPC.
async function confirm(label,bn,bhash,check){
 const res={pinnedBlock:bn,receiptBlockHashInformational:bhash};
 for(const c of [pub,pub2].filter(Boolean)){
  const o={ok:false,tries:0};
  for(let i=0;i<10&&!o.ok;i++){
   o.tries=i+1;
   try{
    const b=await c.getBlock({blockNumber:bn});
    o.canonicalBlockHash=b.hash; // informational only; NOT compared to receipt.blockHash (provisional on mainnet.hsk.xyz)
    {const st=await readGuardState(c,bn);const why=check(st);o.state=st;if(!why)o.ok=true;else o.lastReason=why;}
   }catch(e){o.lastReason='read error: '+(e.shortMessage||e.message).slice(0,160);}
   if(!o.ok) await sleep(2000);
  }
  res[NAME(c)]=o;
 }
 log.checks[label]=res; save();
 const oks=[res.primary,res.secondary].filter(x=>x&&x.ok);
 if(oks.length===0) throw new Anomaly(`${label}: state wrong at pinned block ${bn} on all RPCs (${res.primary.lastReason}${res.secondary?' | '+res.secondary.lastReason:''})`);
 if(res.secondary&&!res.secondary.ok) log.warnings.push(`${label}: secondary not confirmed (${res.secondary.lastReason})`);
 if(!res.primary.ok) log.warnings.push(`${label}: primary not confirmed (${res.primary.lastReason})`);
 save(); return oks[0].state;
}
async function waitNonce(){
 for(let i=0;i<10;i++){
  const l=await pub.getTransactionCount({address:A.test,blockTag:'latest'});
  if(l>nonce) throw new Anomaly(`latest nonce ${l} > expected ${nonce}`);
  if(l===nonce){const p=await pub.getTransactionCount({address:A.test,blockTag:'pending'}); if(p===nonce) return; if(p>nonce) throw new Anomaly(`pending nonce ${p} > expected ${nonce}`);}
  await sleep(2000);
 }
 throw new Anomaly(`nonce never reached ${nonce} on primary within 20s`);
}
async function pinnedBlock(){ // a primary block >= lastBlock
 for(let i=0;i<10;i++){const b=await pub.getBlock(); if(b.number>=lastBlock) return b; await sleep(2000);} throw new Anomaly('primary head behind last receipt block for 20s');
}
async function estimate(step,to,data,recovery){
 for(let i=0;i<5;i++){
  const b=await pinnedBlock();
  try{ return {est:await pub.estimateGas({account:A.test,to,data,blockNumber:b.number}),atBlock:b.number}; }
  catch(e){
   if(isRevert(e)){
    let rev2=null; if(pub2){ try{ await pub2.estimateGas({account:A.test,to,data,blockNumber:b.number}); rev2=false; }catch(e2){ rev2=isRevert(e2)?true:null; } }
    if(rev2===false){ log.warnings.push(`step ${step}: primary estimate reverted at ${b.number} but secondary ok; retrying`); await sleep(2000); continue; }
    if(recovery) return {est:PLAN_LIMIT[step],atBlock:b.number,note:'estimate reverted; recovery uses plan limit'};
    throw new Anomaly(`step ${step} estimateGas reverted at block ${b.number}: ${(e.shortMessage||e.message).slice(0,240)}`);
   }
   await sleep(2000);
  }
 }
 if(recovery) return {est:PLAN_LIMIT[step],atBlock:null,note:'estimate unavailable; recovery uses plan limit'};
 throw new Anomaly(`step ${step} estimateGas unavailable`);
}
async function send(step,label,to,data,{recovery=false}={}){
 await waitNonce();
 const blk=await pinnedBlock();
 if(blk.baseFeePerGas>520n*GWEI) throw new Anomaly(`baseFee ${blk.baseFeePerGas} > 520 gwei`);
 const {est,atBlock,note}=await estimate(step,to,data,recovery);
 try{ const sb=await pinnedBlock(); await pub.call({account:A.test,to,data,blockNumber:sb.number}); (log.simulations??={})['step'+step+(recovery?'_recovery':'')]={ok:true,atBlock:sb.number}; }catch(e){ (log.simulations??={})['step'+step]={ok:false,err:(e.shortMessage||e.message).slice(0,200)}; if(!recovery) throw new Anomaly(`step ${step} eth_call simulation failed`); }
 const gas = PLAN_LIMIT[step] > est*125n/100n ? PLAN_LIMIT[step] : est*125n/100n;
 const tip=1000000n;
 const l1Up=await pub.readContract({address:A.gpo,abi:gpoAbi,functionName:'getL1FeeUpperBound',args:[BigInt((data.length-2)/2+200)]});
 const maxThis=gas*MAX_FEE+l1Up;
 const reserve=(!recovery && fundsInGuard && step!==6) ? PLAN_LIMIT[6]*MAX_FEE+l1Up : 0n;
 if(!recovery && spentWei+maxThis+reserve>GAS_CAP) throw new Anomaly(`gas cap: spent ${spentWei} + max ${maxThis} + reserve ${reserve} > 0.4671 HSK`);
 const rec={step,label,to,nonce,estimateGas:est,estimateAtBlock:atBlock,estimateNote:note,gasLimit:gas,maxFeePerGas:MAX_FEE,maxPriorityFeePerGas:tip,maxPossibleFeeWei:maxThis};
 log.txs.push(rec); save();
 let hash=null;
 for(let attempt=0;attempt<3&&!hash;attempt++){
  try{
   hash = MODE==='mainnet'
    ? await wallet.sendTransaction({to,data,value:0n,nonce,gas,maxFeePerGas:MAX_FEE,maxPriorityFeePerGas:tip,type:'eip1559'})
    : await pub.request({method:'eth_sendTransaction',params:[{from:A.test,to,data,value:'0x0',nonce:toHex(nonce),gas:toHex(gas),maxFeePerGas:toHex(MAX_FEE),maxPriorityFeePerGas:toHex(tip)}]});
  }catch(e){
   say(`send error step ${step} attempt ${attempt}: ${(e.shortMessage||e.message).slice(0,200)}`);
   await sleep(4000);
   const p=await pub.getTransactionCount({address:A.test,blockTag:'pending'});
   if(p!==nonce) throw new Anomaly(`send errored but pending nonce advanced to ${p}; manual check needed`);
  }
 }
 if(!hash) throw new Anomaly(`step ${step} could not be broadcast after 3 attempts`);
 rec.hash=hash; rec.sentAt=new Date().toISOString(); save(); say(`step ${step} ${label} sent ${hash}`);
 let r=null;
 for(let i=0;i<90&&!r;i++){ r=await pub.request({method:'eth_getTransactionReceipt',params:[hash]}).catch(()=>null); if(!r) await sleep(2000); }
 if(!r) throw new Anomaly(`no receipt for ${hash} after 180s`);
 const gasUsed=BigInt(r.gasUsed), egp=BigInt(r.effectiveGasPrice), l1=r.l1Fee?BigInt(r.l1Fee):0n, fee=gasUsed*egp+l1;
 Object.assign(rec,{blockNumber:BigInt(r.blockNumber),blockHash:r.blockHash,gasUsed,effectiveGasPrice:egp,l1FeeWei:l1,feeWei:fee,feeHSK:formatEther(fee),status:r.status==='0x1'?'success':'reverted'});
 spentWei+=fee; nonce++; lastBlock=BigInt(r.blockNumber);
 log.retryFeeWei=spentWei; log.retryFeeHSK=formatEther(spentWei); log.cumulativeWp6FeeHSK=formatEther(spentWei+PRIOR_WP6_FEE_WEI); save();
 say(`step ${step} block ${rec.blockNumber} gasUsed ${gasUsed} fee ${rec.feeHSK} status ${rec.status} retryCum ${formatEther(spentWei)}`);
 if(pub2){ let r2=null; for(let i=0;i<10&&!r2;i++){ r2=await pub2.request({method:'eth_getTransactionReceipt',params:[hash]}).catch(()=>null); if(!r2) await sleep(2000);} rec.secondaryRpcReceipt=r2?{blockNumber:BigInt(r2.blockNumber),status:r2.status==='0x1'?'success':'reverted',blockHashMatch:r2.blockHash===r.blockHash}:'not_seen_within_20s'; save(); }
 if(rec.status!=='success') throw new Anomaly(`step ${step} ${label} reverted (${hash})`);
 return {r,rec,bn:BigInt(r.blockNumber),bh:r.blockHash};
}
const allowZero=s=>['allow_WHSK_Guard_router','allow_USDT_Guard_router','allow_WHSK_TEST_router','allow_USDT_TEST_router','allow_WHSK_TEST_Guard','allow_USDT_TEST_Guard'].every(k=>s[k]===0n);

async function main(){
 // Pre-start, pinned at current primary head, cross-checked on secondary
 const h=await pub.getBlock(); lastBlock=h.number;
 await confirm('preStart',h.number,h.hash,s=> (s.status===0&&s.owner===A.test&&s.pendingOwner==='0x0000000000000000000000000000000000000000'&&s.guardWHSK===0n&&s.guardUSDT===0n&&s.allocatedQuoteRaw===0n&&s.allocatedRiskRaw===0n&&s.testWHSK===PRINCIPAL&&s.testHSK>=GAS_CAP&&allowZero(s))?null:'pre-start mismatch');
 if(!(log.checks.preStart.primary.ok&&(!pub2||log.checks.preStart.secondary.ok))) throw new Anomaly('pre-start not confirmed on both RPCs');
 const pv0=log.checks.preStart.primary.state.policyVersion, sid0=log.checks.preStart.primary.state.sessionId;
 // Step 2 transfer
 fundsInGuard=true;
 const t2=await send(2,'WHSK.transfer(Guard, 1e18)',A.WHSK,encodeFunctionData({abi:erc,functionName:'transfer',args:[A.guard,PRINCIPAL]}));
 await confirm('afterTransfer',t2.bn,t2.bh,s=>(s.guardWHSK===PRINCIPAL&&s.testWHSK===0n)?null:`guardWHSK=${s.guardWHSK} testWHSK=${s.testWHSK}`);
 // Step 3 startSession
 const b=await pinnedBlock(); const now=b.timestamp;
 const docBytes=fs.readFileSync('/workspace/hsk-pilot/docs/06_AGENT_STRATEGY_AND_RISK.md');
 const policy={mode:0,validAfter:now,validUntil:now+3600n,strategySigner:sAcct.address,riskSigner:rAcct.address,strategyPolicyHash:keccak256(docBytes),
  maxBuyPerTradeQuoteRaw:1n,maxSessionGrossBuyQuoteRaw:1n,maxUtcDayGrossBuyQuoteRaw:1n,maxRiskInventoryRaw:PRINCIPAL,maxSellPerTradeRiskRaw:PRINCIPAL,minTradeIntervalSec:60,maxQuoteSlippageBps:100,maxQuoteAgeSec:120,maxIntentTtlSec:300,exitMaxPerTradeRiskRaw:PRINCIPAL,exitMinIntervalSec:60,exitValidUntil:now+7200n};
 log.policy=policy; log.strategyPolicyHashSource='keccak256(bytes of docs/06_AGENT_STRATEGY_AND_RISK.md @ hsk-pilot 2e3af6c)'; save();
 const t3=await send(3,'Guard.startSession(policy, 0, 1e18)',A.guard,encodeFunctionData({abi:gAbi,functionName:'startSession',args:[policy,0n,PRINCIPAL]}));
 const s3=await confirm('afterStartSession',t3.bn,t3.bh,s=>(s.status===1&&s.sessionId===sid0+1n&&s.policyVersion===pv0+1&&s.strategySigner===sAcct.address&&s.riskSigner===rAcct.address&&s.allocatedRiskRaw===PRINCIPAL&&s.intentNonce===0n&&s.strategyPolicyHash===policy.strategyPolicyHash)?null:`status=${s.status} sid=${s.sessionId} pv=${s.policyVersion} S=${s.strategySigner} R=${s.riskSigner} alloc=${s.allocatedRiskRaw}`);
 // Step 4 execute
 let intent,s1,s2,qb,q;
 for(let tries=0;tries<3&&!intent;tries++){
  qb=await pinnedBlock();
  q=(await pub.simulateContract({address:A.quoter,abi:qAbi,functionName:'quoteExactInputSingle',args:[{tokenIn:A.WHSK,tokenOut:A.USDT,amountIn:PRINCIPAL,fee:3000,sqrtPriceLimitX96:0n}],blockNumber:qb.number})).result[0];
  let q2=null; if(pub2){ for(let i=0;i<5&&q2===null;i++){ try{ const b2=await pub2.getBlock({blockNumber:qb.number}); q2=(await pub2.simulateContract({address:A.quoter,abi:qAbi,functionName:'quoteExactInputSingle',args:[{tokenIn:A.WHSK,tokenOut:A.USDT,amountIn:PRINCIPAL,fee:3000,sqrtPriceLimitX96:0n}],blockNumber:qb.number})).result[0]; }catch(e){ await sleep(1500);} } }
  log.checks.quote={attempt:tries,blockNumber:qb.number,blockHash:qb.hash,blockTimestamp:qb.timestamp,quotePrimary:q,quoteSecondarySameBlock:q2,preflightQuote:PREFLIGHT_QUOTE}; save();
  const d=q>PREFLIGHT_QUOTE?q-PREFLIGHT_QUOTE:PREFLIGHT_QUOTE-q;
  if(d*10000n/PREFLIGHT_QUOTE>500n) throw new Anomaly(`quote ${q} deviates >5% from preflight ${PREFLIGHT_QUOTE}`);
  if(pub2 && (q2===null || q2!==q)) throw new Anomaly(`secondary quote at same block ${q2} != primary ${q}`);
  const minOut=q*9900n/10000n;
  intent={sessionId:s3.sessionId,policyVersion:s3.policyVersion,strategyPolicyHash:policy.strategyPolicyHash,intentNonce:s3.intentNonce,direction:1,amountInRaw:PRINCIPAL,referenceAmountOutRaw:q,amountOutMinimumRaw:minOut,quoteObservedAt:qb.timestamp,quoteBlockNumber:qb.number,quoteBlockHash:qb.hash,deadline:qb.timestamp+120n,
   evidenceHash:keccak256(fs.readFileSync(PREFLIGHT_FILE))};
  const td={domain:{name:'HSKPilotGuard',version:'1',chainId:177,verifyingContract:A.guard},types:{TradeIntent:types.types.TradeIntent},primaryType:'TradeIntent',message:intent};
  s1=await sAcct.signTypedData(td); s2=await rAcct.signTypedData(td);
  const onchain=await pub.readContract({address:A.guard,abi:gAbi,functionName:'hashIntent',args:[intent],blockNumber:qb.number});
  const local=hashTypedData(td); const rs=await recoverTypedDataAddress({...td,signature:s1}), rr=await recoverTypedDataAddress({...td,signature:s2});
  log.intent=intent; log.intentDigest={onchain,local,match:onchain===local,recoveredStrategy:rs,recoveredRisk:rr}; save();
  if(onchain!==local||rs!==sAcct.address||rr!==rAcct.address) throw new Anomaly('intent digest/signature mismatch');
  const nb=await pub.getBlock(); const age=nb.timestamp-qb.timestamp; log.checks.quote.ageBeforeSendSec=age; save();
  if(age>60n){ say(`quote age ${age}s > 60s; re-quoting`); intent=null; }
 }
 if(!intent) throw new Anomaly('no fresh quote within window');
 const t4=await send(4,'Guard.execute(SELL 1 WHSK->USDT)',A.guard,encodeFunctionData({abi:gAbi,functionName:'execute',args:[intent,s1,s2]}));
 let actualOut=null; for(const lg of t4.r.logs){ if(lg.address.toLowerCase()!==A.guard.toLowerCase()) continue; try{const d=decodeEventLog({abi:gAbi,data:lg.data,topics:lg.topics}); if(d.eventName==='TradeExecuted') actualOut=d.args.actualOutRaw;}catch{} }
 // FIX (post-run, 2026-11-01): bounded re-reads; a load-balanced node may not serve the block right after the receipt.
 let eb=null; for(const c of [pub,pub2].filter(Boolean)){ for(let i=0;i<10&&!eb;i++){ try{ eb=await c.getBlock({blockNumber:t4.bn}); }catch{ await sleep(2000); } } if(eb) break; }
 if(!eb) throw new Anomaly(`execute block ${t4.bn} not served by any RPC within 20s`);
 log.checks.executeResult={actualOutRaw:actualOut,referenceQuote:intent.referenceAmountOutRaw,minOut:intent.amountOutMinimumRaw,secondsQuoteToInclusion:eb.timestamp-qb.timestamp}; save();
 if(actualOut===null||actualOut<intent.amountOutMinimumRaw||eb.timestamp-qb.timestamp>120n) throw new Anomaly('execute result check failed');
 // Step 5 verify (read-only, pinned)
 await confirm('afterExecute_verify',t4.bn,t4.bh,s=>(s.guardWHSK===0n&&s.guardUSDT===actualOut&&s.allocatedQuoteRaw===actualOut&&s.allocatedRiskRaw===0n&&s.intentNonce===1n&&allowZero(s))?null:`gWHSK=${s.guardWHSK} gUSDT=${s.guardUSDT} allocQ=${s.allocatedQuoteRaw} nonce=${s.intentNonce} allowZero=${allowZero(s)}`);
 // Step 6 withdrawAll
 const t6=await send(6,'Guard.withdrawAll()',A.guard,encodeFunctionData({abi:gAbi,functionName:'withdrawAll'}));
 withdrawn=true; fundsInGuard=false;
 const fin=await confirm('final',t6.bn,t6.bh,s=>(s.status===0&&s.guardWHSK===0n&&s.guardUSDT===0n&&s.allocatedQuoteRaw===0n&&s.allocatedRiskRaw===0n&&s.testUSDT===actualOut&&allowZero(s))?null:'final mismatch');
 log.result='SUCCESS';
}
try{ await main(); }
catch(e){
 log.anomaly=String(e.message||e); log.stoppedAt=new Date().toISOString(); log.result='STOPPED_ON_ANOMALY'; save(); say('ANOMALY:',log.anomaly);
 if(fundsInGuard&&!withdrawn){
  log.recovery={};
  for(let i=0;i<3&&!withdrawn;i++){
   try{ const t=await send(6,'Guard.withdrawAll() [anomaly recovery]',A.guard,encodeFunctionData({abi:gAbi,functionName:'withdrawAll'}),{recovery:true}); withdrawn=true;
    await confirm('recoveryFinal',t.bn,t.bh,s=>(s.status===0&&s.guardWHSK===0n&&s.guardUSDT===0n&&allowZero(s))?null:'recovery final mismatch').catch(e3=>{log.recovery.finalCheck=String(e3.message)});
   }catch(e2){ log.recovery['attempt'+i]=String(e2.message); save(); const p=await pub.getTransactionCount({address:A.test,blockTag:'pending'}).catch(()=>null); if(p!==null) nonce=p; await sleep(3000); }
  }
  if(!withdrawn){ try{ await send(5,'Guard.pause() [recovery fallback]',A.guard,encodeFunctionData({abi:gAbi,functionName:'pause'}),{recovery:true}); log.recovery.paused=true;}catch(e4){log.recovery.pauseError=String(e4.message);} }
  log.recovery.withdrawn=withdrawn;
 }
 save(); process.exitCode=2;
}
log.finishedAt=new Date().toISOString(); log.retryFeeWei=spentWei; log.retryFeeHSK=formatEther(spentWei); log.cumulativeWp6FeeHSK=formatEther(spentWei+PRIOR_WP6_FEE_WEI); save();
say('RESULT',log.result,'retryFee',formatEther(spentWei),'cumWP6',formatEther(spentWei+PRIOR_WP6_FEE_WEI));
