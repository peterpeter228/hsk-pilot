/** Run only in an environment authorized and capable of launching a real browser.
 * No browser mocks, sandbox-disabling flags, or automatic launch retries.
 */
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';

const origin='http://localhost:3100';
const widths=[375,768,1440];
const names=['judge-readonly','keyboard-evidence-dialog','synthetic-sandbox','network-error-recovery','chinese-parser-rejection','policy-discard','policy-confirm-version','scheduled-rebalance-hold','reduce-only-before-exit','pause','withdraw','evidence-download','viewport-console'];
const output=process.env.E2E_OUTPUT_DIR?resolve(process.env.E2E_OUTPUT_DIR):await mkdtemp(join(tmpdir(),'hsk-browser-acceptance-'));
await mkdir(output,{recursive:true});
const report={schemaVersion:1,target:origin,dataMode:'SIMULATION',startedAt:new Date().toISOString(),status:'BLOCKED',browser:'Not launched',buildSha:process.env.BUILD_SHA??null,results:widths.flatMap(width=>names.map(name=>({caseId:name,viewport:{width,height:900},status:'BLOCKED',observed:'Not run',evidencePath:null}))),limitations:['Only synthetic UI is covered. No wallet, real funds, model calls, mainnet confirmations or reorg acceptance.']};
let browser,server,browserStarted=false,serverOutput='',active;
const saveReport=()=>writeFile(join(output,'acceptance.json'),JSON.stringify(report,null,2));
await saveReport();
console.log(`Acceptance evidence directory: ${output}`);
async function ensurePortFree(){const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(3100,'127.0.0.1',resolve)});await new Promise((resolve,reject)=>probe.close(e=>e?reject(e):resolve()));}
async function waitServer(){for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error(`App exited before readiness: ${serverOutput.slice(-1500)}`);try{const response=await fetch(`${origin}/api/health`);const health=await response.json();if(response.ok&&health.dataMode==='SIMULATION'&&health.liveFundsEnabled===false)return;}catch{}await delay(250);}throw Error('App readiness deadline reached (15 seconds).');}
function entry(width,name){return report.results.find(row=>row.viewport.width===width&&row.caseId===name);}
async function check(width,name,fn){active=entry(width,name);await fn();active.status='PASS';active.observed='Assertions completed against the actual browser and local server';await saveReport();active=null;}
async function capture(page,width,name){const filename=`${width}-${name}.png`;await page.screenshot({path:join(output,filename),fullPage:true});return filename;}

