import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Offline structural checks only. This cannot authenticate a receiver or perform delivery.
export function validateHandoff(value) {
  const errors = [];
  const obj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = v => typeof v === 'string' && v.trim().length > 0;
  const sha = v => typeof v === 'string' && /^[a-f0-9]{40}$/.test(v);
  const utc = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v));
  const check = (ok, message) => { if (!ok) errors.push(message); };
  if (!obj(value)) return ['handoff must be an object'];
  const v = value;
  check(v.schema_version === 'dot-grok-v3.1', 'unsupported schema_version');
  check(['PREPARED', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED'].includes(v.status), 'invalid status');
  check(['NONE', 'OFFERED', 'ACCEPTED', 'BLOCKED'].includes(v.handoff_status), 'invalid handoff_status projection');
  check(['PENDING', 'OK', 'CONFLICT'].includes(v.sync_state), 'invalid sync_state');
  if (v.status === 'PREPARED') check(v.handoff_status === 'NONE', 'PREPARED must project handoff_status NONE');
  if (['OFFERED', 'ACCEPTED'].includes(v.status)) check(v.handoff_status === v.status, 'handoff_status must match actual handoff stage');
  for (const key of ['from', 'to', 'project_id', 'repo', 'branch', 'next_step', 'gate']) check(str(v[key]), `${key} must be a nonempty string`);
  for (const key of ['opportunity_id', 'round_id']) check(Object.hasOwn(v, key) && (v[key] === null || str(v[key])), `${key} must be present and null or nonempty`);
  check(sha(v.fixed_sha), 'fixed_sha must be a complete 40-character Git SHA');
  check(obj(v.versions), 'versions must be an object');
  for (const key of ['source_commit', 'build_commit', 'deploy_commit', 'evidence_commit', 'submission_frozen_commit']) check(obj(v.versions) && Object.hasOwn(v.versions, key) && (v.versions[key] === null || sha(v.versions[key])), `versions.${key} must be present and null or a full Git SHA`);
  check(utc(v.prepared_at), 'prepared_at must be UTC ISO timestamp');
  check(utc(v.expires_at), 'expires_at must be UTC ISO timestamp');
  check(utc(v.prepared_at) && utc(v.expires_at) && Date.parse(v.expires_at) > Date.parse(v.prepared_at), 'expires_at must be after prepared_at');
  for (const key of ['DONE', 'BLOCKED', 'NEXT', 'VERIFY', 'allowed_paths', 'forbidden_changes', 'test_commands', 'evidence', 'exit_conditions', 'unknowns', 'user_actions', 'claims_not_made']) check(Array.isArray(v[key]), `${key} must be an array`);
  check(obj(v.cost_time_constraints), 'cost_time_constraints must be an object');
  check(str(v.build_owner), 'build_owner must be nonempty');
  for (const key of ['watch_owner', 'state_writer', 'proposed_state_writer']) check(Object.hasOwn(v, key) && (v[key] === null || str(v[key])), `${key} must be present and null or nonempty`);
  check(obj(v.delivery) && ['UNSENT', 'SENT', 'FAILED', 'UNCERTAIN'].includes(v.delivery.status), 'invalid delivery status');
  check(obj(v.delivery) && Object.hasOwn(v.delivery, 'endpoint') && (v.delivery.endpoint === null || str(v.delivery.endpoint)), 'delivery endpoint must be present and null or nonempty');
  if (v.status === 'PREPARED') check(v.delivery?.status === 'UNSENT', 'PREPARED must remain UNSENT');
  if (['OFFERED', 'ACCEPTED'].includes(v.status)) check(v.delivery?.status === 'SENT' && str(v.delivery?.endpoint), 'OFFERED/ACCEPTED requires confirmed delivery and endpoint');
  if (v.delivery?.status === 'UNSENT') check(v.receiver_ack === null, 'UNSENT cannot have receiver acknowledgement');
  if (v.status === 'ACCEPTED') {
    const a = v.receiver_ack;
    check(obj(a) && a.from === v.to && a.fixed_sha === v.fixed_sha && a.project_id === v.project_id && a.repo === v.repo && str(a.evidence_url) && utc(a.readback_at) && utc(a.accepted_at) && Date.parse(a.readback_at) <= Date.parse(a.accepted_at) && Date.parse(a.accepted_at) <= Date.parse(v.expires_at), 'ACCEPTED requires receiver, matching project/repo/SHA, ordered readback/acceptance within expiry and evidence URL');
    check(v.build_owner === v.to, 'ACCEPTED build_owner must be receiver');
  } else {
    check(v.build_owner === v.from, 'original build_owner retained until ACCEPTED');
    check(v.receiver_ack === null, 'non-ACCEPTED status must not claim receiver acceptance');
  }
  const n = v.notion;
  check(obj(n) && ['NOT_CONFIGURED', 'PENDING', 'UNSYNCED', 'SYNCED', 'FAILED'].includes(n.status), 'invalid notion status');
  if (n?.status === 'NOT_CONFIGURED') check(n.page_id === null && n.last_readback === null, 'NOT_CONFIGURED must not claim a Notion page/readback');
  if (v.sync_state === 'OK') check(n?.status === 'SYNCED', 'sync_state OK requires Notion SYNCED');
  if (n?.status === 'SYNCED') check(str(n.page_id) && obj(n.last_readback) && utc(n.last_readback.checked_at) && n.last_readback.fixed_sha === v.fixed_sha && n.last_readback.project_id === v.project_id && n.last_readback.build_owner === v.build_owner, 'SYNCED requires page ID and timestamped matching project, SHA and owner readback');
  const m = v.monitoring;
  check(obj(m) && ['UNSCHEDULED', 'ACTIVE', 'PAUSED'].includes(m.status), 'invalid monitoring status');
  if (m?.status === 'UNSCHEDULED') check(m.routine_id === null, 'UNSCHEDULED must not claim a routine');
  if (m?.status === 'ACTIVE') check(str(m.routine_id) && str(v.watch_owner) && str(m.verification_evidence), 'ACTIVE monitoring requires routine, owner and verification evidence');
  check(typeof m?.previous_monitor_unchanged === 'boolean', 'monitoring.previous_monitor_unchanged must be boolean');
  const s = v.scores;
  const h = s?.hunter_seven_dimension;
  check(obj(h) && JSON.stringify(h.weights) === '[25,20,20,15,15,3,2]', 'Hunter seven-dimensional weights must remain 25/20/20/15/15/3/2');
  check(Array.isArray(h?.levels) && h.levels.length === 7 && h.levels.every(x => x === null || Number.isFinite(x)), 'Hunter levels must contain seven numeric or null values');
  if (Array.isArray(h?.levels) && h.levels.some(x => x === null)) check(h.total === null, 'unknown Hunter level requires total=null');
  check(h?.total === null || (Number.isFinite(h?.total) && h.total >= 0 && h.total <= 100), 'Hunter total must be null or 0–100, never a success probability');
  const fast = s?.strict_fast_cash;
  check(obj(fast) && [null, true, false].includes(fast.qualified) && typeof fast.conditions_verified === 'boolean', 'invalid strict_fast_cash state');
  if (fast?.qualified === true) {
    check(fast.conditions_verified === true, 'fast_cash qualification requires all conditions verified');
    check(Number.isFinite(fast.first_payment_usd) && fast.first_payment_usd >= 150, 'fast_cash requires individual first payment >=150 USD equivalent');
    check(Number.isInteger(fast.official_submission_count) && fast.official_submission_count >= 0 && fast.official_submission_count < 15, 'fast_cash requires official submission count <15');
    check(utc(fast.checked_at) && utc(fast.payment_by) && Date.parse(fast.payment_by) >= Date.parse(fast.checked_at) && Date.parse(fast.payment_by) - Date.parse(fast.checked_at) <= 10 * 24 * 60 * 60 * 1000, 'fast_cash requires evidenced payment within ten days from checked_at');
    check(Array.isArray(fast.conditions_evidence) && fast.conditions_evidence.length > 0, 'fast_cash requires conditions evidence');
  }
  const formal = s?.formal_development;
  check(obj(formal) && [null, false].includes(formal.qualified) && formal.minimum_score === 75 && formal.minimum_coverage === 0.75 && formal.minimum_individual_usd === 400, 'formal development gates must retain 75/75%/$400; qualified=true requires canonical reviewed evaluation outside this offline proposal validator');
  check(Array.isArray(v.outbox), 'outbox must be an array');
  const keys = new Set(), ids = new Set();
  for (const [i, e] of (Array.isArray(v.outbox) ? v.outbox : []).entries()) {
    check(obj(e), `outbox[${i}] must be an object`);
    if (!obj(e)) continue;
    check(str(e.event_id) && !ids.has(e.event_id), `outbox[${i}] missing/duplicate event_id`); ids.add(e.event_id);
    check(str(e.idempotency_key) && !keys.has(e.idempotency_key), `outbox[${i}] missing/duplicate idempotency_key`); keys.add(e.idempotency_key);
    check(e.kind === 'ENGINEERING_HANDOFF_PREPARED', `outbox[${i}] invalid event kind`);
    check(['PENDING', 'SENT', 'FAILED', 'UNCERTAIN'].includes(e.status), `outbox[${i}] invalid status`);
    check(Number.isInteger(e.attempts) && e.attempts >= 0, `outbox[${i}] invalid attempts`);
    check(e.recipient === v.to && e.source_commit === v.fixed_sha, `outbox[${i}] recipient/SHA mismatch`);
    if (e.status === 'SENT') check(str(e.delivery_evidence), `outbox[${i}] SENT requires evidence`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const file = process.argv[2] ?? 'coordination/handoff.json';
    const errors = validateHandoff(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('PASS: handoff structure is internally consistent; no delivery, acceptance or sync has been verified by this offline check.');
  } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
