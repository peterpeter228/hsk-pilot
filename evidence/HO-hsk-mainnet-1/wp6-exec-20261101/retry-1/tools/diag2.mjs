import {createPublicClient,http} from 'viem'; import fs from 'node:fs';
const out={readAt:new Date().toISOString(),rpcs:{}};
const H=['0x9137e48068f4733776f2c6642c600b50dbeb7dec4673972b87776d3bbd62992f','0xcc869f0bfa13b1294c4f47e835577fa0215e99ac1e4a70a638cc8b989598ef8d'];
for(const u of ['https://mainnet.hsk.xyz','https://hashkey.drpc.org']){const c=createPublicClient({transport:http(u)});const o={};
 for(const h of H){const r=await c.request({method:'eth_getTransactionReceipt',params:[h]});const b=await c.request({method:'eth_getBlockByNumber',params:[r.blockNumber,false]});
  o[h]={blockNumber:parseInt(r.blockNumber),receiptBlockHash:r.blockHash,canonicalBlockHash:b.hash,match:r.blockHash===b.hash,status:r.status,gasUsed:parseInt(r.gasUsed),txInBlock:b.transactions.includes(h)};}
 for(const n of [29584942n]){const b=await c.request({method:'eth_getBlockByNumber',params:['0x'+n.toString(16),false]});o['block'+n]={hash:b.hash,parent:b.parentHash,txs:b.transactions};}
 out.rpcs[u]=o;}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));console.log(JSON.stringify(out,null,1));
