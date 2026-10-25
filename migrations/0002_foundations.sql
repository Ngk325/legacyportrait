-- WP1 foundations: edit token, orders/payments columns, Stripe event log, AI cost log, email log, runtime config, error log.
-- Additive only, so code that predates it keeps working.

-- Hash of the edit token (the cookie that lets only the device that started a draft change it). NULL = older draft, not locked.
ALTER TABLE portraits ADD COLUMN edit_token_hash TEXT;
ALTER TABLE portraits ADD COLUMN email TEXT;

ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';   -- pending | paid | in_review | placed | shipped | delivered | refunded
ALTER TABLE orders ADD COLUMN email TEXT;
ALTER TABLE orders ADD COLUMN options TEXT;                              -- JSON: { color, assembled }
ALTER TABLE orders ADD COLUMN shipping_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_address TEXT;                     -- JSON as Stripe returns it
ALTER TABLE orders ADD COLUMN shipping_state TEXT;                       -- US state, kept for Nick's per-state tax records
ALTER TABLE orders ADD COLUMN gift INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN gift_message TEXT;
ALTER TABLE orders ADD COLUMN livemode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN stripe_payment_intent TEXT;
ALTER TABLE orders ADD COLUMN refunded_at TEXT;
ALTER TABLE orders ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_portrait ON orders (portrait_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_portraits_status ON portraits (status, updated_at);

-- Stripe event ids already handled (webhook idempotency).
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  received_at TEXT DEFAULT (datetime('now'))
);

-- One row per AI call, for the cost dashboard and the per-portrait spend cap.
CREATE TABLE IF NOT EXISTS ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portrait_id TEXT,
  purpose TEXT,                          -- article | interview | factcheck
  provider TEXT,
  model TEXT,
  tokens_in INTEGER, tokens_out INTEGER, tokens_cached INTEGER,
  cost_usd REAL,
  ok INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_calls_portrait ON ai_calls (portrait_id);

CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT,
  template TEXT,
  portrait_id TEXT,
  order_id TEXT,
  provider_id TEXT,
  status TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Runtime switches the team flips from admin (e.g. live_mode). Env vars set the ceiling; see functions/_lib/flags.js.
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,                  -- draft | print | webhook | email | ...
  message TEXT,
  detail TEXT,
  portrait_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_errors_created ON errors (created_at);
