import { parseRaw } from '../../../packages/shared/src/index.js';
export class WacLedger {
 risk=0n; cost:bigint|null=0n; realized:bigint|null=0n; private seen=new Set<string>();
 constructor(openingRisk='0',openingCost:string|null='0'){this.risk=parseRaw(openingRisk);this.cost=openingCost===null?null:parseRaw(openingCost);this.realized=this.cost===null?null:0n;}
 fill(id:string,direction:'BUY'|'SELL',riskRaw:string,quoteRaw:string){if(this.seen.has(id))return false;const risk=parseRaw(riskRaw),quote=parseRaw(quoteRaw);if(risk===0n)throw Error('ZERO_FILL');if(direction==='SELL'&&risk>this.risk)throw Error('INSUFFICIENT_INVENTORY');
 if(direction==='BUY'){this.risk+=risk;if(this.cost!==null)this.cost+=quote;}else{if(this.cost!==null){const released=risk===this.risk?this.cost:this.cost*risk/this.risk;this.cost-=released;this.realized=this.realized!+quote-released;}this.risk-=risk;}this.seen.add(id);return true;}
 state(liquidationQuoteRaw:string|null){return {accountingVersion:'ACCOUNTING_V1_WAC',riskRaw:this.risk.toString(),costBasisQuoteRaw:this.cost?.toString()??null,realizedTradingPnl:this.realized?.toString()??null,unrealizedTradingPnl:this.cost===null||liquidationQuoteRaw===null?null:(parseRaw(liquidationQuoteRaw)-this.cost).toString()};}
}
export interface Cost { kind:'EXECUTION'|'MODEL'|'SETUP'; nativeUnit:'HSK'|'USD'|'USDT'; nativeRaw:string|null; quoteRaw:string|null; complete:boolean; transactionStatus?:'SUCCESS'|'FAILED' }
export function valueSession(openingEquityRaw:string|null,closingQuoteRaw:string,closingRiskLiquidationRaw:string|null,costs:Cost[]){const trading=openingEquityRaw===null||closingRiskLiquidationRaw===null?null:parseRaw(closingQuoteRaw)+parseRaw(closingRiskLiquidationRaw)-parseRaw(openingEquityRaw);const operating=costs.filter(c=>c.kind!=='SETUP');const known=operating.every(c=>c.complete&&c.quoteRaw!==null);return {tradingPnl:trading?.toString()??null,estimatedNetPnl:trading!==null&&known?(trading-operating.reduce((n,c)=>n+parseRaw(c.quoteRaw!),0n)).toString():null,quality:known&&trading!==null?'complete':'partial',costs};}
// Session capital movements are not trades. Freeze valuation BEFORE withdrawal; never add withdrawal twice.
export function aggregateCapitalAdjustedPnl(endingRaw:string,depositsRaw:string,withdrawalsRaw:string){return (parseRaw(endingRaw)+parseRaw(withdrawalsRaw)-parseRaw(depositsRaw)).toString();}
