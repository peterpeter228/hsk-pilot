-- Apply with a dedicated service role and isolated schema/search_path, never public client credentials.
-- Transactional migration; bookkeeping belongs to deployment runner.
CREATE TABLE hsk_job_accounts (
 chain_id text NOT NULL CHECK (chain_id ~ '^[1-9][0-9]*$'),
 account text NOT NULL CHECK (account ~ '^0x[0-9a-f]{40}$'),
 quarantined boolean NOT NULL DEFAULT false,
 quarantine_reason text,
 PRIMARY KEY(chain_id, account)
);
CREATE TABLE hsk_jobs (
 id uuid PRIMARY KEY,
 chain_id text NOT NULL,
 account text NOT NULL,
 session_id text NOT NULL CHECK (session_id ~ '^(0|[1-9][0-9]*)$'),
 nonce text NOT NULL CHECK (nonce ~ '^(0|[1-9][0-9]*)$'),
 intent_hash text NOT NULL CHECK (intent_hash ~ '^0x[0-9a-f]{64}$'),
 payload jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('PREPARED','UNKNOWN','SUBMITTED','MINED','CONFIRMED','FAILED','REORGED')),
 fence bigint NOT NULL DEFAULT 0,
 lease_owner text,
 lease_until timestamptz,
 reversal_required boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(chain_id,account) REFERENCES hsk_job_accounts(chain_id,account),
 UNIQUE(chain_id,account,session_id,nonce),
 UNIQUE(chain_id,intent_hash),
 UNIQUE(chain_id,id)
);
CREATE UNIQUE INDEX hsk_one_pending_account ON hsk_jobs(chain_id,account)
 WHERE status IN ('PREPARED','UNKNOWN','SUBMITTED','MINED');
CREATE TABLE hsk_job_transactions (
 chain_id text NOT NULL,
 tx_hash text NOT NULL CHECK(tx_hash ~ '^0x[0-9a-f]{64}$'),
 job_id uuid NOT NULL,
 sender text NOT NULL CHECK(sender ~ '^0x[0-9a-f]{40}$'),
 tx_nonce text NOT NULL CHECK(tx_nonce ~ '^(0|[1-9][0-9]*)$'),
 replaces_hash text,
 block_number text CHECK(block_number ~ '^(0|[1-9][0-9]*)$'),
 block_hash text CHECK(block_hash ~ '^0x[0-9a-f]{64}$'),
 receipt_success boolean,
 canonical boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(chain_id,tx_hash),
 FOREIGN KEY(chain_id,job_id) REFERENCES hsk_jobs(chain_id,id),
 FOREIGN KEY(chain_id,replaces_hash) REFERENCES hsk_job_transactions(chain_id,tx_hash),
 CHECK(replaces_hash IS NULL OR replaces_hash <> tx_hash),
 CHECK((block_hash IS NULL AND block_number IS NULL AND receipt_success IS NULL) OR
       (block_hash IS NOT NULL AND block_number IS NOT NULL AND receipt_success IS NOT NULL))
);
CREATE UNIQUE INDEX hsk_one_canonical_receipt ON hsk_job_transactions(job_id) WHERE canonical;
CREATE TABLE hsk_job_audit (
 id bigserial PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES hsk_jobs(id),
 event text NOT NULL,
 detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION hsk_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit is append only'; END $$;
CREATE TRIGGER hsk_audit_immutable BEFORE UPDATE OR DELETE ON hsk_job_audit
 FOR EACH ROW EXECUTE FUNCTION hsk_audit_append_only();
CREATE TRIGGER hsk_audit_no_truncate BEFORE TRUNCATE ON hsk_job_audit
 FOR EACH STATEMENT EXECUTE FUNCTION hsk_audit_append_only();
