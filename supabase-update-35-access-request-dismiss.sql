-- Admin can dismiss access requests from the queue (soft hide) without deleting history.

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_access_requests_active
  ON access_requests (created_at DESC)
  WHERE dismissed_at IS NULL;
