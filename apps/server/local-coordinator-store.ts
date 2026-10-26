import { hashTypedData } from 'viem';
import type { CoordinatorStore, Reservation, UnsignedLocalIntent } from '../worker/src/coordinator.js';
import type { IntentState } from '../worker/src/recovery.js';
import { PgJobStore, JobStoreError, type JobLease } from './job-store.js';

/** Trusted LOCAL/FORK coordinator adapter; not a browser API or a live execution capability.
 * Persist unsigned intent data only. No signatures, private keys or broadcaster are stored here.
 */
export class PgLocalCoordinatorStore implements CoordinatorStore {
  constructor(private readonly jobs: PgJobStore, private readonly config: {
    chainId: string; account: string; worker: string; leaseMs?: number;
  }) {
    if(config.chainId!=='31337' || !/^0x[0-9a-fA-F]{40}$/.test(config.account) || !config.worker) throw new JobStoreError('INVALID_LOCAL_STORE_CONFIG');
  }
  async reserve(intent: UnsignedLocalIntent): Promise<Reservation|null> {
    const td=intent.typedData as {domain?:Record<string,unknown>;message?:Record<string,unknown>};
    const message=td.message, domain=td.domain;
    if(!message || !domain || String(domain.chainId)!==this.config.chainId || String(domain.verifyingContract).toLowerCase()!==this.config.account.toLowerCase()
      || String(message.intentNonce)!==intent.nonce || String(message.policyVersion)!==intent.policyVersion || String(message.deadline)!==String(intent.deadline)) throw new JobStoreError('INTENT_BINDING_MISMATCH');
    const intentHash=hashTypedData(intent.typedData as unknown as Parameters<typeof hashTypedData>[0]);
    const payload=JSON.parse(JSON.stringify(intent,(_,v)=>typeof v==='bigint'?v.toString():v)) as Record<string,unknown>;
    try {
      const job=await this.jobs.reserve({chainId:this.config.chainId,account:this.config.account,sessionId:String(message.sessionId),nonce:intent.nonce,intentHash,payload});
      if(job.status!=='PREPARED') return null;
      const lease=await this.jobs.claimPrepared(job.id,this.config.worker,this.config.leaseMs);
      return lease ? {intentId:intent.id,token:JSON.stringify(lease)} : null;
    } catch(error) {
      if(error instanceof JobStoreError && ['ACCOUNT_PENDING','ACCOUNT_QUARANTINED','INTENT_CONFLICT'].includes(error.code)) return null;
      throw error;
    }
  }
  private async lease(reservation: Reservation): Promise<JobLease> {
    let token: JobLease;
    try { token=JSON.parse(reservation.token) as JobLease; } catch { throw new JobStoreError('INVALID_RESERVATION'); }
    if(!token || token.worker!==this.config.worker || typeof token.jobId!=='string' || !/^[0-9]+$/.test(token.fence)) throw new JobStoreError('INVALID_RESERVATION');
    const job=await this.jobs.get(token.jobId);
    if(!job || job.payload.id!==reservation.intentId || job.chain_id!==this.config.chainId || job.account!==this.config.account.toLowerCase()) throw new JobStoreError('RESERVATION_MISMATCH');
    return token;
  }
  async assertFence(reservation: Reservation): Promise<void> { await this.jobs.assertLease(await this.lease(reservation)); }
  /** Explicitly separate recovery claims from reserve: a recovery token never makes the job PREPARED. */
  async claimForReconciliation(jobId: string): Promise<Reservation|null> {
    const job=await this.jobs.get(jobId);
    if(!job || job.chain_id!==this.config.chainId || job.account!==this.config.account.toLowerCase() || typeof job.payload.id!=='string') return null;
    const lease=await this.jobs.claimReconciliation(jobId,this.config.worker,this.config.leaseMs);
    return lease ? {intentId:job.payload.id,token:JSON.stringify(lease)} : null;
  }
  async transition(reservation:Reservation,state:IntentState,details:Record<string,unknown>):Promise<void> {
    const lease=await this.lease(reservation);
    switch(state) {
      case 'SIGNING': return this.jobs.beginSigning(lease);
      case 'SIGNED': return this.jobs.markSigned(lease);
      case 'UNKNOWN':
        if(details.reason==='WRITE_AHEAD_SEND_QUARANTINE') return this.jobs.beginSubmission(lease);
        return this.jobs.recordReconciliationWait(lease);
      case 'SUBMITTED': {
        if(typeof details.txHash!=='string' || typeof details.sender!=='string' || typeof details.txNonce!=='string') throw new JobStoreError('TRANSACTION_METADATA_REQUIRED');
        return this.jobs.recordSubmission(lease,{txHash:details.txHash,sender:details.sender,txNonce:details.txNonce});
      }
      case 'MINED': case 'CONFIRMED': case 'REJECTED': {
        if(!details.receipt) {
          if(state==='REJECTED') return this.jobs.rejectPrepared(lease,String(details.reason??'PRE_SIGN_REJECTED'));
          throw new JobStoreError('RECEIPT_METADATA_REQUIRED');
        }
        const r=details.receipt as Record<string,unknown>;
        if(typeof r.txHash!=='string' || typeof r.blockHash!=='string' || typeof r.blockNumber!=='string' || typeof r.sender!=='string' || typeof r.txNonce!=='string' || typeof r.success!=='boolean') throw new JobStoreError('RECEIPT_METADATA_REQUIRED');
        if((state==='CONFIRMED' && !r.success) || (state==='REJECTED' && r.success)) throw new JobStoreError('RECEIPT_STATE_MISMATCH');
        const job=await this.jobs.get(lease.jobId);
        if(job?.status==='UNKNOWN') await this.jobs.recordSubmission(lease,{txHash:r.txHash,sender:r.sender,txNonce:r.txNonce});
        await this.jobs.assertTransactionIdentity(lease,{txHash:r.txHash,sender:r.sender,txNonce:r.txNonce});
        await this.jobs.recordReceipt(lease,{txHash:r.txHash,blockNumber:r.blockNumber,blockHash:r.blockHash,success:r.success});
        if(state==='CONFIRMED' || state==='REJECTED') {
          if((state==='CONFIRMED')!==r.success) throw new JobStoreError('RECEIPT_STATE_MISMATCH');
          await this.jobs.confirm(lease,r.blockHash);
        }
        return;
      }
      case 'REORGED':
        if(typeof details.orphanedBlockHash!=='string') throw new JobStoreError('ORPHANED_BLOCK_REQUIRED');
        return this.jobs.markReorg(lease.jobId,details.orphanedBlockHash,lease);
      default: throw new JobStoreError('UNSUPPORTED_RECOVERY_TRANSITION');
    }
  }
}
