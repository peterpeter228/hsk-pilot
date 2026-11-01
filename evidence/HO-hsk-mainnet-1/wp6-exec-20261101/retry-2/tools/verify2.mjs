// read-only post-hoc verification for retry-2 (receipts, TradeExecuted decode, pinned state by block number on both RPCs)
import {createPublicClient,http,parseAbi,decodeEventLog} from 'viem'; import fs from 'node:fs';
const gAbi=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/contracts/abi/TradingSessionGuard.json'));
const erc=parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)']);
const G='0xe2172A17223BDa552e0CC101591C8893c4B65c81',T='0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E',W='0xB210D2120d57b758EE163cFfb43e73728c471Cf1',U='0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029',RT='0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3';
const H={transfer:'0xa1eb1e04de5f6de5c499790d9a8fbdcf33359b8d742ff91f4f8b9e8f64aa9d70',startSession:'0x66cb96b60500ae3f0562de566cd81f651b94ad2425e71cbdb3b4e7b6058fed49',execute:'0xf2b703477d4bdfa543156246176f2cf0bd0a6e99858d57f719cefe83741fd1b1',withdrawAll:'0x66068151d1df06a3f96243c024a01fb1fcb14bba9f6ed2caf9cb75e50bc0935a'};
const ser=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='bigint'?v.toString():v));
const out={readAt:new Date().toISOString(),rpcs:{}};
for(const u of ['https://mainnet.hsk.xyz','https://hashkey.drpc.org']){const c=createPublicClient({transport:http(u)});const o={receipts:{},state:{}};
 for(const [k,h] of Object.entries(H)){const r=await c.request({method:'eth_getTransactionReceipt',params:[h]});const b=await c.getBlock({blockNumber:BigInt(r.blockNumber)});
  const ev=[];for(const lg of r.logs){if(lg.address.toLowerCase()!==G.toLowerCase())continue;try{const d=decodeEventLog({abi:gAbi,data:lg.data,topics:lg.topics});ev.push({event:d.eventName,args:d.args});}catch{}}
  o.receipts[k]={hash:h,block:parseInt(r.blockNumber),blockTimestamp:b.timestamp,canonicalHash:b.hash,txInBlock:b.transactions.includes(h),status:r.status,gasUsed:parseInt(r.gasUsed),effectiveGasPrice:BigInt(r.effectiveGasPrice),l1Fee:r.l1Fee?BigInt(r.l1Fee):0n,feeWei:BigInt(r.gasUsed)*BigInt(r.effectiveGasPrice)+(r.l1Fee?BigInt(r.l1Fee):0n),guardEvents:ev};}
 for(const bn of [o.receipts.execute.block,o.receipts.withdrawAll.block]){const B=BigInt(bn);const r=(a,f,x)=>c.readContract({address:a,abi:a===G?gAbi:erc,functionName:f,args:x,blockNumber:B});
  o.state[bn]={status:await r(G,'status'),sessionId:await r(G,'sessionId'),policyVersion:await r(G,'policyVersion'),intentNonce:await r(G,'intentNonce'),allocQ:await r(G,'allocatedQuoteRaw'),allocR:await r(G,'allocatedRiskRaw'),
   gWHSK:await r(W,'balanceOf',[G]),gUSDT:await r(U,'balanceOf',[G]),tHSK:await c.getBalance({address:T,blockNumber:B}),tWHSK:await r(W,'balanceOf',[T]),tUSDT:await r(U,'balanceOf',[T]),
   allow:[[W,G,RT],[U,G,RT],[W,T,RT],[U,T,RT],[W,T,G],[U,T,G]].map(([tk,o2,s])=>0)};
  o.state[bn].allow=[];for(const [tk,o2,s] of [[W,G,RT],[U,G,RT],[W,T,RT],[U,T,RT],[W,T,G],[U,T,G]]) o.state[bn].allow.push(await r(tk,'allowance',[o2,s]));}
 out.rpcs[u]=o;}
fs.writeFileSync(process.argv[2],JSON.stringify(ser(out),null,1));console.log(JSON.stringify(ser(out)));
