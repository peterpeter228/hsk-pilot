import {createApp} from './app.js';
const port=Number(process.env.PORT??3100);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_PORT');
const app=createApp({origin:process.env.APP_BASE_URL??`http://localhost:${port}`,buildSha:process.env.BUILD_SHA});
await app.listen({host:process.env.HOST??'127.0.0.1',port});
console.log(`HSK Pilot SIMULATION only on port ${port}; no live broadcaster`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void app.close().then(()=>process.exit(0)));
