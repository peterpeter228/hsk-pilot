// HSK WP6 executor. Never prints or writes private keys.
import {createPublicClient,createWalletClient,http,parseAbi,encodeFunctionData,decodeEventLog,keccak256,toHex,defineChain,recoverTypedDataAddress,formatEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import fs from 'node:fs';
const MODE=process.argv[2]; // 'fork' | 'mainnet'
const OUT=process.argv[3];
if(!['fork','mainnet'].includes(MODE)||!OUT) throw new Error('usage');
const PRIMARY = MODE==='fork' ? 'http://127.0.0.1:8547' : 'https://mainnet.hsk.xyz';
const SECONDARY = MODE==='fork' ? null : 'https://hashkey.drpc.org';
const A={guard:'0xe2172A17223BDa552e0CC101591C8893c4B65c81',test:'0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E',payout:'0x54145b97d5CeCf72b9900C702a02774171574171',
WHSK:'0xB210D2120d57b758EE163cFfb43e73728c471Cf1',USDT:'0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029',router:'0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3',quoter:'0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD',gpo:'0x420000000000000000000000000000000000000F'};
const E18=10n**18n, PRINCIPAL=E18, GWEI=10n**9n;
const GAS_CAP=8n*E18/10n;            // 0.8 HSK total gas cap
const MAX_FEE=550n*GWEI;             // plan worst-case cap
const PREFLIGHT_QUOTE=87149n;
const PLAN_LIMIT={1:64820n,2:64282n,3:469070n,4:359486n,5:53065n,6:111063n};
const chain=defineChain({id:177,name:'HashKey Chain',nativeCurrency:{name:'HSK',symbol:'HSK',decimals:18},rpcUrls:{default:{http:[PRIMARY]}}});
const pub=createPublicClient({chain,transport:http(PRIMARY,{timeout:30000,retryCount:3})});
const pub2=SECONDARY?createPublicClient({chain,transport:http(SECONDARY,{timeout:30000,retryCount:3})}):null;
const gAbi=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/contracts/abi/TradingSessionGuard.json'));
const types=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/config/trade-intent-types.json'));
const erc=parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function deposit() payable','function transfer(address,uint256) returns (bool)']);
const qAbi=parseAbi(['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)']);
const gpoAbi=parseAbi(['function getL1FeeUpperBound(uint256) view returns (uint256)']);
// keys (in-memory only)
const norm=k=>{k=k.trim();return k.startsWith('0x')?k:'0x'+k};
const testAcct=privateKeyToAccount(norm(process.env.DREAMSHIELD_G1_PRIVATE_KEY));
if(testAcct.address!==A.test) throw new Error('TEST key mismatch');
const env=Object.fromEntries(fs.readFileSync('/home/box/.omp/secrets/hsk-wp6-signers.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const sAcct=privateKeyToAccount(env.HSK_WP6_STRATEGY_PRIVATE_KEY), rAcct=privateKeyToAccount(env.HSK_WP6_RISK_PRIVATE_KEY);
for(const x of [sAcct.address,rAcct.address]) if([A.test,A.payout].map(a=>a.toLowerCase()).includes(x.toLowerCase())) throw new Error('bad role');
if(sAcct.address===rAcct.address) throw new Error('S==R');
const wallet=createWalletClient({chain,transport:http(PRIMARY,{timeout:30000}),account:MODE==='mainnet'?testAcct:A.test});
const ser=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?v.toString():v));
const log={schema:'hsk-wp6-exec/1',mode:MODE==='fork'?'LOCAL_ANVIL_FORK_REHEARSAL_NOT_MAINNET':'MAINNET_BROADCAST',chainId:177,primaryRpc:PRIMARY,secondaryRpc:SECONDARY,startedAt:new Date().toISOString(),
 sender:A.test,strategySigner:sAcct.address,riskSigner:rAcct.address,gasCapHSK:'0.8',principalHSK:'1',txs:[],checks:{},anomaly:null,stoppedAt:null,result:null};
const save=()=>fs.writeFileSync(OUT,JSON.stringify(ser(log),null,1));
const say=(...a)=>console.log(new Date().toISOString(),...a);
let spentWei=0n, nonce=null, fundsInGuard=false, withdrawn=false;
const bal=(t,a)=>pub.readContract({address:t,abi:erc,functionName:'balanceOf',args:[a]});
const gread=fn=>pub.readContract({address:A.guard,abi:gAbi,functionName:fn});
class Anomaly extends Error{}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function send(step,label,to,data,value=0n,{reserveWithdraw=true}={}){
 // nonce discipline
 const latest=await pub.getTransactionCount({address:A.test,blockTag:'latest'}), pending=await pub.getTransactionCount({address:A.test,blockTag:'pending'});
 if(nonce===null) nonce=latest;
 if(latest!==nonce||pending!==nonce) throw new Anomaly(`nonce mismatch before step ${step}: latest=${latest} pending=${pending} expected=${nonce}`);
 const blk=await pub.getBlock();
 if(blk.baseFeePerGas>520n*GWEI) throw new Anomaly(`baseFee ${blk.baseFeePerGas} > 520 gwei`);
 let est; try{ est=await pub.estimateGas({account:A.test,to,data,value}); }catch(e){ throw new Anomaly(`step ${step} ${label} estimateGas reverted: ${(e.shortMessage||e.message).slice(0,300)}`); }
 const gas = PLAN_LIMIT[step] > est*125n/100n ? PLAN_LIMIT[step] : est*125n/100n;
 const tip = 1000000n;
 const l1Up = await pub.readContract({address:A.gpo,abi:gpoAbi,functionName:'getL1FeeUpperBound',args:[BigInt((data.length-2)/2+200)]});
 const maxThis = gas*MAX_FEE + l1Up;
 const reserve = (reserveWithdraw && fundsInGuard && step!==6) ? PLAN_LIMIT[6]*MAX_FEE + l1Up : 0n;
 if(spentWei+maxThis+reserve>GAS_CAP) throw new Anomaly(`gas cap: spent ${spentWei} + max ${maxThis} + reserve ${reserve} > 0.8 HSK`);
 if(value+spentWei+maxThis>PRINCIPAL+GAS_CAP) throw new Anomaly('total spend cap');
 const rec={step,label,to,valueWei:value,nonce,estimateGas:est,gasLimit:gas,maxFeePerGas:MAX_FEE,maxPriorityFeePerGas:tip,maxPossibleFeeWei:maxThis};
 log.txs.push(rec); save();
 let hash=null;
 for(let attempt=0;attempt<3&&!hash;attempt++){
  try{
   hash = MODE==='mainnet'
    ? await wallet.sendTransaction({to,data,value,nonce,gas,maxFeePerGas:MAX_FEE,maxPriorityFeePerGas:tip,type:'eip1559'})
    : await pub.request({method:'eth_sendTransaction',params:[{from:A.test,to,data,value:toHex(value),nonce:toHex(nonce),gas:toHex(gas),maxFeePerGas:toHex(MAX_FEE),maxPriorityFeePerGas:toHex(tip)}]});
  }catch(e){
   say(`send error step ${step} attempt ${attempt}: ${(e.shortMessage||e.message).slice(0,200)}`);
   await sleep(4000);
   const p=await pub.getTransactionCount({address:A.test,blockTag:'pending'});
   if(p!==nonce){ throw new Anomaly(`send errored but nonce advanced (pending=${p}); tx may have landed; manual check needed`); }
  }
 }
 if(!hash) throw new Anomaly(`step ${step} could not be broadcast after 3 attempts`);
 rec.hash=hash; rec.sentAt=new Date().toISOString(); save(); say(`step ${step} ${label} sent ${hash}`);
 let r=null;
 for(let i=0;i<90&&!r;i++){ r=await pub.request({method:'eth_getTransactionReceipt',params:[hash]}).catch(()=>null); if(!r) await sleep(2000); }
 if(!r) throw new Anomaly(`no receipt for ${hash} after 180s`);
 const gasUsed=BigInt(r.gasUsed), egp=BigInt(r.effectiveGasPrice), l1=r.l1Fee?BigInt(r.l1Fee):0n, fee=gasUsed*egp+l1;
 Object.assign(rec,{blockNumber:BigInt(r.blockNumber),blockHash:r.blockHash,gasUsed,effectiveGasPrice:egp,l1FeeWei:l1,feeWei:fee,feeHSK:formatEther(fee),status:r.status==='0x1'?'success':'reverted'});
 spentWei+=fee; nonce++; log.cumulativeFeeWei=spentWei; log.cumulativeFeeHSK=formatEther(spentWei); save();
 say(`step ${step} block ${rec.blockNumber} gasUsed ${gasUsed} fee ${rec.feeHSK} status ${rec.status} cum ${formatEther(spentWei)}`);
 if(pub2){ let r2=null; for(let i=0;i<15&&!r2;i++){ r2=await pub2.request({method:'eth_getTransactionReceipt',params:[hash]}).catch(()=>null); if(!r2) await sleep(2000);} rec.secondaryRpcReceipt=r2?{blockNumber:BigInt(r2.blockNumber),status:r2.status==='0x1'?'success':'reverted',match:r2.blockHash===r.blockHash}:'not_seen_within_30s'; save(); }
 if(rec.status!=='success') throw new Anomaly(`step ${step} ${label} reverted (${hash})`);
 return {r,rec};
}

async function main(){
 log.checks.preStart={TESTnonce:await pub.getTransactionCount({address:A.test}),TESTwei:await pub.getBalance({address:A.test}),guardStatus:await gread('status'),guardOwner:await gread('owner'),guardWHSK:await bal(A.WHSK,A.guard),guardUSDT:await bal(A.USDT,A.guard)};
 const ps=log.checks.preStart;
 if(ps.guardStatus!==0||ps.guardOwner!==A.test||ps.guardWHSK!==0n||ps.guardUSDT!==0n||ps.TESTwei<18n*E18/10n) throw new Anomaly('pre-start state mismatch');
 // 1 wrap
 await send(1,'WHSK.deposit() value 1 HSK',A.WHSK,encodeFunctionData({abi:erc,functionName:'deposit'}),PRINCIPAL);
 if(await bal(A.WHSK,A.test)!==PRINCIPAL) throw new Anomaly('TEST WHSK != 1e18 after wrap');
 // 2 transfer
 fundsInGuard=true; // conservatively reserve withdraw from here
 await send(2,'WHSK.transfer(Guard, 1e18)',A.WHSK,encodeFunctionData({abi:erc,functionName:'transfer',args:[A.guard,PRINCIPAL]}),0n,{reserveWithdraw:false});
 if(await bal(A.WHSK,A.guard)!==PRINCIPAL) throw new Anomaly('Guard WHSK != 1e18 after transfer');
 // 3 startSession
 const b=await pub.getBlock(); const now=b.timestamp;
 const docBytes=fs.readFileSync('/workspace/hsk-pilot/docs/06_AGENT_STRATEGY_AND_RISK.md');
 const policy={mode:0,validAfter:now,validUntil:now+3600n,strategySigner:sAcct.address,riskSigner:rAcct.address,strategyPolicyHash:keccak256(docBytes),
  maxBuyPerTradeQuoteRaw:1n,maxSessionGrossBuyQuoteRaw:1n,maxUtcDayGrossBuyQuoteRaw:1n,maxRiskInventoryRaw:PRINCIPAL,maxSellPerTradeRiskRaw:PRINCIPAL,minTradeIntervalSec:60,maxQuoteSlippageBps:100,maxQuoteAgeSec:120,maxIntentTtlSec:300,exitMaxPerTradeRiskRaw:PRINCIPAL,exitMinIntervalSec:60,exitValidUntil:now+7200n};
 log.policy=policy; log.strategyPolicyHashSource='keccak256(bytes of docs/06_AGENT_STRATEGY_AND_RISK.md @ hsk-pilot 2e3af6c)'; save();
 await send(3,'Guard.startSession(policy, 0, 1e18)',A.guard,encodeFunctionData({abi:gAbi,functionName:'startSession',args:[policy,0n,PRINCIPAL]}));
 const sid=await gread('sessionId'), pv=await gread('policyVersion'), st=await gread('status'), pol=await gread('policy');
 log.checks.afterStart={status:st,sessionId:sid,policyVersion:pv,strategySigner:pol[3],riskSigner:pol[4],allocatedRiskRaw:await gread('allocatedRiskRaw')}; save();
 if(st!==1||sid!==1n||pv!==1||pol[3]!==sAcct.address||pol[4]!==rAcct.address) throw new Anomaly('post-startSession state mismatch');
 // 4 execute: fresh quote, minOut=floor(q*0.99), within 120s
 let intent,s1,s2,q,qb;
 for(let tries=0;tries<3;tries++){
  qb=await pub.getBlock();
  q=(await pub.simulateContract({address:A.quoter,abi:qAbi,functionName:'quoteExactInputSingle',args:[{tokenIn:A.WHSK,tokenOut:A.USDT,amountIn:PRINCIPAL,fee:3000,sqrtPriceLimitX96:0n}],blockNumber:qb.number})).result[0];
  let q2=null; if(pub2){ try{ q2=(await pub2.simulateContract({address:A.quoter,abi:qAbi,functionName:'quoteExactInputSingle',args:[{tokenIn:A.WHSK,tokenOut:A.USDT,amountIn:PRINCIPAL,fee:3000,sqrtPriceLimitX96:0n}]})).result[0]; }catch(e){ q2='err'; } }
  log.checks.quote={attempt:tries,blockNumber:qb.number,blockHash:qb.hash,blockTimestamp:qb.timestamp,quotePrimary:q,quoteSecondary:q2,preflightQuote:PREFLIGHT_QUOTE}; save();
  const dev=x=>{const d=x>PREFLIGHT_QUOTE?x-PREFLIGHT_QUOTE:PREFLIGHT_QUOTE-x;return d*10000n/PREFLIGHT_QUOTE};
  if(dev(q)>500n) throw new Anomaly(`quote ${q} deviates >5% from preflight ${PREFLIGHT_QUOTE}`);
  if(pub2 && (q2==='err' || (q2>q?q2-q:q-q2)*10000n/q>100n)) throw new Anomaly(`secondary quote mismatch: ${q2} vs ${q}`);
  const minOut=q*9900n/10000n; // floor
  intent={sessionId:sid,policyVersion:pv,strategyPolicyHash:policy.strategyPolicyHash,intentNonce:await gread('intentNonce'),direction:1,amountInRaw:PRINCIPAL,referenceAmountOutRaw:q,amountOutMinimumRaw:minOut,quoteObservedAt:qb.timestamp,quoteBlockNumber:qb.number,quoteBlockHash:qb.hash,deadline:qb.timestamp+120n,
   evidenceHash:keccak256(fs.readFileSync('/workspace/web3-bounty/v3-reconcile/evidence/hsk-wp6-exec-20261101/preflight-state.json'))};
  if(intent.intentNonce!==0n) throw new Anomaly('intentNonce != 0');
  const td={domain:{name:'HSKPilotGuard',version:'1',chainId:177,verifyingContract:A.guard},types:{TradeIntent:types.types.TradeIntent},primaryType:'TradeIntent',message:intent};
  s1=await sAcct.signTypedData(td); s2=await rAcct.signTypedData(td);
  const onchain=await pub.readContract({address:A.guard,abi:gAbi,functionName:'hashIntent',args:[intent]});
  const rs=await recoverTypedDataAddress({...td,signature:s1}), rr=await recoverTypedDataAddress({...td,signature:s2});
  const {hashTypedData}=await import('viem'); const local=hashTypedData(td);
  log.intent=intent; log.intentDigest={onchain,local,match:onchain===local,recoveredStrategy:rs,recoveredRisk:rr}; save();
  if(onchain!==local||rs!==sAcct.address||rr!==rAcct.address) throw new Anomaly('intent digest/signature mismatch');
  const nb=await pub.getBlock();
  const age=nb.timestamp-qb.timestamp; log.checks.quote.ageAtSendSec=age; save();
  if(age<=60n) break;
  say(`quote age ${age}s > 60s; re-quoting`); intent=null;
 }
 if(!intent) throw new Anomaly('could not get a fresh quote within window');
 const usdtBefore=await bal(A.USDT,A.guard);
 const {r:er}=await send(4,'Guard.execute(SELL 1 WHSK->USDT)',A.guard,encodeFunctionData({abi:gAbi,functionName:'execute',args:[intent,s1,s2]}));
 let actualOut=null; for(const lg of er.logs){ if(lg.address.toLowerCase()!==A.guard.toLowerCase()) continue; try{const d=decodeEventLog({abi:gAbi,data:lg.data,topics:lg.topics}); if(d.eventName==='TradeExecuted') actualOut=d.args.actualOutRaw;}catch{} }
 const execBlk=await pub.getBlock({blockNumber:BigInt(er.blockNumber)});
 log.checks.afterExecute={actualOutRaw:actualOut,minOut:intent.amountOutMinimumRaw,ref:intent.referenceAmountOutRaw,secondsQuoteToInclusion:execBlk.timestamp-qb.timestamp,
  guardWHSK:await bal(A.WHSK,A.guard),guardUSDT:await bal(A.USDT,A.guard),allocatedQuoteRaw:await gread('allocatedQuoteRaw'),allocatedRiskRaw:await gread('allocatedRiskRaw'),intentNonce:await gread('intentNonce'),
  allowanceWHSK_GuardRouter:await pub.readContract({address:A.WHSK,abi:erc,functionName:'allowance',args:[A.guard,A.router]}),
  allowanceUSDT_GuardRouter:await pub.readContract({address:A.USDT,abi:erc,functionName:'allowance',args:[A.guard,A.router]})}; save();
 const ae=log.checks.afterExecute;
 // 5 verify (read-only)
 if(actualOut===null||actualOut<intent.amountOutMinimumRaw||ae.guardWHSK!==0n||ae.guardUSDT-usdtBefore!==actualOut||ae.allowanceWHSK_GuardRouter!==0n||ae.allowanceUSDT_GuardRouter!==0n||ae.secondsQuoteToInclusion>120n)
  throw new Anomaly('post-execute verification mismatch');
 log.checks.verifyStep='PASS (read-only; no tx)'; save();
 // 6 withdrawAll
 await send(6,'Guard.withdrawAll()',A.guard,encodeFunctionData({abi:gAbi,functionName:'withdrawAll'}));
 withdrawn=true; fundsInGuard=false;
 log.checks.final={status:await gread('status'),policyVersion:await gread('policyVersion'),guardWHSK:await bal(A.WHSK,A.guard),guardUSDT:await bal(A.USDT,A.guard),guardHSK:await pub.getBalance({address:A.guard}),
  TEST_HSK:await pub.getBalance({address:A.test}),TEST_WHSK:await bal(A.WHSK,A.test),TEST_USDT:await bal(A.USDT,A.test)};
 const f=log.checks.final;
 if(f.status!==0||f.guardWHSK!==0n||f.guardUSDT!==0n) throw new Anomaly('final state mismatch');
 log.result='SUCCESS';
}

try{ await main(); }
catch(e){
 log.anomaly=String(e.message||e); log.stoppedAt=new Date().toISOString(); log.result='STOPPED_ON_ANOMALY'; save(); say('ANOMALY:',log.anomaly);
 if(fundsInGuard && !withdrawn){
  const wb=await bal(A.WHSK,A.guard).catch(()=>null), ub=await bal(A.USDT,A.guard).catch(()=>null);
  log.recovery={guardWHSKbefore:wb,guardUSDTbefore:ub};
  if(wb!==0n||ub!==0n){
   for(let i=0;i<3&&!withdrawn;i++){
    try{ await send(6,'Guard.withdrawAll() [anomaly recovery]',A.guard,encodeFunctionData({abi:gAbi,functionName:'withdrawAll'}),0n,{reserveWithdraw:false}); withdrawn=true; }
    catch(e2){ log.recovery['attempt'+i]=String(e2.message); save(); const p=await pub.getTransactionCount({address:A.test,blockTag:'pending'}).catch(()=>null); if(p!==null) nonce=p; await sleep(3000); }
   }
   log.recovery.withdrawn=withdrawn; log.recovery.after={status:await gread('status').catch(()=>null),guardWHSK:await bal(A.WHSK,A.guard).catch(()=>null),guardUSDT:await bal(A.USDT,A.guard).catch(()=>null)};
  } else log.recovery.note='Guard empty; no withdrawAll needed';
 }
 save(); process.exitCode=2;
}
log.finishedAt=new Date().toISOString(); log.cumulativeFeeWei=spentWei; log.cumulativeFeeHSK=formatEther(spentWei); save();
say('RESULT',log.result,'cumFee',formatEther(spentWei));
