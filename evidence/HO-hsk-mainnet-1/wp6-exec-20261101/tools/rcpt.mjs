import {createPublicClient,http} from 'viem';
const H=process.argv.slice(2);const out={};
for(const u of ['https://mainnet.hsk.xyz','https://hashkey.drpc.org']){const c=createPublicClient({transport:http(u)});out[u]={};
 for(const h of H){const r=await c.request({method:'eth_getTransactionReceipt',params:[h]});const b=await c.getBlock({blockNumber:BigInt(r.blockNumber)});out[u][h]={block:BigInt(r.blockNumber).toString(),rBlockHash:r.blockHash,canonicalHash:b.hash,status:r.status,gasUsed:BigInt(r.gasUsed).toString(),l1Fee:r.l1Fee}}
 const fin=await c.request({method:'eth_getBlockByNumber',params:['finalized',false]}).catch(e=>null);const safe=await c.request({method:'eth_getBlockByNumber',params:['safe',false]}).catch(e=>null);
 out[u].finalized=fin?BigInt(fin.number).toString():null;out[u].safe=safe?BigInt(safe.number).toString():null;}
console.log(JSON.stringify(out,null,1));
