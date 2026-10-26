import {it,expect} from 'vitest';
import {LocalCoordinator,type CoordinatorDependencies,type CoordinatorContext} from '../../apps/worker/src/coordinator.js';
import {TRADE_INTENT_SCHEMA} from '../../packages/shared/src/index.js';
import {defaultPolicy,defaultStrategy} from '../../apps/worker/src/simulation.js';
function fixture(tamper=false){
 const context:CoordinatorContext={sourceChainId:177,executionChainId:31337,snapshot:{hash:'audit-s',policyHash:'audit-p',now:1000,observedAt:1000,executionCostEstimate:{quoteRaw:'0',observedAt:1000,source:'SYNTHETIC'},quoteBalanceRaw:'0',riskBalanceRaw:'1000000000000000000',indicativeRiskValueQuoteRaw:'1000000',sessionGrossBuyRaw:'0',dayGrossBuyRaw:'0',lastTradeAt:0,lastExitAt:0},policy:{...defaultPolicy,status:'REDUCE_ONLY'},strategy:{...defaultStrategy},canonicalBlockHash:`0x${'bb'.repeat(32)}`,generation:1,intentNonce:'0',blockNumber:'1',sessionId:'1',guardAddress:`0x${'11'.repeat(20)}`,strategyPolicyHash:`0x${'cc'.repeat(32)}`};
 const calls={signed:0,sent:0,fences:0};const states:string[]=[];let reserved=false;
 const deps:CoordinatorDependencies={readContext:async()=>structuredClone(context),quote:async(d,a)=>d==='BUY'?a*10n**12n:a/10n**12n,model:null,store:{reserve:async i=>{if(reserved)return null;reserved=true;return {intentId:i.id,token:'audit-reservation'};},assertFence:async()=>{calls.fences++;},transition:async(_,state)=>{states.push(state);}},execution:{mode:'SIMULATION',chainId:31337,verifySignature:async()=>true,sign:async(role,i)=>{calls.signed++;return {role,signerId:role,signature:'synthetic-signature',intentId:i.id};},simulateSignedCall:async()=>({success:true}),broadcastLocal:async()=>{calls.sent++;return {txHash:`0x${'ab'.repeat(32)}`,sender:`0x${'ee'.repeat(20)}`,txNonce:'5'};}},buildIntent:async(c,ctx,minOut)=>({id:'audit-intent',nonce:ctx.intentNonce,policyVersion:ctx.policy.version,deadline:1020,typedData:{domain:{name:TRADE_INTENT_SCHEMA.domainName,version:TRADE_INTENT_SCHEMA.domainVersion,chainId:31337,verifyingContract:ctx.guardAddress},types:TRADE_INTENT_SCHEMA.types,primaryType:'TradeIntent',message:{sessionId:ctx.sessionId,policyVersion:ctx.policy.version,strategyPolicyHash:ctx.strategyPolicyHash,intentNonce:ctx.intentNonce,direction:c.direction==='BUY'?0:1,amountInRaw:tamper?'1':c.amountInRaw,referenceAmountOutRaw:c.referenceAmountOutRaw,amountOutMinimumRaw:minOut,quoteObservedAt:ctx.snapshot.observedAt,quoteBlockNumber:ctx.blockNumber,quoteBlockHash:ctx.canonicalBlockHash,deadline:1020,evidenceHash:`0x${'dd'.repeat(32)}`}}})};
 return {deps,calls,states,context};
}
it('does not sign or submit an intent payload differing from the risk-approved candidate',async()=>{
 const {deps,calls}=fixture(true);const result=await new LocalCoordinator(deps).run(true);
 expect(result.status).toBe('REJECTED');expect(result.reason).toBe('TYPED_DATA_RISK_BINDING_MISMATCH');expect(calls.signed).toBe(0);expect(calls.sent).toBe(0);
});

