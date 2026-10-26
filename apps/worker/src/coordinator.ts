import {reconcile,type RecoveryIntent,type ChainObservation,type IntentState} from './recovery.js';
import {assessRisk,buildCandidate,chooseWithModel,type Snapshot,type Candidate,type Quote,type ModelAdapter} from '../../../packages/strategy/src/index.js';
import {TRADE_INTENT_SCHEMA,parseRaw,type SessionPolicy,type StrategyPolicy} from '../../../packages/shared/src/index.js';
export interface CoordinatorContext {sourceChainId:177;executionChainId:31337;snapshot:Snapshot;policy:SessionPolicy;strategy:StrategyPolicy;canonicalBlockHash:string;generation:number;intentNonce:string;blockNumber:string;sessionId:string;guardAddress:string;strategyPolicyHash:string}
export interface UnsignedLocalIntent {id:string;nonce:string;policyVersion:string;deadline:number;typedData:Readonly<Record<string,unknown>>}
export interface RoleSignature {role:'STRATEGY'|'RISK';signerId:string;signature:string;intentId:string}
export interface Reservation {intentId:string;token:string}
export interface CoordinatorStore {
 /** Atomic unique account/session/intent-nonce reservation; refuses any unresolved previous intent. */
 reserve(intent:UnsignedLocalIntent):Promise<Reservation|null>;
 assertFence(reservation:Reservation):Promise<void>;
 transition(reservation:Reservation,state:IntentState,details:Record<string,unknown>):Promise<void>;
}
export interface LocalExecutionAdapter {
 // No LIVE_MAINNET alternative: any future deployment needs a separately reviewed capability boundary.
 mode:'SIMULATION'|'FORK';
 chainId:31337;
 sign(role:'STRATEGY'|'RISK',intent:UnsignedLocalIntent):Promise<RoleSignature>;
 verifySignature(intent:UnsignedLocalIntent,signature:RoleSignature):Promise<boolean>;
 simulateSignedCall(intent:UnsignedLocalIntent,signatures:readonly RoleSignature[]):Promise<{success:boolean;reason?:string}>;
 broadcastLocal(intent:UnsignedLocalIntent,signatures:readonly RoleSignature[]):Promise<{txHash:string;sender:string;txNonce:string}>;
}
export interface CoordinatorDependencies {
 readContext():Promise<CoordinatorContext>;
 quote:Quote;
 model:ModelAdapter|null;
 store:CoordinatorStore;
 execution:LocalExecutionAdapter;
 buildIntent(candidate:Candidate,context:CoordinatorContext,minOutRaw:string):Promise<UnsignedLocalIntent>;
}
export interface CoordinatorResult {status:'HOLD'|'BLOCKED'|'REJECTED'|'UNKNOWN'|'SUBMITTED';reason:string;intentId:string|null;txHash:string|null}
const result=(status:CoordinatorResult['status'],reason:string,intentId:string|null=null,txHash:string|null=null):CoordinatorResult=>({status,reason,intentId,txHash});
/** Injected LOCAL/FORK capability coordinator. No environment keys, live client, live broadcast, retry or background funding. */
export class LocalCoordinator {
 private busy=false;
 constructor(private deps:CoordinatorDependencies){if(!['SIMULATION','FORK'].includes(deps.execution.mode)||deps.execution.chainId!==31337)throw Error('LIVE_EXECUTION_DISABLED');}
 async reconcileExisting(reservation:Reservation,intent:RecoveryIntent,observation:ChainObservation,confirmations=3){if(reservation.intentId!==intent.id)throw Error('RESERVATION_MISMATCH');const receipt=observation.receipt;if(receipt){if(typeof receipt.success!=='boolean'||!Number.isSafeInteger(receipt.confirmations)||receipt.confirmations<0||!/^0x[0-9a-fA-F]{64}$/.test(receipt.blockHash))throw Error('RECEIPT_METADATA_REQUIRED');if(!receipt.txHash||!/^0x[0-9a-fA-F]{64}$/.test(receipt.txHash)||!receipt.sender||!/^0x[0-9a-fA-F]{40}$/.test(receipt.sender)||receipt.txNonce===undefined||receipt.blockNumber===undefined)throw Error('RECEIPT_METADATA_REQUIRED');parseRaw(receipt.txNonce);parseRaw(receipt.blockNumber);if(receipt.txHash!==intent.txHash&&receipt.txHash!==intent.replacementHash)throw Error('RECEIPT_IDENTITY_MISMATCH');}const recovered=reconcile(intent,observation,confirmations);await this.deps.store.transition(reservation,recovered.intent.state,{txHash:recovered.intent.txHash,blockHash:recovered.intent.blockHash,action:recovered.action,receipt,orphanedBlockHash:intent.blockHash});return recovered;}
 async run(exit=false):Promise<CoordinatorResult>{
 if(this.busy)return result('BLOCKED','COORDINATOR_BUSY');this.busy=true;let reserved:Reservation|null=null;let intent:UnsignedLocalIntent|null=null;let ambiguous=false;let signingAttempted=false;
 try{
 const initial=await this.deps.readContext();if(initial.sourceChainId!==177||initial.executionChainId!==this.deps.execution.chainId)throw Error('LOCAL_CHAIN_CONTEXT_MISMATCH');let candidate=await buildCandidate(initial.snapshot,initial.policy,initial.strategy,this.deps.quote,exit);if(!candidate)return result('HOLD','NO_LEGAL_CANDIDATE');
 if(!exit){const choice=await chooseWithModel(this.deps.model,initial.snapshot,candidate);if(!choice.choice||choice.choice.action==='HOLD')return result(choice.status==='BLOCKED'?'BLOCKED':'HOLD',choice.reason??'MODEL_HOLD');const amount=BigInt(candidate.amountInRaw)*BigInt(choice.choice.sizeFractionBps)/10000n;if(amount===0n)return result('HOLD','SCALED_AMOUNT_ZERO');candidate={...candidate,amountInRaw:amount.toString(),referenceAmountOutRaw:(await this.deps.quote(candidate.direction,amount)).toString()};}
 const fresh=await this.deps.readContext();if(!sameAuthority(initial,fresh))return result('REJECTED','AUTHORITY_CHANGED');
 const risk=await assessRisk(candidate,fresh.snapshot,fresh.policy,fresh.strategy,this.deps.quote);if(!risk.allowed||!risk.minOutRaw)return result(risk.reason.startsWith('EXECUTION_COST_')?'HOLD':'REJECTED',risk.reason);
 intent=await this.deps.buildIntent(candidate,fresh,risk.minOutRaw);if(intent.policyVersion!==fresh.policy.version||intent.nonce!==fresh.intentNonce||intent.deadline<fresh.snapshot.now||intent.deadline>fresh.snapshot.observedAt+fresh.policy.maxIntentTtlSec)throw Error('INVALID_INTENT_BINDING');
 validateIntentPayload(intent,candidate,fresh,risk.minOutRaw);
 // Capture immutable bytes through structured cloning; signing adapters receive independent clones, never mutable shared references.
 const canonical=JSON.stringify(intent,(_,v)=>typeof v==='bigint'?v.toString():v);reserved=await this.deps.store.reserve(structuredClone(intent));if(!reserved)return result('BLOCKED','UNRESOLVED_INTENT_OR_LOCK',intent.id);
 signingAttempted=true;await this.deps.store.transition(reserved,'SIGNING',{intentId:intent.id,reason:'WRITE_AHEAD_SIGNING_QUARANTINE'});
 const signatures:RoleSignature[]=[];for(const role of ['STRATEGY','RISK'] as const){await this.deps.store.assertFence(reserved);const signature=await this.deps.execution.sign(role,structuredClone(intent));if(signature.role!==role||signature.intentId!==intent.id||!signature.signature||!signature.signerId||!await this.deps.execution.verifySignature(structuredClone(intent),structuredClone(signature)))throw Error('ROLE_SIGNATURE_INVALID');signatures.push(signature);} 
 if(signatures[0]!.signerId.toLowerCase()===signatures[1]!.signerId.toLowerCase())throw Error('SIGNER_ROLES_NOT_DISTINCT');
 if(JSON.stringify(intent,(_,v)=>typeof v==='bigint'?v.toString():v)!==canonical)throw Error('INTENT_MUTATED');
 await this.deps.store.transition(reserved,'SIGNED',{intentId:intent.id});
 const simulated=await this.deps.execution.simulateSignedCall(structuredClone(intent),structuredClone(signatures));if(!simulated.success)throw Error('FULL_SIGNED_CALL_REVERTED');
 const beforeSend=await this.deps.readContext();if(!sameAuthority(fresh,beforeSend)||beforeSend.snapshot.observedAt>beforeSend.snapshot.now||beforeSend.snapshot.now-fresh.snapshot.observedAt>fresh.policy.maxQuoteAgeSec||beforeSend.snapshot.now>intent.deadline)throw Error('PRE_BROADCAST_STATE_CHANGED');
 // Durable write-ahead quarantine precedes the only injected LOCAL/FORK send. A throw can mean accepted; never retry.
 await this.deps.store.transition(reserved,'UNKNOWN',{reason:'WRITE_AHEAD_SEND_QUARANTINE',txHash:null});ambiguous=true;
 await this.deps.store.assertFence(reserved);const sent=await this.deps.execution.broadcastLocal(structuredClone(intent),structuredClone(signatures));if(!/^0x[0-9a-fA-F]{64}$/.test(sent.txHash))return result('UNKNOWN','LOCAL_SEND_HASH_UNAVAILABLE_RECONCILE',intent.id);
 if(!/^0x[0-9a-fA-F]{40}$/.test(sent.sender))throw Error('LOCAL_SEND_SENDER_UNAVAILABLE');parseRaw(sent.txNonce);await this.deps.store.transition(reserved,'SUBMITTED',{txHash:sent.txHash,sender:sent.sender,txNonce:sent.txNonce});return result('SUBMITTED','LOCAL_EXECUTION_REQUIRES_RECEIPT_RECONCILIATION',intent.id,sent.txHash);
 }catch(error){const reason=error instanceof Error?error.message:'COORDINATOR_ERROR';if(ambiguous)return result('UNKNOWN','AMBIGUOUS_LOCAL_SEND_RECONCILE',intent?.id??null);if(reserved&&!signingAttempted){try{await this.deps.store.transition(reserved,'REJECTED',{reason});}catch{return result('BLOCKED','STORE_FAILURE_RECONCILE',intent?.id??null);}}return result(signingAttempted?'BLOCKED':'REJECTED',reason,intent?.id??null);}finally{this.busy=false;}
 }
}
function sameAuthority(a:CoordinatorContext,b:CoordinatorContext){return a.sourceChainId===b.sourceChainId&&a.executionChainId===b.executionChainId&&a.generation===b.generation&&a.policy.version===b.policy.version&&a.policy.status===b.policy.status&&a.snapshot.hash===b.snapshot.hash&&a.canonicalBlockHash===b.canonicalBlockHash&&a.intentNonce===b.intentNonce&&a.blockNumber===b.blockNumber&&a.sessionId===b.sessionId&&a.guardAddress===b.guardAddress&&a.strategyPolicyHash===b.strategyPolicyHash;}

