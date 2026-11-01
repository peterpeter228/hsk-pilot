import {createPublicClient,http,parseAbi,keccak256} from 'viem';
import fs from 'node:fs';
const [OUT,LABEL,...urls]=process.argv.slice(2);
const RPCS=urls.length?urls:['https://mainnet.hsk.xyz','https://hashkey.drpc.org'];
const A={guard:'0xe2172A17223BDa552e0CC101591C8893c4B65c81',test:'0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E',payout:'0x54145b97d5CeCf72b9900C702a02774171574171',
S:'0x96c06E98CE98F342aF2E2c7a030cFf15cBC8eC69',R:'0x92501bA2F20422184b22D176F78f40B1AbB32FED',
WHSK:'0xB210D2120d57b758EE163cFfb43e73728c471Cf1',USDT:'0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029',router:'0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3',quoter:'0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD'};
const gAbi=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/contracts/abi/TradingSessionGuard.json'));
const erc=parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)']);
const qAbi=parseAbi(['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)']);
const ser=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?v.toString():v));
const res={schema:'hsk-wp6-exec-state/1',label:LABEL,observedAt:new Date().toISOString(),addresses:A,rpcs:{}};
for(const url of RPCS){
 const c=createPublicClient({transport:http(url,{timeout:20000,retryCount:2})});const r={};res.rpcs[url]=r;
 const t=async(k,f)=>{try{r[k]=ser(await f())}catch(e){r[k]={error:(e.shortMessage||e.message).slice(0,300)}}};
 await t('chainId',()=>c.getChainId());
 const b=await c.getBlock();const bn=b.number;r.block={number:bn.toString(),hash:b.hash,timestamp:b.timestamp.toString(),baseFeePerGas:b.baseFeePerGas?.toString()};
 await t('gasPrice',()=>c.getGasPrice());
 await t('maxPriorityFeePerGas',async()=>BigInt(await c.request({method:'eth_maxPriorityFeePerGas'})));
 await t('guard.codeKeccak',async()=>keccak256(await c.getCode({address:A.guard,blockNumber:bn})));
 for(const fn of ['owner','pendingOwner','status','sessionId','policyVersion','intentNonce','allocatedQuoteRaw','allocatedRiskRaw'])
  await t('guard.'+fn,()=>c.readContract({address:A.guard,abi:gAbi,functionName:fn,blockNumber:bn}));
 await t('guard.policy.signers',async()=>{const p=await c.readContract({address:A.guard,abi:gAbi,functionName:'policy',blockNumber:bn});return {strategySigner:p[3],riskSigner:p[4],validUntil:p[2]}});
 for(const [n,a] of [['TEST',A.test],['Guard',A.guard],['PAYOUT',A.payout],['S',A.S],['R',A.R]]){
  await t(n+'.HSKWei',()=>c.getBalance({address:a,blockNumber:bn}));
  for(const tk of ['WHSK','USDT']) await t(`${n}.${tk}`,()=>c.readContract({address:A[tk],abi:erc,functionName:'balanceOf',args:[a],blockNumber:bn}));
 }
 await t('TEST.nonce.latest',()=>c.getTransactionCount({address:A.test,blockTag:'latest'}));
 await t('TEST.nonce.pending',()=>c.getTransactionCount({address:A.test,blockTag:'pending'}));
 await t('S.nonce',()=>c.getTransactionCount({address:A.S}));await t('R.nonce',()=>c.getTransactionCount({address:A.R}));
 for(const tk of ['WHSK','USDT']) for(const [o,s] of [['Guard','router',],['TEST','router'],['TEST','Guard']]){}
 const pairs=[['Guard',A.guard,'router',A.router],['TEST',A.test,'router',A.router],['TEST',A.test,'Guard',A.guard]];
 for(const tk of ['WHSK','USDT']) for(const [on,o,sn,s] of pairs) await t(`allowance.${tk}.${on}->${sn}`,()=>c.readContract({address:A[tk],abi:erc,functionName:'allowance',args:[o,s],blockNumber:bn}));
 await t('quote.SELL_1WHSK_USDTraw',async()=>(await c.simulateContract({address:A.quoter,abi:qAbi,functionName:'quoteExactInputSingle',args:[{tokenIn:A.WHSK,tokenOut:A.USDT,amountIn:10n**18n,fee:3000,sqrtPriceLimitX96:0n}],blockNumber:bn})).result[0]);
}
fs.writeFileSync(OUT,JSON.stringify(res,null,1));
for(const [u,r] of Object.entries(res.rpcs)){console.log(u,JSON.stringify({chain:r.chainId,blk:r.block.number,base:r.block.baseFeePerGas,gp:r.gasPrice,tip:r.maxPriorityFeePerGas,nonce:[r['TEST.nonce.latest'],r['TEST.nonce.pending']],TEST:[r['TEST.HSKWei'],r['TEST.WHSK'],r['TEST.USDT']],G:[r['Guard.HSKWei'],r['Guard.WHSK'],r['Guard.USDT']],st:r['guard.status'],own:r['guard.owner'],pend:r['guard.pendingOwner'],sid:r['guard.sessionId'],pv:r['guard.policyVersion'],alloc:[r['guard.allocatedQuoteRaw'],r['guard.allocatedRiskRaw']],code:r['guard.codeKeccak'],q:r['quote.SELL_1WHSK_USDTraw'],allow:Object.entries(r).filter(([k])=>k.startsWith('allowance')).map(([k,v])=>v).join(','),SR:[r['S.HSKWei'],r['R.HSKWei'],r['S.nonce'],r['R.nonce']]})) }
