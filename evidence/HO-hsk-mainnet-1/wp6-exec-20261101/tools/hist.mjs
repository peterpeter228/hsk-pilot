import {createPublicClient,http,decodeEventLog,parseAbi} from 'viem';import fs from 'node:fs';
const gAbi=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/contracts/abi/TradingSessionGuard.json'));
const erc=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)','event Deposit(address indexed dst,uint256 wad)']);
const G='0xe2172A17223BDa552e0CC101591C8893c4B65c81';const out={};
for(const u of ['https://mainnet.hsk.xyz','https://hashkey.drpc.org']){const c=createPublicClient({transport:http(u)});const o=out[u]={};
 for(const [k,h] of [['startSession','0x37fc6e0ef21b62cd627e71f3ad87352aed6c066a2d93a77527262665d0136e5b'],['withdrawAll','0xab6c4ccb0eded1992c6c8119d20ca843cc38783b83029a1e0530e86e6d1ed51f']]){
  const r=await c.getTransactionReceipt({hash:h});o[k+'.events']=r.logs.map(l=>{for(const a of [gAbi,erc]){try{const d=decodeEventLog({abi:a,data:l.data,topics:l.topics});return {addr:l.address,ev:d.eventName,args:JSON.parse(JSON.stringify(d.args,(x,v)=>typeof v==='bigint'?v.toString():v))}}catch{}}return {addr:l.address,raw:l.topics[0]}});}
 const rd=(fn,bn)=>c.readContract({address:G,abi:gAbi,functionName:fn,blockNumber:bn});
 for(const bn of [29584248n,29584249n]){o['stateAtBlock'+bn]={status:await rd('status',bn),sessionId:(await rd('sessionId',bn)).toString(),policyVersion:await rd('policyVersion',bn),allocatedRiskRaw:(await rd('allocatedRiskRaw',bn)).toString(),signers:(p=>[p[3],p[4]])(await rd('policy',bn))};}
}
console.log(JSON.stringify(out,null,1));
