import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chainPreflight,type ChainRegistry} from '../packages/chain/src/index.js';
const registry=JSON.parse(await readFile(new URL('../config/chain-candidates.json',import.meta.url),'utf8')) as ChainRegistry;
let report:unknown;try{report=await chainPreflight(registry);if((report as {status:string}).status==='BLOCKED')process.exitCode=1;}catch(error){report={status:'BLOCKED',dataMode:'MAINNET_READONLY',observedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error),liveFundsEnabled:false};process.exitCode=1;}
const text=JSON.stringify(report,(_,value)=>typeof value==='bigint'?value.toString():value,2);const dir=new URL('../evidence/preflight/',import.meta.url);await mkdir(dir,{recursive:true});const name=`${new Date().toISOString().replace(/[:.]/g,'-')}.json`;await writeFile(new URL(name,dir),text);console.log(text);
