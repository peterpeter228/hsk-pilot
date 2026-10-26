import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHandoff } from '../scripts/validate-collaboration.mjs';
const sha = 'a'.repeat(40);
function fixture() {
  return {
    schema_version:'dot-grok-v3.1', status:'PREPARED', handoff_status:'NONE', sync_state:'PENDING', from:'dot', to:'GROK_DEV', project_id:'test', opportunity_id:null, round_id:null,
    repo:'owner/test', branch:'main', gate:'LOCAL_COMPLETE_EXTERNAL_BLOCKED', fixed_sha:sha,
    versions:{source_commit:sha,build_commit:null,deploy_commit:null,evidence_commit:sha,submission_frozen_commit:null},
    build_owner:'dot',watch_owner:null,state_writer:null,proposed_state_writer:'GROK_HUNTER',receiver_ack:null,
    delivery:{status:'UNSENT',endpoint:null},notion:{status:'NOT_CONFIGURED',page_id:null,last_readback:null},
    monitoring:{status:'UNSCHEDULED',routine_id:null,previous_monitor_unchanged:true},
    DONE:[],BLOCKED:[],NEXT:[],VERIFY:[],allowed_paths:[],forbidden_changes:[],test_commands:[],cost_time_constraints:{},evidence:[],exit_conditions:[],unknowns:[],user_actions:[],claims_not_made:[],next_step:'Read fixed source',
    prepared_at:'2026-10-26T11:20:00Z',expires_at:'2026-10-27T11:20:00Z',
    scores:{hunter_seven_dimension:{weights:[25,20,20,15,15,3,2],levels:Array(7).fill(null),total:null},strict_fast_cash:{qualified:null,conditions_verified:false},formal_development:{qualified:null,minimum_score:75,minimum_coverage:0.75,minimum_individual_usd:400}},
    outbox:[{event_id:'test-1',kind:'ENGINEERING_HANDOFF_PREPARED',status:'PENDING',idempotency_key:'test-1',attempts:0,recipient:'GROK_DEV',source_commit:sha}]
  };
}
test('valid PREPARED record stays offline and owned by dot',()=>assert.deepEqual(validateHandoff(fixture()),[]));
for (const [name, edit] of [
 ['missing required next_step',v=>delete v.next_step],
 ['short SHA',v=>v.fixed_sha='abcdef0'],
 ['unknown scores cannot retain old 87',v=>v.scores.hunter_seven_dimension.total=87],
 ['altered scoring weights',v=>v.scores.hunter_seven_dimension.weights=[25,25,25,25]],
 ['expiry before preparation',v=>v.expires_at='2026-10-25T11:20:00Z'],
 ['non UTC timestamp',v=>v.prepared_at='2026-10-26T19:20:00+08:00'],
 ['premature owner transfer',v=>v.build_owner='GROK_DEV'],
 ['unverified acceptance',v=>v.status='ACCEPTED'],
 ['fake Notion sync',v=>v.notion.status='SYNCED'],
 ['false sync_state OK',v=>v.sync_state='OK'],
 ['missing deploy version',v=>delete v.versions.deploy_commit],
 ['fake monitor',v=>v.monitoring.status='ACTIVE'],
 ['duplicate idempotency key',v=>v.outbox.push({...v.outbox[0],event_id:'test-2'})],
 ['duplicate event ID',v=>v.outbox.push({...v.outbox[0],idempotency_key:'test-2'})],
 ['unverified fast cash',v=>v.scores.strict_fast_cash.qualified=true],
 ['verified boolean without cash facts',v=>Object.assign(v.scores.strict_fast_cash,{qualified:true,conditions_verified:true})],
 ['missing sync_state',v=>delete v.sync_state],
 ['false offered projection',v=>v.handoff_status='OFFERED'],
 ['weakened formal threshold',v=>v.scores.formal_development.minimum_individual_usd=150],
 ['formal qualification cannot be granted by proposal',v=>v.scores.formal_development.qualified=true],
 ['sent event without evidence',v=>v.outbox[0].status='SENT'],
 ['unknown delivery status',v=>v.delivery.status='DONE'],
 ['missing versions field',v=>delete v.versions.build_commit],
 ['malformed levels fail without crashing',v=>v.scores.hunter_seven_dimension.levels={}],
]) test(name,()=>{const v=fixture();edit(v);assert.ok(validateHandoff(v).length>0)});
test('structurally complete acceptance is allowed but not authenticated by validator',()=>{
 const v=fixture();v.status='ACCEPTED';v.handoff_status='ACCEPTED';v.build_owner='GROK_DEV';v.delivery={status:'SENT',endpoint:'verified-channel-reference'};
 v.receiver_ack={from:'GROK_DEV',fixed_sha:sha,project_id:'test',repo:'owner/test',evidence_url:'https://example.invalid/test-only',readback_at:'2026-10-26T11:21:00Z',accepted_at:'2026-10-26T11:22:00Z'};
 assert.deepEqual(validateHandoff(v),[]);
});
test('malformed/null input fails without exception',()=>{assert.ok(validateHandoff(null).length);assert.ok(validateHandoff({}).length)});

