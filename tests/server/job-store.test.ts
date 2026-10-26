import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgJobStore, type JobLease } from '../../apps/server/job-store';

// Explicit integration prerequisite. No in-memory substitute; skipped without an isolated local PG URL.
const url = process.env.HSK_TEST_DATABASE_URL;
const schema = `hsk_test_${randomUUID().replaceAll('-','')}`;
const addr = (n: number) => `0x${n.toString(16).padStart(40,'0')}`;
const hash = (n: number) => `0x${n.toString(16).padStart(64,'0')}`;
describe.skipIf(!url)('PostgreSQL durable coordinator (real DB)', () => {
  let admin: Pool, pool: Pool, store: PgJobStore;
  beforeAll(async () => {
    admin = new Pool({connectionString:url});
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({connectionString:url, options:`-c search_path=${schema}`,max:20});
    const migration = await pool.connect();
    try { await migration.query('BEGIN'); await migration.query(await readFile(new URL('../../migrations/001_durable_jobs.sql',import.meta.url),'utf8')); await migration.query(await readFile(new URL('../../migrations/002_signing_barrier.sql',import.meta.url),'utf8')); await migration.query('COMMIT'); }
    catch(e) { await migration.query('ROLLBACK'); throw e; }
    finally { migration.release(); }
    store = new PgJobStore(pool);
  });
  afterAll(async () => { await pool?.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
  const reserve = (n:number, nonce='0') => store.reserve({chainId:'177',account:addr(n),sessionId:'1',nonce,intentHash:hash(n*100+Number(nonce)),payload:{amountRaw:'9007199254740993000000'}});
  const prepareSend = async (l:JobLease) => { await store.beginSigning(l); await store.markSigned(l); await store.beginSubmission(l); };
  const lease = async (id:string) => { const l = await store.claim(id,'worker-a'); expect(l).not.toBeNull(); return l as JobLease; };
  it('serializes concurrent duplicate reservations and forbids a second pending nonce/session', async () => {
    const jobs = await Promise.all(Array.from({length:16},()=>reserve(1)));
    expect(new Set(jobs.map(j=>j.id)).size).toBe(1);
    const attempts = await Promise.allSettled(Array.from({length:10},(_,i)=>reserve(1,String(i+1))));
    expect(attempts.every(r=>r.status==='rejected' && r.reason.code==='ACCOUNT_PENDING')).toBe(true);
    await expect(store.reserve({chainId:'177',account:addr(1),sessionId:'1',nonce:'0',intentHash:hash(100),payload:{amountRaw:'1'}})).rejects.toMatchObject({code:'INTENT_CONFLICT'});
  });
  it('survives client restart and preserves full decimal precision', async () => {
    const job=await reserve(2);
    const independent = new Pool({connectionString:url,options:`-c search_path=${schema}`});
    try { const read = await new PgJobStore(independent).get(job.id); expect(read?.payload.amountRaw).toBe('9007199254740993000000'); expect(read?.status).toBe('PREPARED'); }
    finally { await independent.end(); }
  });
  it('only one worker claims; expired lease cannot write after a new fencing token', async () => {
    const job=await reserve(3);
    const claims = await Promise.all(Array.from({length:12},(_,i)=>store.claim(job.id,`worker-${i}`,1000)));
    expect(claims.filter(Boolean)).toHaveLength(1);
    const old=claims.find(Boolean)!;
    await pool.query('SELECT pg_sleep(1.1)');
    const next=await lease(job.id); expect(BigInt(next.fence)).toBeGreaterThan(BigInt(old.fence));
    await expect(store.beginSubmission(old)).rejects.toMatchObject({code:'STALE_LEASE'});
    await prepareSend(next); expect((await store.get(job.id))?.status).toBe('UNKNOWN');
  });
  it('quarantines hashless unknown across restart, disallows rebroadcast and next intent', async () => {
    const job=await reserve(4), l=await lease(job.id);
    await prepareSend(l);
    const restart = new PgJobStore(pool);
    expect((await restart.pending('177',addr(4)))[0].status).toBe('UNKNOWN');
    await expect(restart.beginSubmission(l)).rejects.toMatchObject({code:'NOT_SIGNED_NO_REBROADCAST'});
    await expect(reserve(4,'1')).rejects.toMatchObject({code:'ACCOUNT_PENDING'});
    expect((await pool.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1',[job.id])).rowCount).toBe(0);
  });
  it('records discovered submission idempotently, rejects duplicate hash on another job', async () => {
    const a=await reserve(5), la=await lease(a.id); await prepareSend(la);
    const tx={txHash:hash(5000),sender:addr(99),txNonce:'9007199254740993'};
    await store.recordSubmission(la,tx); await store.recordSubmission(la,tx);
    expect((await pool.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1',[a.id])).rowCount).toBe(1);
    const b=await reserve(6), lb=await lease(b.id); await prepareSend(lb);
    await expect(store.recordSubmission(lb,tx)).rejects.toMatchObject({code:'TRANSACTION_CONFLICT'});
    expect((await store.get(b.id))?.status).toBe('UNKNOWN');
    await expect(store.recordSubmission(la,{...tx,txHash:hash(5001)})).rejects.toMatchObject({code:'REPLACEMENT_LINK_REQUIRED'});
  });
  it('links replacements with same EOA nonce, counts only one canonical receipt, reorg invalidates and audits', async () => {
    const j=await reserve(7), l=await lease(j.id); await prepareSend(l);
    const tx={txHash:hash(7000),sender:addr(99),txNonce:'30'};
    await store.recordSubmission(l,tx);
    await expect(store.recordReplacement(l,tx.txHash,{...tx,txHash:hash(7001),txNonce:'31'})).rejects.toMatchObject({code:'INVALID_REPLACEMENT'});
    await store.recordReplacement(l,tx.txHash,{...tx,txHash:hash(7001)});
    await store.recordReplacement(l,tx.txHash,{...tx,txHash:hash(7001)});
    const receipt={txHash:hash(7001),blockHash:hash(7777),blockNumber:'12345',success:true};
    await store.recordReceipt(l,receipt); await store.recordReceipt(l,receipt);
    await expect(store.recordReceipt(l,{...receipt,txHash:hash(7000)})).rejects.toMatchObject({code:'23505'});
    await store.confirm(l,receipt.blockHash); expect((await store.get(j.id))?.status).toBe('CONFIRMED');
    const newer=await reserve(7,'1'), newerLease=await lease(newer.id);
    await store.markReorg(j.id,receipt.blockHash); await store.markReorg(j.id,receipt.blockHash);
    expect(await store.get(j.id)).toMatchObject({status:'REORGED',reversal_required:true});
    expect((await pool.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1 AND canonical',[j.id])).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM hsk_job_audit WHERE job_id=$1 AND event='REORG_REVERSAL_REQUIRED'",[j.id])).rowCount).toBe(1);
    await expect(store.assertLease(newerLease)).rejects.toMatchObject({code:'ACCOUNT_QUARANTINED'});
    await expect(store.beginSigning(newerLease)).rejects.toMatchObject({code:'ACCOUNT_QUARANTINED'});
    await expect(reserve(7,'2')).rejects.toMatchObject({code:'ACCOUNT_QUARANTINED'});
    await expect(pool.query("UPDATE hsk_job_audit SET event='ERASED' WHERE job_id=$1",[j.id])).rejects.toThrow('audit is append only');
  });
  it('retains failed receipt as failed (no invented fill), accepts only matching block confirmation', async () => {
    const j=await reserve(8), l=await lease(j.id); await prepareSend(l);
    await store.recordSubmission(l,{txHash:hash(8000),sender:addr(99),txNonce:'40'});
    await store.recordReceipt(l,{txHash:hash(8000),blockHash:hash(8888),blockNumber:'100',success:false});
    await expect(store.confirm(l,hash(9999))).rejects.toMatchObject({code:'CANONICAL_RECEIPT_REQUIRED'});
    await store.confirm(l,hash(8888)); expect((await store.get(j.id))?.status).toBe('FAILED');
    await expect(store.claim(j.id,'retry')).resolves.toBeNull();
  });
});
