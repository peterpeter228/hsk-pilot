/** Local-only SIMULATION. Spawns its own ephemeral Anvil, refuses every non-31337 chain.
 * No RPC/key env variables accepted, no production broadcast/deploy path. */
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {tsImport} from 'tsx/esm/api';
import {resolveFoundry} from './native-tool.mjs';
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createPublicClient, createWalletClient, http, defineChain, hashTypedData, keccak256, stringToHex, decodeEventLog, recoverTypedDataAddress} from 'viem';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';
// Fail before compilation, opening sockets or spawning any child; never print credentials.
const connectionString=process.env.HSK_TEST_DATABASE_URL;
if(!connectionString){console.error('HSK_TEST_DATABASE_URL is required for an explicitly isolated local test database');process.exit(2);}
let databaseUrl;
try {databaseUrl=new URL(connectionString);} catch {console.error('HSK_TEST_DATABASE_URL must be a valid local PostgreSQL URL');process.exit(2);}
if(!['postgres:','postgresql:'].includes(databaseUrl.protocol)
 || !['127.0.0.1','[::1]','localhost'].includes(databaseUrl.hostname)
 || databaseUrl.pathname.length<=1 || databaseUrl.search || databaseUrl.hash){
 console.error('HSK_TEST_DATABASE_URL must name a loopback PostgreSQL database without query or fragment overrides');process.exit(2);
}
const {LocalCoordinator,PgJobStore,PgLocalCoordinatorStore}=await tsImport('./durable-local-modules.ts',import.meta.url);
const {Pool}=pg;
const root = fileURLToPath(new URL('../../', import.meta.url));
const contractRoot = fileURLToPath(new URL('../', import.meta.url));
const build = spawnSync(`${contractRoot}script/forge-local.sh`, ['build'], {stdio:'inherit'});
if(build.status!==0) throw new Error('Local compilation failed');
const artifact = (file,name) => JSON.parse(readFileSync(`${contractRoot}out/${file}/${name}.json`,'utf8'));
const artifacts={token:artifact('TradingSessionGuard.t.sol','MockToken'),pool:artifact('TradingSessionGuard.t.sol','MockPool'),factory:artifact('TradingSessionGuard.t.sol','MockFactory'),router:artifact('TradingSessionGuard.t.sol','MockRouter'),guard:artifact('TradingSessionGuard.sol','TradingSessionGuard')};
// A random free local TCP port prevents accidental reuse of an unrelated node.
const {createServer}=await import('node:net');
const reserver=createServer();await new Promise(r=>reserver.listen(0,'127.0.0.1',r));
const port=reserver.address().port;await new Promise(r=>reserver.close(r));
const rpc=`http://127.0.0.1:${port}`;
const anvil=spawn(resolveFoundry('anvil'),['--host','127.0.0.1','--port',String(port),'--chain-id','31337','--silent'],{stdio:['ignore','ignore','pipe']});
let startupError='';anvil.stderr.on('data',d=>startupError+=d.toString());
const chain=defineChain({id:31337,name:'HSK Pilot ephemeral local SIMULATION',nativeCurrency:{name:'Synthetic Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[rpc]}}});
const publicClient=createPublicClient({chain,transport:http(rpc,{retryCount:0,timeout:1000})});
const startedAt=new Date().toISOString();
const schema=`hsk_anvil_${randomUUID().replaceAll('-','')}`;
let admin,poolDb,restartedPool,schemaCreated=false;
const evidenceDir=`${contractRoot}evidence/durable-local`;mkdirSync(evidenceDir,{recursive:true});
const evidence={schemaVersion:'hsk-durable-local-integration/1',sourceDataMode:'SIMULATION',executionDataMode:'SIMULATION',executionKind:'LOCAL_TX',chainId:31337,startedAt,status:'RUNNING',databaseSchema:schema,transactions:[],checks:[],limitations:['Synthetic tokens and router, not HSKSwap integration or mainnet performance.','Ephemeral local chain transaction hashes are not mainnet explorer evidence.','Role keys are different but execute in one test process; no independent trust domains.']};
let ready=false;
try {
 for(let n=0;n<100;n++) {if(anvil.exitCode!==null)throw new Error(`Anvil stopped: ${startupError}`);try {ready=await publicClient.getChainId()===31337;if(ready)break;}catch{} await new Promise(r=>setTimeout(r,50));}
 assert(ready,'Own ephemeral Anvil did not become ready');
 admin=new Pool({connectionString});await admin.query(`CREATE SCHEMA ${schema}`);schemaCreated=true;
 poolDb=new Pool({connectionString,options:`-c search_path=${schema}`});
 const migration=await poolDb.connect();
 try {await migration.query('BEGIN');for(const name of ['001_durable_jobs.sql','002_signing_barrier.sql'])await migration.query(readFileSync(`${root}migrations/${name}`,'utf8'));await migration.query('COMMIT');}
 catch(e){await migration.query('ROLLBACK');throw e;}finally{migration.release();}
 // Local unlocked Anvil account; roles are ephemeral, never loaded from env or exported.
 const accounts=await publicClient.request({method:'eth_accounts'});
 const owner=accounts[0];
 const wallet=createWalletClient({account:owner,chain,transport:http(rpc,{retryCount:0})});
 const strategy=privateKeyToAccount(generatePrivateKey()),riskSigner=privateKeyToAccount(generatePrivateKey());
 const checkChain=async()=>assert.equal(await publicClient.getChainId(),31337,'Refuse nonlocal chain');
 const receipt=async(hash,label)=>{const r=await publicClient.waitForTransactionReceipt({hash});assert.equal(r.status,'success',label);evidence.transactions.push({label,hash,blockNumber:r.blockNumber.toString(),gasUsed:r.gasUsed.toString(),status:r.status});return r;};
 const deploy=async(art,args,label)=>{await checkChain();const r=await receipt(await wallet.deployContract({abi:art.abi,bytecode:art.bytecode.object,args}),label);assert(r.contractAddress);return r.contractAddress;};
 const write=async(address,art,name,args=[])=>{await checkChain();const {request}=await publicClient.simulateContract({account:owner,address,abi:art.abi,functionName:name,args});return receipt(await wallet.writeContract(request),name);};
 const read=(address,art,name,args=[])=>publicClient.readContract({address,abi:art.abi,functionName:name,args});
 const risk=await deploy(artifacts.token,[18],'deploy mock WHSK18');
 const quote=await deploy(artifacts.token,[6],'deploy mock USDT6');
 const pool=await deploy(artifacts.pool,[risk,quote],'deploy mock pool');
 const factory=await deploy(artifacts.factory,[pool],'deploy mock factory');
 const router=await deploy(artifacts.router,[factory,risk,pool],'deploy mock router');
 const guard=await deploy(artifacts.guard,[owner,risk,quote,router,factory,pool,3000],'deploy guard');
 evidence.addresses={guard,risk,quote,pool,factory,router,owner,strategySigner:strategy.address,riskSigner:riskSigner.address};
 await write(quote,artifacts.token,'mint',[guard,100_000_000n]);await write(risk,artifacts.token,'mint',[pool,1000n*10n**18n]);await write(quote,artifacts.token,'mint',[pool,1_000_000_000n]);
 const now=(await publicClient.getBlock()).timestamp;
 const policy={mode:0,validAfter:now,validUntil:now+86400n,strategySigner:strategy.address,riskSigner:riskSigner.address,strategyPolicyHash:keccak256(stringToHex('synthetic approved strategy')),maxBuyPerTradeQuoteRaw:10_000_000n,maxSessionGrossBuyQuoteRaw:20_000_000n,maxUtcDayGrossBuyQuoteRaw:30_000_000n,maxRiskInventoryRaw:100n*10n**18n,maxSellPerTradeRiskRaw:5n*10n**18n,minTradeIntervalSec:0,maxQuoteSlippageBps:100,maxQuoteAgeSec:30,maxIntentTtlSec:60,exitMaxPerTradeRiskRaw:10n*10n**18n,exitMinIntervalSec:0,exitValidUntil:now+172800n};
 await write(guard,artifacts.guard,'startSession',[policy,100_000_000n,0n]);
 const typeConfig=JSON.parse(readFileSync(`${root}config/trade-intent-types.json`,'utf8'));
 const strategyPolicy={targetRiskWeightBps:5000,rebalanceBandBps:500,stopDrawdownBps:500,minimumTradeQuoteRaw:'1',maxExecutionCostQuoteRaw:'100000',riskEnabled:true};
 // Configure the synthetic fixed router BEFORE observing the coordinator's immutable block snapshot.
 await write(router,artifacts.router,'configure',[10n*10n**18n,0n,false]);
 const readContext=async()=>{
  await checkChain();const block=await publicClient.getBlock();
  const currentStatus=await read(guard,artifacts.guard,'status');
  const version=String(await read(guard,artifacts.guard,'policyVersion'));
  const offchainPolicy={...policy,mode:'BOUNDED_EXECUTION',status:['PAUSED','ACTIVE','REDUCE_ONLY','EXPIRED'][currentStatus],version};
  for(const key of ['maxBuyPerTradeQuoteRaw','maxSessionGrossBuyQuoteRaw','maxUtcDayGrossBuyQuoteRaw','maxRiskInventoryRaw','maxSellPerTradeRiskRaw','exitMaxPerTradeRiskRaw'])offchainPolicy[key]=String(policy[key]);
  for(const key of ['validAfter','validUntil','exitValidUntil'])offchainPolicy[key]=Number(policy[key]);
  const q=await read(guard,artifacts.guard,'allocatedQuoteRaw'),r=await read(guard,artifacts.guard,'allocatedRiskRaw');
  const snapshot={hash:keccak256(stringToHex(`synthetic-local:${block.hash}:${q}:${r}:${version}`)),policyHash:policy.strategyPolicyHash,executionCostEstimate:{quoteRaw:'0',observedAt:Number(block.timestamp),source:'SYNTHETIC'},now:Number(block.timestamp),observedAt:Number(block.timestamp),quoteBalanceRaw:String(q),riskBalanceRaw:String(r),indicativeRiskValueQuoteRaw:String(r/10n**12n),sessionGrossBuyRaw:String(await read(guard,artifacts.guard,'sessionGrossBuyQuoteRaw')),dayGrossBuyRaw:String(await read(guard,artifacts.guard,'utcDayGrossBuyQuoteRaw',[block.timestamp/86400n])),lastTradeAt:Number(await read(guard,artifacts.guard,'lastTradeAt')),lastExitAt:Number(await read(guard,artifacts.guard,'lastExitAt'))};
  return {sourceChainId:177,executionChainId:31337,snapshot,policy:offchainPolicy,strategy:strategyPolicy,canonicalBlockHash:block.hash,generation:0,intentNonce:String(await read(guard,artifacts.guard,'intentNonce')),blockNumber:String(block.number),sessionId:String(await read(guard,artifacts.guard,'sessionId')),guardAddress:guard,strategyPolicyHash:policy.strategyPolicyHash};
 };
 let builtIntent,signCalls=0,sendCalls=0,verifiedSignatures=0,simulations=0;
 const consumedRoleSignatures=[];
 const jobStore=new PgJobStore(poolDb);
 const coordinatorStore=new PgLocalCoordinatorStore(jobStore,{chainId:'31337',account:guard,worker:'durable-local-first',leaseMs:10000});
 const roleAccount=role=>role==='STRATEGY'?strategy:riskSigner;
 const signaturesArgs=signatures=>[signatures.find(s=>s.role==='STRATEGY').signature,signatures.find(s=>s.role==='RISK').signature];
 const execution={
  mode:'SIMULATION',chainId:31337,
  async sign(role,intent){
   await checkChain();
   const row=(await poolDb.query('SELECT status FROM hsk_jobs WHERE payload->>\'id\'=$1',[intent.id])).rows[0];
   assert.equal(row?.status,'SIGNING','Actual keys must never be used before durable SIGNING');
   signCalls++;
   const account=roleAccount(role);const signed={role,signerId:account.address,signature:await account.signTypedData(intent.typedData),intentId:intent.id};consumedRoleSignatures.push(signed);return signed;
  },
  async verifySignature(intent,signature){
   const recovered=await recoverTypedDataAddress({...intent.typedData,signature:signature.signature});
   const valid=recovered.toLowerCase()===roleAccount(signature.role).address.toLowerCase() && signature.signerId.toLowerCase()===recovered.toLowerCase();
   if(valid)verifiedSignatures++;return valid;
  },
  async simulateSignedCall(intent,signatures){
   await checkChain();simulations++;
   try{await publicClient.simulateContract({account:owner,address:guard,abi:artifacts.guard.abi,functionName:'execute',args:[intent.typedData.message,...signaturesArgs(signatures)]});return {success:true};}
   catch{return {success:false,reason:'ACTUAL_LOCAL_ETH_CALL_REVERTED'};}
  },
  async broadcastLocal(intent,signatures){
   await checkChain();
   const row=(await poolDb.query('SELECT status FROM hsk_jobs WHERE payload->>\'id\'=$1',[intent.id])).rows[0];
   assert.equal(row?.status,'UNKNOWN','Actual local send must follow durable write-ahead quarantine');
   sendCalls++;
   const txHash=await wallet.writeContract({address:guard,abi:artifacts.guard.abi,functionName:'execute',args:[intent.typedData.message,...signaturesArgs(signatures)]});
   const tx=await publicClient.getTransaction({hash:txHash});
   assert.equal(tx.from.toLowerCase(),owner.toLowerCase());
   return {txHash,sender:tx.from,txNonce:String(tx.nonce)};
  }
 };
 const dependencies={readContext,quote:async(direction,amount)=>direction==='BUY'?amount*10n**12n:amount/10n**12n,
  model:{provider:'SYNTHETIC_LOCAL_FIXTURE',model:'deterministic-selection-no-external-ai',async select({snapshot,candidate}){return {action:'REBALANCE',candidateId:candidate.id,sizeFractionBps:10000,reasonCode:'REBALANCE_TARGET',reasonSummary:'Explicit deterministic local integration fixture, not an external AI invocation.',inputSnapshotHash:snapshot.hash,strategyPolicyHash:snapshot.policyHash};}},
  store:coordinatorStore,execution,
  async buildIntent(candidate,context,minOutRaw){
   const message={sessionId:context.sessionId,policyVersion:context.policy.version,strategyPolicyHash:context.strategyPolicyHash,intentNonce:context.intentNonce,direction:candidate.direction==='BUY'?0:1,amountInRaw:candidate.amountInRaw,referenceAmountOutRaw:candidate.referenceAmountOutRaw,amountOutMinimumRaw:minOutRaw,quoteObservedAt:String(context.snapshot.observedAt),quoteBlockNumber:context.blockNumber,quoteBlockHash:context.canonicalBlockHash,deadline:String(context.snapshot.observedAt+30),evidenceHash:keccak256(stringToHex(`synthetic-local-commitment:${candidate.id}`))};
   const typedData={domain:{name:typeConfig.domainName,version:typeConfig.domainVersion,chainId:31337,verifyingContract:guard},types:typeConfig.types,primaryType:typeConfig.primaryType,message};
   const digest=hashTypedData(typedData);assert.equal(await read(guard,artifacts.guard,'hashIntent',[message]),digest);
   const intent={id:digest,nonce:context.intentNonce,policyVersion:context.policy.version,deadline:Number(message.deadline),typedData};
   if(!builtIntent)builtIntent=intent;return intent;
  }
 };
 const beforeQuote=await read(quote,artifacts.token,'balanceOf',[guard]);
 const beforeRisk=await read(risk,artifacts.token,'balanceOf',[guard]);
 const coordinator=new LocalCoordinator(dependencies);
 const submitted=await coordinator.run();assert.equal(submitted.status,'SUBMITTED',JSON.stringify(submitted));
 assert.equal(signCalls,2);assert.equal(sendCalls,1);assert.equal(verifiedSignatures,2);assert.equal(simulations,1);
 const firstJob=(await poolDb.query('SELECT * FROM hsk_jobs')).rows[0];assert.equal(firstJob.status,'SUBMITTED');
 const dbTx=(await poolDb.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1',[firstJob.id])).rows[0];
 assert.equal(dbTx.tx_hash,submitted.txHash);assert.notEqual(String(dbTx.tx_nonce),builtIntent.nonce,'EOA transaction nonce must not be confused with intent nonce');
 const actualReceipt=await receipt(submitted.txHash,'coordinator actual local buy');
 assert.equal(beforeQuote-await read(quote,artifacts.token,'balanceOf',[guard]),10_000_000n);
 assert.equal(await read(risk,artifacts.token,'balanceOf',[guard])-beforeRisk,10n*10n**18n);
 assert.equal(await read(quote,artifacts.token,'allowance',[guard,router]),0n);
 const event=actualReceipt.logs.filter(l=>l.address.toLowerCase()===guard.toLowerCase()).map(l=>decodeEventLog({abi:artifacts.guard.abi,data:l.data,topics:l.topics})).find(e=>e.eventName==='TradeExecuted');
 assert.equal(event.args.intentHash,builtIntent.id);assert.equal(event.args.amountInRaw,10_000_000n);
 evidence.checks.push({check:'actual strategy-risk coordinator with durable pre-sign barrier, cryptographic role recovery, signed eth_call, local transaction and exact deltas',status:'PASS',intentId:builtIntent.id,jobId:firstJob.id,transactionHash:submitted.txHash,intentNonce:builtIntent.nonce,eoaNonce:String(dbTx.tx_nonce),sender:dbTx.sender});
 // New pool, store and coordinator model a process restart. Pending DB job must block any new signing/send.
 restartedPool=new Pool({connectionString,options:`-c search_path=${schema}`});
 const restartedJobs=new PgJobStore(restartedPool);
 const restartedStore=new PgLocalCoordinatorStore(restartedJobs,{chainId:'31337',account:guard,worker:'durable-local-restarted',leaseMs:10000});
 const restarted=new LocalCoordinator({...dependencies,store:restartedStore});
 const afterRestart=await restarted.run();assert.equal(afterRestart.status,'BLOCKED',JSON.stringify(afterRestart));assert.equal(afterRestart.reason,'UNRESOLVED_INTENT_OR_LOCK');
 assert.equal(signCalls,2);assert.equal(sendCalls,1);
 // Use real DB clock/lease expiry, not mutation of persisted fencing metadata.
 const waitSeconds=Number((await restartedPool.query('SELECT greatest(0,extract(epoch FROM (lease_until-clock_timestamp()))) AS wait FROM hsk_jobs WHERE id=$1',[firstJob.id])).rows[0].wait);
 if(waitSeconds>0)await new Promise(r=>setTimeout(r,Math.ceil(waitSeconds*1000)+50));
 const reservation=await restartedStore.claimForReconciliation(firstJob.id);assert(reservation,'Restart must claim only after real lease expiry');
 const tx=await publicClient.getTransaction({hash:submitted.txHash});
 const canonical=await publicClient.getBlock({blockNumber:actualReceipt.blockNumber});
 const latest=await publicClient.getBlock();
 const recoveryIntent={id:builtIntent.id,nonce:builtIntent.nonce,policyVersion:builtIntent.policyVersion,deadline:builtIntent.deadline,state:'SUBMITTED',txHash:submitted.txHash,blockHash:null,replacementHash:null};
 const observation={now:Number(latest.timestamp),nonce:String(await read(guard,artifacts.guard,'intentNonce')),policyVersion:String(await read(guard,artifacts.guard,'policyVersion')),canonicalBlockHash:canonical.hash,receipt:{success:actualReceipt.status==='success',blockHash:actualReceipt.blockHash,blockNumber:String(actualReceipt.blockNumber),txHash:submitted.txHash,sender:tx.from,txNonce:String(tx.nonce),confirmations:Number(latest.number-actualReceipt.blockNumber+1n)}};
 const reconciled=await restarted.reconcileExisting(reservation,recoveryIntent,observation,1);
 assert.equal(reconciled.intent.state,'CONFIRMED');assert.equal((await restartedJobs.get(firstJob.id)).status,'CONFIRMED');
 assert.equal(await restartedStore.reserve(builtIntent),null,'Consumed old intent cannot be claimed again');
 assert.equal(sendCalls,1);assert.equal(signCalls,2);assert.equal(await read(guard,artifacts.guard,'intentNonce'),1n);
 assert.equal((await restartedPool.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1',[firstJob.id])).rowCount,1);
 const receipts=(await restartedPool.query('SELECT * FROM hsk_job_transactions WHERE job_id=$1 AND canonical=true',[firstJob.id])).rows;
 assert.equal(receipts.length,1);assert.equal(receipts[0].block_hash,actualReceipt.blockHash);
 const audit=(await restartedPool.query('SELECT event,detail,created_at FROM hsk_job_audit WHERE job_id=$1 ORDER BY id',[firstJob.id])).rows;
 evidence.checks.push({check:'new coordinator/PG pool blocks duplicate before reconciliation and confirms canonical RPC receipt under new fence',status:'PASS',restartResult:afterRestart,finalState:reconciled.intent.state,signCalls,verifiedSignatures,simulations,sendCalls,receipts,audit});
 evidence.status='PASS';evidence.finishedAt=new Date().toISOString();evidence.intent=builtIntent;evidence.receiptObservation=observation;
 // Export only after successful execution consumed the nonce; no active signatures or private keys.
 evidence.consumedRoleSignatures=consumedRoleSignatures;
 evidence.costDisclosure={preTradeEstimate:{quoteRaw:'0',source:'SYNTHETIC'},actualLocalGasUsed:actualReceipt.gasUsed.toString(),effectiveGasPrice:actualReceipt.effectiveGasPrice.toString(),actualLocalNativeFeeWei:(actualReceipt.gasUsed*actualReceipt.effectiveGasPrice).toString(),quoteCostConversion:null,note:'Synthetic estimate is not observed zero cost; USDT conversion unknown.'};
 evidence.limitations.push('Configured sourceChainId177 is coordinator project metadata only; this fixture reads no mainnet market data. All snapshot/quote/token/router data are synthetic Anvil31337.','One confirmation is a local-test setting, not a production finality policy.','Schema is dropped after exporting evidence; this is a local integration test, not a hosted durable service.');
 writeFileSync(`${evidenceDir}/integration.json`,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
 console.log(`PASS LOCAL31337 + actual PostgreSQL + LocalCoordinator: 1 signed buy, durable SIGNING/SUBMITTED/CONFIRMED, restart blocked duplicates. ${schema}`);
} catch(error){
 evidence.status='FAIL';evidence.finishedAt=new Date().toISOString();evidence.error=error instanceof Error?error.message:String(error);
 writeFileSync(`${evidenceDir}/integration-failure.json`,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');throw error;
} finally {
 await restartedPool?.end();await poolDb?.end();
 if(admin){if(schemaCreated)await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();}
 if(anvil.exitCode===null){const stopped=new Promise(r=>anvil.once('exit',r));anvil.kill('SIGTERM');await stopped;}
}
