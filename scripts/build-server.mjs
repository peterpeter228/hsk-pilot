import {build} from 'esbuild';
await build({entryPoints:['apps/server/main.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'dist/server/main.js'});
