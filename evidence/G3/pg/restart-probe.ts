// Local-only process restart probe, run with node --import tsx; no financial/network writes.
import { Pool } from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { PgJobStore } from '../../../apps/server/job-store';
const schema='hsk_restart_probe';
const admin=new Pool({connectionString:process.env.HSK_TEST_DATABASE_URL});
const pool=new Pool({connectionString:process.env.HSK_TEST_DATABASE_URL,options:`-c search_path=${schema}`});
try {
 const store=new PgJobStore(pool);
 if(process.argv[2]==='prepare') {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await pool.query(await readFile(new URL('../../../migrations/001_durable_jobs.sql',import.meta.url),'utf8'));
  const j=await store.reserve({chainId:'177',account:'0x'+'a'.repeat(40),sessionId:'1',nonce:'0',intentHash:'0x'+'b'.repeat(64),payload:{sourceDataMode:'SIMULATION'}});
  const l=await store.claim(j.id,'restart-probe',1_000);
  if(!l) throw Error('claim missing');
  await store.beginSubmission(l);
  await writeFile('/tmp/hsk-restart-job-id',j.id);
  console.log('PREPARE: durable UNKNOWN committed; no tx hash, no broadcast');
 } else {
  const id=await readFile('/tmp/hsk-restart-job-id','utf8');
  const job=await store.get(id);
  if(job?.status!=='UNKNOWN') throw Error('durable state lost');
  const txs=await pool.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1',[id]);
  if(txs.rowCount!==0) throw Error('invented transaction');
  let blocked=false;
  try { await store.reserve({chainId:'177',account:job.account,sessionId:'1',nonce:'1',intentHash:'0x'+'c'.repeat(64),payload:{}}); }
  catch(e) { blocked=(e as {code:string}).code==='ACCOUNT_PENDING'; }
  if(!blocked) throw Error('unknown did not quarantine new intent');
  console.log('VERIFY: actual PostgreSQL stop/start preserved UNKNOWN and blocked new intent; no hash invented');
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
 }
} finally { await pool.end(); await admin.end(); }
