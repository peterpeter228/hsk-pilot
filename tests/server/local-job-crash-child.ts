// Spawned only by local-job-adapter.test.ts. Deliberately exits without finally at crash boundaries.
import { Pool } from 'pg';
import { LocalCoordinator } from '../../apps/worker/src/coordinator.js';
import { PgJobStore } from '../../apps/server/job-store.js';
import { PgLocalCoordinatorStore } from '../../apps/server/local-coordinator-store.js';
import { localJobFixture } from './local-job-fixture.js';
const [schema,account,phase]=process.argv.slice(2);
if(!/^hsk_adapter_[a-f0-9]+$/.test(schema??'')) throw Error('BAD_TEST_SCHEMA');
const pool=new Pool({connectionString:process.env.HSK_TEST_DATABASE_URL,options:`-c search_path=${schema}`});
const store=new PgLocalCoordinatorStore(new PgJobStore(pool),{chainId:'31337',account:account!,worker:'crashing-child',leaseMs:1000});
const fixture=localJobFixture(store,account!);
if(phase==='before-first-sign') {
 const transition=store.transition.bind(store);
 store.transition=async(...args)=>{await transition(...args);if(args[1]==='SIGNING') {console.log('CRASH_AFTER_DURABLE_SIGNING_BEFORE_SIGN');process.exit(71);}};
} else if(phase==='during-second-sign') {
 const sign=fixture.deps.execution.sign;
 fixture.deps.execution.sign=async(role,intent)=>{if(role==='RISK'){console.log('CRASH_DURING_SECOND_SIGN');process.exit(72);}return sign(role,intent);};
} else if(phase==='after-signed') {
 fixture.deps.execution.simulateSignedCall=async()=>{console.log('CRASH_AFTER_SIGNED');process.exit(73);};
} else if(phase==='after-unknown') {
 fixture.deps.execution.broadcastLocal=async()=>{console.log('CRASH_AFTER_UNKNOWN_SEND_RESULT_UNAVAILABLE');process.exit(74);};
}
console.log(await new LocalCoordinator(fixture.deps).run());
await pool.end();
throw Error('EXPECTED_CRASH_BOUNDARY_NOT_REACHED');
