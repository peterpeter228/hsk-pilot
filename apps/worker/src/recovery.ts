export type IntentState='PREPARED'|'SIGNING'|'SIGNED'|'SUBMITTED'|'UNKNOWN'|'MINED'|'CONFIRMED'|'REORGED'|'REJECTED'|'EXPIRED';
export interface RecoveryIntent {id:string;nonce:string;policyVersion:string;deadline:number;state:IntentState;txHash:string|null;blockHash:string|null;replacementHash:string|null}
export interface ChainObservation {now:number;nonce:string;policyVersion:string;receipt:null|{success:boolean;blockHash:string;confirmations:number;txHash?:string;blockNumber?:string;sender?:string;txNonce?:string};canonicalBlockHash:string|null}
export function reconcile(intent:RecoveryIntent,chain:ChainObservation,confirmations=3):{intent:RecoveryIntent;action:'WAIT'|'RECONCILE'|'NONE'}{
 const next={...intent};
 if(intent.state==='SIGNING'&&!chain.receipt)return {intent:next,action:'RECONCILE'};
 if(chain.receipt){if(chain.canonicalBlockHash!==chain.receipt.blockHash){next.state='REORGED';next.blockHash=null;return {intent:next,action:'RECONCILE'};}next.blockHash=chain.receipt.blockHash;next.state=chain.receipt.confirmations<confirmations?'MINED':chain.receipt.success?'CONFIRMED':'REJECTED';return {intent:next,action:'NONE'};}
 if(['SUBMITTED','UNKNOWN','MINED','CONFIRMED','REORGED'].includes(next.state)){next.state='UNKNOWN';return {intent:next,action:'RECONCILE'};}
 if(chain.now>intent.deadline){next.state='EXPIRED';return {intent:next,action:'NONE'};}
 // Local version mismatch does not revoke already issued signatures: retain until chain invalidation is observed.
 if(chain.policyVersion!==intent.policyVersion||BigInt(chain.nonce)>BigInt(intent.nonce)){next.state='REJECTED';return {intent:next,action:'NONE'};}
 return {intent:next,action:'WAIT'};
}
export function linkReplacement(intent:RecoveryIntent,replacementHash:string,nonce:string){if(nonce!==intent.nonce)throw Error('REPLACEMENT_NONCE_MISMATCH');return {...intent,replacementHash,state:'UNKNOWN' as const};}
