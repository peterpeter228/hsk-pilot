import {createApp} from './app.js';
import {createDecisionEngine} from './ai-decision.js';
import {createStructuredModelAdapter} from '../../packages/strategy/src/model-adapter.js';
import type {ModelAdapter} from '../../packages/strategy/src/index.js';
const provider='sub2api',model=process.env.HSK_AI_MODEL??'gpt-6-luna';
let adapter:ModelAdapter|null=null;
try{if(process.env.S2A_BASE_URL&&process.env.S2A_API_KEY)adapter=createStructuredModelAdapter({endpoint:new URL('/v1/chat/completions',process.env.S2A_BASE_URL).toString(),allowedOrigin:new URL(process.env.S2A_BASE_URL).origin,apiKey:process.env.S2A_API_KEY,provider,model});}catch{adapter=null;}finally{delete process.env.S2A_API_KEY;}
const decision=createDecisionEngine({adapter,provider,model:adapter?model:null,timeoutMs:Number(process.env.HSK_AI_TIMEOUT_MS??15000)});
const port=Number(process.env.PORT??3100);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_PORT');
const app=createApp({origin:process.env.APP_BASE_URL??`http://localhost:${port}`,buildSha:process.env.BUILD_SHA,decision});
await app.listen({host:process.env.HOST??'127.0.0.1',port});
console.log(`HSK Pilot SIMULATION only; no live broadcaster; provider ${provider}; model ${adapter?model:'NOT_CONFIGURED'}`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void app.close().then(()=>process.exit(0)));
