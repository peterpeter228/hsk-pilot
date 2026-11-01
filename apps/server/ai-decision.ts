import {chooseWithModel,type Candidate,type ModelAdapter,type ModelChoice,type Snapshot} from '../../packages/strategy/src/index.js';

export interface Decision {
 dataMode:'SIMULATION';advisoryOnly:true;liveFundsEnabled:false;source:'ai'|'fallback';fallbackReason:null|'MODEL_NOT_CONFIGURED'|'RATE_LIMITED'|'MODEL_INVALID_OR_UNAVAILABLE';
 provider:string;model:string|null;action:'HOLD'|'BUY'|'SELL';modelAction:'HOLD'|'REBALANCE';candidateId:string|null;direction:'BUY'|'SELL'|null;sizeFractionBps:number;
 suggestedAmountInRaw:string;guardMaxAmountInRaw:string;reasonCode:string;explanation:string;snapshotHash:string;decidedAt:string;latencyMs:number;cached:boolean;
}
export interface DecisionEngineConfig {adapter:ModelAdapter|null;provider:string;model:string|null;timeoutMs?:number;cacheMs?:number;perIpPerMinute?:number;globalPerMinute?:number;now?:()=>number}
export interface DecisionEngine {
 info():{status:'CONFIGURED'|'NOT_CONFIGURED';provider:string;model:string|null};
 decide(key:string,ip:string,input:{snapshot:Snapshot;candidate:Candidate|null}):Promise<Decision>;
}
export function createDecisionEngine(config:DecisionEngineConfig):DecisionEngine {
 const {adapter,provider,model}=config,now=config.now??Date.now,timeoutMs=config.timeoutMs??15000,cacheMs=config.cacheMs??30000,perIpPerMinute=config.perIpPerMinute??6,globalPerMinute=config.globalPerMinute??30;
 const cache=new Map<string,{expiresAt:number;decision:Decision}>(),ips=new Map<string,{window:number;count:number}>();let global={window:-1,count:0};
 return {
  info:()=>({status:adapter?'CONFIGURED':'NOT_CONFIGURED',provider,model}),
  async decide(key,ip,{snapshot,candidate}){
   const startedAt=now(),window=Math.floor(startedAt/60000),cacheKey=`${key}|${snapshot.hash}|${snapshot.policyHash}|${candidate?.id??'none'}`;
   for(const[k,v]of cache)if(v.expiresAt<=startedAt)cache.delete(k);
   for(const[k,v]of ips)if(v.window!==window)ips.delete(k);
   if(global.window!==window)global={window,count:0};
   const hit=cache.get(cacheKey);if(hit)return {...hit.decision,cached:true};
   let fallbackReason:Decision['fallbackReason']=null,choice:ModelChoice|null=null;
   if(!adapter)fallbackReason='MODEL_NOT_CONFIGURED';
   else {
    const bucket=ips.get(ip)??{window,count:0};
    if(bucket.count>=perIpPerMinute||global.count>=globalPerMinute)fallbackReason='RATE_LIMITED';
    else {bucket.count++;ips.set(ip,bucket);global.count++;const result=await chooseWithModel(adapter,snapshot,candidate,timeoutMs);if(result.status==='VALID')choice=result.choice;else fallbackReason='MODEL_INVALID_OR_UNAVAILABLE';}
   }
   if(!choice)choice={action:candidate?'REBALANCE':'HOLD',candidateId:candidate?.id??null,sizeFractionBps:candidate?10000:0,reasonCode:candidate?(candidate.kind==='DETERMINISTIC_EXIT'?'RISK_REDUCTION':'REBALANCE_TARGET'):'BAND_NOT_MET',reasonSummary:candidate?(candidate.kind==='DETERMINISTIC_EXIT'?'A bounded sell candidate reduces the simulated risk inventory.':'A legal rebalance candidate is available within the current simulation limits.'):'No legal rebalance candidate is available within the current simulation limits.',inputSnapshotHash:snapshot.hash,strategyPolicyHash:snapshot.policyHash};
   const decidedAt=now(),decision:Decision={dataMode:'SIMULATION',advisoryOnly:true,liveFundsEnabled:false,source:fallbackReason===null?'ai':'fallback',fallbackReason,provider,model,action:candidate&&choice.action==='REBALANCE'?candidate.direction:'HOLD',modelAction:choice.action,candidateId:choice.candidateId,direction:candidate?.direction??null,sizeFractionBps:choice.sizeFractionBps,suggestedAmountInRaw:candidate&&choice.action==='REBALANCE'?(BigInt(candidate.amountInRaw)*BigInt(choice.sizeFractionBps)/10000n).toString():'0',guardMaxAmountInRaw:candidate?.amountInRaw??'0',reasonCode:choice.reasonCode,explanation:choice.reasonSummary,snapshotHash:snapshot.hash,decidedAt:new Date(decidedAt).toISOString(),latencyMs:Math.max(0,decidedAt-startedAt),cached:false};
   cache.set(cacheKey,{expiresAt:decidedAt+cacheMs,decision});return {...decision};
  }
 };
}