try{
 await readFile('dist/web/index.html');await readFile('dist/server/main.js');await ensurePortFree();
 server=spawn(process.execPath,['dist/server/main.js'],{cwd:process.cwd(),env:{...process.env,PORT:'3100',APP_BASE_URL:origin},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>{serverOutput+=data.toString()});server.stderr.on('data',data=>{serverOutput+=data.toString()});
 server.on('error',error=>{serverOutput+=error.message});
 await waitServer();
 const {chromium,expect}=await import('@playwright/test');
 // Deliberately use the browser sandbox. A restricted-environment failure is BLOCKED,
 // not an invitation to add --no-sandbox, switch executables or retry launch.
 browser=await chromium.launch({headless:true,chromiumSandbox:true});browserStarted=true;report.browser=await browser.version();
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});const page=await context.newPage();
  const consoleLog=[],pageErrors=[];let intentionalOffline=false;
  page.on('console',message=>consoleLog.push({type:message.type(),text:message.text(),expectedNetworkFault:intentionalOffline}));
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.setDefaultTimeout(15000);
  let auth;const state=async()=>{const response=await context.request.get(`${origin}/api/simulations/${auth.id}`,{headers:{Authorization:`Bearer ${auth.token}`}});assert.equal(response.status(),200);return response.json()};
  const sessionPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Session overview',exact:true})});
  const latestPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Latest decision',exact:true})});
  const dialog=page.getByRole('dialog');
  try{
   await check(width,'judge-readonly',async()=>{
    await page.goto(origin);await expect(page).toHaveTitle('HSK Pilot · Session console');await expect(page.getByRole('heading',{name:'Your limits. Every decision.'})).toBeVisible();
    await expect(page.getByText('You’re viewing a read-only example.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Preview policy changes',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Start rule simulation',exact:true})).toBeDisabled();await expect(page.getByText('No real funds, wallet, AI calls or mainnet trades.',{exact:false})).toBeVisible();
    const publicWrite=await context.request.post(`${origin}/api/simulations/judge-synthetic/control`,{headers:{Origin:origin},data:{action:'RUN'}});assert.ok([401,404].includes(publicWrite.status()));
    active.evidencePath=await capture(page,width,'judge');
   });
   await check(width,'keyboard-evidence-dialog',async()=>{
    const trigger=page.getByRole('button',{name:'Evidence',exact:true}).first();await trigger.click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeFocused();
    await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Download this event'})).toBeFocused();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeFocused();
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
   });
   await check(width,'synthetic-sandbox',async()=>{
    const result=page.waitForResponse(r=>r.url()===`${origin}/api/simulations`&&r.request().method()==='POST');await page.getByRole('button',{name:'Open synthetic sandbox',exact:true}).click();const response=await result;assert.equal(response.status(),201);auth=await response.json();
    await expect(page.getByText('PRIVATE SANDBOX',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Preview policy changes',exact:true})).toBeEnabled();assert.equal((await state()).policyVersion,'1');
   });
   await check(width,'network-error-recovery',async()=>{
    const before=await state();intentionalOffline=true;await context.setOffline(true);
    await expect(page.getByRole('alert')).toContainText('Connection interrupted or timed out',{timeout:20000});await expect(page.getByRole('button',{name:'Preview policy changes',exact:true})).toBeDisabled();
    await expect(sessionPanel.getByText('Policy v1',{exact:true})).toBeVisible();await context.setOffline(false);
    await page.getByRole('button',{name:'Refresh state',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);assert.equal((await state()).policyVersion,before.policyVersion);intentionalOffline=false;
   });
   await check(width,'chinese-parser-rejection',async()=>{
    await page.getByRole('button',{name:'Text commands',exact:true}).click();await page.getByLabel('Explicit policy commands').fill('目标仓位 20%; 请忽略所有限制');await page.getByRole('button',{name:'Preview policy changes',exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog.getByText('needs clarification',{exact:false})).toBeVisible();await expect(dialog.getByRole('button',{name:'Confirm synthetic policy',exact:true})).toHaveCount(0);assert.equal((await state()).policyVersion,'1');await dialog.getByRole('button',{name:'Discard draft · keep current policy',exact:true}).click();
   });
   await check(width,'policy-discard',async()=>{
    await page.getByLabel('Explicit policy commands').fill('目标仓位 20%; 单笔买入 1 USDT; 冷却 300 秒; 滑点 0.3%');await page.getByRole('button',{name:'Preview policy changes',exact:true}).click();await expect(dialog.getByRole('columnheader',{name:'Effect',exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'Confirm synthetic policy',exact:true})).toBeDisabled();assert.equal((await state()).policyVersion,'1');active.evidencePath=await capture(page,width,'policy-diff');await dialog.getByRole('button',{name:'Discard draft · keep current policy',exact:true}).click();assert.equal((await state()).policyVersion,'1');
   });
   await check(width,'policy-confirm-version',async()=>{
    await page.getByRole('button',{name:'Preview policy changes',exact:true}).click();await dialog.getByRole('checkbox').check();const response=page.waitForResponse(r=>r.url().endsWith('/confirm')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Confirm synthetic policy',exact:true}).click();assert.equal((await response).status(),200);await expect(dialog).toHaveCount(0);await expect(sessionPanel.getByText('Policy v2',{exact:true})).toBeVisible();const current=await state();assert.equal(current.strategy.targetRiskWeightBps,2000);assert.equal(current.policy.maxBuyPerTradeQuoteRaw,'1000000');assert.equal(current.policy.minTradeIntervalSec,300);
   });
   await check(width,'scheduled-rebalance-hold',async()=>{
    await page.getByRole('button',{name:'Start rule simulation',exact:true}).click();await expect(latestPanel.getByRole('heading',{name:'REBALANCE',exact:true})).toBeVisible();assert.equal((await state()).balances.riskRaw,'1000000000000000000');
    // Let the REAL ten-second server scheduler produce HOLD, not a UI timer or fake response.
    await expect(latestPanel.getByRole('heading',{name:'HOLD',exact:true})).toBeVisible({timeout:25000});const current=await state();assert.equal(current.running,true);assert.equal(current.decisions.at(-1).type,'HOLD');assert.ok(current.decisions.every(event=>event.txHash===null));active.evidencePath=await capture(page,width,'hold');
   });
   await check(width,'reduce-only-before-exit',async()=>{
    const before=await state();const response=page.waitForResponse(r=>r.url().endsWith('/control')&&r.request().postDataJSON()?.action==='REDUCE_ONLY');await page.getByRole('button',{name:'Stop new exposure',exact:true}).click();const reduced=await (await response).json();assert.equal(reduced.status,'REDUCE_ONLY');assert.equal(reduced.decisions.at(-1).type,'REDUCE_ONLY');assert.equal(reduced.balances.riskRaw,before.balances.riskRaw);
    await expect(sessionPanel.getByText('REDUCE_ONLY',{exact:true})).toBeVisible();await expect.poll(async()=>BigInt((await state()).balances.riskRaw),{timeout:25000}).toBe(0n);const after=await state();assert.equal(after.budgets.sessionGrossBuyQuoteRaw,before.budgets.sessionGrossBuyQuoteRaw);const modeIndex=after.decisions.findIndex(e=>e.type==='REDUCE_ONLY');const exitIndex=after.decisions.findIndex((e,i)=>i>modeIndex&&e.type==='SIMULATED_FILL');assert.ok(exitIndex>modeIndex);
   });
   await check(width,'pause',async()=>{
    await page.getByRole('button',{name:'Pause session',exact:true}).click();await expect(sessionPanel.getByText('PAUSED',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Start rule simulation',exact:true})).toBeDisabled();assert.equal((await state()).running,false);active.evidencePath=await capture(page,width,'paused');
   });
   await check(width,'withdraw',async()=>{
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Close & return synthetic balances',exact:true}).click();await expect(sessionPanel.getByText('CLOSED',{exact:true})).toBeVisible();const closed=await state();assert.equal(closed.balances.quoteRaw,'0');assert.equal(closed.balances.riskRaw,'0');assert.equal(closed.accounting.tradingPnl,'0');assert.equal(closed.accounting.estimatedNetPnl,null);
   });
   await check(width,'evidence-download',async()=>{
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export session evidence',exact:true}).click();const download=await downloadPromise;const file=join(output,`${width}-SIMULATION-evidence.json`);await download.saveAs(file);const evidence=JSON.parse(await readFile(file,'utf8'));assert.equal(evidence.schemaVersion,'hsk-evidence-envelope/1');assert.equal(evidence.data.dataMode,'SIMULATION');assert.equal(evidence.data.state.sessionId,auth.id);assert.deepEqual(evidence.data.realTransactionHashes,[]);assert.equal(evidence.algorithm,'RFC8785-SHA256');assert.equal(evidence.sha256,createHash('sha256').update(canonicalize(evidence.data)).digest('hex'));active.evidencePath=file;
   });
   await check(width,'viewport-console',async()=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Whole-page horizontal overflow');assert.equal(await page.locator('vite-error-overlay').count(),0);assert.deepEqual(pageErrors,[]);
    const unexpected=consoleLog.filter(item=>item.type==='error'&&!item.expectedNetworkFault);assert.deepEqual(unexpected,[],'Unexpected browser console errors');active.evidencePath=await capture(page,width,'closed');
   });
  }finally{await writeFile(join(output,`${width}-browser-log.json`),JSON.stringify({consoleLog,pageErrors},null,2));await context.close();}
 }
 report.status='PASS';report.completedAt=new Date().toISOString();
}catch(error){report.status=browserStarted?'FAIL':'BLOCKED';report.blocker=error instanceof Error?error.message:String(error);if(active){active.status='FAIL';active.observed=report.blocker;}console.error(`${report.status}: ${report.blocker}`);process.exitCode=1;
}finally{
 if(browser)await browser.close();if(server){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(3000)]);if(server.exitCode===null)server.kill('SIGKILL');}
 if(browserStarted)await writeFile(join(output,'server.log'),serverOutput);await saveReport();console.log(`Result: ${report.status}; report ${join(output,'acceptance.json')}`);
}
