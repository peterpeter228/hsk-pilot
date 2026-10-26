import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { afterAll,beforeAll,describe,it,expect } from 'vitest';
import { LocalCoordinator } from '../../apps/worker/src/coordinator.js';
import { PgJobStore } from '../../apps/server/job-store.js';
import { PgLocalCoordinatorStore } from '../../apps/server/local-coordinator-store.js';
import { localJobFixture,testAddress,testHash } from './local-job-fixture.js';
const url=process.env.HSK_TEST_DATABASE_URL;
const schema=`hsk_adapter_${randomUUID().replaceAll('-','')}`;
describe.skipIf(!url)('LocalCoordinator with real PostgreSQL (fake execution only)',()=>{
 let admin:Pool,pool:Pool,jobs:PgJobStore;
 const adapter=(account:string,worker='test-worker',leaseMs=30_000)=>new PgLocalCoordinatorStore(jobs,{chainId:'31337',account,worker,leaseMs});
 beforeAll(async()=>{
  admin=new Pool({connectionString:url}); await admin.query(`CREATE SCHEMA ${schema}`);
  pool=new Pool({connectionString:url,options:`-c search_path=${schema}`}); jobs=new PgJobStore(pool);
  const c=await pool.connect();
  try{await c.query('BEGIN');for(const file of ['001_durable_jobs.sql','002_signing_barrier.sql'])await c.query(await readFile(new URL(`../../migrations/${file}`,import.meta.url),'utf8'));await c.query('COMMIT');}finally{c.release();}
 });
 afterAll(async()=>{await pool?.end();if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}});
 it('runs a complete local substrate trace; independent coordinator race signs twice total and sends once',async()=>{
  const account=testAddress(101),f=localJobFixture(adapter(account,'a'),account),g=localJobFixture(adapter(account,'b'),account);
  const results=await Promise.all([new LocalCoordinator(f.deps).run(),new LocalCoordinator(g.deps).run()]);
  console.log('COORDINATOR_RESULTS',results);expect(results.filter(r=>r.status==='SUBMITTED')).toHaveLength(1);
  expect([...f.calls,...g.calls].sort()).toEqual(['send','sign:RISK','sign:STRATEGY']);
  const job=(await jobs.pending('31337',account))[0];expect(job.status).toBe('SUBMITTED');
  const tx=(await pool.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1',[job.id])).rows[0];
  expect(tx.tx_nonce).toBe('42');expect(job.nonce).toBe('0');
  const events=(await pool.query('SELECT event FROM hsk_job_audit WHERE job_id=$1 ORDER BY id',[job.id])).rows.map(r=>r.event);
  expect(events).toEqual(['RESERVED','CLAIMED','SIGNING_WRITE_AHEAD','BOTH_ROLE_SIGNATURES_VERIFIED','SUBMISSION_UNCERTAIN','SUBMITTED']);
  await writeFile('evidence/G3/pg/local-coordinator-trace.json',JSON.stringify({recordedAt:new Date().toISOString(),dataMode:'SIMULATION',execution:'FAKE_SIGNATURES_AND_SEND_ONLY',executionChainId:31337,sourceChainId:177,events,roleCalls:[...f.calls,...g.calls],eoaNonce:tx.tx_nonce,intentNonce:job.nonce,status:job.status},null,2));
 });
 for(const [index,phase,status,code] of [[102,'before-first-sign','SIGNING',71],[103,'during-second-sign','SIGNING',72],[104,'after-signed','SIGNED',73],[105,'after-unknown','UNKNOWN',74]] as const) {
  it(`actual child crash ${phase} survives independent restart without sign/send replay`,async()=>{
   const account=testAddress(index);
   const child=spawnSync(process.execPath,['--import','tsx','tests/server/local-job-crash-child.ts',schema,account,phase],{cwd:process.cwd(),env:process.env,encoding:'utf8',timeout:15_000});
   expect(child.status,child.stderr+child.stdout).toBe(code);
   await pool.query('SELECT pg_sleep(1.05)');
   const independent=new Pool({connectionString:url,options:`-c search_path=${schema}`});
   try {
    const restartedJobs=new PgJobStore(independent), restarted=new PgLocalCoordinatorStore(restartedJobs,{chainId:'31337',account,worker:'restart'});
    const f=localJobFixture(restarted,account);expect((await new LocalCoordinator(f.deps).run()).status).toBe('BLOCKED');expect(f.calls).toEqual([]);
    const job=(await restartedJobs.pending('31337',account))[0];expect(job.status).toBe(status);
    expect(await restartedJobs.claimPrepared(job.id,'must-not-sign')).toBeNull();
    const recovery=await restarted.claimForReconciliation(job.id);expect(recovery).not.toBeNull();
    await expect(restarted.transition(recovery!,'SIGNING',{})).rejects.toMatchObject({code:'NOT_PREPARED_NO_RESIGN'});
    expect((await restartedJobs.get(job.id))?.status).toBe(status);
    console.log('CRASH_RESTART',phase,status,'no re-sign or send');
   }finally{await independent.end();}
  });
 }
 it('expired signer fence stops second role and leaves SIGNING, not PREPARED',async()=>{
  const account=testAddress(106),f=localJobFixture(adapter(account,'slow',100),account);
  const sign=f.deps.execution.sign;
  f.deps.execution.sign=async(role,intent)=>{const r=await sign(role,intent);await pool.query('SELECT pg_sleep(0.15)');return r;};
  const result=await new LocalCoordinator(f.deps).run();expect(result.status).not.toBe('SUBMITTED');expect(f.calls).toEqual(['sign:STRATEGY']);
  expect((await jobs.pending('31337',account))[0].status).toBe('SIGNING');
  const restart=localJobFixture(adapter(account,'replacement'),account);await new LocalCoordinator(restart.deps).run();expect(restart.calls).toEqual([]);
 });
 it('failed write-ahead SIGNING persistence invokes no signer',async()=>{
  const account=testAddress(107),store=adapter(account),f=localJobFixture(store,account);
  const transition=store.transition.bind(store);store.transition=async(...args)=>{if(args[1]==='SIGNING')throw Error('INJECTED_DB_COMMIT_FAILURE');return transition(...args);};
  await new LocalCoordinator(f.deps).run();expect(f.calls).toEqual([]);expect((await jobs.pending('31337',account))[0].status).toBe('PREPARED');
 });
 it('failed UNKNOWN persistence does not send, keeps SIGNED quarantined',async()=>{
  const account=testAddress(108),store=adapter(account),f=localJobFixture(store,account);
  const transition=store.transition.bind(store);store.transition=async(...args)=>{if(args[1]==='UNKNOWN')throw Error('INJECTED_DB_COMMIT_FAILURE');return transition(...args);};
  await new LocalCoordinator(f.deps).run();expect(f.calls).toEqual(['sign:STRATEGY','sign:RISK']);expect((await jobs.pending('31337',account))[0].status).toBe('SIGNED');
 });
 it('blocks mismatched version/typed payload and forged reservation ownership',async()=>{
  const account=testAddress(109),store=adapter(account),f=localJobFixture(store,account);await new LocalCoordinator(f.deps).run();
  const job=(await jobs.pending('31337',account))[0];const intent=job.payload as unknown as Parameters<typeof store.reserve>[0];
  await expect(store.reserve({...intent,policyVersion:'99'})).rejects.toMatchObject({code:'INTENT_BINDING_MISMATCH'});
  const changed=structuredClone(intent);(changed.typedData.message as Record<string,unknown>).policyVersion='99';changed.policyVersion='99';expect(await store.reserve(changed)).toBeNull();
  await expect(store.assertFence({intentId:intent.id,token:JSON.stringify({jobId:job.id,worker:'attacker',fence:job.fence})})).rejects.toMatchObject({code:'INVALID_RESERVATION'});
 });
 it('persists verified receipt metadata, rejects mismatched EOA identity, and confirms without another send',async()=>{
  const account=testAddress(112),store=adapter(account),f=localJobFixture(store,account);
  let reservation:Awaited<ReturnType<typeof store.reserve>>=null;
  const reserve=store.reserve.bind(store);store.reserve=async(intent)=>{reservation=await reserve(intent);return reservation;};
  const result=await new LocalCoordinator(f.deps).run();expect(result.status).toBe('SUBMITTED');
  const receipt={txHash:result.txHash!,blockHash:testHash(900),blockNumber:'100',sender:testAddress(999),txNonce:'42',success:true,confirmations:3};
  await expect(store.transition(reservation!,'CONFIRMED',{receipt:{...receipt,txNonce:'0'}})).rejects.toMatchObject({code:'TRANSACTION_IDENTITY_MISMATCH'});
  const job=(await jobs.pending('31337',account))[0];expect(job.status).toBe('SUBMITTED');
  await store.transition(reservation!,'MINED',{receipt});await store.transition(reservation!,'CONFIRMED',{receipt});
  expect((await jobs.get(job.id))?.status).toBe('CONFIRMED');expect(f.calls.filter(x=>x==='send')).toHaveLength(1);
  const recovery=await store.claimForReconciliation(job.id);expect(recovery).not.toBeNull();
  await expect(store.transition(reservation!,'REORGED',{orphanedBlockHash:receipt.blockHash})).rejects.toMatchObject({code:'STALE_LEASE'});
  await store.transition(recovery!,'REORGED',{orphanedBlockHash:receipt.blockHash});
  expect(await jobs.get(job.id)).toMatchObject({status:'REORGED',reversal_required:true});
  await expect(jobs.reserve({chainId:'31337',account,sessionId:'1',nonce:'1',intentHash:testHash(1111),payload:{}})).rejects.toMatchObject({code:'ACCOUNT_QUARANTINED'});
 });
 it('rejects mainnet chain ID at local adapter construction',()=>{
  expect(()=>new PgLocalCoordinatorStore(jobs,{chainId:'177',account:testAddress(113),worker:'x'})).toThrow('INVALID_LOCAL_STORE_CONFIG');
 });
 it('upgrades legacy pending rows conservatively and extends pending unique index',async()=>{
  const upgrade=`${schema}_upgrade`;await admin.query(`CREATE SCHEMA ${upgrade}`);
  const p=new Pool({connectionString:url,options:`-c search_path=${upgrade}`});
  try{
   await p.query(await readFile(new URL('../../migrations/001_durable_jobs.sql',import.meta.url),'utf8'));
   const old=new PgJobStore(p);const j=await old.reserve({chainId:'31337',account:testAddress(110),sessionId:'1',nonce:'0',intentHash:testHash(110),payload:{version:'1'}});
   await p.query('BEGIN');await p.query(await readFile(new URL('../../migrations/002_signing_barrier.sql',import.meta.url),'utf8'));await p.query('COMMIT');
   expect((await old.get(j.id))?.status).toBe('SIGNING');expect(await old.claimPrepared(j.id,'restart')).toBeNull();
   await expect(old.reserve({chainId:'31337',account:testAddress(110),sessionId:'1',nonce:'1',intentHash:testHash(111),payload:{}})).rejects.toMatchObject({code:'ACCOUNT_PENDING'});
   expect((await p.query("SELECT event FROM hsk_job_audit WHERE job_id=$1 AND event='MIGRATION_SIGNING_QUARANTINE'",[j.id])).rowCount).toBe(1);
   const index=(await p.query("SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname='hsk_one_pending_account'",[upgrade])).rows[0].indexdef;
   expect(index).toContain('SIGNING');expect(index).toContain('SIGNED');
  }finally{await p.end();await admin.query(`DROP SCHEMA ${upgrade} CASCADE`);}
 });
});
