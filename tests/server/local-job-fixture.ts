import type { CoordinatorDependencies, CoordinatorStore, CoordinatorContext } from '../../apps/worker/src/coordinator.js';
import { TRADE_INTENT_SCHEMA } from '../../packages/shared/src/index.js';
import { defaultPolicy, defaultStrategy } from '../../apps/worker/src/simulation.js';
export const testHash=(n:number)=>`0x${n.toString(16).padStart(64,'0')}`;
export const testAddress=(n:number)=>`0x${n.toString(16).padStart(40,'0')}`;
export function localJobFixture(store:CoordinatorStore,account:string) {
 const calls:string[]=[];
 const context:CoordinatorContext={executionChainId:31337,sourceChainId:177,snapshot:{executionCostEstimate:{quoteRaw:'0',observedAt:1000,source:'SYNTHETIC'},hash:'s',policyHash:'p',now:1000,observedAt:1000,quoteBalanceRaw:'20000000',riskBalanceRaw:'0',indicativeRiskValueQuoteRaw:'0',sessionGrossBuyRaw:'0',dayGrossBuyRaw:'0',lastTradeAt:0,lastExitAt:0},policy:{...defaultPolicy},strategy:{...defaultStrategy},canonicalBlockHash:testHash(11),generation:1,intentNonce:'0',blockNumber:'1',sessionId:'1',guardAddress:account,strategyPolicyHash:testHash(12)};
 const deps:CoordinatorDependencies={store,readContext:async()=>structuredClone(context),quote:async(d,a)=>d==='BUY'?a*10n**12n:a/10n**12n,
 model:{provider:'mock',model:'mock',select:async({snapshot,candidate})=>({action:'REBALANCE',candidateId:candidate!.id,sizeFractionBps:10000,reasonCode:'REBALANCE_TARGET',reasonSummary:'LOCAL TEST ONLY',inputSnapshotHash:snapshot.hash,strategyPolicyHash:snapshot.policyHash})},
 execution:{mode:'SIMULATION',chainId:31337,sign:async(role,intent)=>{calls.push(`sign:${role}`);return {role,signerId:role,signature:'fake',intentId:intent.id};},verifySignature:async()=>true,simulateSignedCall:async()=>({success:true}),broadcastLocal:async()=>{calls.push('send');return {txHash:testHash(Number(BigInt(account))),sender:testAddress(999),txNonce:'42'};}},
 buildIntent:async(c,ctx,minOut)=>({id:`local-${account}`,nonce:ctx.intentNonce,policyVersion:ctx.policy.version,deadline:1020,typedData:{domain:{name:TRADE_INTENT_SCHEMA.domainName,version:TRADE_INTENT_SCHEMA.domainVersion,chainId:31337,verifyingContract:account},types:TRADE_INTENT_SCHEMA.types,primaryType:'TradeIntent',message:{sessionId:ctx.sessionId,policyVersion:ctx.policy.version,strategyPolicyHash:ctx.strategyPolicyHash,intentNonce:ctx.intentNonce,direction:c.direction==='BUY'?0:1,amountInRaw:c.amountInRaw,referenceAmountOutRaw:c.referenceAmountOutRaw,amountOutMinimumRaw:minOut,quoteObservedAt:1000,quoteBlockNumber:'1',quoteBlockHash:ctx.canonicalBlockHash,deadline:1020,evidenceHash:testHash(13)}}})};
 return {deps,calls,context};
}
