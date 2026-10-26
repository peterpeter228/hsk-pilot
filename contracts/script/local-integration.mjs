/** Local-only SIMULATION. Spawns its own ephemeral Anvil, refuses every non-31337 chain.
 * No RPC/key env variables accepted, no production broadcast/deploy path. */
import {tsImport} from 'tsx/esm/api';
import {resolveFoundry} from './native-tool.mjs';
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createPublicClient, createWalletClient, http, defineChain, hashTypedData, keccak256, stringToHex, decodeEventLog} from 'viem';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';
const {buildCandidate,assessRisk,validateModelChoice}=await tsImport('../../packages/strategy/src/index.ts',import.meta.url);
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
const evidence={schemaVersion:'hsk-local-integration/1',sourceDataMode:'SIMULATION',executionDataMode:'SIMULATION',executionKind:'LOCAL_TX',chainId:31337,startedAt,status:'RUNNING',transactions:[],checks:[],limitations:['Synthetic tokens and router, not HSKSwap integration or mainnet performance.','Ephemeral local chain transaction hashes are not mainnet explorer evidence.','Role keys are different but execute in one test process; no independent trust domains.']};
let ready=false;
try {
 for(let n=0;n<100;n++) {if(anvil.exitCode!==null)throw new Error(`Anvil stopped: ${startupError}`);try {ready=await publicClient.getChainId()===31337;if(ready)break;}catch{} await new Promise(r=>setTimeout(r,50));}
 assert(ready,'Own ephemeral Anvil did not become ready');
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
 const createIntent=async(direction,amountInRaw,out)=>{const block=await publicClient.getBlock();return {sessionId:await read(guard,artifacts.guard,'sessionId'),policyVersion:await read(guard,artifacts.guard,'policyVersion'),strategyPolicyHash:policy.strategyPolicyHash,intentNonce:await read(guard,artifacts.guard,'intentNonce'),direction,amountInRaw,referenceAmountOutRaw:out,amountOutMinimumRaw:out,quoteObservedAt:block.timestamp,quoteBlockNumber:block.number,quoteBlockHash:block.hash,deadline:block.timestamp+30n,evidenceHash:keccak256(stringToHex(`synthetic-local-${direction}-${block.number}`))};};
 const sign=async(message)=>{const typed={domain:{name:typeConfig.domainName,version:typeConfig.domainVersion,chainId:31337,verifyingContract:guard},types:typeConfig.types,primaryType:typeConfig.primaryType,message};return {typed,digest:hashTypedData(typed),a:await strategy.signTypedData(typed),b:await riskSigner.signTypedData(typed)};};
 const execute=async(direction,input,out)=>{
  await write(router,artifacts.router,'configure',[out,0n,false]);
  const block=await publicClient.getBlock();
  const currentStatus=await read(guard,artifacts.guard,'status');
  const strategyPolicy={targetRiskWeightBps:5000,rebalanceBandBps:500,stopDrawdownBps:500,minimumTradeQuoteRaw:'1',maxExecutionCostQuoteRaw:'100000',riskEnabled:true};
  const offchainPolicy={...policy,mode:'BOUNDED_EXECUTION',status:['PAUSED','ACTIVE','REDUCE_ONLY','EXPIRED'][currentStatus],version:String(await read(guard,artifacts.guard,'policyVersion'))};
  for(const key of ['maxBuyPerTradeQuoteRaw','maxSessionGrossBuyQuoteRaw','maxUtcDayGrossBuyQuoteRaw','maxRiskInventoryRaw','maxSellPerTradeRiskRaw','exitMaxPerTradeRiskRaw'])offchainPolicy[key]=String(policy[key]);
  for(const key of ['validAfter','validUntil','exitValidUntil'])offchainPolicy[key]=Number(policy[key]);
  const snapshot={hash:keccak256(stringToHex(`synthetic-${block.number}`)),policyHash:policy.strategyPolicyHash,now:Number(block.timestamp),observedAt:Number(block.timestamp),quoteBalanceRaw:String(await read(guard,artifacts.guard,'allocatedQuoteRaw')),riskBalanceRaw:String(await read(guard,artifacts.guard,'allocatedRiskRaw')),indicativeRiskValueQuoteRaw:direction===0?'0':out.toString(),sessionGrossBuyRaw:String(await read(guard,artifacts.guard,'sessionGrossBuyQuoteRaw')),dayGrossBuyRaw:String(await read(guard,artifacts.guard,'utcDayGrossBuyQuoteRaw',[block.timestamp/86400n])),lastTradeAt:Number(await read(guard,artifacts.guard,'lastTradeAt')),lastExitAt:Number(await read(guard,artifacts.guard,'lastExitAt'))};
  // Fixed synthetic quote curve, never described as a live DEX or independent fair price.
  const syntheticQuote=async(_direction,amount)=>amount*out/input;
  const candidate=await buildCandidate(snapshot,offchainPolicy,strategyPolicy,syntheticQuote,currentStatus===2);
  assert(candidate,'Strategy produced no legal candidate');assert.equal(candidate.amountInRaw,input.toString());
  const fixtureChoice=validateModelChoice({action:'REBALANCE',candidateId:candidate.id,sizeFractionBps:10000,reasonCode:currentStatus===2?'RISK_REDUCTION':'REBALANCE_TARGET',reasonSummary:'Synthetic deterministic local-test selection; no LLM invocation.',inputSnapshotHash:snapshot.hash,strategyPolicyHash:snapshot.policyHash},candidate,snapshot);
  const riskDecision=await assessRisk(candidate,snapshot,offchainPolicy,strategyPolicy,syntheticQuote);
  assert.equal(riskDecision.allowed,true);
  const message=await createIntent(direction,BigInt(candidate.amountInRaw),BigInt(candidate.referenceAmountOutRaw));message.amountOutMinimumRaw=BigInt(riskDecision.minOutRaw);
  const signed=await sign(message);
  evidence.checks.push({check:'buildCandidate -> validated synthetic choice -> assessRisk -> typed intent',status:'PASS',candidate,fixtureChoice,riskDecision,modelInvocation:'NONE_SYNTHETIC_SELECTION'});
  assert.equal(await read(guard,artifacts.guard,'hashIntent',[message]),signed.digest);
  const beforeQ=await read(quote,artifacts.token,'balanceOf',[guard]),beforeR=await read(risk,artifacts.token,'balanceOf',[guard]);
  const r=await write(guard,artifacts.guard,'execute',[message,signed.a,signed.b]);
  const afterQ=await read(quote,artifacts.token,'balanceOf',[guard]),afterR=await read(risk,artifacts.token,'balanceOf',[guard]);
  assert.equal(direction===0?beforeQ-afterQ:beforeR-afterR,input);assert.equal(direction===0?afterR-beforeR:afterQ-beforeQ,out);
  assert.equal(await read(direction===0?quote:risk,artifacts.token,'allowance',[guard,router]),0n);
  const event=r.logs.filter(l=>l.address.toLowerCase()===guard.toLowerCase()).map(l=>decodeEventLog({abi:artifacts.guard.abi,data:l.data,topics:l.topics})).find(e=>e.eventName==='TradeExecuted');
  assert.equal(event.args.intentHash,signed.digest);assert.equal(event.args.actualOutRaw,out);
  evidence.checks.push({check:direction===0?'dual-signed buy':'dual-signed sell',status:'PASS',intent:message,intentHash:signed.digest,transactionHash:r.transactionHash,actualQuoteDelta:afterQ-beforeQ,actualRiskDelta:afterR-beforeR});
  // Already consumed signatures are safe to disclose in local test evidence.
  evidence.checks.at(-1).typedData=signed.typed;evidence.checks.at(-1).strategySignature=signed.a;evidence.checks.at(-1).riskSignature=signed.b;
  await assert.rejects(()=>publicClient.simulateContract({account:owner,address:guard,abi:artifacts.guard.abi,functionName:'execute',args:[message,signed.a,signed.b]}));
  evidence.checks.push({check:'consumed nonce replay rejected by full eth_call',status:'PASS',transactionHash:null});
  return signed;
 };
 await execute(0,10_000_000n,10n*10n**18n);
 const oldIntent=await createIntent(1,1n*10n**18n,1_000_000n),old=await sign(oldIntent);
 policy.maxSessionGrossBuyQuoteRaw=10_000_000n;await write(guard,artifacts.guard,'updatePolicy',[policy]);
 await assert.rejects(()=>publicClient.simulateContract({account:owner,address:guard,abi:artifacts.guard.abi,functionName:'execute',args:[oldIntent,old.a,old.b]}));
 assert.equal(await read(guard,artifacts.guard,'sessionGrossBuyQuoteRaw'),10_000_000n);
 evidence.checks.push({check:'same-session policy tightening preserves gross spend and invalidates old signature',status:'PASS',transactionHash:null});
 await write(guard,artifacts.guard,'enterReduceOnly',[keccak256(stringToHex('local stop')),keccak256(stringToHex('local evidence'))]);
 await write(router,artifacts.router,'configure',[0n,0n,false]);
 const failure=await createIntent(1,10n*10n**18n,9_000_000n),failureSig=await sign(failure);
 await assert.rejects(()=>publicClient.simulateContract({account:owner,address:guard,abi:artifacts.guard.abi,functionName:'execute',args:[failure,failureSig.a,failureSig.b]}));
 assert.equal(await read(guard,artifacts.guard,'status'),2);
 evidence.checks.push({check:'separately mined REDUCE_ONLY survives failed sell simulation',status:'PASS',transactionHash:null});
 await execute(1,10n*10n**18n,9_000_000n);
 assert.equal(await read(guard,artifacts.guard,'sessionGrossBuyQuoteRaw'),10_000_000n);
 await write(guard,artifacts.guard,'pause');await write(guard,artifacts.guard,'withdrawAll');
 assert.equal(await read(quote,artifacts.token,'balanceOf',[owner]),99_000_000n);assert.equal(await read(quote,artifacts.token,'balanceOf',[guard]),0n);
 evidence.checks.push({check:'owner pause and withdrawal return synthetic capital, no oracle dependencies',status:'PASS'});
 evidence.status='PASS';evidence.finishedAt=new Date().toISOString();
 writeFileSync(`${contractRoot}evidence/local-integration.json`,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
 console.log(`PASS LOCAL_TX SIMULATION: ${evidence.transactions.length} local receipts; ${evidence.checks.length} checks. Evidence contracts/evidence/local-integration.json`);
} finally {
 if(anvil.exitCode===null){const stopped=new Promise(r=>anvil.once('exit',r));anvil.kill('SIGTERM');await stopped;}
}
