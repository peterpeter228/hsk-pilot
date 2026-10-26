import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export type JobStatus = 'PREPARED' | 'SIGNING' | 'SIGNED' | 'REJECTED' | 'UNKNOWN' | 'SUBMITTED' | 'MINED' | 'CONFIRMED' | 'FAILED' | 'REORGED';
export interface ReserveJob {
  chainId: string; account: string; sessionId: string; nonce: string;
  intentHash: string; payload: Record<string, unknown>;
}
export interface DurableJob {
  id: string; chain_id: string; account: string; session_id: string; nonce: string;
  intent_hash: string; payload: Record<string, unknown>; status: JobStatus;
  fence: string; lease_owner: string | null; lease_until: Date | null;
  reversal_required: boolean;
}
export interface JobLease { jobId: string; worker: string; fence: string }
export interface Submission { txHash: string; sender: string; txNonce: string }
export class JobStoreError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'JobStoreError'; }
}
const uint = (v: string) => { if (!/^(0|[1-9][0-9]*)$/.test(v)) throw new JobStoreError('INVALID_UINT'); return v; };
const hex = (v: string, n: number) => { if (!new RegExp(`^0x[0-9a-fA-F]{${n}}$`).test(v)) throw new JobStoreError('INVALID_HEX'); return v.toLowerCase(); };
const fail = (code: string): never => { throw new JobStoreError(code); };

/** Durable coordination only. No network broadcaster, receipt verifier, or P&L writer.
 * The caller MUST validate chain receipts/policy/nonce using trusted chain adapters.
 * All queries use a pool configured with a dedicated schema/search_path and server-only role.
 */