function validateIntentPayload(intent:UnsignedLocalIntent,candidate:Candidate,ctx:CoordinatorContext,minOut:string){
 if(!/^0x[0-9a-fA-F]{40}$/.test(ctx.guardAddress)||/^0x0{40}$/.test(ctx.guardAddress))throw Error('GUARD_CONTEXT_INVALID');
 const td=intent.typedData as {domain?:Record<string,unknown>;types?:unknown;primaryType?:unknown;message?:Record<string,unknown>};const m=td.message,d=td.domain;
 if(!m||!d||d.name!==TRADE_INTENT_SCHEMA.domainName||d.version!==TRADE_INTENT_SCHEMA.domainVersion||ctx.executionChainId!==31337||d.chainId!==ctx.executionChainId||String(d.verifyingContract).toLowerCase()!==ctx.guardAddress.toLowerCase()||td.primaryType!==TRADE_INTENT_SCHEMA.primaryType||JSON.stringify(td.types)!==JSON.stringify(TRADE_INTENT_SCHEMA.types))throw Error('TYPED_DATA_DOMAIN_OR_SCHEMA_MISMATCH');
 const expected:Record<string,string>={sessionId:ctx.sessionId,policyVersion:ctx.policy.version,strategyPolicyHash:ctx.strategyPolicyHash,intentNonce:ctx.intentNonce,direction:candidate.direction==='BUY'?'0':'1',amountInRaw:candidate.amountInRaw,referenceAmountOutRaw:candidate.referenceAmountOutRaw,amountOutMinimumRaw:minOut,quoteObservedAt:String(ctx.snapshot.observedAt),quoteBlockHash:ctx.canonicalBlockHash,quoteBlockNumber:ctx.blockNumber,deadline:String(intent.deadline)};
 for(const [key,value]of Object.entries(expected))if(String(m[key])!==value)throw Error('TYPED_DATA_RISK_BINDING_MISMATCH');
 if(Object.keys(m).length!==TRADE_INTENT_SCHEMA.types.TradeIntent.length)throw Error('TYPED_DATA_FIELD_MISMATCH');
 for(const field of TRADE_INTENT_SCHEMA.types.TradeIntent){const value=m[field.name];if(field.type==='bytes32'){if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))throw Error('TYPED_DATA_BYTES32');}else {const n=parseRaw(String(value));if(n>=1n<<BigInt(field.type.slice(4)))throw Error('TYPED_DATA_UINT_OVERFLOW');}}
}
