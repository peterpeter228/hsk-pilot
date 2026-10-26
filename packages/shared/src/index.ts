export type Raw = string;
export type DataMode = 'LIVE_MAINNET'|'MAINNET_READONLY'|'FORK'|'SIMULATION';
export type Quality = 'fresh'|'stale'|'pending'|'unavailable'|'reorged';
export interface ApiEnvelope<T> { dataMode: DataMode; chainId: number; buildSha: string; account: string|null; sessionId: string|null; policyVersion: string|null; observedAt: string; blockNumber: string|null; blockHash: string|null; source: 'rpc'|'receipt'|'indexer'|'quote'|'synthetic'; quality: Quality; data:T }
export interface SessionPolicy { version:string; mode:'BOUNDED_EXECUTION'|'ORACLE_GUARDED'; status:'ACTIVE'|'REDUCE_ONLY'|'PAUSED'|'EXPIRED'|'CLOSED'; maxBuyPerTradeQuoteRaw:Raw; maxSessionGrossBuyQuoteRaw:Raw; maxUtcDayGrossBuyQuoteRaw:Raw; maxRiskInventoryRaw:Raw; maxSellPerTradeRiskRaw:Raw; exitMaxPerTradeRiskRaw:Raw; minTradeIntervalSec:number; exitMinIntervalSec:number; maxQuoteSlippageBps:number; maxQuoteAgeSec:number; maxIntentTtlSec:number; validAfter:number; validUntil:number; exitValidUntil:number }
export interface StrategyPolicy { targetRiskWeightBps:number; rebalanceBandBps:number; stopDrawdownBps:number; minimumTradeQuoteRaw:Raw; maxExecutionCostQuoteRaw:Raw; riskEnabled:boolean }
export const UINT256_MAX=(1n<<256n)-1n;
export function parseRaw(value:unknown):bigint { if(typeof value!=='string'|| !/^(0|[1-9][0-9]*)$/.test(value)||value.length>78) throw Error('INVALID_RAW'); const n=BigInt(value); if(n>UINT256_MAX)throw Error('UINT256_OVERFLOW'); return n; }
export function parseUnitsStrict(text:string, decimals:number):Raw { if(!Number.isInteger(decimals)||decimals<0||decimals>36||!/^\d+(\.\d+)?$/.test(text))throw Error('INVALID_AMOUNT'); const [whole,fraction='']=text.split('.'); if(fraction.length>decimals)throw Error('EXCESS_PRECISION'); const raw=(BigInt(whole!)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0')).toString(); parseRaw(raw); return raw; }
export function parsePercentBps(text:string):number { const n=Number(parseUnitsStrict(text.replace(/%$/,''),2)); if(n>10000)throw Error('INVALID_BPS'); return n; }
export interface PolicyProposal { status:'READY'|'UNSUPPORTED'|'NEEDS_CLARIFICATION'; expectedPolicyVersion:string; chainPatch:Partial<SessionPolicy>; strategyPatch:Partial<StrategyPolicy>; warnings:string[]; sourceText:string; executionAuthorized:false }
export function parsePolicyProposal(message:string,current:{policy:SessionPolicy;strategy:StrategyPolicy},context:{expectedVersion:string;quoteDecimals:number}):PolicyProposal {
 const out:PolicyProposal={status:'NEEDS_CLARIFICATION',expectedPolicyVersion:context.expectedVersion,chainPatch:{},strategyPatch:{},warnings:[],sourceText:message,executionAuthorized:false};
 if(current.policy.version!==context.expectedVersion)throw Error('POLICY_VERSION_CHANGED');
 if(message.length>10000)throw Error('MESSAGE_TOO_LONG');
 if(/BTC|ETH|美元|USD(?!T)|套利|保证|profit|全部买|all.in|calldata|私钥/i.test(message)){out.status='UNSUPPORTED';out.warnings=['Only explicit WHSK/USDT policy drafts are supported; no execution.'];return out;}
 // Deliberately narrow grammar: ambiguous natural language must not widen authority.
 const commands=message.trim().split(/[;；\n]+/).map(x=>x.trim()).filter(Boolean);
 for(const command of commands){let m:RegExpMatchArray|null;
 if((m=command.match(/^(?:target|目标仓位)\s*(\d+(?:\.\d+)?)%$/i)))out.strategyPatch.targetRiskWeightBps=parsePercentBps(m[1]!);
 else if((m=command.match(/^(?:slippage|滑点)\s*(\d+(?:\.\d+)?)%$/i))){const b=parsePercentBps(m[1]!);if(b>500)throw Error('SLIPPAGE_LIMIT');out.chainPatch.maxQuoteSlippageBps=b;}
 else if((m=command.match(/^(?:buy limit|单笔买入)\s*(\d+(?:\.\d+)?)\s*USDT$/i)))out.chainPatch.maxBuyPerTradeQuoteRaw=parseUnitsStrict(m[1]!,context.quoteDecimals);
 else if((m=command.match(/^(?:cooldown|冷却)\s*(\d+)\s*(?:seconds|秒)$/i))){const n=Number(m[1]);if(n>86400)throw Error('INTERVAL_LIMIT');out.chainPatch.minTradeIntervalSec=n;}
 else if(/^(stop new risk|停止新增风险)$/i.test(command))out.strategyPatch.riskEnabled=false;
 else {out.chainPatch={};out.strategyPatch={};out.warnings=['Use explicit target %, slippage %, buy limit USDT, cooldown seconds, or stop new risk. Unparsed clauses block the entire draft.'];return out;}}
 if(commands.length){out.status='READY';out.warnings=['Draft only. Owner review and confirmed chain policy update are required.'];}return out;
}
export function validatePolicies(p:SessionPolicy,t:StrategyPolicy):void {
 for(const k of ['maxBuyPerTradeQuoteRaw','maxSessionGrossBuyQuoteRaw','maxUtcDayGrossBuyQuoteRaw','maxRiskInventoryRaw','maxSellPerTradeRiskRaw','exitMaxPerTradeRiskRaw'] as const)parseRaw(p[k]);
 parseRaw(p.version);parseRaw(t.minimumTradeQuoteRaw);parseRaw(t.maxExecutionCostQuoteRaw);
 const bounded=(n:number,lo:number,hi:number)=>{if(!Number.isSafeInteger(n)||n<lo||n>hi)throw Error('POLICY_RANGE');};
 bounded(p.maxQuoteSlippageBps,0,500);bounded(p.maxQuoteAgeSec,1,120);bounded(p.maxIntentTtlSec,1,120);bounded(p.minTradeIntervalSec,0,86400);bounded(p.exitMinIntervalSec,0,86400);bounded(p.validAfter,0,Number.MAX_SAFE_INTEGER);bounded(p.validUntil,p.validAfter,Number.MAX_SAFE_INTEGER);bounded(p.exitValidUntil,p.validUntil,Number.MAX_SAFE_INTEGER);bounded(t.targetRiskWeightBps,0,10000);bounded(t.rebalanceBandBps,1,10000);bounded(t.stopDrawdownBps,1,10000);
 if(!['ACTIVE','REDUCE_ONLY','PAUSED','EXPIRED','CLOSED'].includes(p.status)||!['BOUNDED_EXECUTION','ORACLE_GUARDED'].includes(p.mode)||typeof t.riskEnabled!=='boolean')throw Error('POLICY_ENUM');
}
export {TRADE_INTENT_SCHEMA,prepareTypedIntent,type TradeIntent} from './trade-intent.js';