export class PgJobStore {
  constructor(private readonly pool: Pool) {}
  private async transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try { await c.query('BEGIN'); const value = await fn(c); await c.query('COMMIT'); return value; }
    catch (e) { await c.query('ROLLBACK'); throw e; }
    finally { c.release(); }
  }
  private async audit(c: PoolClient, id: string, event: string, detail: Record<string, unknown> = {}) {
    await c.query('INSERT INTO hsk_job_audit(job_id,event,detail) VALUES($1,$2,$3)', [id,event,detail]);
  }
  async get(id: string): Promise<DurableJob | null> {
    return (await this.pool.query<DurableJob>('SELECT * FROM hsk_jobs WHERE id=$1',[id])).rows[0] ?? null;
  }
  async pending(chainId: string, account: string): Promise<DurableJob[]> {
    return (await this.pool.query<DurableJob>(`SELECT * FROM hsk_jobs WHERE chain_id=$1 AND account=$2
      AND status IN ('PREPARED','SIGNING','SIGNED','UNKNOWN','SUBMITTED','MINED','REORGED') ORDER BY created_at`,[uint(chainId),hex(account,40)])).rows;
  }
  async reserve(input: ReserveJob): Promise<DurableJob> {
    const chain = uint(input.chainId); if (chain === '0') fail('INVALID_CHAIN');
    const account = hex(input.account,40), intent = hex(input.intentHash,64);
    uint(input.sessionId); uint(input.nonce);
    // JSON conversion deliberately rejects bigint rather than losing precision.
    const payload = JSON.stringify(input.payload);
    return this.transaction(async c => {
      await c.query('INSERT INTO hsk_job_accounts(chain_id,account) VALUES($1,$2) ON CONFLICT DO NOTHING',[chain,account]);
      const a = (await c.query('SELECT * FROM hsk_job_accounts WHERE chain_id=$1 AND account=$2 FOR UPDATE',[chain,account])).rows[0];
      const old = await c.query<DurableJob>(`SELECT *, payload=$5::jsonb AS same_payload FROM hsk_jobs
        WHERE chain_id=$1 AND account=$2 AND session_id=$3 AND nonce=$4`,[chain,account,input.sessionId,input.nonce,payload]);
      if (old.rows[0]) {
        const job = old.rows[0] as DurableJob & { same_payload: boolean };
        if (job.intent_hash !== intent || !job.same_payload) fail('INTENT_CONFLICT');
        delete (job as Partial<typeof job>).same_payload;
        return job;
      }
      if (a.quarantined) fail('ACCOUNT_QUARANTINED');
      if ((await c.query(`SELECT id FROM hsk_jobs WHERE chain_id=$1 AND account=$2 AND status IN ('PREPARED','SIGNING','SIGNED','UNKNOWN','SUBMITTED','MINED')`,[chain,account])).rowCount) fail('ACCOUNT_PENDING');
      const row = (await c.query<DurableJob>(`INSERT INTO hsk_jobs(id,chain_id,account,session_id,nonce,intent_hash,payload,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,'PREPARED') RETURNING *`,[randomUUID(),chain,account,input.sessionId,input.nonce,intent,payload])).rows[0];
      await this.audit(c,row.id,'RESERVED'); return row;
    });
  }
  /** Claim permits reconciliation of UNKNOWN, never rebroadcast. Fence is a decimal string. */
  async claim(id: string, worker: string, leaseMs = 30_000): Promise<JobLease | null> {
    return this.claimEligible(id,worker,leaseMs,false);
  }
  async claimPrepared(id: string, worker: string, leaseMs = 30_000): Promise<JobLease | null> {
    return this.claimEligible(id,worker,leaseMs,true);
  }
  async claimReconciliation(id: string, worker: string, leaseMs = 30_000): Promise<JobLease | null> {
    return this.claimEligible(id,worker,leaseMs,false,true);
  }
  private async claimEligible(id: string, worker: string, leaseMs: number, preparedOnly: boolean, includeTerminal=false): Promise<JobLease | null> {
    if (!worker || !Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 300_000) fail('INVALID_LEASE');
    return this.transaction(async c => {
      const result = await c.query<DurableJob>(`UPDATE hsk_jobs SET fence=fence+1,lease_owner=$2,
        lease_until=clock_timestamp()+($3::double precision * interval '1 millisecond'),updated_at=clock_timestamp()
        WHERE id=$1 AND (status IN ('PREPARED','SIGNING','SIGNED','UNKNOWN','SUBMITTED','MINED','REORGED') OR ($5::boolean AND status IN ('CONFIRMED','FAILED')))
        AND (NOT $4::boolean OR status='PREPARED')
        AND (lease_until IS NULL OR lease_until<=clock_timestamp()) RETURNING *`,[id,worker,leaseMs,preparedOnly,includeTerminal]);
      if (!result.rows[0]) return null;
      const lease = {jobId:id,worker,fence:result.rows[0].fence};
      await this.audit(c,id,'CLAIMED',{worker,fence:lease.fence}); return lease;
    });
  }
  private async locked(c: PoolClient, lease: JobLease): Promise<DurableJob> {
    // Acquire account lock first everywhere to serialize reorg vs new reservation.
    const lookup = (await c.query<DurableJob>('SELECT * FROM hsk_jobs WHERE id=$1',[lease.jobId])).rows[0];
    if (!lookup) fail('JOB_NOT_FOUND');
    await c.query('SELECT 1 FROM hsk_job_accounts WHERE chain_id=$1 AND account=$2 FOR UPDATE',[lookup.chain_id,lookup.account]);
    const row = (await c.query<DurableJob>(`SELECT * FROM hsk_jobs WHERE id=$1 AND fence=$2 AND lease_owner=$3
      AND lease_until>clock_timestamp() FOR UPDATE`,[lease.jobId,uint(lease.fence),lease.worker])).rows[0];
    if (!row) fail('STALE_LEASE'); return row;
  }
  /** Validates a live fence and account quarantine; no external side effects occur here. */
  async assertLease(lease: JobLease): Promise<void> {
    await this.transaction(async c => {
      const job=await this.locked(c,lease);
      const a=(await c.query('SELECT quarantined FROM hsk_job_accounts WHERE chain_id=$1 AND account=$2',[job.chain_id,job.account])).rows[0];
      if(a.quarantined) fail('ACCOUNT_QUARANTINED');
      if(!['PREPARED','SIGNING','SIGNED','UNKNOWN','SUBMITTED','MINED'].includes(job.status)) fail('INACTIVE_JOB');
    });
  }
  /** Write-ahead signing barrier: UNKNOWN signer outcome must never become PREPARED again. */
  async beginSigning(lease: JobLease): Promise<void> {
    await this.transaction(async c => {
      const job=await this.locked(c,lease);
      if(job.status!=='PREPARED') fail('NOT_PREPARED_NO_RESIGN');
      const a=(await c.query('SELECT quarantined FROM hsk_job_accounts WHERE chain_id=$1 AND account=$2',[job.chain_id,job.account])).rows[0];
      if(a.quarantined) fail('ACCOUNT_QUARANTINED');
      await c.query("UPDATE hsk_jobs SET status='SIGNING',updated_at=clock_timestamp() WHERE id=$1",[job.id]);
      await this.audit(c,job.id,'SIGNING_WRITE_AHEAD');
    });
  }
  async markSigned(lease: JobLease): Promise<void> {
    await this.transaction(async c => {
      const job=await this.locked(c,lease);
      if(job.status!=='SIGNING') fail('NOT_SIGNING');
      await c.query("UPDATE hsk_jobs SET status='SIGNED',updated_at=clock_timestamp() WHERE id=$1",[job.id]);
      await this.audit(c,job.id,'BOTH_ROLE_SIGNATURES_VERIFIED');
    });
  }
  async rejectPrepared(lease: JobLease, reason: string): Promise<void> {
    await this.transaction(async c => {
      const job=await this.locked(c,lease);
      if(job.status!=='PREPARED') fail('SIGNING_CANNOT_BE_RELEASED');
      await c.query("UPDATE hsk_jobs SET status='REJECTED',lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1",[job.id]);
      await this.audit(c,job.id,'PRE_SIGN_REJECTED',{reason});
    });
  }
  async recordReconciliationWait(lease: JobLease): Promise<void> {
    await this.transaction(async c => {
      const job=await this.locked(c,lease);
      await this.audit(c,job.id,'RECONCILIATION_WAIT',{status:job.status});
    });
  }
  /** Persist the uncertainty barrier BEFORE invoking any network submission. A crash now requires reconciliation. */
  async beginSubmission(lease: JobLease): Promise<void> {
    await this.transaction(async c => {
      const job = await this.locked(c,lease);
      if (job.status !== 'SIGNED') fail('NOT_SIGNED_NO_REBROADCAST');
      const a = (await c.query('SELECT quarantined FROM hsk_job_accounts WHERE chain_id=$1 AND account=$2',[job.chain_id,job.account])).rows[0];
      if (a.quarantined) fail('ACCOUNT_QUARANTINED');
      await c.query(`UPDATE hsk_jobs SET status='UNKNOWN',updated_at=clock_timestamp() WHERE id=$1`,[job.id]);
      await this.audit(c,job.id,'SUBMISSION_UNCERTAIN');
    });
  }
  async recordSubmission(lease: JobLease, submission: Submission): Promise<void> {
    await this.transaction(async c => {
      const job = await this.locked(c,lease);
      if (!['UNKNOWN','SUBMITTED'].includes(job.status)) fail('INVALID_SUBMISSION_STATE');
      const hash = hex(submission.txHash,64), sender = hex(submission.sender,40), nonce = uint(submission.txNonce);
      const existing = (await c.query('SELECT * FROM hsk_job_transactions WHERE chain_id=$1 AND tx_hash=$2',[job.chain_id,hash])).rows[0];
      if (existing) {
        if (existing.job_id !== job.id || existing.sender !== sender || existing.tx_nonce !== nonce) fail('TRANSACTION_CONFLICT');
        return;
      }
      if ((await c.query('SELECT 1 FROM hsk_job_transactions WHERE job_id=$1',[job.id])).rowCount) fail('REPLACEMENT_LINK_REQUIRED');
      await c.query(`INSERT INTO hsk_job_transactions(chain_id,tx_hash,job_id,sender,tx_nonce) VALUES($1,$2,$3,$4,$5)`,[job.chain_id,hash,job.id,sender,nonce]);
      await c.query(`UPDATE hsk_jobs SET status='SUBMITTED',updated_at=clock_timestamp() WHERE id=$1`,[job.id]);
      await this.audit(c,job.id,'SUBMITTED',{txHash:hash});
    });
  }
  /** Records a verified replacement; does not authorize or submit a fee-bump transaction. */
  async recordReplacement(lease: JobLease, replacesHash: string, submission: Submission): Promise<void> {
    await this.transaction(async c => {
      const job = await this.locked(c,lease);
      if (job.status !== 'SUBMITTED') fail('INVALID_REPLACEMENT_STATE');
      const oldHash = hex(replacesHash,64), hash = hex(submission.txHash,64);
      const old = (await c.query('SELECT * FROM hsk_job_transactions WHERE chain_id=$1 AND tx_hash=$2 AND job_id=$3',[job.chain_id,oldHash,job.id])).rows[0];
      if (!old || oldHash === hash || old.sender !== hex(submission.sender,40) || old.tx_nonce !== uint(submission.txNonce)) fail('INVALID_REPLACEMENT');
      const exists = (await c.query('SELECT * FROM hsk_job_transactions WHERE chain_id=$1 AND tx_hash=$2',[job.chain_id,hash])).rows[0];
      if (exists) {
        if (exists.job_id !== job.id || exists.replaces_hash !== oldHash) fail('TRANSACTION_CONFLICT');
        return;
      }
      await c.query(`INSERT INTO hsk_job_transactions(chain_id,tx_hash,job_id,sender,tx_nonce,replaces_hash) VALUES($1,$2,$3,$4,$5,$6)`,[job.chain_id,hash,job.id,old.sender,old.tx_nonce,oldHash]);
      await this.audit(c,job.id,'REPLACEMENT_OBSERVED',{txHash:hash,replacesHash:oldHash});
    });
  }
  async assertTransactionIdentity(lease: JobLease, submission: Submission): Promise<void> {
    await this.transaction(async c => {
      const job=await this.locked(c,lease);
      const tx=(await c.query('SELECT sender,tx_nonce FROM hsk_job_transactions WHERE chain_id=$1 AND tx_hash=$2 AND job_id=$3',[job.chain_id,hex(submission.txHash,64),job.id])).rows[0];
      if(!tx || tx.sender!==hex(submission.sender,40) || tx.tx_nonce!==uint(submission.txNonce)) fail('TRANSACTION_IDENTITY_MISMATCH');
    });
  }
  async recordReceipt(lease: JobLease, receipt: {txHash: string; blockNumber: string; blockHash: string; success: boolean}): Promise<void> {
    await this.transaction(async c => {
      const job = await this.locked(c,lease);
      if (!['SUBMITTED','MINED'].includes(job.status)) fail('INVALID_RECEIPT_STATE');
      const hash=hex(receipt.txHash,64), block=hex(receipt.blockHash,64); uint(receipt.blockNumber);
      if (typeof receipt.success !== 'boolean') fail('INVALID_RECEIPT');
      const tx = (await c.query('SELECT * FROM hsk_job_transactions WHERE chain_id=$1 AND tx_hash=$2 AND job_id=$3',[job.chain_id,hash,job.id])).rows[0];
      if (!tx) fail('UNKNOWN_TRANSACTION');
      if (tx.canonical) {
        if (tx.block_hash !== block || tx.block_number !== receipt.blockNumber || tx.receipt_success !== receipt.success) fail('RECEIPT_CONFLICT');
        return;
      }
      await c.query(`UPDATE hsk_job_transactions SET block_number=$3,block_hash=$4,receipt_success=$5,canonical=true WHERE chain_id=$1 AND tx_hash=$2`,[job.chain_id,hash,receipt.blockNumber,block,receipt.success]);
      await c.query(`UPDATE hsk_jobs SET status='MINED',updated_at=clock_timestamp() WHERE id=$1`,[job.id]);
      await this.audit(c,job.id,'RECEIPT_OBSERVED',{txHash:hash,blockHash:block,success:receipt.success});
    });
  }
  /** Caller supplies verified confirmation evidence. Confirmed != L1 finality. */
  async confirm(lease: JobLease, blockHash: string): Promise<void> {
    await this.transaction(async c => {
      const job = await this.locked(c,lease);
      if (job.status !== 'MINED') fail('NOT_MINED');
      const tx = (await c.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1 AND canonical AND block_hash=$2',[job.id,hex(blockHash,64)])).rows[0];
      if (!tx) fail('CANONICAL_RECEIPT_REQUIRED');
      await c.query(`UPDATE hsk_jobs SET status=$2,lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1`,[job.id,tx.receipt_success ? 'CONFIRMED':'FAILED']);
      await this.audit(c,job.id,'CONFIRMED',{txHash:tx.tx_hash,blockHash:tx.block_hash,success:tx.receipt_success});
    });
  }
  /** Trusted indexer entrypoint: atomically revoke receipt, flag accounting reversal and block account.
   * No automatic clear/rebroadcast: ledger reversal and chain reconciliation must be implemented separately.
   */
  async markReorg(id: string, orphanedBlockHash: string, lease?: JobLease): Promise<void> {
    await this.transaction(async c => {
      if(lease) { if(lease.jobId!==id) fail('RESERVATION_MISMATCH'); await this.locked(c,lease); }
      const job = (await c.query<DurableJob>('SELECT * FROM hsk_jobs WHERE id=$1',[id])).rows[0];
      if (!job) fail('JOB_NOT_FOUND');
      await c.query('SELECT 1 FROM hsk_job_accounts WHERE chain_id=$1 AND account=$2 FOR UPDATE',[job.chain_id,job.account]);
      await c.query('SELECT 1 FROM hsk_jobs WHERE id=$1 FOR UPDATE',[id]);
      const changed = await c.query(`UPDATE hsk_job_transactions SET canonical=false WHERE job_id=$1 AND block_hash=$2 AND canonical RETURNING tx_hash`,[id,hex(orphanedBlockHash,64)]);
      if (!changed.rowCount) return;
      await c.query(`UPDATE hsk_jobs SET status='REORGED',reversal_required=true,fence=fence+1,lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1`,[id]);
      await c.query(`UPDATE hsk_job_accounts SET quarantined=true,quarantine_reason='REORG_REQUIRES_LEDGER_REVERSAL' WHERE chain_id=$1 AND account=$2`,[job.chain_id,job.account]);
      await this.audit(c,id,'REORG_REVERSAL_REQUIRED',{blockHash:orphanedBlockHash.toLowerCase(),txHashes:changed.rows.map(r=>r.tx_hash)});
    });
  }
}
