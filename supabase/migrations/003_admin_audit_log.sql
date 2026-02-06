-- Admin audit log (version control: who did what, when)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_id ON admin_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_entity ON admin_audit_log (entity_type, entity_id);
