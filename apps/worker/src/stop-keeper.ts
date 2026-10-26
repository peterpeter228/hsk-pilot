import {parseRaw} from '../../../packages/shared/src/index.js';
export interface DrawdownState {sessionId:string;highWaterEquityQuoteRaw:string|null}
/** Both balances refer only to this session's allocated assets; exclude unsolicited surplus/capital flows. Units are USDT raw, not USD. */
export interface WholePositionObservation {sessionId:string;quoteBalanceRaw:string;riskLiquidationQuoteRaw:string|null;valuationMethod:'WHOLE_POSITION_EXECUTABLE_QUOTE';observedAt:number;now:number;maxAgeSec:number}
export interface DrawdownResult {state:DrawdownState;action:'HOLD'|'ENTER_REDUCE_ONLY';reason:string;observedDrawdownBps:number|null;equityQuoteRaw:string|null}
export function observeDrawdown(state:DrawdownState,observation:WholePositionObservation,stopDrawdownBps:number):DrawdownResult{
 if(!Number.isSafeInteger(stopDrawdownBps)||stopDrawdownBps<1||stopDrawdownBps>10000)throw Error('DRAWDOWN_THRESHOLD_INVALID');
 const hold=(reason:string):DrawdownResult=>({state:{...state},action:'HOLD',reason,observedDrawdownBps:null,equityQuoteRaw:null});
 if(state.sessionId!==observation.sessionId)throw Error('SESSION_MISMATCH');
 if(observation.valuationMethod!=='WHOLE_POSITION_EXECUTABLE_QUOTE')return hold('WHOLE_POSITION_QUOTE_REQUIRED');
 if(observation.riskLiquidationQuoteRaw===null)return hold('VALUATION_UNAVAILABLE');
 if(!Number.isSafeInteger(observation.observedAt)||!Number.isSafeInteger(observation.now)||!Number.isSafeInteger(observation.maxAgeSec)||observation.maxAgeSec<1||observation.maxAgeSec>120||observation.now<0||observation.observedAt<0||observation.observedAt>observation.now||observation.now-observation.observedAt>observation.maxAgeSec)return hold('VALUATION_STALE');
 const equity=parseRaw(observation.quoteBalanceRaw)+parseRaw(observation.riskLiquidationQuoteRaw);const prior=state.highWaterEquityQuoteRaw===null?equity:parseRaw(state.highWaterEquityQuoteRaw);const high=equity>prior?equity:prior;
 const drawdown=high===0n?0n:(high-equity)*10000n/high;const triggered=high>0n&&(high-equity)*10000n>=high*BigInt(stopDrawdownBps);
 return {state:{sessionId:state.sessionId,highWaterEquityQuoteRaw:high.toString()},action:triggered?'ENTER_REDUCE_ONLY':'HOLD',reason:triggered?'OBSERVED_DRAWDOWN_THRESHOLD':'BELOW_DRAWDOWN_THRESHOLD',observedDrawdownBps:Number(drawdown),equityQuoteRaw:equity.toString()};
}
export interface LocalStopKeeperDependencies {
 mode:'SIMULATION'|'FORK';executionChainId:31337;
 persistObservation(result:DrawdownResult):Promise<void>;
 readConfirmedStatus():Promise<'ACTIVE'|'REDUCE_ONLY'|'PAUSED'|'CLOSED'>;
 requestLocalReduceOnly():Promise<void>;
 persistReduceOnlyConfirmation():Promise<void>;
 executeDeterministicLocalExit():Promise<{status:string}>;
}
/** Local-only orchestration; confirmation is durably recorded before the independently constrained exit callback. */
export async function runLocalStopKeeper(state:DrawdownState,observation:WholePositionObservation,stopDrawdownBps:number,deps:LocalStopKeeperDependencies){
 if(!['SIMULATION','FORK'].includes(deps.mode)||deps.executionChainId!==31337)throw Error('LIVE_KEEPER_DISABLED');
 const decision=observeDrawdown(state,observation,stopDrawdownBps);await deps.persistObservation(decision);
 const initial=await deps.readConfirmedStatus();if(initial==='PAUSED'||initial==='CLOSED')return {decision,status:'HOLD',reason:'OWNER_CONTROL',exit:null};
 if(initial!=='REDUCE_ONLY'&&decision.action!=='ENTER_REDUCE_ONLY')return {decision,status:'HOLD',reason:decision.reason,exit:null};
 if(initial!=='REDUCE_ONLY'){await deps.requestLocalReduceOnly();if(await deps.readConfirmedStatus()!=='REDUCE_ONLY')return {decision,status:'BLOCKED',reason:'REDUCE_ONLY_NOT_CONFIRMED',exit:null};}
 await deps.persistReduceOnlyConfirmation();
 // Owner pause/close may race confirmation storage: never ask the exit path to ignore it.
 if(await deps.readConfirmedStatus()!=='REDUCE_ONLY')return {decision,status:'BLOCKED',reason:'OWNER_STATE_CHANGED',exit:null};
 try{return {decision,status:'EXIT_ATTEMPTED',reason:'REDUCE_ONLY_CONFIRMED_FIRST',exit:await deps.executeDeterministicLocalExit()};}catch{return {decision,status:'HOLD_EXIT_FAILED',reason:'REDUCE_ONLY_REMAINS_CONFIRMED',exit:null};}
}