test('evidenced fast cash fields are structurally valid, not independently verified',()=>{
 const v=fixture();Object.assign(v.scores.strict_fast_cash,{qualified:true,conditions_verified:true,first_payment_usd:150,official_submission_count:14,checked_at:'2026-10-26T11:20:00Z',payment_by:'2026-11-05T11:20:00Z',conditions_evidence:['official-evidence-reference']});
 assert.deepEqual(validateHandoff(v),[]);
 for (const patch of [{first_payment_usd:149},{official_submission_count:15},{official_submission_count:1.5},{payment_by:'2026-11-05T11:20:01Z'},{payment_by:'2026-10-25T11:20:00Z'},{conditions_evidence:[]}]) {const bad=structuredClone(v);Object.assign(bad.scores.strict_fast_cash,patch);assert.ok(validateHandoff(bad).length>0)}
});
test('Notion UNSYNCED and PENDING can retain unknown page',()=>{for(const status of ['UNSYNCED','PENDING']) {const v=fixture();v.notion.status=status;assert.deepEqual(validateHandoff(v),[])}});

test('Notion readback must bind project, source and current owner',()=>{
 const v=fixture();v.sync_state='OK';v.notion={status:'SYNCED',page_id:'page-test',last_readback:{checked_at:'2026-10-26T11:21:00Z',fixed_sha:sha,project_id:'test',build_owner:'dot'}};
 assert.deepEqual(validateHandoff(v),[]);
 for(const patch of [{project_id:'another-project'},{build_owner:'GROK_DEV'},{fixed_sha:'b'.repeat(40)},{checked_at:null}]) {const bad=structuredClone(v);Object.assign(bad.notion.last_readback,patch);assert.ok(validateHandoff(bad).length>0)}
});
test('outbox source reference is not mislabeled as a content digest',()=>{const v=fixture();v.outbox[0].payload_sha=sha;delete v.outbox[0].source_commit;assert.ok(validateHandoff(v).length>0)});

test('accepted acknowledgement cannot cross project/repo or violate ordering and expiry',()=>{
 const v=fixture();v.status='ACCEPTED';v.handoff_status='ACCEPTED';v.build_owner='GROK_DEV';v.delivery={status:'SENT',endpoint:'verified-channel-reference'};
 v.receiver_ack={from:'GROK_DEV',fixed_sha:sha,project_id:'test',repo:'owner/test',evidence_url:'https://example.invalid/test-only',readback_at:'2026-10-26T11:21:00Z',accepted_at:'2026-10-26T11:22:00Z'};
 for(const patch of [{project_id:'another'},{repo:'owner/another'},{accepted_at:'2026-10-26T11:20:00Z'},{accepted_at:'2026-10-28T11:22:00Z'}]) {const bad=structuredClone(v);Object.assign(bad.receiver_ack,patch);assert.ok(validateHandoff(bad).length>0)}
});
