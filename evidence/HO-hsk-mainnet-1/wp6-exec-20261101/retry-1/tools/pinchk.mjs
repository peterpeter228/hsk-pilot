// read-only: guard/test state pinned at canonical withdrawAll block and transfer block on both RPCs
import {createPublicClient,http,parseAbi} from 'viem'; import fs from 'node:fs';
const gAbi=JSON.parse(fs.readFileSync('/workspace/hsk-pilot/contracts/abi/TradingSessionGuard.json'));
const erc=parseAbi(['function balanceOf(address) view returns (uint256)']);
const G='0xe2172A17223BDa552e0CC101591C8893c4B65c81',T='0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E',W='0xB210D2120d57b758EE163cFfb43e73728c471Cf1',U='0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029';
const out={};
for(const u of ['https://mainnet.hsk.xyz','https://hashkey.drpc.org']){const c=createPublicClient({transport:http(u)});out[u]={};
 for(const bn of [29584941n,29584942n,29584965n,29584966n]){const r=(a,f,x)=>c.readContract({address:a,abi:a===G?gAbi:erc,functionName:f,args:x,blockNumber:bn});
  out[u][bn]={hash:(await c.getBlock({blockNumber:bn})).hash,status:await r(G,'status'),sid:String(await r(G,'sessionId')),pv:await r(G,'policyVersion'),gWHSK:String(await r(W,'balanceOf',[G])),gUSDT:String(await r(U,'balanceOf',[G])),tWHSK:String(await r(W,'balanceOf',[T])),allocRisk:String(await r(G,'allocatedRiskRaw'))};}}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));console.log(JSON.stringify(out));
