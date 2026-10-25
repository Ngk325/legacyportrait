-- Saved drafts and follow-up emails: one customer row per email address, and an unsubscribe flag.
ALTER TABLE customers ADD COLUMN unsubscribed_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers (email);
CREATE INDEX IF NOT EXISTS idx_email_log_portrait ON email_log (portrait_id, template);
