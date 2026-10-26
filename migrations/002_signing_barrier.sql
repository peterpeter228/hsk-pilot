-- Apply atomically after 001; run while coordinator processes are stopped.
ALTER TABLE hsk_jobs DROP CONSTRAINT hsk_jobs_status_check;
ALTER TABLE hsk_jobs ADD CONSTRAINT hsk_jobs_status_check CHECK(status IN
 ('PREPARED','SIGNING','SIGNED','UNKNOWN','SUBMITTED','MINED','CONFIRMED','FAILED','REORGED','REJECTED'));
DROP INDEX hsk_one_pending_account;
CREATE UNIQUE INDEX hsk_one_pending_account ON hsk_jobs(chain_id,account)
 WHERE status IN ('PREPARED','SIGNING','SIGNED','UNKNOWN','SUBMITTED','MINED');
-- Legacy PREPARED cannot prove that no signer was called by the old coordinator.
INSERT INTO hsk_job_audit(job_id,event,detail)
 SELECT id,'MIGRATION_SIGNING_QUARANTINE','{"reason":"LEGACY_PREPARED_SIGNER_HISTORY_UNKNOWN"}'::jsonb
 FROM hsk_jobs WHERE status='PREPARED';
UPDATE hsk_jobs SET status='SIGNING',fence=fence+1,lease_owner=NULL,lease_until=NULL,
 updated_at=clock_timestamp() WHERE status='PREPARED';