it('partial signer failure preserves durable SIGNING and blocks fresh retry',async()=>{
 const f=fixture();f.deps.execution.sign=async(role,i)=>{f.calls.signed++;if(role==='RISK')throw Error('AMBIGUOUS_SIGNER');return {role,signerId:role,signature:'synthetic',intentId:i.id};};
 const c=new LocalCoordinator(f.deps);expect((await c.run(true)).status).toBe('BLOCKED');expect(f.states).toEqual(['SIGNING']);expect(f.calls.signed).toBe(2);expect(f.calls.sent).toBe(0);
 expect((await c.run(true)).status).toBe('BLOCKED');expect(f.calls.signed).toBe(2);
});
it('failed SIGNING write invokes zero signers and never promotes durable state',async()=>{
 const f=fixture();f.deps.store.transition=async(_,state)=>{f.states.push(state);throw Error('DB_UNAVAILABLE');};
 expect((await new LocalCoordinator(f.deps).run(true)).status).toBe('BLOCKED');expect(f.states).toEqual(['SIGNING']);expect(f.calls.signed).toBe(0);expect(f.calls.sent).toBe(0);
});
it('stale lease before second role prevents that signer and send',async()=>{
 const f=fixture();f.deps.store.assertFence=async()=>{if(++f.calls.fences===2)throw Error('STALE_LEASE');};
 expect((await new LocalCoordinator(f.deps).run(true)).status).toBe('BLOCKED');expect(f.calls.signed).toBe(1);expect(f.calls.sent).toBe(0);expect(f.states).toEqual(['SIGNING']);
});
it('stale send fence leaves UNKNOWN without submitting',async()=>{
 const f=fixture();f.deps.store.assertFence=async()=>{if(++f.calls.fences===3)throw Error('STALE_LEASE');};
 expect((await new LocalCoordinator(f.deps).run(true)).status).toBe('UNKNOWN');expect(f.calls.signed).toBe(2);expect(f.calls.sent).toBe(0);expect(f.states).toEqual(['SIGNING','SIGNED','UNKNOWN']);
});
it('ambiguous network send never retries signing or submission',async()=>{
 const f=fixture();f.deps.execution.broadcastLocal=async()=>{f.calls.sent++;throw Error('NETWORK_TIMEOUT');};const c=new LocalCoordinator(f.deps);
 expect((await c.run(true)).status).toBe('UNKNOWN');expect((await c.run(true)).status).toBe('BLOCKED');expect(f.calls.sent).toBe(1);expect(f.calls.signed).toBe(2);expect(f.states).toEqual(['SIGNING','SIGNED','UNKNOWN']);
});
it('invalid recovered role signature stops before second role and never sends',async()=>{
 const f=fixture();f.deps.execution.verifySignature=async()=>false;
 expect((await new LocalCoordinator(f.deps).run(true)).reason).toBe('ROLE_SIGNATURE_INVALID');expect(f.calls.signed).toBe(1);expect(f.calls.sent).toBe(0);expect(f.states).toEqual(['SIGNING']);
});
it('valid local flow persists signing and send barriers in order',async()=>{
 const f=fixture();expect((await new LocalCoordinator(f.deps).run(true)).status).toBe('SUBMITTED');expect(f.calls).toEqual({signed:2,sent:1,fences:3});expect(f.states).toEqual(['SIGNING','SIGNED','UNKNOWN','SUBMITTED']);
});

it('unhealthy normal execution cost prevents all signer and send calls',async()=>{
 for(const kind of ['missing','future','stale','overcap'] as const){
  const f=fixture();f.context.policy.status='ACTIVE';
  f.deps.model={provider:'mock',model:'mock',select:async({snapshot,candidate})=>({action:'REBALANCE',candidateId:candidate!.id,sizeFractionBps:10000,reasonCode:'REBALANCE_TARGET',reasonSummary:'Synthetic audit',inputSnapshotHash:snapshot.hash,strategyPolicyHash:snapshot.policyHash})};
  f.context.snapshot.executionCostEstimate=kind==='missing'?undefined:{quoteRaw:kind==='overcap'?'100001':'0',observedAt:kind==='future'?1001:kind==='stale'?969:1000,source:'SYNTHETIC'};
  const result=await new LocalCoordinator(f.deps).run(false);
  expect(result.status).toBe('HOLD');expect(result.reason).toMatch(/^EXECUTION_COST_/);expect(f.calls.signed).toBe(0);expect(f.calls.sent).toBe(0);expect(f.states).toEqual([]);
 }
});
