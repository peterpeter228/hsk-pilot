import {describe,it,expect} from 'vitest';
import {buildCandidate,assessRisk,type Snapshot} from '../../packages/strategy/src/index.js';
import {defaultPolicy as p,defaultStrategy as t} from '../../apps/worker/src/simulation.js';
import {CanonicalLedger} from '../../apps/worker/src/indexer.js';
const s:Snapshot={hash:'audit-s',policyHash:'audit-p',now:1000,observedAt:1000,quoteBalanceRaw:'20000000',riskBalanceRaw:'0',indicativeRiskValueQuoteRaw:'0',sessionGrossBuyRaw:'0',dayGrossBuyRaw:'0',lastTradeAt:0,lastExitAt:0};
const quote=async(d:'BUY'|'SELL',a:bigint)=>d==='BUY'?a*10n**12n:a/10n**12n;
describe('independent safety audit: expected invariants',()=>{
 it('risk approval must not authorize caller-weakened reference/minimum',async()=>{
  const c=(await buildCandidate(s,p,t,quote))!;
  const result=await assessRisk({...c,referenceAmountOutRaw:'2'},s,p,t,quote);
  // Either reject tampering or independently derive the full-size fresh minimum.
  expect(!result.allowed||BigInt(result.minOutRaw!)>=BigInt(c.referenceAmountOutRaw)*9970n/10000n).toBe(true);
 });
 it('normal downsize must still satisfy owner minimum trade size',async()=>{
  const c=(await buildCandidate(s,p,t,quote))!;
  const result=await assessRisk({...c,amountInRaw:'1',referenceAmountOutRaw:'1000000000000'},s,p,t,quote);
  expect(result.allowed).toBe(false);
 });
 it('expired active session can use still-valid preauthorized exit window',async()=>{
  const c=await buildCandidate({...s,riskBalanceRaw:'1000000000000000000'}, {...p,validUntil:999,exitValidUntil:1100},t,quote,true);
  expect(c?.kind).toBe('DETERMINISTIC_EXIT');
 });
 it('same-block receipts are ordered canonically, not by fetch arrival',()=>{
  const l=new CanonicalLedger();
  const common={chainId:177,confirmations:3,blockNumber:1,blockHash:'b1',status:'SUCCESS' as const,gasNativeRaw:'1',gasComplete:true};
  // Both receipts are confirmed; transactionIndex supplies factual canonical order.
  const sell={...common,transactionIndex:1,txHash:'sell',fills:[{logIndex:1,direction:'SELL' as const,riskRaw:'3',quoteRaw:'12'}]};
  const buy={...common,transactionIndex:0,txHash:'buy',fills:[{logIndex:0,direction:'BUY' as const,riskRaw:'3',quoteRaw:'10'}]};
  l.ingest(sell);l.ingest(buy);
  expect(l.state('0').realizedTradingPnl).toBe('2');
 });
});

import {reconcile} from '../../apps/worker/src/recovery.js';
it('unconfirmed reverted receipt must remain pending until confirmation threshold',()=>{
 const intent={id:'i',nonce:'0',policyVersion:'1',deadline:2000,state:'SUBMITTED' as const,txHash:'tx',blockHash:null,replacementHash:null};
 const result=reconcile(intent,{now:1000,nonce:'0',policyVersion:'1',receipt:{success:false,blockHash:'b',confirmations:1},canonicalBlockHash:'b'},3);
 expect(result.intent.state).toBe('MINED');
});
it('chain-reported EXPIRED status is supported for authorized exits',async()=>{
 const c=await buildCandidate({...s,riskBalanceRaw:'1000000000000000000'}, {...p,status:'EXPIRED',validUntil:999,exitValidUntil:1100},t,quote,true);
 expect(c?.kind).toBe('DETERMINISTIC_EXIT');
});

it('pending receipt does not enter confirmed inventory or costs until threshold',()=>{
 const l=new CanonicalLedger(3);
 const receipt={chainId:177,txHash:'pending',blockNumber:1,transactionIndex:0,confirmations:2,blockHash:'b',status:'SUCCESS' as const,gasNativeRaw:'4',gasComplete:true,fills:[{logIndex:0,direction:'BUY' as const,riskRaw:'3',quoteRaw:'10'}]};
 l.ingest(receipt);
 expect(l.state('0').riskRaw).toBe('0');
 expect(l.state('0').knownGasNativeRaw).toBe('0');
 l.ingest({...receipt,confirmations:3});
 expect(l.state('10').riskRaw).toBe('3');
 expect(l.state('10').knownGasNativeRaw).toBe('4');
});
