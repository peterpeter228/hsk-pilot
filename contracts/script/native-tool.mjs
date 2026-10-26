// Resolve the official pinned platform binary directly. Foundry npm 1.4.4's JS
// wrapper does not propagate child exit codes/signals; gate checks must not use it.
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
export function resolveFoundry(tool) {
 if(!['forge','anvil'].includes(tool))throw new Error('Unsupported local tool');
 const req=createRequire(realpathSync(new URL(`../../node_modules/@foundry-rs/${tool}/package.json`,import.meta.url)));
 const platform=process.platform==='win32'?'win32':process.platform;
 const arch=process.arch==='x64'?'amd64':process.arch;
 return req.resolve(`@foundry-rs/${tool}-${platform}-${arch}/bin/${tool}${platform==='win32'?'.exe':''}`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) console.log(resolveFoundry(process.argv[2]));
